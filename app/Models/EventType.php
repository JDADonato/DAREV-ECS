<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EventType extends Model
{
    protected $fillable = [
        'slug',
        'label',
        'icon',
        'description',
        'image',
        'package_category',
        'applicable_setups',
        'security_type',
        'security_label',
        'security_description',
    ];

    protected function casts(): array
    {
        return [
            'applicable_setups' => 'array',
        ];
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }
}
