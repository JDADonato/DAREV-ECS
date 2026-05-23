<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'booking_id' => $this->booking_id,
            'amount' => (float) $this->amount,
            'payment_method' => $this->payment_method,
            'status' => $this->status,
            'payment_type' => $this->payment_type,
            'due_date' => $this->due_date,
            'verified_by' => $this->verified_by,
            'verified_at' => $this->verified_at,
            'paymongo_checkout_session_id' => $this->paymongo_checkout_session_id ?? null,
            'paymongo_payment_id' => $this->paymongo_payment_id ?? null,
            'paymongo_reference_number' => $this->paymongo_reference_number ?? null,
        ];
    }
}
