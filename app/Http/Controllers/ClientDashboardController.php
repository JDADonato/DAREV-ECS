<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\FoodTasting;
use App\Models\Payment;
use App\Services\BookingManagementService;
use App\Services\PaymentCalculationService;
use Illuminate\Support\Facades\Auth;

/**
 * Ported from: server/controllers/clientDashboardController.js
 * Client dashboard — aggregates bookings, tastings, and payments for the logged-in user.
 */
class ClientDashboardController extends Controller
{
    /**
     * JSON API endpoint — returns dashboard data for the original ClientDashboard.jsx
     * which fetches via fetch('/api/dashboard/client').
     */
    public function apiData(PaymentCalculationService $paymentService, BookingManagementService $bookingService)
    {
        $userId = Auth::id();

        $allBookings = Booking::where('user_id', $userId)
            ->orderBy('event_date', 'desc')
            ->get();

        $allBookings->each(fn ($booking) => $paymentService->syncPendingTranches($booking));

        $allBookings = $allBookings
            ->map(function ($booking) use ($paymentService, $bookingService) {
                $bookingArray = $booking->toArray();
                $bookingArray['nextPaymentDue'] = $paymentService->getNextPaymentDue($booking);
                $bookingArray['canEditSupplementary'] = $bookingService->canEditSupplementary($booking);
                $bookingArray['canEditMenu'] = $bookingService->canEditMenu($booking);
                $bookingArray['cancellationImpact'] = $bookingService->calculateCancellationImpact($booking);
                return $bookingArray;
            });

        $historyStatuses = ['Cancelled', 'cancelled', 'Completed', 'completed'];
        $bookings = $allBookings
            ->reject(fn ($booking) => in_array($booking['status'] ?? null, $historyStatuses, true))
            ->values();
        $historyBookings = $allBookings
            ->filter(fn ($booking) => in_array($booking['status'] ?? null, $historyStatuses, true))
            ->values();

        $tastings = FoodTasting::where('user_id', $userId)
            ->orderBy('preferred_date', 'desc')
            ->get();

        $payments = Payment::whereHas('booking', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            })
            ->with('booking:id,event_date,client_full_name,total_cost')
            ->orderBy('booking_id')
            ->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 END")
            ->get()
            ->map(function ($p) {
                $data = $p->toArray();
                $data['event_date'] = $p->booking->event_date ?? null;
                $data['client_full_name'] = $p->booking->client_full_name ?? null;
                $data['total_cost'] = $p->booking->total_cost ?? null;
                return $data;
            });

        return response()->json([
            'bookings' => $bookings,
            'historyBookings' => $historyBookings,
            'tastings' => $tastings,
            'payments' => $payments,
        ]);
    }
}
