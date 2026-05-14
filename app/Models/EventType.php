<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EventType extends Model
{
    protected $fillable = ['slug', 'label', 'icon', 'description', 'image'];

    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }
}
