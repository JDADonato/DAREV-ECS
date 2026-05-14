<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

/**
 * Ported from: server/controllers/financeController.js
 * 8 methods for the Accounting dashboard.
 */
class FinanceController extends Controller
{
    /**
     * Show the Finance dashboard page.
     */
    public function index()
    {
        return Inertia::render('Finance/DashboardFinance');
    }

    /**
     * Get all bookings with their payment schedules.
     * Ported from: financeController.getBookingsWithPayments()
     */
    public function getBookingsWithPayments()
    {
        $bookings = Booking::with(['user:id,username', 'payments' => function ($q) {
                $q->whereNotNull('payment_type')
                  ->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 END");
            }])
            ->where('status', '!=', 'Cancelled')
            ->where('status', '!=', 'Pending') // Do not show pending (unapproved) bookings
            ->orderBy('event_date', 'asc')
            ->get()
            ->map(function ($b) {
                return array_merge($b->toArray(), [
                    'totalCost' => $b->total_cost ?? $b->budget ?? 0,
                    'username'  => $b->user->username ?? null,
                ]);
            });

        return response()->json($bookings);
    }

    /**
     * Get pending payments for verification queue.
     * Ported from: financeController.getPendingPayments()
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
     * Ported from: financeController.verifyPayment()
     */
    public function verifyPayment(Request $request, int $id)
    {
        $request->validate([
            'action' => 'required|in:Verify,Reject',
        ]);

        $newStatus = $request->action === 'Verify' ? 'Verified' : 'Rejected';
        $verifiedBy = Auth::user()->username ?? 'finance';

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
     * Ported from: financeController.updatePayment()
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

        $payment->update([
            'amount'   => $request->amount,
            'due_date' => $request->due_date,
        ]);

        return response()->json(['success' => true, 'message' => 'Payment updated successfully']);
    }

    /**
     * Get transaction ledger (all payments with filters).
     * Ported from: financeController.getLedger()
     */
    public function getLedger(Request $request)
    {
        $query = Payment::with(['booking:id,event_date,client_full_name,package_id,user_id', 'booking.user:id,username'])
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
     * Send a payment reminder (simulated).
     * Ported from: financeController.remindClient()
     */
    public function remindClient(int $paymentId)
    {
        $payment = Payment::with('booking:id,client_email,client_phone')->find($paymentId);

        if (!$payment) {
            return response()->json(['error' => 'Payment not found'], 404);
        }

        Log::info("[SIMULATED NOTIFICATION] Reminder sent to {$payment->booking->client_email} for payment #{$paymentId} due on {$payment->due_date}");

        return response()->json(['success' => true, 'message' => 'Reminder sent successfully']);
    }

    /**
     * Get refund queue (cancelled bookings with verified payments).
     * Ported from: financeController.getRefundQueue()
     */
    public function getRefundQueue()
    {
        $items = DB::table('bookings as b')
            ->join('payments as p', 'b.id', '=', 'p.booking_id')
            ->where('b.status', 'Cancelled')
            ->where('p.status', 'Verified')
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
     * Ported from: financeController.processRefund()
     */
    public function processRefund(int $bookingId)
    {
        $verifiedBy = Auth::user()->username ?? 'finance';

        $updated = Payment::where('booking_id', $bookingId)
            ->where('status', 'Verified')
            ->update([
                'status'      => 'Refunded',
                'verified_by' => $verifiedBy,
                'verified_at' => now(),
            ]);

        if ($updated === 0) {
            return response()->json(['error' => 'No verified payments found for this booking to refund.'], 404);
        }

        Log::info("[SIMULATED REFUND] Processed refund for booking #{$bookingId}. Updated {$updated} payment records.");

        return response()->json(['success' => true, 'message' => 'Refund processed successfully.']);
    }
}
