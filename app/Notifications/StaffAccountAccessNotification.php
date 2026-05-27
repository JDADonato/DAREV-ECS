<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StaffAccountAccessNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $temporaryPassword,
        private readonly string $purpose = 'created',
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $subject = $this->purpose === 'reset'
            ? 'Your Eloquente staff password was reset'
            : 'Your Eloquente staff account is ready';

        return (new MailMessage)
            ->subject($subject)
            ->greeting('Hello ' . ($notifiable->full_name ?: $notifiable->username) . ',')
            ->line('You can now sign in to the Eloquente staff workspace.')
            ->line('Temporary password: ' . $this->temporaryPassword)
            ->line('For security, you will be asked to set your own password after signing in.')
            ->action('Sign in', url('/login'))
            ->line('If you were not expecting this, please contact the administrator.');
    }
}
