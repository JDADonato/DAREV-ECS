<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BusinessRule extends Model
{
    protected $fillable = [
        'minimum_lead_days',
        'maximum_capacity_per_day',
        'maximum_pax_per_event',
        'minimum_pax_per_event',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'minimum_lead_days'        => 'integer',
            'maximum_capacity_per_day' => 'integer',
            'maximum_pax_per_event'    => 'integer',
            'minimum_pax_per_event'    => 'integer',
            'is_active'                => 'boolean',
        ];
    }

    public static function getActive(): self
    {
        return self::whereRaw('is_active is true')->first() ?? self::first();
    }
}
