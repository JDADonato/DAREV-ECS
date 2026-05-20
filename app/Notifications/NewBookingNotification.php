<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NewBookingNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Booking $booking
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $booking = $this->booking;
        $eventDate = \Carbon\Carbon::parse($booking->event_date);

        return (new MailMessage)
            ->subject('New Booking Received - Eloquente Catering')
            ->greeting("Hello {$notifiable->username}!")
            ->line("A new booking has been submitted and requires review.")
            ->line("Client: {$booking->client_full_name}")
            ->line("Event Date: " . $eventDate->format('F j, Y'))
            ->line("Number of Guests: {$booking->pax}")
            ->line("Venue: {$booking->venue_address_line}, {$booking->venue_city}")
            ->line("Total Cost: ₱" . number_format($booking->total_cost, 2))
            ->line("Status: {$booking->status}")
            ->action('Review Booking', route('dashboard.marketing'))
            ->line('Please review this booking and update its status accordingly.');
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'booking_id' => $this->booking->id,
            'type' => 'new_booking',
            'message' => "New booking from {$this->booking->client_full_name} for {$this->booking->pax} guests on " . \Carbon\Carbon::parse($this->booking->event_date)->format('F j, Y'),
        ];
    }
}
