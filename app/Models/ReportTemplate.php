<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReportTemplate extends Model
{
    protected $fillable = [
        'name',
        'description',
        'created_by',
        'visibility',
        'layout_json',
        'filters_json',
    ];

    protected $casts = [
        'layout_json' => 'array',
        'filters_json' => 'array',
    ];
}
