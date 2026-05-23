<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BookingConfirmedNotification extends Notification implements ShouldQueue
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
        $eventDate = $this->booking->event_date;
        $pax = $this->booking->pax;

        return (new MailMessage)
            ->subject('Booking Confirmed - Eloquente Catering')
            ->greeting("Hello {$notifiable->username}!")
            ->line("Your catering booking has been confirmed!")
            ->line("Event Date: " . \Carbon\Carbon::parse($eventDate)->format('F j, Y'))
            ->line("Number of Guests: {$pax}")
            ->line("Booking Reference: #" . str_pad($this->booking->id, 5, '0', STR_PAD_LEFT))
            ->line("Total Amount: ₱" . number_format($this->booking->total_cost, 2))
            ->action('View Booking Details', route('dashboard.client'))
            ->line("\nPayment Schedule:")
            ->line("• Reservation (10%): Due Immediately")
            ->line("• Down Payment (70%): Due 1 month before event")
            ->line("• Final Payment (20%): Due 10 days before event")
            ->line('Thank you for choosing Eloquente Catering!');
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'booking_id' => $this->booking->id,
            'type' => 'booking_confirmed',
            'message' => "Your booking for {$this->booking->pax} guests on " . \Carbon\Carbon::parse($this->booking->event_date)->format('F j, Y') . " has been confirmed.",
        ];
    }
}
