<?php

namespace App\Http\Controllers;

use App\Http\Resources\BookingSummaryResource;
use App\Models\Booking;
use App\Models\BookingReviewTask;
use App\Models\User;
use App\Services\EventPreparationService;
use App\Services\PostEventLifecycleService;
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
        $query = Booking::with(['user:id,full_name,username,email,phone,role', 'assignee:id,full_name,username', 'transferRequestedTo:id,full_name,username', 'transferRequestedBy:id,full_name,username', 'reviewTasks', 'preparationTasks', 'historyNotes:id,booking_id,user_id,body,created_at'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('date_from'), fn ($q, $date) => $q->whereDate('event_date', '>=', $date))
            ->when($request->query('date_to'), fn ($q, $date) => $q->whereDate('event_date', '<=', $date))
            ->when($request->query('search'), function ($q, $search) {
                $term = '%' . trim((string) $search) . '%';
                $q->where(fn ($inner) => $inner
                    ->where('client_full_name', 'like', $term)
                    ->orWhere('event_name', 'like', $term)
                    ->orWhere('venue_city', 'like', $term)
                    ->orWhere('event_type', 'like', $term));
            });

        match ($request->query('sort', 'eventDateSoonest')) {
            'eventDateLatest' => $query->orderBy('event_date', 'desc'),
            'bookingNewest' => $query->orderBy('created_at', 'desc'),
            'bookingOldest' => $query->orderBy('created_at', 'asc'),
            'clientAZ' => $query->orderBy('client_full_name', 'asc'),
            'clientZA' => $query->orderBy('client_full_name', 'desc'),
            default => $query->orderBy('event_date', 'asc'),
        };

        if ($request->boolean('paginated')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
            $bookings = $query->paginate($perPage);

            return ApiResponse::paginated($bookings, BookingSummaryResource::collection($bookings->getCollection())->resolve());
        }

        $bookings = BookingSummaryResource::collection($query->get())->resolve();

        return response()->json($bookings);
    }

    public function summary()
    {
        $reviewStatuses = ['Submitted', 'Under Review', 'Needs Customer Details', 'Clarification Received'];
        $pendingQuery = Booking::query()
            ->whereNotIn('status', ['Completed', 'completed', 'Cancelled', 'cancelled'])
            ->where(fn ($query) => $query->where('status', 'Pending')->orWhereIn('review_status', $reviewStatuses));
        $needsDetailsQuery = Booking::query()
            ->whereNotIn('status', ['Completed', 'completed', 'Cancelled', 'cancelled'])
            ->where(fn ($query) => $query->where('review_status', 'Needs Customer Details')->orWhereNotNull('clarification_request'));
        $upcomingQuery = Booking::query()
            ->whereNotNull('event_date')
            ->where('status', 'Confirmed');
        $thisMonthQuery = (clone $upcomingQuery)
            ->whereBetween('event_date', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()]);
        $urgentQuery = (clone $pendingQuery)
            ->whereNotNull('event_date')
            ->whereBetween('event_date', [now()->toDateString(), now()->addDays(7)->toDateString()]);

        return response()->json([
            'pending' => (clone $pendingQuery)->count(),
            'needs_details' => (clone $needsDetailsQuery)->count(),
            'upcoming' => (clone $upcomingQuery)->count(),
            'this_month' => (clone $thisMonthQuery)->count(),
            'urgent' => (clone $urgentQuery)->count(),
            'pipeline' => (float) (clone $pendingQuery)->sum(DB::raw('COALESCE(total_cost, budget, 0)')),
        ]);
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

        if ($guard = $this->ensureCanMutateBooking($booking)) {
            return $guard;
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

        if ($request->status === 'Confirmed') {
            EventPreparationService::ensureDefaultTasks($booking->fresh());
        }

        if ($request->status === 'Completed') {
            EventPreparationService::ensureFeedbackRequest($booking->fresh());
            PostEventLifecycleService::refresh($booking->fresh());
        }

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
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
        ]);
    }

    public function assign(Request $request, int $id)
    {
        return $this->claim($request, $id);
    }

    public function claim(Request $request, int $id)
    {
        $booking = Booking::find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        if (!in_array(Auth::user()->role, ['Marketing', 'Admin'], true)) {
            return response()->json(['error' => 'Only Marketing or Admin can claim bookings.'], 403);
        }

        $updated = Booking::where('id', $booking->id)
            ->whereNull('assigned_to')
            ->update([
                'assigned_to' => Auth::id(),
                'transfer_requested_to' => null,
                'transfer_requested_by' => null,
                'transfer_requested_at' => null,
                'review_status' => $booking->review_status === 'Submitted' ? 'Under Review' : ($booking->review_status ?: 'Under Review'),
            ]);

        if (!$updated) {
            $booking->refresh()->load('assignee:id,full_name,username');

            if ((int) $booking->assigned_to === (int) Auth::id()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Booking is already assigned to you.',
                    'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'transferRequestedTo', 'transferRequestedBy', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
                ]);
            }

            return response()->json([
                'error' => 'This booking was already claimed by ' . ($booking->assignee?->full_name ?: ($booking->assignee->username ?? 'another staff member')) . '.',
                'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'transferRequestedTo', 'transferRequestedBy', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
            ], 409);
        }

        return response()->json([
            'success' => true,
            'message' => 'Booking claimed.',
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'transferRequestedTo', 'transferRequestedBy', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
        ]);
    }

    public function transfer(Request $request, int $id)
    {
        $data = $request->validate([
            'new_staff_id' => 'required|exists:users,id',
        ]);

        $booking = Booking::find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $user = Auth::user();
        if ($user->role !== 'Admin' && (int) $booking->assigned_to !== (int) $user->id) {
            return response()->json(['error' => 'Only the booking owner or an admin can transfer this booking.'], 403);
        }

        $newOwner = User::find($data['new_staff_id']);
        if ($newOwner->role !== 'Marketing') {
            return response()->json(['error' => 'Bookings can only be transferred to Marketing staff.'], 422);
        }

        if ((int) $booking->assigned_to === (int) $newOwner->id) {
            return response()->json(['error' => 'This staff member already owns the booking.'], 422);
        }

        $booking->update([
            'transfer_requested_to' => $newOwner->id,
            'transfer_requested_by' => $user->id,
            'transfer_requested_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Transfer request sent. The new staff member must accept it before ownership changes.',
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'transferRequestedTo', 'transferRequestedBy', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
        ]);
    }

    public function acceptTransfer(Request $request, int $id)
    {
        $booking = Booking::find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $user = Auth::user();
        if ($user->role !== 'Marketing' || (int) $booking->transfer_requested_to !== (int) $user->id) {
            return response()->json(['error' => 'Only the requested Marketing staff member can accept this transfer.'], 403);
        }

        $booking->update([
            'assigned_to' => $user->id,
            'transfer_requested_to' => null,
            'transfer_requested_by' => null,
            'transfer_requested_at' => null,
            'review_status' => $booking->review_status === 'Submitted' ? 'Under Review' : ($booking->review_status ?: 'Under Review'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Booking transfer accepted.',
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'transferRequestedTo', 'transferRequestedBy', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
        ]);
    }

    public function declineTransfer(Request $request, int $id)
    {
        $booking = Booking::find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $user = Auth::user();
        $isRequestedStaff = $user->role === 'Marketing' && (int) $booking->transfer_requested_to === (int) $user->id;
        $isOwnerOrAdmin = $user->role === 'Admin' || (int) $booking->assigned_to === (int) $user->id;

        if (!$isRequestedStaff && !$isOwnerOrAdmin) {
            return response()->json(['error' => 'Only the requested staff member, owner, or admin can decline this transfer.'], 403);
        }

        $booking->update([
            'transfer_requested_to' => null,
            'transfer_requested_by' => null,
            'transfer_requested_at' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Booking transfer declined.',
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'transferRequestedTo', 'transferRequestedBy', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
        ]);
    }

    public function release(Request $request, int $id)
    {
        $booking = Booking::find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $user = Auth::user();
        if ($user->role !== 'Admin' && (int) $booking->assigned_to !== (int) $user->id) {
            return response()->json(['error' => 'Only the booking owner or an admin can release this booking.'], 403);
        }

        if (in_array($booking->status, ['Completed'], true) || in_array($booking->review_status, ['Completed'], true)) {
            return response()->json(['error' => 'Completed booking work cannot be released. Transfer it instead.'], 422);
        }

        $booking->update([
            'assigned_to' => null,
            'transfer_requested_to' => null,
            'transfer_requested_by' => null,
            'transfer_requested_at' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Booking returned to the unassigned queue.',
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'transferRequestedTo', 'transferRequestedBy', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
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

        if ($guard = $this->ensureCanMutateBooking($booking)) {
            return $guard;
        }

        $booking->update([
            'review_status' => $data['review_status'],
            'assigned_to' => $booking->assigned_to ?: Auth::id(),
            'reviewed_at' => in_array($data['review_status'], ['Approved For Reservation', 'Not Available', 'Completed'], true) ? now() : $booking->reviewed_at,
        ]);

        if ($data['review_status'] === 'Approved For Reservation') {
            EventPreparationService::ensureDefaultTasks($booking->fresh());
        }

        if ($data['review_status'] === 'Completed') {
            EventPreparationService::ensureFeedbackRequest($booking->fresh());
            PostEventLifecycleService::refresh($booking->fresh());
        }

        return response()->json([
            'success' => true,
            'message' => 'Review status updated.',
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
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

        if ($guard = $this->ensureCanMutateBooking($booking)) {
            return $guard;
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
            'customer_visible' => true,
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
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
        ]);
    }

    public function updateReviewTask(Request $request, int $bookingId, int $taskId)
    {
        $data = $request->validate([
            'status' => 'required|in:Pending,Done,Needs Customer,Customer Responded',
        ]);

        $booking = Booking::find($bookingId);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        if ($guard = $this->ensureCanMutateBooking($booking)) {
            return $guard;
        }

        $task = BookingReviewTask::where('booking_id', $bookingId)->find($taskId);

        if (!$task) {
            return response()->json(['error' => 'Review task not found'], 404);
        }

        $task->update([
            'status' => $data['status'],
            'completed_by' => $data['status'] === 'Done' ? Auth::id() : null,
            'completed_at' => $data['status'] === 'Done' ? now() : null,
        ]);

        $booking = Booking::with(['user', 'assignee', 'reviewTasks', 'preparationTasks', 'historyNotes'])->find($bookingId);

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

        if ($guard = $this->ensureCanMutateBooking($booking)) {
            return $guard;
        }

        $booking->update(['live_status' => $request->live_status]);

        return response()->json([
            'success' => true,
            'message' => 'Live status updated',
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
        ]);
    }

    /**
     * Get detailed booking info.
     * Ported from: marketing booking details
     */
    public function show(int $id)
    {
        $booking = Booking::with(['user:id,full_name,username,email,phone,role', 'assignee:id,full_name,username', 'transferRequestedTo:id,full_name,username', 'transferRequestedBy:id,full_name,username', 'reviewTasks', 'preparationTasks', 'historyNotes:id,booking_id,user_id,body,created_at'])->find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $data = $booking->toArray();
        $data['username'] = $booking->user->username ?? null;
        $data['role'] = $booking->user->role ?? null;
        $summary = (new BookingSummaryResource($booking))->resolve();
        $data = array_merge($data, $summary);

        return response()->json($data);
    }

    private function ensureCanMutateBooking(Booking $booking)
    {
        $user = Auth::user();
        $booking->refresh();

        if (!$user || !in_array($user->role, ['Marketing', 'Admin'], true)) {
            return response()->json(['error' => 'Only Marketing or Admin can update bookings.'], 403);
        }

        if ($user->role === 'Admin') {
            return null;
        }

        if ((int) $booking->assigned_to === (int) $user->id) {
            return null;
        }

        if (is_null($booking->assigned_to)) {
            return response()->json([
                'error' => 'Claim this booking before making changes.',
                'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
            ], 403);
        }

        $booking->loadMissing('assignee:id,full_name,username');
        $ownerName = $booking->assignee?->full_name ?: ($booking->assignee->username ?? 'another staff member');

        return response()->json([
            'error' => "This booking is owned by {$ownerName}. Ask the owner or an admin to transfer it before making changes.",
            'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'reviewTasks', 'preparationTasks', 'historyNotes'])),
        ], 403);
    }
}
