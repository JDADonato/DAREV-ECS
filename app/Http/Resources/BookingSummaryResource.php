<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'event_date' => $this->event_date,
            'event_time' => $this->event_time,
            'pax' => (int) $this->pax,
            'budget' => $this->budget,
            'package_id' => $this->package_id,
            'event_type' => $this->event_type,
            'client_full_name' => $this->client_full_name,
            'client_email' => $this->client_email,
            'client_phone' => $this->client_phone,
            'venue_address_line' => $this->venue_address_line,
            'venue_street' => $this->venue_street,
            'venue_city' => $this->venue_city,
            'venue_province' => $this->venue_province,
            'venue_zip_code' => $this->venue_zip_code,
            'venue_building_details' => $this->venue_building_details,
            'reservation_time' => $this->reservation_time,
            'serving_time' => $this->serving_time,
            'event_timeline' => $this->event_timeline,
            'color_motif' => $this->color_motif,
            'theme_uploads' => $this->theme_uploads,
            'special_instructions' => $this->special_instructions,
            'selected_menu' => $this->selected_menu,
            'outsourced_services' => $this->outsourced_services,
            'transport_fee' => $this->transport_fee,
            'labor_surcharge' => $this->labor_surcharge,
            'discount_value' => $this->discount_value,
            'discount_type' => $this->discount_type,
            'total_cost' => $this->total_cost,
            'totalCost' => (float) ($this->total_cost ?? $this->budget ?? 0),
            'status' => $this->status,
            'live_status' => $this->live_status,
            'created_at' => $this->created_at,
            'username' => $this->user->username ?? null,
            'user_email' => $this->user->email ?? null,
            'user_phone' => $this->user->phone ?? null,
            'role' => $this->user->role ?? null,
            'payments_count' => $this->whenLoaded('payments', fn () => $this->payments->count()),
            'paid_total' => $this->whenLoaded('payments', fn () => $this->payments->whereIn('status', ['Paid', 'Verified'])->sum(fn ($payment) => (float) $payment->amount)),
            'pending_payment_total' => $this->whenLoaded('payments', fn () => $this->payments->whereNotIn('status', ['Paid', 'Verified', 'Refunded'])->sum(fn ($payment) => (float) $payment->amount)),
            'payments' => PaymentResource::collection($this->whenLoaded('payments', fn () => $this->payments, collect())),
        ];
    }
}
