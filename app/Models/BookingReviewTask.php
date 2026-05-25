<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BookingReviewTask extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'task_type',
        'label',
        'status',
        'assigned_to',
        'completed_by',
        'completed_at',
        'customer_visible',
        'customer_response',
    ];

    protected function casts(): array
    {
        return [
            'customer_visible' => 'boolean',
            'completed_at' => 'datetime',
        ];
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function completedBy()
    {
        return $this->belongsTo(User::class, 'completed_by');
    }
}
