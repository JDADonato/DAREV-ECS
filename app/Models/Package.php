<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Package extends Model
{
    protected $fillable = [
        'name',
        'type',
        'base_price_per_head',
        'minimum_pax',
        'description',
        'inclusions',
        'menu_structure',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'base_price_per_head' => 'integer',
            'minimum_pax'         => 'integer',
            'inclusions'          => 'array',
            'menu_structure'      => 'array',
            'is_active'           => 'boolean',
        ];
    }
}
