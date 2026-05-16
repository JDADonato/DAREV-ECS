<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Handles chat messaging between Clients and Marketing Staff.
 * Clients can message Marketing staff only.
 * Marketing/Admin staff can view and reply to all client conversations.
 */
class MessageController extends Controller
{
    /**
     * Get conversations list for the current user.
     * For Clients: returns their conversations with staff.
     * For Marketing/Admin: returns all client conversations.
     */
    public function conversations()
    {
        $user = Auth::user();

        if ($user->role === 'Client') {
            $conversations = $this->getClientConversations($user);
        } else {
            $conversations = $this->getStaffConversations($user);
        }

        return response()->json($conversations);
    }

    /**
     * Get messages for a specific conversation between current user and another user.
     */
    public function messages(int $userId)
    {
        $currentUser = Auth::user();

        // For staff, when viewing a client conversation, get messages between
        // the client and ANY staff (shared inbox approach)
        if (in_array($currentUser->role, ['Marketing', 'Admin'])) {
            $targetUser = User::find($userId);
            if ($targetUser && $targetUser->role === 'Client') {
                return $this->getStaffViewMessages($currentUser, $userId);
            }
        }

        // Default: messages between the two users directly
        $messages = Message::where(function ($q) use ($currentUser, $userId) {
                $q->where('sender_id', $currentUser->id)->where('receiver_id', $userId);
            })
            ->orWhere(function ($q) use ($currentUser, $userId) {
                $q->where('sender_id', $userId)->where('receiver_id', $currentUser->id);
            })
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($msg) use ($currentUser) {
                return $this->formatMessage($msg, $currentUser);
            });

        // Mark messages from the other user as read
        Message::where('sender_id', $userId)
            ->where('receiver_id', $currentUser->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json($messages);
    }

    /**
     * Send a message to another user.
     */
    public function send(Request $request)
    {
        $request->validate([
            'receiver_id' => 'required|exists:users,id',
            'message' => 'required|string|max:5000',
        ]);

        $currentUser = Auth::user();

        // Clients can only message Marketing staff
        if ($currentUser->role === 'Client') {
            $receiver = User::find($request->receiver_id);
            if (!$receiver || $receiver->role !== 'Marketing') {
                return response()->json(['error' => 'You can only message marketing staff.'], 403);
            }
        }

        $message = Message::create([
            'sender_id' => $currentUser->id,
            'receiver_id' => $request->receiver_id,
            'message' => $request->message,
        ]);

        return response()->json([
            'id' => $message->id,
            'sender_id' => $message->sender_id,
            'receiver_id' => $message->receiver_id,
            'message' => $message->message,
            'is_mine' => true,
            'read_at' => null,
            'created_at' => $message->created_at->toISOString(),
            'time' => $message->created_at->setTimezone('Asia/Manila')->format('g:i A'),
            'sender_name' => $currentUser->username,
            'is_booking_card' => false,
        ], 201);
    }

    /**
     * Get available Marketing staff that a client can message.
     * Only returns Marketing role users (not Admin).
     */
    public function availableStaff()
    {
        $staff = User::where('role', 'Marketing')
            ->select('id', 'username', 'role')
            ->get();

        return response()->json($staff);
    }

    /**
     * Get unread message count for the current user.
     * For staff: counts unread messages from clients.
     */
    public function unreadCount()
    {
        $user = Auth::user();

        if (in_array($user->role, ['Marketing', 'Admin'])) {
            // Staff sees unread from clients to any staff
            $count = Message::whereIn('sender_id', function ($q) {
                    $q->select('id')->from('users')->where('role', 'Client');
                })
                ->whereIn('receiver_id', function ($q) {
                    $q->select('id')->from('users')->whereIn('role', ['Marketing', 'Admin']);
                })
                ->whereNull('read_at')
                ->count();
        } else {
            $count = Message::where('receiver_id', $user->id)
                ->whereNull('read_at')
                ->count();
        }

        return response()->json(['count' => $count]);
    }

    /**
     * Get the current user's bookings for sharing in chat.
     * Only available for Client role users.
     */
    public function myBookings()
    {
        $user = Auth::user();

        if ($user->role !== 'Client') {
            return response()->json([]);
        }

        $bookings = Booking::where('user_id', $user->id)
            ->whereNotIn('status', ['Cancelled', 'Canceled', 'Expired'])
            ->orderBy('event_date', 'desc')
            ->get()
            ->map(function ($b) {
                return [
                    'id' => $b->id,
                    'event_date' => $b->event_date,
                    'event_time' => $b->event_time,
                    'event_type' => $b->event_type,
                    'pax' => $b->pax,
                    'status' => $b->status,
                    'total_cost' => $b->total_cost,
                    'venue_city' => $b->venue_city,
                    'client_full_name' => $b->client_full_name,
                ];
            });

        return response()->json($bookings);
    }

    // ─── Private Helpers ───

    private function formatMessage($msg, $currentUser)
    {
        $messageText = $msg->message;
        $isBookingCard = str_starts_with($messageText, '📋 BOOKING DETAILS');
        // Convert timestamp to Asia/Manila for display
        $localTime = $msg->created_at->setTimezone('Asia/Manila');

        return [
            'id' => $msg->id,
            'sender_id' => $msg->sender_id,
            'receiver_id' => $msg->receiver_id,
            'message' => $messageText,
            'is_mine' => $msg->sender_id === $currentUser->id,
            'read_at' => $msg->read_at,
            'created_at' => $msg->created_at->toISOString(),
            'time' => $localTime->format('g:i A'),
            'sender_name' => $msg->sender->username ?? 'Unknown',
            'is_booking_card' => $isBookingCard,
        ];
    }

    /**
     * Staff view of messages: see all messages between a client and any staff member.
     */
    private function getStaffViewMessages($staffUser, int $clientId)
    {
        $staffIds = User::whereIn('role', ['Marketing', 'Admin'])->pluck('id');

        $messages = Message::where(function ($q) use ($clientId, $staffIds) {
                $q->where('sender_id', $clientId)->whereIn('receiver_id', $staffIds);
            })
            ->orWhere(function ($q) use ($clientId, $staffIds) {
                $q->whereIn('sender_id', $staffIds)->where('receiver_id', $clientId);
            })
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($msg) use ($staffUser) {
                return $this->formatMessage($msg, $staffUser);
            });

        // Mark messages from the client as read
        Message::where('sender_id', $clientId)
            ->whereIn('receiver_id', $staffIds)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json($messages);
    }

    private function getClientConversations(User $user)
    {
        // Get unique staff members the client has chatted with
        $staffIds = Message::where(function ($q) use ($user) {
                $q->where('sender_id', $user->id);
            })
            ->orWhere(function ($q) use ($user) {
                $q->where('receiver_id', $user->id);
            })
            ->get()
            ->map(function ($m) use ($user) {
                return $m->sender_id === $user->id ? $m->receiver_id : $m->sender_id;
            })
            ->unique()
            ->values();

        $conversations = [];
        foreach ($staffIds as $staffId) {
            $staff = User::find($staffId);
            if (!$staff || $staff->role !== 'Marketing') continue;

            $lastMessage = Message::where(function ($q) use ($user, $staffId) {
                    $q->where('sender_id', $user->id)->where('receiver_id', $staffId);
                })
                ->orWhere(function ($q) use ($user, $staffId) {
                    $q->where('sender_id', $staffId)->where('receiver_id', $user->id);
                })
                ->latest()
                ->first();

            $unread = Message::where('sender_id', $staffId)
                ->where('receiver_id', $user->id)
                ->whereNull('read_at')
                ->count();

            $conversations[] = [
                'user_id' => $staff->id,
                'username' => $staff->username,
                'role' => $staff->role,
                'last_message' => $lastMessage ? \Illuminate\Support\Str::limit($lastMessage->message, 60) : '',
                'last_message_time' => $lastMessage ? $lastMessage->created_at->diffForHumans() : '',
                'last_message_at' => $lastMessage ? $lastMessage->created_at->toISOString() : null,
                'unread_count' => $unread,
            ];
        }

        usort($conversations, function ($a, $b) {
            return strcmp($b['last_message_at'] ?? '', $a['last_message_at'] ?? '');
        });

        return $conversations;
    }

    private function getStaffConversations(User $user)
    {
        $staffIds = User::whereIn('role', ['Marketing', 'Admin'])->pluck('id');

        // Get all unique clients who have sent or received messages from any staff
        $clientIds = Message::where(function ($q) use ($staffIds) {
                $q->whereIn('receiver_id', $staffIds)
                  ->whereIn('sender_id', function ($sub) {
                      $sub->select('id')->from('users')->where('role', 'Client');
                  });
            })
            ->orWhere(function ($q) use ($staffIds) {
                $q->whereIn('sender_id', $staffIds)
                  ->whereIn('receiver_id', function ($sub) {
                      $sub->select('id')->from('users')->where('role', 'Client');
                  });
            })
            ->get()
            ->map(function ($m) use ($staffIds) {
                return $staffIds->contains($m->sender_id) ? $m->receiver_id : $m->sender_id;
            })
            ->unique()
            ->values();

        $conversations = [];
        foreach ($clientIds as $clientId) {
            $client = User::find($clientId);
            if (!$client || $client->role !== 'Client') continue;

            $lastMessage = Message::where(function ($q) use ($clientId, $staffIds) {
                    $q->where('sender_id', $clientId)->whereIn('receiver_id', $staffIds);
                })
                ->orWhere(function ($q) use ($clientId, $staffIds) {
                    $q->whereIn('sender_id', $staffIds)->where('receiver_id', $clientId);
                })
                ->latest()
                ->first();

            $unread = Message::where('sender_id', $clientId)
                ->whereIn('receiver_id', $staffIds)
                ->whereNull('read_at')
                ->count();

            $conversations[] = [
                'user_id' => $client->id,
                'username' => $client->username,
                'email' => $client->email,
                'role' => $client->role,
                'last_message' => $lastMessage ? \Illuminate\Support\Str::limit($lastMessage->message, 60) : '',
                'last_message_time' => $lastMessage ? $lastMessage->created_at->diffForHumans() : '',
                'last_message_at' => $lastMessage ? $lastMessage->created_at->toISOString() : null,
                'unread_count' => $unread,
            ];
        }

        usort($conversations, function ($a, $b) {
            return strcmp($b['last_message_at'] ?? '', $a['last_message_at'] ?? '');
        });

        return $conversations;
    }
}
