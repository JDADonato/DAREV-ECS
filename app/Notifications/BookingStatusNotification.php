<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Sent to the client when their booking status changes (Confirmed, Cancelled, etc.).
 */
class BookingStatusNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Booking $booking,
        public string $newStatus
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $eventDate = \Carbon\Carbon::parse($this->booking->event_date)->format('F j, Y');

        $messages = [
            'Confirmed' => "Great news! Your booking #{$this->booking->id} for {$eventDate} has been approved.",
            'Cancelled' => "Your booking #{$this->booking->id} for {$eventDate} has been cancelled.",
            'Completed' => "Your event (Booking #{$this->booking->id}) on {$eventDate} has been marked as completed. Thank you!",
        ];

        return [
            'booking_id' => $this->booking->id,
            'type' => 'booking_' . strtolower($this->newStatus),
            'message' => $messages[$this->newStatus] ?? "Your booking #{$this->booking->id} status changed to {$this->newStatus}.",
        ];
    }
}
