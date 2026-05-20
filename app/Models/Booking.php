<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'event_date',
        'event_time',
        'pax',
        'budget',
        'package_id',
        'event_type',
        'event_type_id',
        'client_full_name',
        'venue_address_line',
        'venue_street',
        'venue_city',
        'venue_province',
        'venue_zip_code',
        'venue_building_details',
        'client_email',
        'client_phone',
        'reservation_time',
        'serving_time',
        'event_timeline',
        'color_motif',
        'food_tasting_id',
        'total_cost',
        'status',
        'outsourced_services',
        'theme_uploads',
        'special_instructions',
        'selected_menu',
        'live_status',
        'transport_fee',
        'labor_surcharge',
        'discount_value',
        'discount_type',
        'expires_at',
        'milestone_step',
    ];

    /**
     * Attribute casting — JSON fields are auto-serialized/deserialized.
     */
    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            'expires_at' => 'datetime',
            'total_cost' => 'decimal:2',
            'transport_fee' => 'decimal:2',
            'labor_surcharge' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'pax' => 'integer',
            'budget' => 'integer',
        ];
    }

    // ─── Relationships ───

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function eventType()
    {
        return $this->belongsTo(EventType::class);
    }

    public function bookingItems()
    {
        return $this->hasMany(BookingItem::class);
    }

    public function menuItems()
    {
        return $this->belongsToMany(MenuItem::class, 'booking_items', 'booking_id', 'menu_item_id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function foodTasting()
    {
        return $this->belongsTo(FoodTasting::class);
    }

    // ─── Helpers ───

    /**
     * Get decoded selected_menu as array.
     */
    public function getSelectedMenuArrayAttribute(): ?array
    {
        return $this->selected_menu ? json_decode($this->selected_menu, true) : null;
    }

    /**
     * Get decoded outsourced_services as array.
     */
    public function getOutsourcedServicesArrayAttribute(): ?array
    {
        return $this->outsourced_services ? json_decode($this->outsourced_services, true) : null;
    }
}
