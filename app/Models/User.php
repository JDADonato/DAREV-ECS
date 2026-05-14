<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'username',
        'password',
        'email',
        'phone',
        'role',
        'email_verified_at',
        'otp_code',
        'otp_expires_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'password',
        'remember_token',
        'otp_code',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'email_verified_at' => 'datetime',
            'otp_expires_at' => 'datetime',
        ];
    }

    // ─── Relationships ───

    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }

    public function foodTastings()
    {
        return $this->hasMany(FoodTasting::class);
    }

    public function sentMessages()
    {
        return $this->hasMany(Message::class, 'sender_id');
    }

    public function receivedMessages()
    {
        return $this->hasMany(Message::class, 'receiver_id');
    }

    /**
     * Conversations started by this user (as a client).
     */
    public function clientConversations()
    {
        return $this->hasMany(Conversation::class, 'client_id');
    }

    /**
     * Conversations claimed by this user (as staff).
     */
    public function staffConversations()
    {
        return $this->hasMany(Conversation::class, 'staff_id');
    }

    // ─── Role Helpers ───

    public function isAdmin(): bool
    {
        return $this->role === 'Admin';
    }

    public function isMarketing(): bool
    {
        return $this->role === 'Marketing';
    }

    public function isAccounting(): bool
    {
        return $this->role === 'Accounting';
    }

    public function isClient(): bool
    {
        return $this->role === 'Client';
    }
}
