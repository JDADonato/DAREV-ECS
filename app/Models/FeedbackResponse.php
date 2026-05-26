<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedbackResponse extends Model
{
    protected $fillable = [
        'feedback_request_id',
        'booking_id',
        'user_id',
        'rating',
        'food_rating',
        'service_rating',
        'communication_rating',
        'value_rating',
        'comments',
        'testimonial_permission',
        'follow_up_required',
    ];

    protected $casts = [
        'testimonial_permission' => 'boolean',
        'follow_up_required' => 'boolean',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(FeedbackRequest::class, 'feedback_request_id');
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
