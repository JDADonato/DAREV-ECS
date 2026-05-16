<?php

namespace App\Http\Controllers;

use App\Events\ConversationClaimed;
use App\Events\ConversationCreated;
use App\Events\MessageSent;
use App\Models\Booking;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Notifications\NewChatMessageNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Phase 2: WebSocket-powered Ticket/Claiming Chat Controller.
 *
 * Replaces the polling-based MessageController with a conversation-centric
 * approach. Clients send messages into a general queue; Marketing staff
 * claim and handle conversations individually.
 */
class ChatController extends Controller
{
    // ─────────────────────────────────────────────
    //  Conversation Listing
    // ─────────────────────────────────────────────

    /**
     * GET /api/chat/conversations
     *
     * Returns conversations based on the user's role:
     * - Client: their own conversations
     * - Marketing/Admin: two lists (unassigned + my active chats)
     */
    public function conversations()
    {
        $user = Auth::user();

        if ($user->role === 'Client') {
            return response()->json([
                'conversations' => $this->getClientConversations($user),
            ]);
        }

        // Staff gets both lists
        return response()->json([
            'unassigned' => $this->getUnassignedQueue(),
            'my_chats' => $this->getMyActiveChats($user),
        ]);
    }

    /**
     * GET /api/chat/unassigned
     *
     * Fetch conversations where staff_id is null (the unassigned queue).
     * Only accessible by Marketing/Admin.
     */
    public function unassigned()
    {
        return response()->json($this->getUnassignedQueue());
    }

    /**
     * GET /api/chat/my-chats
     *
     * Fetch active conversations claimed by the authenticated staff member.
     */
    public function myChats()
    {
        $user = Auth::user();
        return response()->json($this->getMyActiveChats($user));
    }

    // ─────────────────────────────────────────────
    //  Messages
    // ─────────────────────────────────────────────

    /**
     * GET /api/chat/conversations/{conversation}/messages
     *
     * Fetch all messages for a given conversation.
     * Authorization: user must be the client or the assigned staff (or any staff for unassigned).
     */
    public function messages(Conversation $conversation)
    {
        $user = Auth::user();
        $this->authorizeConversationAccess($user, $conversation);

        $messages = $conversation->messages()
            ->with('sender:id,username,role')
            ->get()
            ->map(fn ($msg) => $this->formatMessage($msg, $user));

        // Mark unread messages from the other party as read
        $conversation->messages()
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json($messages);
    }

    /**
     * POST /api/chat/conversations/{conversation}/messages
     *
     * Send a message within a conversation and broadcast it via Reverb.
     */
    public function sendMessage(Request $request, Conversation $conversation)
    {
        $request->validate([
            'message' => 'required|string|max:5000',
        ]);

        $user = Auth::user();
        $this->authorizeConversationAccess($user, $conversation);

        // Staff can only send if they've claimed this conversation
        if (in_array($user->role, ['Marketing', 'Admin']) && $conversation->staff_id !== $user->id) {
            return response()->json([
                'error' => 'You must claim this conversation before sending messages.',
            ], 403);
        }

        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $user->id,
            'message' => $request->message,
        ]);

        $message->load('sender:id,username,role');

        // Broadcast the message to the conversation channel
        broadcast(new MessageSent($message))->toOthers();

        // ── Step 4: Email notification with 15-minute cooldown ──
        // Only send when staff replies to a client (not the other way around)
        if (in_array($user->role, ['Marketing', 'Admin'])) {
            $client = $conversation->client;
            if ($client && $client->email) {
                $cacheKey = "chat_email_cooldown:{$conversation->id}";

                if (!Cache::has($cacheKey)) {
                    // Dispatch the queued email notification
                    $client->notify(new NewChatMessageNotification($message, $conversation, $user));

                    // Set the 15-minute cooldown
                    Cache::put($cacheKey, true, now()->addMinutes(15));
                }
            }
        }

        return response()->json($this->formatMessage($message, $user), 201);
    }

    // ─────────────────────────────────────────────
    //  Client: Start a Conversation
    // ─────────────────────────────────────────────

    /**
     * POST /api/chat/conversations
     *
     * Client starts a new conversation (or resumes their existing active one).
     * The first message is included in the request.
     */
    public function startConversation(Request $request)
    {
        $request->validate([
            'message' => 'required|string|max:5000',
        ]);

        $user = Auth::user();

        if ($user->role !== 'Client') {
            return response()->json(['error' => 'Only clients can start conversations.'], 403);
        }

        // Check if the client already has an active conversation
        $conversation = Conversation::where('client_id', $user->id)
            ->where('status', 'active')
            ->first();

        $isNew = false;
        if (!$conversation) {
            $conversation = Conversation::create([
                'client_id' => $user->id,
                'status' => 'active',
            ]);
            $isNew = true;
        }

        // Create the first message
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $user->id,
            'message' => $request->message,
        ]);

        $message->load('sender:id,username,role');

        // Broadcast events
        if ($isNew) {
            $conversation->load('client:id,username,email');
            broadcast(new ConversationCreated($conversation));
        }
        broadcast(new MessageSent($message))->toOthers();

        return response()->json([
            'conversation' => [
                'id' => $conversation->id,
                'client_id' => $conversation->client_id,
                'staff_id' => $conversation->staff_id,
                'status' => $conversation->status,
            ],
            'message' => $this->formatMessage($message, $user),
        ], $isNew ? 201 : 200);
    }

    // ─────────────────────────────────────────────
    //  Staff: Claim & Resolve
    // ─────────────────────────────────────────────

    /**
     * POST /api/chat/conversations/{conversation}/claim
     *
     * Staff claims an unassigned conversation.
     * Uses optimistic locking to prevent two staff from claiming simultaneously.
     */
    public function claim(Conversation $conversation)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['Marketing', 'Admin'])) {
            return response()->json(['error' => 'Only staff can claim conversations.'], 403);
        }

        if ($conversation->isClaimed()) {
            return response()->json([
                'error' => 'This conversation has already been claimed by ' . ($conversation->staff->username ?? 'another staff member') . '.',
            ], 409); // 409 Conflict
        }

        // Atomically claim (prevents race conditions)
        $updated = Conversation::where('id', $conversation->id)
            ->whereNull('staff_id')
            ->update(['staff_id' => $user->id]);

        if (!$updated) {
            return response()->json([
                'error' => 'This conversation was just claimed by another staff member.',
            ], 409);
        }

        $conversation->refresh();
        $conversation->load(['client:id,username,email', 'staff:id,username']);

        // Broadcast to all staff and the client
        broadcast(new ConversationClaimed($conversation));

        return response()->json([
            'success' => true,
            'conversation' => [
                'id' => $conversation->id,
                'client_id' => $conversation->client_id,
                'client_name' => $conversation->client->username,
                'staff_id' => $conversation->staff_id,
                'staff_name' => $conversation->staff->username,
                'status' => $conversation->status,
            ],
        ]);
    }

    /**
     * POST /api/chat/conversations/{conversation}/resolve
     *
     * Staff marks a conversation as resolved (closed).
     */
    public function resolve(Conversation $conversation)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['Marketing', 'Admin'])) {
            return response()->json(['error' => 'Only staff can resolve conversations.'], 403);
        }

        if ($conversation->staff_id !== $user->id) {
            return response()->json(['error' => 'You can only resolve your own claimed conversations.'], 403);
        }

        $conversation->update(['status' => 'resolved']);

        return response()->json([
            'success' => true,
            'message' => 'Conversation resolved successfully.',
        ]);
    }

    /**
     * POST /api/chat/conversations/{conversation}/transfer
     *
     * Staff transfers a conversation to another staff member.
     */
    public function transfer(Request $request, Conversation $conversation)
    {
        $request->validate([
            'new_staff_id' => 'required|exists:users,id',
        ]);

        $user = Auth::user();

        if (!in_array($user->role, ['Marketing', 'Admin'])) {
            return response()->json(['error' => 'Only staff can transfer conversations.'], 403);
        }

        if ($conversation->staff_id !== $user->id) {
            return response()->json(['error' => 'You can only transfer your own claimed conversations.'], 403);
        }

        $newStaff = User::find($request->new_staff_id);
        if (!in_array($newStaff->role, ['Marketing', 'Admin'])) {
            return response()->json(['error' => 'Can only transfer to Marketing or Admin.'], 422);
        }

        $conversation->update(['staff_id' => $newStaff->id]);

        $conversation->refresh();
        $conversation->load(['client:id,username,email', 'staff:id,username']);

        // Broadcast claim event so UI updates for everyone
        broadcast(new ConversationClaimed($conversation));

        return response()->json([
            'success' => true,
            'message' => 'Conversation transferred successfully.',
        ]);
    }

    // ─────────────────────────────────────────────
    //  Utility: Staff & Unread
    // ─────────────────────────────────────────────

    /**
     * GET /api/chat/staff/available
     */
    public function availableStaff()
    {
        $user = Auth::user();
        if (!in_array($user->role, ['Marketing', 'Admin'])) {
            return response()->json([]);
        }

        $staff = User::whereIn('role', ['Marketing', 'Admin'])
            ->where('id', '!=', $user->id)
            ->select('id', 'username', 'role')
            ->get();

        return response()->json($staff);
    }

    /**
     * GET /api/chat/unread-count
     *
     * Returns the total unread message count for the authenticated user.
     */
    public function unreadCount()
    {
        $user = Auth::user();

        if ($user->role === 'Client') {
            // Count unread messages in the client's active conversations
            $count = Message::whereIn('conversation_id', function ($q) use ($user) {
                    $q->select('id')
                      ->from('conversations')
                      ->where('client_id', $user->id)
                      ->where('status', 'active');
                })
                ->where('sender_id', '!=', $user->id)
                ->whereNull('read_at')
                ->count();
        } else {
            // Staff: count unread across their claimed conversations
            $count = Message::whereIn('conversation_id', function ($q) use ($user) {
                    $q->select('id')
                      ->from('conversations')
                      ->where('staff_id', $user->id)
                      ->where('status', 'active');
                })
                ->where('sender_id', '!=', $user->id)
                ->whereNull('read_at')
                ->count();

            // Also count total unassigned conversations as "pending attention"
            $unassignedCount = Conversation::unassigned()->count();
            return response()->json([
                'count' => $count,
                'unassigned_count' => $unassignedCount,
            ]);
        }

        return response()->json(['count' => $count]);
    }

    /**
     * GET /api/chat/my-bookings
     *
     * Returns the client's bookings for sharing in chat (unchanged from original).
     */
    public function myBookings()
    {
        $user = Auth::user();

        if ($user->role !== 'Client') {
            return response()->json([]);
        }

        // Issue 4: Exclude cancelled and expired bookings from the chat share dropdown
        $bookings = Booking::where('user_id', $user->id)
            ->whereNotIn('status', ['Cancelled', 'Canceled', 'Expired'])
            ->orderBy('event_date', 'desc')
            ->get()
            ->map(fn ($b) => [
                'id' => $b->id,
                'event_date' => $b->event_date,
                'event_time' => $b->event_time,
                'event_type' => $b->event_type,
                'pax' => $b->pax,
                'status' => $b->status,
                'total_cost' => $b->total_cost,
                'venue_city' => $b->venue_city,
                'client_full_name' => $b->client_full_name,
            ]);

        return response()->json($bookings);
    }

    // ─────────────────────────────────────────────
    //  Private Helpers
    // ─────────────────────────────────────────────

    /**
     * Authorize that a user can access a conversation.
     */
    private function authorizeConversationAccess($user, Conversation $conversation): void
    {
        $isClient = $user->id === $conversation->client_id;
        $isAssignedStaff = $user->id === $conversation->staff_id;
        $isStaffViewingUnassigned = in_array($user->role, ['Marketing', 'Admin']) && is_null($conversation->staff_id);
        $isStaffRole = in_array($user->role, ['Marketing', 'Admin']);

        if (!$isClient && !$isAssignedStaff && !$isStaffViewingUnassigned && !$isStaffRole) {
            abort(403, 'You do not have access to this conversation.');
        }
    }

    /**
     * Format a message for JSON response.
     */
    private function formatMessage($msg, $currentUser): array
    {
        // Convert created_at to Asia/Manila for display
        $localTime = $msg->created_at->setTimezone('Asia/Manila');

        return [
            'id' => $msg->id,
            'conversation_id' => $msg->conversation_id,
            'sender_id' => $msg->sender_id,
            'message' => $msg->message,
            'is_mine' => $msg->sender_id === $currentUser->id,
            'read_at' => $msg->read_at,
            'created_at' => $msg->created_at->toISOString(),
            'time' => $localTime->format('g:i A'),
            'sender_name' => $msg->sender->username ?? 'Unknown',
            'sender_role' => $msg->sender->role ?? 'Unknown',
            'is_booking_card' => str_starts_with($msg->message, '📋 BOOKING DETAILS'),
        ];
    }

    /**
     * Get conversations in the unassigned queue.
     */
    private function getUnassignedQueue(): array
    {
        return Conversation::unassigned()
            ->with(['client:id,username,email', 'latestMessage.sender:id,username'])
            ->withCount(['messages as unread_count' => function ($q) {
                $q->whereNull('read_at');
            }])
            ->latest()
            ->get()
            ->map(fn ($conv) => [
                'id' => $conv->id,
                'client_id' => $conv->client_id,
                'client_name' => $conv->client->username ?? 'Unknown',
                'client_email' => $conv->client->email ?? null,
                'staff_id' => null,
                'status' => $conv->status,
                'last_message' => $conv->latestMessage
                    ? Str::limit($conv->latestMessage->message, 60)
                    : '',
                'last_message_time' => $conv->latestMessage
                    ? $conv->latestMessage->created_at->diffForHumans()
                    : $conv->created_at->diffForHumans(),
                'unread_count' => $conv->unread_count,
            ])
            ->toArray();
    }

    /**
     * Get active conversations claimed by the given staff user.
     */
    private function getMyActiveChats($user): array
    {
        return Conversation::claimedBy($user->id)
            ->with(['client:id,username,email', 'latestMessage.sender:id,username'])
            ->withCount(['messages as unread_count' => function ($q) use ($user) {
                $q->where('sender_id', '!=', $user->id)->whereNull('read_at');
            }])
            ->latest()
            ->get()
            ->map(fn ($conv) => [
                'id' => $conv->id,
                'client_id' => $conv->client_id,
                'client_name' => $conv->client->username ?? 'Unknown',
                'client_email' => $conv->client->email ?? null,
                'staff_id' => $conv->staff_id,
                'status' => $conv->status,
                'last_message' => $conv->latestMessage
                    ? Str::limit($conv->latestMessage->message, 60)
                    : '',
                'last_message_time' => $conv->latestMessage
                    ? $conv->latestMessage->created_at->diffForHumans()
                    : '',
                'unread_count' => $conv->unread_count,
            ])
            ->toArray();
    }

    /**
     * Get conversations for a client user.
     */
    private function getClientConversations($user): array
    {
        return Conversation::where('client_id', $user->id)
            ->where('status', 'active')
            ->with(['staff:id,username', 'latestMessage.sender:id,username'])
            ->withCount(['messages as unread_count' => function ($q) use ($user) {
                $q->where('sender_id', '!=', $user->id)->whereNull('read_at');
            }])
            ->latest()
            ->get()
            ->map(fn ($conv) => [
                'id' => $conv->id,
                'client_id' => $conv->client_id,
                'staff_id' => $conv->staff_id,
                'staff_name' => $conv->staff->username ?? null,
                'status' => $conv->status,
                'last_message' => $conv->latestMessage
                    ? Str::limit($conv->latestMessage->message, 60)
                    : '',
                'last_message_time' => $conv->latestMessage
                    ? $conv->latestMessage->created_at->diffForHumans()
                    : '',
                'unread_count' => $conv->unread_count,
            ])
            ->toArray();
    }
}
