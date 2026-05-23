<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BookingRejectedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Booking $booking,
        public ?string $reason = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $eventDate = $this->booking->event_date;

        return (new MailMessage)
            ->subject('Booking Status Update - Eloquente Catering')
            ->greeting("Hello {$notifiable->username}!")
            ->line("Unfortunately, your booking request could not be confirmed.")
            ->line("Event Date: " . \Carbon\Carbon::parse($eventDate)->format('F j, Y'))
            ->line("Booking Reference: #" . str_pad($this->booking->id, 5, '0', STR_PAD_LEFT))
            ->when($this->reason, function ($mail) {
                return $mail->line("Reason: {$this->reason}");
            })
            ->action('Browse Available Dates', route('booking.wizard'))
            ->line('Please contact us at 02-XXXX-XXXX for more information.')
            ->line('Thank you for your interest in Eloquente Catering!');
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'booking_id' => $this->booking->id,
            'type' => 'booking_rejected',
            'message' => "Your booking for " . \Carbon\Carbon::parse($this->booking->event_date)->format('F j, Y') . " has been rejected. " . ($this->reason ? "Reason: {$this->reason}" : ''),
        ];
    }
}
