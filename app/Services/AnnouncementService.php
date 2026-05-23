<?php

namespace App\Services;

use App\Mail\AnnouncementEmail;
use App\Models\Announcement;
use App\Models\AnnouncementRecipient;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AnnouncementService
{
    public function publish(Announcement $announcement, User $actor): Announcement
    {
        $announcement->update([
            'status' => 'published',
            'published_at' => now(),
            'approved_by' => $actor->id,
            'updated_by' => $actor->id,
            'starts_at' => $announcement->starts_at ?: now(),
        ]);

        if ($announcement->send_email) {
            $this->queueEmailDelivery($announcement);
        }

        return $announcement->fresh(['recipients', 'reads']);
    }

    public function archive(Announcement $announcement, User $actor): Announcement
    {
        $announcement->update([
            'status' => 'archived',
            'updated_by' => $actor->id,
        ]);

        return $announcement->fresh(['recipients', 'reads']);
    }

    public function resolveRecipients(Announcement $announcement): Collection
    {
        $query = User::query()->whereNotNull('email');

        if ($announcement->visibility === 'active_clients') {
            $query->where('role', 'Client')->whereHas('bookings');
        } elseif ($announcement->visibility === 'specific_roles') {
            $roles = $announcement->visibility_roles ?: ['Client'];
            $query->whereIn('role', $roles);
        } elseif ($announcement->visibility === 'specific_users') {
            $ids = $announcement->specific_user_ids ?: [];
            $query->whereIn('id', $ids);
        } else {
            $query->where('role', 'Client');
        }

        return $query->get();
    }

    public function queueEmailDelivery(Announcement $announcement): int
    {
        $count = 0;

        foreach ($this->resolveRecipients($announcement) as $user) {
            $recipient = AnnouncementRecipient::firstOrCreate(
                ['announcement_id' => $announcement->id, 'user_id' => $user->id],
                ['email' => $user->email, 'status' => 'pending']
            );

            try {
                Mail::to($user->email)->queue(new AnnouncementEmail($announcement));
                $recipient->update([
                    'email' => $user->email,
                    'status' => 'sent',
                    'sent_at' => now(),
                ]);
                $count++;
            } catch (\Throwable $e) {
                $recipient->update([
                    'email' => $user->email,
                    'status' => 'failed',
                ]);
            }
        }

        return $count;
    }

    public function uniqueSlug(string $title, ?int $ignoreId = null): string
    {
        $base = Str::slug($title) ?: 'announcement';
        $slug = $base;
        $i = 2;

        while (Announcement::where('slug', $slug)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }
}
