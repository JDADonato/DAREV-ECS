<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StaffAccountAccessNotification extends Notification
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
        $workspaceLabel = $notifiable->role === 'Admin' ? 'admin console' : 'staff workspace';
        $subject = $this->purpose === 'reset'
            ? 'Your Eloquente account password was reset'
            : 'Your Eloquente account is ready';

        return (new MailMessage)
            ->subject($subject)
            ->greeting('Hello ' . ($notifiable->full_name ?: $notifiable->username) . ',')
            ->line("You can now sign in to the Eloquente {$workspaceLabel}.")
            ->line('Temporary password: ' . $this->temporaryPassword)
            ->line('For security, you will be asked to set your own password after signing in.')
            ->action('Sign in', url('/login'))
            ->line('If you were not expecting this, please contact the administrator.');
    }
}
