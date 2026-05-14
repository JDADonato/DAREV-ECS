<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Ported from: server/controllers/opsController.js
 * Operations/Marketing dashboard — booking management and live status tracking.
 */
class OpsController extends Controller
{
    /**
     * Show the Ops dashboard page.
     */
    public function index()
    {
        return Inertia::render('Ops/DashboardOps');
    }

    /**
     * Get all bookings with user details.
     * Ported from: opsController.getAllBookings()
     */
    public function getAllBookings()
    {
        $bookings = Booking::with('user:id,username,role')
            ->orderBy('event_date', 'asc')
            ->get()
            ->map(function ($b) {
                $data = $b->toArray();
                $data['username'] = $b->user->username ?? null;
                $data['role'] = $b->user->role ?? null;
                return $data;
            });

        return response()->json($bookings);
    }

    /**
     * Update booking status.
     * Ported from: opsController.updateBookingStatus()
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
     * Ported from: opsController.updateBookingLiveStatus()
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
     * Ported from: opsController.getBookingDetails()
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
