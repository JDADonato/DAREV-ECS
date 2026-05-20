<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\MenuItem;
use App\Models\Payment;
use App\Models\User;
use App\Mail\BookingContinuationReminder;
use App\Notifications\NewBookingNotification;
use App\Services\BookingValidationService;
use App\Services\BusinessRulesService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;

/**
 * Ported from: server/controllers/bookingController.js
 * Handles booking CRUD, availability checks, and payment recording.
 */
class BookingController extends Controller
{
    /**
     * Create a new booking.
     * Ported from: bookingController.createBooking()
     *
     * Business rules enforced:
     * - MAX_EVENTS_PER_DAY = 10
     * - MAX_PAX_PER_DAY = 3500
     * - Auto-generates 3-tier payment schedule (10% / 70% / 20%)
     */
    public function store(Request $request)
    {
        $request->validate([
            'user_id'     => 'required|exists:users,id',
            'event_date'  => 'required|date',
            'event_time'  => 'required|string',
            'pax'         => 'required|integer|min:1',
            'budget'      => 'nullable|numeric',
            'package_id'  => 'nullable|string',
            'event_type'  => 'nullable|string',
            'menu_items'  => 'nullable|array',
            'total_cost'  => 'nullable|numeric',
        ]);

        // ─── Apply Business Rule Validation ───
        // Validates: lead time, capacity per day, pax limits
        try {
            BookingValidationService::validateBookingConstraints([
                'event_date' => $request->event_date,
                'pax' => $request->pax,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error("Booking validation error: {$e->getMessage()}");
            return response()->json(['error' => $e->getMessage()], 500);
        }

        // ─── Verify Price Accuracy ───
        // Prevents client-side price manipulation
        if ($request->has('menu_items') && $request->has('total_cost')) {
            try {
                $isAccurate = BookingValidationService::verifyCostAccuracy(
                    (float) $request->total_cost,
                    $request->menu_items,
                    (int) $request->pax
                );

                if (!$isAccurate) {
                    Log::warning("Potential price manipulation detected for user {$request->user_id}");
                    return response()->json([
                        'error' => 'Price calculation mismatch. Please refresh and try again.',
                        'recalculated_total' => BookingValidationService::calculateTotalCost(
                            $request->menu_items,
                            (int) $request->pax
                        )
                    ], 422);
                }
            } catch (\Exception $e) {
                Log::error("Price verification failed: {$e->getMessage()}");
                return response()->json(['error' => 'Unable to verify pricing'], 500);
            }
        }

        $eventDate = $request->event_date;
        $pax = (int) $request->pax;

        // 1. Stringify arrays if present
        $outsourcedServices = $request->outsourced_services;
        if (is_array($outsourcedServices)) {
            $outsourcedServices = json_encode($outsourcedServices);
        }

        $selectedMenu = $request->selected_menu;
        if (is_array($selectedMenu)) {
            $selectedMenu = json_encode($selectedMenu);
        }

        // 4. Insert Booking
        $booking = Booking::create([
            'user_id'              => $request->user_id,
            'event_date'           => $eventDate,
            'event_time'           => $request->event_time,
            'pax'                  => $pax,
            'budget'               => $request->budget,
            'package_id'           => $request->package_id,
            'event_type'           => $request->event_type,
            'client_full_name'     => $request->client_full_name,
            'venue_address_line'   => $request->venue_address_line,
            'venue_street'         => $request->venue_street,
            'venue_city'           => $request->venue_city,
            'venue_province'       => $request->venue_province,
            'venue_zip_code'       => $request->venue_zip_code,
            'client_email'         => $request->client_email,
            'client_phone'         => $request->client_phone,
            'total_cost'           => $request->total_cost ?? $request->budget,
            'outsourced_services'  => $outsourcedServices,
            'selected_menu'        => $selectedMenu,
            'venue_building_details' => $request->venue_building_details,
            'transport_fee'        => $request->transport_fee ?? 0,
            'labor_surcharge'      => $request->labor_surcharge ?? 0,
            'expires_at'           => now()->addHours(24), // Phase 1: Slot Expiration
        ]);

        // 5. Auto-generate dynamic payment schedule using PaymentCalculationService
        $cost = (float) ($request->total_cost ?? $request->budget ?? 0);

        if ($cost > 0) {
            try {
                $paymentService = new \App\Services\PaymentCalculationService();
                $tranches = $paymentService->calculateTranches($booking);

                foreach ($tranches as $tranche) {
                    Payment::create([
                        'booking_id'     => $booking->id,
                        'amount'         => $tranche['amount'],
                        'payment_method' => 'Pending',
                        'status'         => 'Pending',
                        'payment_type'   => $tranche['name'],
                        'due_date'       => Carbon::parse($tranche['due_date'])->toDateString(),
                    ]);
                }

                Log::info("Created dynamic payment schedule for booking #{$booking->id}");
            } catch (\Exception $e) {
                Log::error("Payment schedule creation failed (booking still created): {$e->getMessage()}");
            }
        }

        // ─── Send Notifications ───
        try {
            // Notify admins/marketing of new booking
            $admins = User::whereIn('role', ['Admin', 'Marketing'])->get();
            Notification::send($admins, new NewBookingNotification($booking));
        } catch (\Exception $e) {
            Log::error("Notification sending failed: {$e->getMessage()}");
            // Don't fail the booking if notifications fail
        }

        return response()->json([
            'message'   => 'Booking created successfully!',
            'bookingId' => $booking->id,
        ], 201);
    }

    /**
     * Send a gentle continuation email when a logged-in client leaves a meaningful booking draft.
     */
    public function sendAbandonedReminder(Request $request)
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $data = $request->validate([
            'step' => 'required|integer|min:2|max:6',
            'event_date' => 'nullable|date',
            'event_time' => 'nullable|string|max:20',
            'event_type' => 'nullable|string|max:120',
            'pax' => 'nullable|integer|min:1|max:5000',
            'client_email' => 'nullable|email|max:255',
            'client_full_name' => 'nullable|string|max:255',
            'total_cost' => 'nullable|numeric|min:0',
        ]);

        $email = $data['client_email'] ?? $user->email;
        if (!$email) {
            return response()->json(['message' => 'No customer email available.'], 202);
        }

        $draftSignature = sha1(implode('|', [
            $user->id,
            $data['step'],
            $data['event_date'] ?? '',
            $data['event_type'] ?? '',
            $data['pax'] ?? '',
        ]));
        $cacheKey = "booking.abandoned_reminder.{$draftSignature}";

        if (Cache::has($cacheKey)) {
            return response()->json(['message' => 'Reminder already sent for this draft.']);
        }

        try {
            Mail::to($email)->send(new BookingContinuationReminder($user, $data));
            Cache::put($cacheKey, true, now()->addHours(6));
        } catch (\Throwable $e) {
            Log::warning('Booking continuation reminder failed.', [
                'user_id' => $user->id,
                'email' => $email,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Reminder could not be sent right now.'], 202);
        }

        return response()->json(['message' => 'Continuation reminder sent.']);
    }

    /**
     * GET /api/bookings/disabled-dates
     *
     * Returns an array of all fully-booked dates (YYYY-MM-DD) within the next
     * 12 months so the React calendar can disable them on initial render.
     * Also includes dates within the 7-day lead-time window.
     */
    public function getDisabledDates()
    {
        $rules   = \App\Models\BusinessRule::getActive();
        $maxEvents = $rules ? $rules->maximum_capacity_per_day : BusinessRulesService::MAX_EVENTS_PER_DAY;
        $maxPax    = BusinessRulesService::MAX_PAX_PER_DAY;

        // Lead-time window: today through today + 6 days are always blocked
        $today     = Carbon::today();
        $rangeEnd  = Carbon::today()->addMonths(12);

        $disabledDates = [];

        // Add lead-time blocked dates (0-6 days from today)
        for ($i = 0; $i < 7; $i++) {
            $disabledDates[] = $today->copy()->addDays($i)->toDateString();
        }

        // Query aggregate booking stats grouped by date, for future bookable window
        $bookingStats = \Illuminate\Support\Facades\DB::table('bookings')
            ->select(
                \Illuminate\Support\Facades\DB::raw('DATE(event_date) as booking_date'),
                \Illuminate\Support\Facades\DB::raw('COUNT(*) as event_count'),
                \Illuminate\Support\Facades\DB::raw('SUM(pax) as total_pax')
            )
            ->where('event_date', '>', $today->toDateString())
            ->where('event_date', '<=', $rangeEnd->toDateString())
            ->whereNotIn('status', ['Cancelled', 'cancelled'])
            ->groupBy('booking_date')
            ->get();

        foreach ($bookingStats as $stat) {
            if ((int) $stat->event_count >= $maxEvents || (int) $stat->total_pax >= $maxPax) {
                $disabledDates[] = $stat->booking_date;
            }
        }

        return response()->json([
            'disabled_dates' => array_values(array_unique($disabledDates)),
        ]);
    }

    /**
     * Check availability for a specific date.
     * Ported from: bookingController.checkAvailability()
     */
    public function checkAvailability(string $date)
    {
        $rules = \App\Models\BusinessRule::getActive();

        $start = Carbon::parse($date)->toDateString();
        $end = Carbon::parse($date)->addDay()->toDateString();

        $eventCount = Booking::where('event_date', '>=', $start)
            ->where('event_date', '<', $end)
            ->whereNotIn('status', ['Cancelled', 'cancelled'])
            ->count();

        $totalPax = Booking::where('event_date', '>=', $start)
            ->where('event_date', '<', $end)
            ->whereNotIn('status', ['Cancelled', 'cancelled'])
            ->sum('pax') ?? 0;

        $maxEvents = $rules ? $rules->maximum_capacity_per_day : BusinessRulesService::MAX_EVENTS_PER_DAY;
        $maxPax = BusinessRulesService::MAX_PAX_PER_DAY; // Max pax isn't in business rules dynamically, fallback to constant

        $remainingPax = max(0, $maxPax - $totalPax);
        $remainingEvents = max(0, $maxEvents - $eventCount);
        $isFull = $remainingEvents === 0 || $remainingPax === 0;

        return response()->json([
            'date'            => $date,
            'isFull'          => $isFull,
            'remainingPax'    => $remainingPax,
            'remainingEvents' => $remainingEvents,
            'currentPax'      => (int) $totalPax,
            'currentEvents'   => $eventCount,
        ]);
    }

    /**
     * Update event details from dashboard.
     * Ported from: bookingController.updateEventDetails()
     */
    public function updateEventDetails(Request $request, int $id)
    {
        $userId = Auth::id();

        $booking = Booking::where('id', $id)->where('user_id', $userId)->first();

        if (!$booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        $themeUploads = $request->theme_uploads;
        if (is_array($themeUploads)) {
            $themeUploads = json_encode($themeUploads);
        }

        $booking->update([
            'reservation_time'      => $request->reservation_time,
            'serving_time'          => $request->serving_time,
            'event_timeline'        => $request->event_timeline,
            'color_motif'           => $request->color_motif,
            'theme_uploads'         => $themeUploads,
            'special_instructions'  => $request->special_instructions,
            'venue_building_details' => $request->venue_building_details,
            'selected_menu'         => $request->has('selected_menu')
                ? (is_array($request->selected_menu) ? json_encode($request->selected_menu) : $request->selected_menu)
                : $booking->selected_menu,
        ]);

        return response()->json(['message' => 'Event details updated successfully!']);
    }

    /**
     * Update selected dishes while preserving payment integrity.
     * Server recalculates with current menu prices, updates total_cost, and redistributes
     * unpaid tranches only. Verified payments are never modified.
     */
    public function updateMenu(Request $request, int $id)
    {
        $userId = Auth::id();

        $booking = Booking::where('id', $id)->where('user_id', $userId)->first();

        if (!$booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        if (in_array($booking->status, ['Cancelled', 'cancelled', 'Completed', 'completed'], true)) {
            return response()->json(['error' => 'This booking can no longer be edited.'], 400);
        }

        $bookingService = new \App\Services\BookingManagementService();
        if (!$bookingService->canEditMenu($booking)) {
            return response()->json(['error' => 'Menu changes are locked within 30 days of the event.'], 400);
        }

        $validated = $request->validate([
            'selected_menu' => 'required|array',
        ]);

        $selectedMenu = $validated['selected_menu'];
        $menuItemIds = collect($selectedMenu)
            ->flatMap(fn ($items) => is_array($items) ? $items : [])
            ->map(function ($item) {
                if (is_array($item)) {
                    return $item['id'] ?? null;
                }
                return $item;
            })
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($menuItemIds->isEmpty()) {
            return response()->json(['error' => 'Please select at least one dish.'], 422);
        }

        $menuItems = MenuItem::whereIn('id', $menuItemIds)->where('is_active', \Illuminate\Support\Facades\DB::raw('true'))->get()->keyBy('id');
        if ($menuItems->count() !== $menuItemIds->unique()->count()) {
            return response()->json(['error' => 'One or more selected dishes are unavailable. Please refresh your menu.'], 422);
        }

        $newTotal = $menuItemIds->reduce(function ($sum, $itemId) use ($menuItems, $booking) {
            $item = $menuItems[$itemId];
            return $sum + (($item->cost_per_head + ($item->price_adj ?? 0)) * (int) $booking->pax);
        }, 0);

        DB::transaction(function () use ($booking, $selectedMenu, $newTotal) {
            $paidTotal = $booking->payments()
                ->whereIn('status', ['Paid', 'Verified'])
                ->sum('amount');

            $pendingPayments = $booking->payments()
                ->whereIn('status', ['Pending', 'Failed', 'Rejected'])
                ->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 ELSE 4 END")
                ->get();

            $remaining = max($newTotal - (float) $paidTotal, 0);
            $pendingTotal = (float) $pendingPayments->sum('amount');

            foreach ($pendingPayments as $index => $payment) {
                if ($remaining <= 0) {
                    $payment->update(['amount' => 0]);
                    continue;
                }

                if ($index === $pendingPayments->count() - 1) {
                    $amount = $remaining;
                } elseif ($pendingTotal > 0) {
                    $amount = round($remaining * ((float) $payment->amount / $pendingTotal), 2);
                } else {
                    $amount = round($remaining / max($pendingPayments->count(), 1), 2);
                }

                $payment->update(['amount' => $amount]);
                $remaining -= $amount;
            }

            $booking->update([
                'selected_menu' => json_encode($selectedMenu),
                'total_cost' => $newTotal,
                'live_status' => $paidTotal > $newTotal ? 'Credit Review' : $booking->live_status,
            ]);
        });

        // 3. Notification Triggers (Phase 4)
        $booking->load('user');
        if ($booking->user) {
            $booking->user->notify(new \App\Notifications\ClientMenuUpdatedNotification($booking, $newTotal));
        }

        $staff = \App\Models\User::whereIn('role', ['Marketing', 'Accounting', 'Admin'])->get();
        foreach ($staff as $user) {
            $user->notify(new \App\Notifications\StaffMenuUpdatedNotification($booking, $newTotal));
        }

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Menu updated and pricing recalculated.',
                'total_cost' => $newTotal,
            ]);
        }

        return back();
    }

    /**
     * Remove a booking from the user's history (soft delete or simply hide).
     */
    public function removeHistory(int $id)
    {
        $userId = Auth::id();
        $booking = Booking::where('id', $id)->where('user_id', $userId)->first();
        if ($booking) {
            // Either delete permanently or set a hidden flag
            $booking->delete(); // Assuming SoftDeletes is used, otherwise maybe we just delete it or add a hidden_from_history column.
        }
        return response()->json(['message' => 'History removed.']);
    }

    /**
     * Cancel a booking (only if 7+ days before event).
     * Ported from: bookingController.cancelBooking()
     */
    public function cancel(int $id)
    {
        $userId = Auth::id();

        $booking = Booking::where('id', $id)->where('user_id', $userId)->first();

        if (!$booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        if ($booking->status === 'Cancelled') {
            return response()->json(['error' => 'Booking is already cancelled.'], 400);
        }

        // Check 7-day rule and 48-hour grace period
        $eventDate = Carbon::parse($booking->event_date);
        $daysUntilEvent = (int) ceil(now()->diffInDays($eventDate, false));
        $hoursSinceCreation = (int) ceil($booking->created_at->diffInHours(now()));

        if ($daysUntilEvent < 7 && $hoursSinceCreation > 48) {
            return response()->json(['error' => 'Cannot cancel within 7 days of the event date unless within 48 hours of booking.'], 400);
        }

        $booking->update(['status' => 'Cancelled']);

        return response()->json(['message' => 'Booking cancelled successfully.']);
    }

    /**
     * Update booking details via modal (only if 7+ days before event).
     * Ported from: bookingController.updateBooking()
     */
    public function update(Request $request, int $id)
    {
        $userId = Auth::id();

        $booking = Booking::where('id', $id)->where('user_id', $userId)->first();

        if (!$booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        if ($booking->status === 'Cancelled') {
            return response()->json(['error' => 'Cannot edit a cancelled booking.'], 400);
        }

        // Check 7-day rule and 48-hour grace period
        $eventDate = Carbon::parse($booking->event_date);
        $daysUntilEvent = (int) ceil(now()->diffInDays($eventDate, false));
        $hoursSinceCreation = (int) ceil($booking->created_at->diffInHours(now()));

        if ($daysUntilEvent < 7 && $hoursSinceCreation > 48) {
            return response()->json(['error' => 'Cannot edit within 7 days of the event date unless within 48 hours of booking.'], 400);
        }

        // Only update provided fields (COALESCE equivalent)
        $fields = [
            'event_date', 'event_time', 'pax',
            'client_full_name', 'venue_address_line', 'venue_street',
            'venue_city', 'venue_province', 'venue_zip_code',
            'client_email', 'client_phone',
        ];

        $updates = [];
        foreach ($fields as $field) {
            if ($request->has($field) && $request->$field !== null) {
                $updates[$field] = $request->$field;
            }
        }

        if (!empty($updates)) {
            $booking->update($updates);
        }

        return response()->json(['message' => 'Booking updated successfully.']);
    }

    /**
     * Record a payment (client submits payment).
     * Ported from: bookingController.recordPayment()
     */
    public function recordPayment(Request $request)
    {
        $userId = Auth::id();

        $request->validate([
            'booking_id'     => 'required|integer',
            'payment_method' => 'required|string',
        ]);

        // Verify the booking belongs to this user
        $booking = Booking::where('id', $request->booking_id)
            ->where('user_id', $userId)
            ->first();

        if (!$booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        if ($request->pay_in_full) {
            // Update all pending payments for this booking
            Payment::where('booking_id', $request->booking_id)
                ->where('status', 'Pending')
                ->update([
                    'payment_method' => $request->payment_method,
                    'status'         => 'Verified',
                    'verified_at'    => now(),
                ]);
        } else {
            // Update single payment
            Payment::where('id', $request->payment_id)
                ->where('booking_id', $request->booking_id)
                ->update([
                    'payment_method' => $request->payment_method,
                    'status'         => 'Verified',
                    'verified_at'    => now(),
                ]);
        }

        // If the booking is 'Pending' and payment was verified, we update the status
        if ($booking->status === 'Pending') {
            $booking->update(['status' => 'Confirmed', 'live_status' => 'Payment Verified']);
        }

        return response()->json(['message' => 'Payment processed and verified successfully.']);
    }
}
