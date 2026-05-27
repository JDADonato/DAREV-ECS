<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Handles notification retrieval and management for all user roles.
 * Uses Laravel's built-in notification system with the database channel.
 */
class NotificationController extends Controller
{
    /**
     * Get all notifications for the authenticated user.
     * Returns the most recent 50 notifications.
     */
    public function index()
    {
        $user = Auth::user();

        $notifications = $user->notifications()
            ->latest()
            ->take(50)
            ->get()
            ->map(function ($notification) {
                $type = $notification->data['type'] ?? 'general';
                $message = $notification->data['message'] ?? '';
                $priority = $notification->data['priority'] ?? $this->notificationPriority($type, $message);
                $category = $notification->data['category'] ?? $this->notificationCategory($type, $message);

                return [
                    'id' => $notification->id,
                    'type' => $type,
                    'message' => $message,
                    'booking_id' => $notification->data['booking_id'] ?? null,
                    'target_type' => $notification->data['target_type'] ?? (isset($notification->data['booking_id']) ? 'booking' : null),
                    'target_id' => $notification->data['target_id'] ?? ($notification->data['booking_id'] ?? null),
                    'action_url' => $notification->data['action_url'] ?? null,
                    'priority' => $priority,
                    'category' => $category,
                    'read_at' => $notification->read_at,
                    'created_at' => $notification->created_at->toISOString(),
                    'time_ago' => $notification->created_at->diffForHumans(),
                ];
            });

        return response()->json($notifications);
    }

    /**
     * Get the count of unread notifications.
     */
    public function unreadCount()
    {
        $count = Auth::user()->unreadNotifications()->count();
        return response()->json(['count' => $count]);
    }

    /**
     * Mark a specific notification as read.
     */
    public function markAsRead(string $id)
    {
        $notification = Auth::user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return response()->json(['success' => true]);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead()
    {
        Auth::user()->unreadNotifications->markAsRead();

        return response()->json(['success' => true]);
    }

    /**
     * Remove a notification from the authenticated user's list.
     */
    public function destroy(string $id)
    {
        $notification = Auth::user()->notifications()->findOrFail($id);
        $notification->delete();

        return response()->json(['success' => true]);
    }

    private function notificationPriority(string $type, string $message): string
    {
        $text = strtolower($type . ' ' . $message);

        if (str_contains($text, 'failed') || str_contains($text, 'rejected') || str_contains($text, 'overdue') || str_contains($text, 'refund')) {
            return 'urgent';
        }

        if (str_contains($text, 'new_booking') || str_contains($text, 'clarification') || str_contains($text, 'payment') || str_contains($text, 'transfer')) {
            return 'action';
        }

        return 'info';
    }

    private function notificationCategory(string $type, string $message): string
    {
        $text = strtolower($type . ' ' . $message);

        if (str_contains($text, 'booking') || str_contains($text, 'event')) return 'booking';
        if (str_contains($text, 'payment') || str_contains($text, 'refund')) return 'finance';
        if (str_contains($text, 'chat') || str_contains($text, 'message')) return 'message';
        if (str_contains($text, 'feedback') || str_contains($text, 'testimonial')) return 'feedback';

        return 'update';
    }
}
