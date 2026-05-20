<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
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
        return $this->newStatus === 'Confirmed'
            ? ['mail', 'database']
            : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $eventDate = \Carbon\Carbon::parse($this->booking->event_date)->format('F j, Y');
        $reference = str_pad($this->booking->id, 5, '0', STR_PAD_LEFT);
        $total = (float) ($this->booking->total_cost ?? $this->booking->budget ?? 0);

        return (new MailMessage)
            ->subject('Booking Approved - Eloquente Catering')
            ->greeting("Hello {$notifiable->username}!")
            ->line('Great news! Your catering booking has been approved.')
            ->line("Event Date: {$eventDate}")
            ->line("Number of Guests: {$this->booking->pax}")
            ->line("Booking Reference: #{$reference}")
            ->line('Total Amount: PHP ' . number_format($total, 2))
            ->action('View Booking Details', route('dashboard.client'))
            ->line('You can now proceed with the required payment steps from your dashboard.');
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
