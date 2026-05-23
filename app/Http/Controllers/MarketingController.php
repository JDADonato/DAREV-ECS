<?php

namespace App\Http\Controllers;

use App\Http\Resources\BookingSummaryResource;
use App\Models\Booking;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
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
                return Booking::with('user:id,username,role')
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
        $query = Booking::with('user:id,username,email,phone,role')
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('search'), function ($q, $search) {
                $term = '%' . trim((string) $search) . '%';
                $q->where(fn ($inner) => $inner
                    ->where('client_full_name', 'like', $term)
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

        $booking->update(['status' => $request->status]);

        // ─── Send notification to the client ───
        try {
            $client = \App\Models\User::find($booking->user_id);
            if ($client && in_array($request->status, ['Confirmed', 'Cancelled', 'Completed'])) {
                $client->notify(new \App\Notifications\BookingStatusNotification($booking, $request->status));
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Notification failed on status update: {$e->getMessage()}");
        }

        return response()->json(['success' => true, 'message' => 'Booking status updated']);
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
        $booking = Booking::with('user:id,username,role')->find($id);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $data = $booking->toArray();
        $data['username'] = $booking->user->username ?? null;
        $data['role'] = $booking->user->role ?? null;

        return response()->json($data);
    }
}
