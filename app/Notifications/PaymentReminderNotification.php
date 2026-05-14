<?php

namespace App\Notifications;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PaymentReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Payment $payment
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $booking = $this->payment->booking;
        $daysUntilDue = \Carbon\Carbon::parse($this->payment->due_date)->diffInDays(\Carbon\Carbon::now());

        return (new MailMessage)
            ->subject('Payment Reminder - Eloquente Catering')
            ->greeting("Hello {$notifiable->username}!")
            ->line("This is a friendly reminder about your upcoming payment.")
            ->line("Payment Type: {$this->payment->payment_type}")
            ->line("Amount Due: ₱" . number_format($this->payment->amount, 2))
            ->line("Due Date: " . \Carbon\Carbon::parse($this->payment->due_date)->format('F j, Y'))
            ->when($daysUntilDue > 0, function ($mail) use ($daysUntilDue) {
                return $mail->line("Days Remaining: {$daysUntilDue}");
            })
            ->line("Booking Reference: #" . str_pad($booking->id, 5, '0', STR_PAD_LEFT))
            ->action('View Payment Details', route('payment.page'))
            ->line('Please make your payment on or before the due date to maintain your booking.')
            ->line('Thank you!');
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'payment_id' => $this->payment->id,
            'booking_id' => $this->payment->booking_id,
            'type' => 'payment_reminder',
            'message' => "Payment reminder: ₱" . number_format($this->payment->amount, 2) . " ({$this->payment->payment_type}) due on " . \Carbon\Carbon::parse($this->payment->due_date)->format('F j, Y'),
        ];
    }
}
