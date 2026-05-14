<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BusinessRule;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class BookingValidationService
{
    /**
     * Validate booking constraints (lead time, capacity, pax limits)
     *
     * @param array $data Booking data
     * @param Booking|null $booking Existing booking for updates
     * @return array Validated data or throws ValidationException
     */
    public static function validateBookingConstraints(array $data, ?Booking $booking = null): array
    {
        $rules = BusinessRule::getActive();
        
        if (!$rules) {
            throw new \Exception('Business rules not configured');
        }

        $errors = [];

        // ─── Lead Time Validation ───
        if (isset($data['event_date'])) {
            $eventDate = Carbon::parse($data['event_date'])->startOfDay();
            $today = Carbon::now()->startOfDay();
            $minimumDate = $today->copy()->addDays($rules->minimum_lead_days);

            if ($eventDate->isBefore($minimumDate)) {
                $errors['event_date'] = "Event must be booked at least {$rules->minimum_lead_days} days in advance. Earliest available: {$minimumDate->format('Y-m-d')}";
            }
        }

        // ─── Pax Limits Validation ───
        if (isset($data['pax'])) {
            $pax = (int) $data['pax'];

            if ($pax < $rules->minimum_pax_per_event) {
                $errors['pax'] = "Minimum {$rules->minimum_pax_per_event} guests required";
            }

            if ($pax > $rules->maximum_pax_per_event) {
                $errors['pax'] = "Maximum {$rules->maximum_pax_per_event} guests allowed";
            }
        }

        // ─── Capacity Per Day Validation ───
        if (isset($data['event_date'])) {
            $eventDate = Carbon::parse($data['event_date'])->startOfDay();
            
            // Count existing bookings for this date (excluding current booking if updating)
            $query = Booking::whereDate('event_date', $eventDate)
                ->whereNotIn('status', ['cancelled', 'Cancelled']);

            if ($booking) {
                $query->where('id', '!=', $booking->id);
            }

            $bookingsOnDate = $query->count();

            if ($bookingsOnDate >= $rules->maximum_capacity_per_day) {
                $errors['event_date'] = "No availability on {$eventDate->format('Y-m-d')}. Maximum {$rules->maximum_capacity_per_day} events per day. Try another date.";
            }
        }

        if (!empty($errors)) {
            throw ValidationException::withMessages($errors);
        }

        return $data;
    }

    /**
     * Calculate total cost based on menu items and pax count
     * Prevents client-side price manipulation
     *
     * @param array $menuItemIds Menu item IDs with quantities
     * @param int $pax Number of guests
     * @return float Total cost
     */
    public static function calculateTotalCost(array $menuItemIds, int $pax): float
    {
        if (empty($menuItemIds) || $pax < 1) {
            return 0;
        }

        $total = 0;

        // Group items by ID and sum quantities
        $itemCounts = array_count_values($menuItemIds);

        foreach ($itemCounts as $itemId => $quantity) {
            $item = \App\Models\MenuItem::find($itemId);
            
            if (!$item) {
                throw new \Exception("Menu item {$itemId} not found");
            }

            // Price per head includes base cost + any adjustments
            $pricePerHead = $item->cost_per_head + ($item->price_adj ?? 0);
            
            // Total = (price per head × number of guests) × quantity
            $total += ($pricePerHead * $pax) * $quantity;
        }

        return $total;
    }

    /**
     * Verify submitted total cost matches server calculation
     *
     * @param float $submittedTotal Client submitted total
     * @param array $menuItemIds Menu item IDs
     * @param int $pax Number of guests
     * @param float $allowedVariance Allowed price variance (default 1%)
     * @return bool
     */
    public static function verifyCostAccuracy(
        float $submittedTotal,
        array $menuItemIds,
        int $pax,
        float $allowedVariance = 0.01
    ): bool
    {
        $calculatedTotal = self::calculateTotalCost($menuItemIds, $pax);
        $variance = abs($submittedTotal - $calculatedTotal) / $calculatedTotal;

        return $variance <= $allowedVariance;
    }
}
