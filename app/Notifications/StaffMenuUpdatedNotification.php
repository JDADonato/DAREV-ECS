<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class StaffMenuUpdatedNotification extends Notification
{
    use Queueable;

    public $booking;
    public $newTotal;

    public function __construct(Booking $booking, $newTotal = null)
    {
        $this->booking = $booking;
        $this->newTotal = $newTotal;
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $message = "Booking #{$this->booking->id} menu updated.";
        if ($notifiable->role === 'Accounting') {
            $message = "Booking #{$this->booking->id} has a pricing update due to menu changes. New total: ₱" . number_format($this->newTotal, 2);
        } else if ($notifiable->role === 'Marketing') {
            $message = "Client updated their menu for Booking #{$this->booking->id}.";
        }

        return [
            'type' => 'menu_updated',
            'booking_id' => $this->booking->id,
            'title' => 'Menu Updated',
            'message' => $message,
        ];
    }
}
