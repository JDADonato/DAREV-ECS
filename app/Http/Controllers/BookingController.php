<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use App\Notifications\BookingConfirmedNotification;
use App\Notifications\NewBookingNotification;
use App\Services\BookingValidationService;
use App\Services\BusinessRulesService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
        ]);

        // 5. Auto-generate 3-tier payment schedule
        $cost = (float) ($request->total_cost ?? $request->budget ?? 0);

        if ($cost > 0) {
            try {
                $eventDateObj = Carbon::parse($eventDate);
                $reservationDue = now()->toDateString();
                $downPaymentDue = $eventDateObj->copy()->subMonth()->toDateString();
                $finalDue = $eventDateObj->copy()->subDays(10)->toDateString();

                // 3 Payment Tranches: 10% Reservation, 70% DownPayment, 20% Final
                $reservationAmount = round($cost * 0.10, 2);
                $finalAmount = round($cost * 0.20, 2);
                $downPaymentAmount = $cost - $reservationAmount - $finalAmount;

                Payment::create([
                    'booking_id'     => $booking->id,
                    'amount'         => $reservationAmount,
                    'payment_method' => 'Pending',
                    'status'         => 'Pending',
                    'payment_type'   => 'Reservation',
                    'due_date'       => $reservationDue,
                ]);

                Payment::create([
                    'booking_id'     => $booking->id,
                    'amount'         => $downPaymentAmount,
                    'payment_method' => 'Pending',
                    'status'         => 'Pending',
                    'payment_type'   => 'DownPayment',
                    'due_date'       => $downPaymentDue,
                ]);

                Payment::create([
                    'booking_id'     => $booking->id,
                    'amount'         => $finalAmount,
                    'payment_method' => 'Pending',
                    'status'         => 'Pending',
                    'payment_type'   => 'Final',
                    'due_date'       => $finalDue,
                ]);

                Log::info("Created 3 payment schedule rows for booking #{$booking->id}");
            } catch (\Exception $e) {
                Log::error("Payment schedule creation failed (booking still created): {$e->getMessage()}");
            }
        }

        // ─── Send Notifications ───
        try {
            // Notify client of booking confirmation
            $client = User::find($request->user_id);
            if ($client) {
                $client->notify(new BookingConfirmedNotification($booking));
            }

            // Notify admins/ops of new booking
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
     * Check availability for a specific date.
     * Ported from: bookingController.checkAvailability()
     */
    public function checkAvailability(string $date)
    {
        $rules = \App\Models\BusinessRule::getActive();

        $eventCount = Booking::whereDate('event_date', $date)
            ->whereNotIn('status', ['Cancelled', 'cancelled'])
            ->count();

        $totalPax = Booking::whereDate('event_date', $date)
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
        ]);

        return response()->json(['message' => 'Event details updated successfully!']);
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

        // Check 7-day rule
        $eventDate = Carbon::parse($booking->event_date);
        $daysUntilEvent = (int) ceil(now()->diffInDays($eventDate, false));

        if ($daysUntilEvent < 7) {
            return response()->json(['error' => 'Cannot cancel within 7 days of the event date.'], 400);
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

        // Check 7-day rule
        $eventDate = Carbon::parse($booking->event_date);
        $daysUntilEvent = (int) ceil(now()->diffInDays($eventDate, false));

        if ($daysUntilEvent < 7) {
            return response()->json(['error' => 'Cannot edit within 7 days of the event date.'], 400);
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
                    'status'         => 'Pending',
                ]);
        } else {
            // Update single payment
            Payment::where('id', $request->payment_id)
                ->where('booking_id', $request->booking_id)
                ->update([
                    'payment_method' => $request->payment_method,
                    'status'         => 'Pending',
                ]);
        }

        return response()->json(['message' => 'Payment recorded successfully. Pending verification.']);
    }
}
