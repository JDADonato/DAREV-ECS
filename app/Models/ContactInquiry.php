<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContactInquiry extends Model
{
    use HasFactory;

    protected $fillable = [
        'full_name',
        'email',
        'phone',
        'event_date',
        'pax',
        'event_type',
        'concern_type',
        'subject',
        'message',
        'status',
        'source',
        'assigned_to',
        'resolved_at',
        'staff_notes',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            'pax' => 'integer',
            'resolved_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
