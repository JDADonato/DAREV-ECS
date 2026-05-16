<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;

class PaymentController extends Controller
{
    public function initializeCheckout(Request $request)
    {
        $validated = $request->validate([
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
            'payment_id' => ['nullable', 'integer', 'exists:payments,id'],
            'amount' => ['required', 'numeric', 'min:1'],
        ]);

        $booking = Booking::where('id', $validated['booking_id'])
            ->where('user_id', Auth::id())
            ->firstOrFail();

        $payment = $this->resolvePayablePayment(
            $booking,
            (float) $validated['amount'],
            $validated['payment_id'] ?? null
        );

        if (!$payment) {
            return response()->json([
                'error' => 'No payable tranche was found for this booking and amount.',
            ], 422);
        }

        // TODO: PAYMONGO INTEGRATION
        // Replace this internal URL generation with a PayMongo Checkout Session creation request.
        // The future implementation should send the payable amount, currency, booking reference,
        // payment tranche identifier, success URL, cancel URL, and client billing details to PayMongo.
        // The PayMongo response will return a hosted checkout URL; store its checkout/session ID
        // against the Payment record before returning that hosted URL to the browser.
        $checkoutUrl = URL::temporarySignedRoute(
            'checkout.secure',
            now()->addMinutes(30),
            [
                'booking_id' => $booking->id,
                'payment_id' => $payment->id,
                'amount' => number_format((float) $payment->amount, 2, '.', ''),
            ]
        );

        return response()->json([
            'redirect_url' => $checkoutUrl,
            'payment' => [
                'id' => $payment->id,
                'booking_id' => $booking->id,
                'payment_type' => $payment->payment_type,
                'amount' => (float) $payment->amount,
            ],
        ]);
    }

    public function showSecureCheckout(Request $request)
    {
        $validated = $request->validate([
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
            'payment_id' => ['required', 'integer', 'exists:payments,id'],
            'amount' => ['required', 'numeric', 'min:1'],
        ]);

        $booking = Booking::where('id', $validated['booking_id'])
            ->where('user_id', Auth::id())
            ->firstOrFail();

        $payment = Payment::where('id', $validated['payment_id'])
            ->where('booking_id', $booking->id)
            ->firstOrFail();

        return Inertia::render('client/SecureCheckout', [
            'checkout' => [
                'booking_id' => $booking->id,
                'payment_id' => $payment->id,
                'payment_type' => $payment->payment_type,
                'amount' => (float) $payment->amount,
                'event_date' => optional($booking->event_date)->toDateString(),
                'client_full_name' => $booking->client_full_name,
            ],
        ]);
    }

    public function processPayment(Request $request)
    {
        $validated = $request->validate([
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
            'payment_id' => ['required', 'integer', 'exists:payments,id'],
            'amount' => ['required', 'numeric', 'min:1'],
            'payment_method' => ['required', 'string', 'max:100'],
            'authorization_token' => ['nullable', 'string', 'max:255'],
        ]);

        $result = DB::transaction(function () use ($validated) {
            $booking = Booking::where('id', $validated['booking_id'])
                ->where('user_id', Auth::id())
                ->lockForUpdate()
                ->firstOrFail();

            $payment = Payment::where('id', $validated['payment_id'])
                ->where('booking_id', $booking->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (abs((float) $payment->amount - (float) $validated['amount']) > 0.01) {
                abort(422, 'Payment amount does not match the selected tranche.');
            }

            // TODO: PAYMONGO INTEGRATION
            // This temporary endpoint acts as the successful authorization callback for the checkout UI.
            // Replace this block with a PayMongo Webhook endpoint that verifies the webhook signature,
            // checks the event type and payment intent status, extracts the Payment ID from metadata,
            // confirms the gross amount and currency, then marks the matching Payment record as paid.
            // The real webhook handler must be idempotent because payment providers may retry events.
            if (!in_array($payment->status, ['Paid', 'Verified'], true)) {
                $payment->update([
                    'payment_method' => $validated['payment_method'],
                    'status' => 'Paid',
                    'verified_by' => 'Checkout',
                    'verified_at' => now(),
                ]);
            }

            $totalPaid = (float) $booking->payments()
                ->whereIn('status', ['Paid', 'Verified'])
                ->sum('amount');

            $bookingUpdates = [
                'milestone_step' => $this->determineMilestoneStep($booking, $totalPaid),
            ];

            if ($booking->status === 'Pending') {
                $bookingUpdates['status'] = 'Confirmed';
            }

            $bookingUpdates['live_status'] = 'Payment Authorized';
            $booking->update($bookingUpdates);

            // Broadcast payment processed event for accounting dashboard
            broadcast(new \App\Events\PaymentProcessed($payment->fresh()))->toOthers();

            return [
                'booking_id' => $booking->id,
                'payment_id' => $payment->id,
                'payment_status' => $payment->fresh()->status,
                'total_paid' => $totalPaid,
                'balance' => max(((float) $booking->total_cost) - $totalPaid, 0),
                'milestone_step' => $booking->fresh()->milestone_step,
            ];
        });

        return response()->json([
            'success' => true,
            'redirect_url' => route('checkout.success', [
                'booking_id' => $result['booking_id'],
                'payment_id' => $result['payment_id'],
            ]),
            'payment' => $result,
        ]);
    }

    private function resolvePayablePayment(Booking $booking, float $amount, ?int $paymentId): ?Payment
    {
        $query = $booking->payments()
            ->whereIn('status', ['Pending', 'Failed', 'Rejected']);

        if ($paymentId) {
            return (clone $query)
                ->where('id', $paymentId)
                ->first();
        }

        return $query
            ->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 ELSE 4 END")
            ->get()
            ->first(fn (Payment $payment) => abs((float) $payment->amount - $amount) <= 0.01);
    }

    private function determineMilestoneStep(Booking $booking, float $totalPaid): int
    {
        $currentStep = (int) ($booking->milestone_step ?: 1);
        $totalCost = (float) $booking->total_cost;

        if ($totalCost <= 0) {
            return max($currentStep, 1);
        }

        $paidRatio = $totalPaid / $totalCost;
        $nextStep = 1;

        if ($paidRatio >= 0.10) {
            $nextStep = 3;
        }

        if ($paidRatio >= 0.80) {
            $nextStep = 4;
        }

        return max($currentStep, $nextStep);
    }
}
