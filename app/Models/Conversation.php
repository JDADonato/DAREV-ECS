<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'staff_id',
        'status',
    ];

    // ─── Relationships ───

    /**
     * The client who started this conversation.
     */
    public function client()
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    /**
     * The staff member who claimed this conversation (nullable).
     */
    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    /**
     * All messages in this conversation.
     */
    public function messages()
    {
        return $this->hasMany(Message::class)->orderBy('created_at', 'asc');
    }

    /**
     * The latest message in this conversation (for sidebar previews).
     */
    public function latestMessage()
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    // ─── Scopes ───

    /**
     * Conversations waiting in the unassigned queue.
     */
    public function scopeUnassigned($query)
    {
        return $query->whereNull('staff_id')->where('status', 'active');
    }

    /**
     * Active conversations claimed by a specific staff member.
     */
    public function scopeClaimedBy($query, int $staffId)
    {
        return $query->where('staff_id', $staffId)->where('status', 'active');
    }

    /**
     * All resolved conversations.
     */
    public function scopeResolved($query)
    {
        return $query->where('status', 'resolved');
    }

    // ─── Helpers ───

    /**
     * Check if the conversation has been claimed by any staff.
     */
    public function isClaimed(): bool
    {
        return !is_null($this->staff_id);
    }

    /**
     * Check if the conversation is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
