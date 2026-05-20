<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\FoodTasting;
use App\Models\Payment;
use App\Services\PayMongoService;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

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
    public function apiData(PayMongoService $payMongo)
    {
        $userId = Auth::id();
        $paymentService = new \App\Services\PaymentCalculationService();

        $allBookings = Booking::where('user_id', $userId)
            ->orderBy('event_date', 'desc')
            ->get();

        $allBookings->each(fn ($booking) => $paymentService->syncPendingTranches($booking));
        $this->syncPendingPayMongoCheckouts($userId, $payMongo);

        $allBookings = $allBookings
            ->map(function ($booking) {
                $paymentService = new \App\Services\PaymentCalculationService();
                $bookingService = new \App\Services\BookingManagementService();
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

    private function syncPendingPayMongoCheckouts(int $userId, PayMongoService $payMongo): void
    {
        $payments = Payment::with('booking.payments')
            ->whereIn('status', ['Pending', 'Failed', 'Rejected'])
            ->whereNotNull('paymongo_checkout_session_id')
            ->whereHas('booking', fn ($query) => $query->where('user_id', $userId))
            ->get();

        foreach ($payments as $payment) {
            try {
                $checkout = $payMongo->retrieveCheckoutSession($payment->paymongo_checkout_session_id);

                if (!$this->checkoutSessionIsPaid($checkout) || !$this->checkoutAmountMatches($checkout, $payment)) {
                    continue;
                }

                DB::transaction(function () use ($payment, $checkout) {
                    $payment->refresh();

                    if (!in_array($payment->status, ['Pending', 'Failed', 'Rejected'], true)) {
                        return;
                    }

                    $payment->forceFill([
                        'status' => 'Paid',
                        'payment_method' => $this->checkoutPaymentMethod($checkout) ?: 'PayMongo',
                        'verified_by' => 'PayMongo Checkout',
                        'verified_at' => now(),
                        'paymongo_payment_id' => $this->checkoutPaymentId($checkout) ?: $payment->paymongo_payment_id,
                        'paymongo_payment_intent_id' => $this->checkoutPaymentIntentId($checkout) ?: $payment->paymongo_payment_intent_id,
                    ])->save();

                    if ($payment->booking) {
                        $this->updateBookingMilestone($payment->booking);
                    }
                });
            } catch (\Throwable $exception) {
                Log::warning('Pending PayMongo checkout sync failed.', [
                    'payment_id' => $payment->id,
                    'checkout_session_id' => $payment->paymongo_checkout_session_id,
                    'message' => $exception->getMessage(),
                ]);
            }
        }
    }

    private function checkoutSessionIsPaid(array $checkout): bool
    {
        $statuses = [
            Arr::get($checkout, 'data.attributes.status'),
            Arr::get($checkout, 'data.attributes.payment_intent.attributes.status'),
            Arr::get($checkout, 'data.attributes.payment_intent.status'),
            Arr::get($checkout, 'data.attributes.payments.0.attributes.status'),
            Arr::get($checkout, 'data.attributes.payment.attributes.status'),
        ];

        return collect($statuses)
            ->filter()
            ->map(fn ($status) => strtolower((string) $status))
            ->contains(fn ($status) => in_array($status, ['paid', 'succeeded', 'success', 'completed'], true));
    }

    private function checkoutAmountMatches(array $checkout, Payment $payment): bool
    {
        $amount = $this->checkoutAmount($checkout);

        if ($amount === null) {
            return true;
        }

        return (int) $amount === (int) round(((float) $payment->amount) * 100);
    }

    private function checkoutAmount(array $checkout): ?int
    {
        return Arr::get($checkout, 'data.attributes.amount_total')
            ?? Arr::get($checkout, 'data.attributes.total_amount')
            ?? Arr::get($checkout, 'data.attributes.payments.0.attributes.amount')
            ?? Arr::get($checkout, 'data.attributes.payment.attributes.amount')
            ?? Arr::get($checkout, 'data.attributes.line_items.0.amount');
    }

    private function checkoutPaymentId(array $checkout): ?string
    {
        return Arr::get($checkout, 'data.attributes.payments.0.id')
            ?? Arr::get($checkout, 'data.attributes.payment.id')
            ?? Arr::get($checkout, 'data.attributes.payment_id');
    }

    private function checkoutPaymentIntentId(array $checkout): ?string
    {
        return Arr::get($checkout, 'data.attributes.payment_intent.id')
            ?? Arr::get($checkout, 'data.attributes.payment_intent_id');
    }

    private function checkoutPaymentMethod(array $checkout): ?string
    {
        return Arr::get($checkout, 'data.attributes.payments.0.attributes.source.type')
            ?? Arr::get($checkout, 'data.attributes.payment.attributes.source.type')
            ?? Arr::get($checkout, 'data.attributes.payment_method_used')
            ?? 'PayMongo';
    }

    private function updateBookingMilestone(Booking $booking): void
    {
        $booking->load('payments');

        $totalPaid = (float) $booking->payments
            ->whereIn('status', ['Paid', 'Verified'])
            ->sum(fn (Payment $payment) => (float) $payment->amount);

        $totalCost = (float) $booking->total_cost;
        $paidRatio = $totalCost > 0 ? $totalPaid / $totalCost : 0;

        $updates = [
            'milestone_step' => $this->milestoneStep($paidRatio),
            'live_status' => $this->bookingLiveStatus($paidRatio),
        ];

        if ($paidRatio >= 1) {
            $updates['status'] = 'Completed';
        } elseif ($paidRatio >= 0.10) {
            $updates['status'] = 'Reserved';
        }

        $booking->update($updates);
    }

    private function milestoneStep(float $paidRatio): int
    {
        if ($paidRatio >= 1) {
            return 5;
        }

        if ($paidRatio >= 0.80) {
            return 4;
        }

        if ($paidRatio >= 0.10) {
            return 3;
        }

        return 1;
    }

    private function bookingLiveStatus(float $paidRatio): string
    {
        if ($paidRatio >= 1) {
            return 'Payment Complete';
        }

        if ($paidRatio >= 0.80) {
            return 'Progress Payment Paid';
        }

        if ($paidRatio >= 0.10) {
            return 'Reserved';
        }

        return 'Payment Pending';
    }
}
