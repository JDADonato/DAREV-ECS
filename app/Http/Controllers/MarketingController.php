<?php

namespace App\Http\Controllers;

use App\Http\Resources\BookingSummaryResource;
use App\Models\Booking;
use App\Models\BookingReviewTask;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Marketing dashboard - booking management and live status tracking.
 */
class MarketingController extends Controller
{
    /**
     * Show the Marketing dashboard page.
     */
    public function index()
    {
        return Inertia::render('DashboardMarketing', [
            // Phase 2: Inertia.js Payload Optimization
            // Lazy Evaluation: Only queries the database if the 'bookings' prop is explicitly requested via partial reloads.
            'bookings' => Inertia::lazy(function () {
                return Booking::with('user:id,full_name,username,role')
                    ->orderBy('event_date', 'asc')
                    ->get();
            })
        ]);
    }

    /**
     * Get all bookings with user details.
     * Ported from: marketing bookings list
     */
    public function getAllBookings(Request $request)
    {
        $query = Booking::with(['user:id,full_name,username,email,phone,role', 'assignee:id,full_name,username', 'reviewTasks'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('search'), function ($q, $search) {
                $term = '%' . trim((string) $search) . '%';
                $q->where(fn ($inner) => $inner
                    ->where('client_full_name', 'like', $term)
                    ->orWhere('event_name', 'like', $term)
                    ->orWhere('venue_city', 'like', $term)
                    ->orWhere('event_type', 'like', $term));
            })
            ->orderBy('event_date', 'asc');

        if ($request->boolean('paginated')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
            $bookings = $query->paginate($perPage);

            return ApiResponse::paginated($bookings, BookingSummaryResource::collection($bookings->getCollection())->resolve());
        }

        $bookings = BookingSummaryResource::collection($query->get())->resolve();

        return response()->json($bookings);
    }

    /**
     * Update booking status.
     * Ported from: marketing booking status update
     */
    public function updateStatus(Request $request, int $id)
    {
        $request->validate([
            'status' => 'required|in:Pending,Confirmed,Cancelled,Completed',
        ]);

        $booking = Booking::find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $reviewStatus = match ($request->status) {
            'Confirmed' => 'Approved For Reservation',
            'Cancelled' => 'Not Available',
            'Completed' => 'Completed',
            default => $booking->review_status ?: 'Submitted',
        };

        $booking->update([
            'status' => $request->status,
            'review_status' => $reviewStatus,
            'assigned_to' => $booking->assigned_to ?: Auth::id(),
            'reviewed_at' => in_array($request->status, ['Confirmed', 'Cancelled', 'Completed'], true) ? now() : $booking->reviewed_at,
        ]);

        // ─── Send notification to the client ───
        try {
            $client = \App\Models\User::find($booking->user_id);
            if ($client && in_array($request->status, ['Confirmed', 'Cancelled', 'Completed'])) {
                $client->notify(new \App\Notifications\BookingStatusNotification($booking, $request->status));
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Notification failed on status update: {$e->getMessage()}");
        }

        return response()->json([
            'success' => true,
            'message' => 'Booking status updated',
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'reviewTasks'])),
        ]);
    }

    public function assign(Request $request, int $id)
    {
        $booking = Booking::find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $booking->update([
            'assigned_to' => Auth::id(),
            'review_status' => $booking->review_status === 'Submitted' ? 'Under Review' : ($booking->review_status ?: 'Under Review'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Booking assigned.',
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'reviewTasks'])),
        ]);
    }

    public function updateReviewStatus(Request $request, int $id)
    {
        $data = $request->validate([
            'review_status' => 'required|in:Submitted,Under Review,Needs Customer Details,Clarification Received,Approved For Reservation,Not Available,Completed',
        ]);

        $booking = Booking::find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $booking->update([
            'review_status' => $data['review_status'],
            'assigned_to' => $booking->assigned_to ?: Auth::id(),
            'reviewed_at' => in_array($data['review_status'], ['Approved For Reservation', 'Not Available', 'Completed'], true) ? now() : $booking->reviewed_at,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Review status updated.',
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'reviewTasks'])),
        ]);
    }

    public function requestClarification(Request $request, int $id)
    {
        $data = $request->validate([
            'message' => 'required|string|min:5|max:3000',
        ]);

        $booking = Booking::find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $booking->update([
            'review_status' => 'Needs Customer Details',
            'assigned_to' => $booking->assigned_to ?: Auth::id(),
            'clarification_request' => $data['message'],
            'clarification_response' => null,
            'clarification_requested_at' => now(),
            'clarification_responded_at' => null,
        ]);

        BookingReviewTask::create([
            'booking_id' => $booking->id,
            'task_type' => 'clarification',
            'label' => $data['message'],
            'status' => 'Needs Customer',
            'assigned_to' => Auth::id(),
            'customer_visible' => DB::raw('true'),
        ]);

        try {
            $booking->user?->notify(new \App\Notifications\BookingStatusNotification($booking, 'Needs Customer Details'));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Clarification notification failed.', [
                'booking_id' => $booking->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Details requested from customer.',
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'reviewTasks'])),
        ]);
    }

    public function updateReviewTask(Request $request, int $bookingId, int $taskId)
    {
        $data = $request->validate([
            'status' => 'required|in:Pending,Done,Needs Customer,Customer Responded',
        ]);

        $task = BookingReviewTask::where('booking_id', $bookingId)->find($taskId);

        if (!$task) {
            return response()->json(['error' => 'Review task not found'], 404);
        }

        $task->update([
            'status' => $data['status'],
            'completed_by' => $data['status'] === 'Done' ? Auth::id() : null,
            'completed_at' => $data['status'] === 'Done' ? now() : null,
        ]);

        $booking = Booking::with(['user', 'assignee', 'reviewTasks'])->find($bookingId);

        return response()->json([
            'success' => true,
            'message' => 'Review checklist updated.',
            'booking' => new BookingSummaryResource($booking),
        ]);
    }

    /**
     * Update booking live status (real-time tracking).
     * Ported from: marketing booking live status update
     */
    public function updateLiveStatus(Request $request, int $id)
    {
        $validStatuses = ['Not Started', 'On the Way', 'Preparing', 'Serving', 'Completed'];

        $request->validate([
            'live_status' => 'required|in:' . implode(',', $validStatuses),
        ]);

        $booking = Booking::find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $booking->update(['live_status' => $request->live_status]);

        return response()->json(['success' => true, 'message' => 'Live status updated']);
    }

    /**
     * Get detailed booking info.
     * Ported from: marketing booking details
     */
    public function show(int $id)
    {
        $booking = Booking::with(['user:id,full_name,username,email,phone,role', 'assignee:id,full_name,username', 'reviewTasks'])->find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $data = $booking->toArray();
        $data['username'] = $booking->user->username ?? null;
        $data['role'] = $booking->user->role ?? null;

        return response()->json($data);
    }
}
