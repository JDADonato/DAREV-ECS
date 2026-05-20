<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'amount',
        'payment_method',
        'proof_image',
        'status',
        'payment_type',
        'due_date',
        'verified_by',
        'verified_at',
        'paymongo_checkout_session_id',
        'paymongo_payment_id',
        'paymongo_payment_intent_id',
        'paymongo_reference_number',
        'paymongo_event_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'due_date' => 'date',
            'verified_at' => 'datetime',
        ];
    }

    // ─── Relationships ───

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}
