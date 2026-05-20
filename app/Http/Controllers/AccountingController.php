<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use App\Notifications\PaymentReminderNotification;
use App\Services\BookingManagementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

/**
 * Accounting dashboard controller
 * 8 methods for the Accounting dashboard.
 */
class AccountingController extends Controller
{
    /**
     * Show the Accounting dashboard page.
     */
    public function index()
    {
        return Inertia::render('DashboardAccounting');
    }

    /**
     * Get all bookings with their payment schedules.
     * Ported from: accountingController.getBookingsWithPayments()
     */
    public function getBookingsWithPayments(Request $request)
    {
        $query = Booking::query()
            ->select([
                'id',
                'user_id',
                'event_date',
                'pax',
                'budget',
                'total_cost',
                'status',
                'client_full_name',
                'client_email',
                'client_phone',
                'created_at',
            ])
            ->with(['user:id,username', 'payments' => function ($q) {
                $q->select([
                    'id',
                    'booking_id',
                    'amount',
                    'payment_method',
                    'status',
                    'payment_type',
                    'due_date',
                    'verified_by',
                    'verified_at',
                    'paymongo_checkout_session_id',
                    'paymongo_payment_id',
                    'paymongo_reference_number',
                ])
                  ->whereNotNull('payment_type')
                  ->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 ELSE 4 END")
                  ->orderBy('due_date')
                  ->orderBy('id');
            }])
            ->where('status', '!=', 'Cancelled')
            ->where('status', '!=', 'Pending'); // Do not show pending (unapproved) bookings

        if ($request->filled('search')) {
            $search = trim((string) $request->query('search'));
            $query->where(function ($inner) use ($search) {
                $inner->where('client_full_name', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($userQuery) => $userQuery->where('username', 'like', "%{$search}%"));
                if (ctype_digit($search)) {
                    $inner->orWhere('id', (int) $search);
                }
            });
        }

        if ($request->query('payment_status') === 'pending') {
            $query->whereHas('payments', fn ($paymentQuery) => $paymentQuery->whereNotIn('status', ['Paid', 'Verified']));
        } elseif ($request->query('payment_status') === 'complete') {
            $query->whereHas('payments')
                ->whereDoesntHave('payments', fn ($paymentQuery) => $paymentQuery->whereNotIn('status', ['Paid', 'Verified']));
        }

        match ($request->query('sort', 'eventDateSoonest')) {
            'eventDateLatest' => $query->orderBy('event_date', 'desc'),
            'bookingNewest' => $query->orderBy('created_at', 'desc'),
            'bookingOldest' => $query->orderBy('created_at', 'asc'),
            'clientAZ' => $query->orderBy('client_full_name', 'asc'),
            'clientZA' => $query->orderBy('client_full_name', 'desc'),
            default => $query->orderBy('event_date', 'asc'),
        };

        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $bookings = $query->paginate($perPage)->through(function ($b) {
                return array_merge($b->toArray(), [
                    'totalCost' => $b->total_cost ?? $b->budget ?? 0,
                    'username'  => $b->user->username ?? null,
                ]);
            });

        return response()->json($bookings);
    }

    /**
     * Get pending payments for verification queue.
     * Ported from: accountingController.getPendingPayments()
     */
    public function getPendingPayments()
    {
        $payments = Payment::with(['booking:id,event_date,client_full_name,user_id', 'booking.user:id,username'])
            ->where('status', 'Pending')
            ->whereHas('booking', function ($q) {
                $q->where('status', '!=', 'Pending'); // Only payments for approved/confirmed bookings
            })
            ->orderBy('due_date', 'asc')
            ->get()
            ->map(function ($p) {
                $data = $p->toArray();
                $data['event_date'] = $p->booking->event_date ?? null;
                $data['client_full_name'] = $p->booking->client_full_name ?? null;
                $data['username'] = $p->booking->user->username ?? null;
                return $data;
            });

        return response()->json($payments);
    }

    /**
     * Verify or reject a payment.
     * Ported from: accountingController.verifyPayment()
     */
    public function verifyPayment(Request $request, int $id)
    {
        $request->validate([
            'action' => 'required|in:Verify,Reject',
        ]);

        $newStatus = $request->action === 'Verify' ? 'Verified' : 'Rejected';
        $verifiedBy = Auth::user()->username ?? 'accounting';

        $payment = Payment::find($id);

        if (!$payment) {
            return response()->json(['error' => 'Payment not found'], 404);
        }

        $payment->update([
            'status'      => $newStatus,
            'verified_by' => $verifiedBy,
            'verified_at' => now(),
        ]);

        // ─── Send notification to the client ───
        try {
            $booking = Booking::find($payment->booking_id);
            if ($booking && $newStatus === 'Verified') {
                $client = \App\Models\User::find($booking->user_id);
                if ($client) {
                    $client->notify(new \App\Notifications\PaymentApprovedNotification(
                        $booking,
                        $payment->payment_type,
                        (float) $payment->amount
                    ));
                }
            }
        } catch (\Exception $e) {
            Log::error("Notification failed on payment verify: {$e->getMessage()}");
        }

        return response()->json(['success' => true, 'message' => "Payment {$newStatus}"]);
    }

    /**
     * Update payment term (amount, due_date).
     * Ported from: accountingController.updatePayment()
     */
    public function updatePayment(Request $request, int $id)
    {
        $request->validate([
            'amount'   => 'required|numeric',
            'due_date' => 'required|date',
        ]);

        $payment = Payment::find($id);

        if (!$payment) {
            return response()->json(['error' => 'Payment not found'], 404);
        }

        if (in_array($payment->status, ['Verified', 'Paid', 'Refunded'], true)) {
            return response()->json(['error' => 'Verified, paid, or refunded payment terms cannot be modified.'], 422);
        }

        $payment->update([
            'amount'   => $request->amount,
            'due_date' => $request->due_date,
        ]);

        return response()->json(['success' => true, 'message' => 'Payment updated successfully']);
    }

    public function updateBookingPaymentTerms(Request $request, int $id)
    {
        $data = $request->validate([
            'terms' => 'required|array|min:1',
            'terms.*.id' => 'nullable|integer|exists:payments,id',
            'terms.*.payment_type' => 'required|string|max:255',
            'terms.*.percentage' => 'required|numeric|min:0.01|max:100',
            'terms.*.due_date' => 'required|date',
        ]);

        $booking = Booking::with('payments')->find($id);
        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $totalPercentage = collect($data['terms'])->sum(fn ($term) => (float) $term['percentage']);
        if (round($totalPercentage, 2) !== 100.00) {
            return response()->json(['error' => 'Payment term percentages must total 100%.'], 422);
        }

        $totalCost = (float) ($booking->total_cost ?? $booking->budget ?? 0);
        if ($totalCost <= 0) {
            return response()->json(['error' => 'Booking total must be greater than zero before payment terms can be edited.'], 422);
        }

        $existingIds = $booking->payments->pluck('id')->all();
        $incomingIds = collect($data['terms'])->pluck('id')->filter()->map(fn ($id) => (int) $id)->all();

        foreach ($incomingIds as $paymentId) {
            if (!in_array($paymentId, $existingIds, true)) {
                return response()->json(['error' => 'One or more payment terms do not belong to this booking.'], 422);
            }
        }

        $lockedPaymentIds = $booking->payments
            ->whereIn('status', ['Verified', 'Paid', 'Refunded'])
            ->pluck('id')
            ->all();

        foreach ($lockedPaymentIds as $lockedPaymentId) {
            if (!in_array($lockedPaymentId, $incomingIds, true)) {
                return response()->json(['error' => 'Verified, paid, or refunded payment terms must remain in the schedule.'], 422);
            }
        }

        DB::transaction(function () use ($booking, $data, $totalCost, $incomingIds) {
            $stalePayments = $booking->payments();
            if (!empty($incomingIds)) {
                $stalePayments->whereNotIn('id', $incomingIds);
            }
            $stalePayments->whereNotIn('status', ['Verified', 'Paid', 'Refunded'])->delete();

            $remaining = round($totalCost, 2);
            $lastIndex = count($data['terms']) - 1;

            foreach ($data['terms'] as $index => $term) {
                $existingPayment = !empty($term['id'])
                    ? $booking->payments->firstWhere('id', (int) $term['id'])
                    : null;

                if ($existingPayment && in_array($existingPayment->status, ['Verified', 'Paid', 'Refunded'], true)) {
                    $remaining = round($remaining - (float) $existingPayment->amount, 2);
                    continue;
                }

                $amount = $index === $lastIndex
                    ? $remaining
                    : round($totalCost * ((float) $term['percentage'] / 100), 2);

                $payload = [
                    'amount' => $amount,
                    'payment_method' => 'Pending',
                    'status' => 'Pending',
                    'payment_type' => $term['payment_type'],
                    'due_date' => $term['due_date'],
                ];

                if (!empty($term['id'])) {
                    Payment::where('id', $term['id'])
                        ->where('booking_id', $booking->id)
                        ->update($payload);
                } else {
                    $booking->payments()->create($payload);
                }

                $remaining = round($remaining - $amount, 2);
            }
        });

        $booking->load(['payments' => function ($q) {
            $q->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 ELSE 4 END")
                ->orderBy('due_date')
                ->orderBy('id');
        }]);

        return response()->json([
            'success' => true,
            'message' => 'Payment terms updated successfully.',
            'booking' => $booking,
        ]);
    }

    /**
     * Get transaction ledger (all payments with filters).
     * Ported from: accountingController.getLedger()
     */
    public function getLedger(Request $request)
    {
        $query = Payment::query()
            ->select([
                'id',
                'booking_id',
                'amount',
                'payment_method',
                'status',
                'payment_type',
                'due_date',
                'verified_by',
                'verified_at',
                'created_at',
            ])
            ->with(['booking:id,event_date,client_full_name,package_id,user_id', 'booking.user:id,username'])
            ->whereHas('booking', function ($q) {
                $q->whereNotIn('status', ['Pending', 'Cancelled']); // Hide ledger entries for unapproved/cancelled bookings
            });

        if ($request->status && $request->status !== 'All') {
            $query->where('status', $request->status);
        }

        if ($request->startDate) {
            $query->where('created_at', '>=', $request->startDate);
        }

        if ($request->endDate) {
            $query->where('created_at', '<=', $request->endDate);
        }

        $payments = $query->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($p) {
                $data = $p->toArray();
                $data['event_date'] = $p->booking->event_date ?? null;
                $data['client_full_name'] = $p->booking->client_full_name ?? null;
                $data['package_id'] = $p->booking->package_id ?? null;
                $data['username'] = $p->booking->user->username ?? null;
                return $data;
            });

        return response()->json($payments);
    }

    /**
     * Send a real payment reminder email + in-app notification to the client.
     * Ported from: accountingController.remindClient()
     */
    public function remindClient(int $paymentId)
    {
        $payment = Payment::with([
            'booking:id,user_id,client_email,client_full_name,client_phone',
        ])->find($paymentId);

        if (!$payment) {
            return response()->json(['error' => 'Payment not found'], 404);
        }

        $booking = $payment->booking;

        if (!$booking) {
            return response()->json(['error' => 'Booking not found for this payment'], 404);
        }

        // Ensure the payment has its booking eager-loaded for the notification
        $payment->setRelation('booking', $booking);

        $notified = false;

        // ── Path A: Booking has a registered user account ──
        if ($booking->user_id) {
            $client = User::find($booking->user_id);

            if ($client) {
                try {
                    $client->notify(new PaymentReminderNotification($payment));
                    $notified = true;

                    Log::info('Payment reminder notification sent.', [
                        'payment_id' => $paymentId,
                        'user_id'    => $client->id,
                        'email'      => $client->email,
                    ]);
                } catch (\Throwable $e) {
                    Log::error('PaymentReminderNotification failed.', [
                        'payment_id' => $paymentId,
                        'error'      => $e->getMessage(),
                    ]);

                    return response()->json([
                        'error' => 'Could not send reminder: ' . $e->getMessage(),
                    ], 500);
                }
            }
        }

        // ── Path B: No linked user — fall back to raw mail using client_email ──
        if (!$notified) {
            $email = $booking->client_email;

            if (!$email) {
                return response()->json([
                    'error' => 'No email address found for this client. Please update the booking with a valid email first.',
                ], 422);
            }

            try {
                $dueDate  = \Carbon\Carbon::parse($payment->due_date)->format('F j, Y');
                $amount   = number_format((float) $payment->amount, 2);
                $type     = $payment->payment_type ?? 'Payment';
                $bookingRef = str_pad($booking->id, 5, '0', STR_PAD_LEFT);
                $clientName = $booking->client_full_name ?: 'Valued Client';

                Mail::raw(
                    implode("\n\n", [
                        "Hello {$clientName},",
                        "This is a friendly payment reminder from Eloquente Catering.",
                        "Payment Type : {$type}",
                        "Amount Due   : ₱{$amount}",
                        "Due Date     : {$dueDate}",
                        "Booking Ref  : #{$bookingRef}",
                        "Please settle your payment on or before the due date to keep your booking active.",
                        "Thank you,\nEloquente Catering Team",
                    ]),
                    function ($message) use ($email, $clientName, $bookingRef) {
                        $message->to($email, $clientName)
                                ->subject("Payment Reminder – Booking #{$bookingRef} | Eloquente Catering");
                    }
                );

                Log::info('Payment reminder raw mail sent (no user account).', [
                    'payment_id' => $paymentId,
                    'email'      => $email,
                ]);

                $notified = true;
            } catch (\Throwable $e) {
                Log::error('Payment reminder raw mail failed.', [
                    'payment_id' => $paymentId,
                    'email'      => $booking->client_email,
                    'error'      => $e->getMessage(),
                ]);

                return response()->json([
                    'error' => 'Could not send reminder email: ' . $e->getMessage(),
                ], 500);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment reminder sent to the client successfully.',
        ]);
    }

    /**
     * Get refund queue (cancelled bookings with verified payments).
     * Ported from: accountingController.getRefundQueue()
     */
    public function getRefundQueue()
    {
        $items = DB::table('bookings as b')
            ->join('payments as p', 'b.id', '=', 'p.booking_id')
            ->where('b.status', 'Cancelled')
            ->whereIn('p.status', ['Verified', 'Paid'])
            ->select(
                'b.id as booking_id',
                'b.client_full_name',
                'b.client_email',
                'b.event_date',
                'b.total_cost',
                DB::raw('SUM(p.amount) as total_paid')
            )
            ->groupBy('b.id', 'b.client_full_name', 'b.client_email', 'b.event_date', 'b.total_cost')
            ->get();

        return response()->json($items);
    }

    /**
     * Process refund for a booking.
     * Integrates with PayMongo API to refund actual payments.
     */
    public function processRefund(int $bookingId, \App\Services\PayMongoService $payMongo)
    {
        $verifiedBy = Auth::user()->username ?? 'accounting';
        $booking = Booking::with('payments')->find($bookingId);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        $payments = Payment::where('booking_id', $bookingId)
            ->whereIn('status', ['Verified', 'Paid'])
            ->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 ELSE 4 END")
            ->orderBy('id')
            ->get();

        if ($payments->isEmpty()) {
            return response()->json(['error' => 'No verified or paid payments found for this booking to refund.'], 404);
        }

        $impact = (new BookingManagementService())->calculateCancellationImpact($booking);
        $remainingRefundable = round((float) ($impact['refundable_amount'] ?? 0), 2);
        $nonRefundableRemaining = round((float) ($impact['non_refundable_amount'] ?? 0), 2);
        $refundCount = 0;
        $forfeitedCount = 0;
        $errors = [];

        foreach ($payments as $payment) {
            try {
                $paidAmount = round((float) $payment->amount, 2);
                $forfeitedForPayment = min($paidAmount, $nonRefundableRemaining);
                $nonRefundableRemaining = round($nonRefundableRemaining - $forfeitedForPayment, 2);
                $refundAmount = min(round($paidAmount - $forfeitedForPayment, 2), $remainingRefundable);

                if ($refundAmount <= 0) {
                    $payment->update([
                        'status'      => 'Refunded',
                        'verified_by' => $verifiedBy,
                        'verified_at' => now(),
                        'payment_method' => trim(($payment->payment_method ?: 'Payment') . ' (Forfeited)')
                    ]);
                    $forfeitedCount++;
                    continue;
                }

                // If it was paid via PayMongo and has a payment ID, issue a real refund
                if ($payment->paymongo_payment_id) {
                    try {
                        $payMongo->createRefund(
                            paymentId: $payment->paymongo_payment_id,
                            amount: $refundAmount,
                            reason: 'requested_by_customer',
                            notes: "Refunded via Accounting Dashboard for Booking #{$bookingId}, Payment #{$payment->id}"
                        );
                    } catch (\Exception $apiException) {
                        Log::error("PayMongo API failed for payment #{$payment->id}: " . $apiException->getMessage());
                        $errors[] = "Payment #{$payment->id} failed: " . $apiException->getMessage();
                        continue; // Skip local update if the real refund failed
                    }
                } elseif (str_contains(strtolower((string) $payment->payment_method), 'paymongo')) {
                    $errors[] = "Payment #{$payment->id} is missing the PayMongo payment ID needed for an API refund.";
                    continue;
                }

                // Update the payment record
                $payment->update([
                    'status'      => 'Refunded',
                    'verified_by' => $verifiedBy,
                    'verified_at' => now(),
                    'payment_method' => $forfeitedForPayment > 0
                        ? trim(($payment->payment_method ?: 'Payment') . " (Partial refund: PHP " . number_format($refundAmount, 2) . "; forfeited: PHP " . number_format($forfeitedForPayment, 2) . ")")
                        : $payment->payment_method,
                ]);

                $remainingRefundable = round($remainingRefundable - $refundAmount, 2);
                $refundCount++;
            } catch (\Exception $e) {
                Log::error("Failed to process refund for payment #{$payment->id}: " . $e->getMessage());
                $errors[] = "Payment #{$payment->id}: " . $e->getMessage();
            }
        }

        if (count($errors) > 0 && $refundCount === 0) {
            return response()->json([
                'error' => 'Failed to process refunds.',
                'details' => $errors
            ], 500);
        }

        $message = $refundCount > 0
            ? "Refund processed successfully through PayMongo where provider payment IDs were available. Non-refundable reservation fees were forfeited."
            : "No refundable amount was available. Paid amounts were marked as forfeited.";
        if (count($errors) > 0) {
            $message .= " However, some payments failed to refund.";
        }

        Log::info("[REFUND] Processed refund for booking #{$bookingId}. Updated records.", [
            'refunded_payments' => $refundCount,
            'forfeited_payments' => $forfeitedCount,
            'errors' => $errors,
        ]);

        return response()->json(['success' => true, 'message' => $message]);
    }
}
