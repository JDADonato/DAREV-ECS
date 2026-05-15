<?php

namespace App\Services;

use App\Models\Booking;
use Carbon\Carbon;

class PaymentCalculationService
{
    /**
     * Calculate required payment tranches for a booking based on the event date proximity.
     * 
     * @param Booking $booking
     * @return array
     */
    public function calculateTranches(Booking $booking): array
    {
        $eventDate = Carbon::parse($booking->event_date)->startOfDay();
        $createdAt = $booking->created_at ? $booking->created_at->startOfDay() : now()->startOfDay();
        
        $daysUntilEvent = $createdAt->diffInDays($eventDate, false);
        $totalCost = (float) $booking->total_cost;

        // Rush 2: Event is less than 10 days away
        if ($daysUntilEvent <= 10) {
            return [
                [
                    'name' => 'Final',
                    'percentage' => 100,
                    'amount' => $totalCost,
                    'due_date' => now()->addHours(24)->toIso8601String(), // Due within 24 hours
                    'description' => '100% Full Payment required immediately for rush events.',
                ]
            ];
        }

        // Rush 1: Event is less than 1 month, but > 10 days away
        if ($daysUntilEvent <= 30) {
            return [
                [
                    'name' => 'DownPayment',
                    'percentage' => 80,
                    'amount' => $totalCost * 0.80,
                    'due_date' => now()->addHours(24)->toIso8601String(),
                    'description' => 'Because your event is less than a month away, the 10% Reservation Fee and 70% Down Payment are combined into a single 80% payment required immediately to secure the date.',
                ],
                [
                    'name' => 'Final',
                    'percentage' => 20,
                    'amount' => $totalCost * 0.20,
                    'due_date' => $eventDate->copy()->subDays(10)->toIso8601String(),
                    'description' => '20% Final Balance due 10 days before the event.',
                ]
            ];
        }

        // Standard: Event is > 1 month away
        return [
            [
                'name' => 'Reservation',
                'percentage' => 10,
                'amount' => $totalCost * 0.10,
                'due_date' => now()->addHours(24)->toIso8601String(),
                'description' => '10% Reservation Fee to lock in your date.',
            ],
            [
                'name' => 'DownPayment',
                'percentage' => 70,
                'amount' => $totalCost * 0.70,
                'due_date' => $eventDate->copy()->subMonth()->toIso8601String(),
                'description' => '70% Down Payment due 1 month before the event.',
            ],
            [
                'name' => 'Final',
                'percentage' => 20,
                'amount' => $totalCost * 0.20,
                'due_date' => $eventDate->copy()->subDays(10)->toIso8601String(),
                'description' => '20% Final Balance due 10 days before the event.',
            ]
        ];
    }

    /**
     * Check if the booking is within the non-refundable window (7 days before event).
     * 
     * @param Booking $booking
     * @return bool
     */
    public function isNonRefundable(Booking $booking): bool
    {
        $eventDate = Carbon::parse($booking->event_date)->startOfDay();
        $daysUntilEvent = now()->startOfDay()->diffInDays($eventDate, false);

        // If the event is in the past, or less than or equal to 7 days away
        return $daysUntilEvent <= 7;
    }

    /**
     * Get the next sequential payment due, ignoring future tranches.
     * Evaluates the event proximity and outstanding payments.
     * 
     * @param Booking $booking
     * @return array|null
     */
    public function getNextPaymentDue(Booking $booking): ?array
    {
        // Since tranches are generated dynamically at reservation time (Standard, Rush 1, Rush 2)
        // we can simply find the earliest pending payment from the database.
        $nextPayment = $booking->payments()
            ->whereIn('status', ['Pending', 'Failed', 'Rejected'])
            ->orderBy('due_date', 'asc')
            ->first();
            
        if (!$nextPayment) {
            return null; // Fully paid or no pending payments
        }

        $tranches = $this->calculateTranches($booking);
        $description = 'Payment due.';
        foreach ($tranches as $tranche) {
            if ($tranche['name'] === $nextPayment->payment_type) {
                $description = $tranche['description'];
                break;
            }
        }

        return [
            'id' => $nextPayment->id,
            'payment_type' => $nextPayment->payment_type,
            'amount' => $nextPayment->amount,
            'due_date' => $nextPayment->due_date,
            'status' => $nextPayment->status,
            'description' => $description,
        ];
    }
}
