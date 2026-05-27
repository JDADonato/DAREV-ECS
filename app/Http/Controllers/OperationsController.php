<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Conversation;
use App\Models\EventPreparationTask;
use App\Models\FoodTasting;
use App\Services\EventPreparationService;
use App\Support\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class OperationsController extends Controller
{
    public function preparationBoard(Request $request)
    {
        $query = $this->preparationBoardQuery($request);

        if ($request->boolean('paginated')) {
            $perPage = min(max((int) $request->query('per_page', 10), 1), 50);
            $bookings = $query->paginate($perPage);
            $rows = $bookings->getCollection()
                ->map(fn (Booking $booking) => $this->preparationRow($booking))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => [
                    'current_page' => $bookings->currentPage(),
                    'last_page' => $bookings->lastPage(),
                    'per_page' => $bookings->perPage(),
                    'total' => $bookings->total(),
                    'from' => $bookings->firstItem(),
                    'to' => $bookings->lastItem(),
                    'summary' => $this->preparationSummary($request),
                ],
                'links' => [
                    'first' => $bookings->url(1),
                    'last' => $bookings->url($bookings->lastPage()),
                    'prev' => $bookings->previousPageUrl(),
                    'next' => $bookings->nextPageUrl(),
                ],
            ]);
        }

        $rows = $query->get()
            ->map(fn (Booking $booking) => $this->preparationRow($booking))
            ->values();

        return response()->json($rows);
    }

    public function preparationBoardSummary(Request $request)
    {
        return ApiResponse::ok($this->preparationSummary($request));
    }

    private function preparationBoardQuery(Request $request)
    {
        $start = $request->filled('date_from')
            ? Carbon::parse($request->query('date_from'))->startOfDay()
            : Carbon::today();
        $end = $request->filled('date_to')
            ? Carbon::parse($request->query('date_to'))->endOfDay()
            : Carbon::today()->addDays((int) $request->query('days', 30));

        $query = Booking::query()
            ->with([
                'payments:id,booking_id,status',
                'preparationTasks' => fn ($query) => $query->orderBy('department')->orderBy('id'),
                'user:id,full_name,username,email',
            ])
            ->whereBetween('event_date', [$start->toDateString(), $end->toDateString()])
            ->where('status', 'Confirmed')
            ->orderBy('event_date')
            ->orderBy('event_time');

        if ($request->filled('search')) {
            $search = '%' . trim((string) $request->query('search')) . '%';
            $query->where(function ($inner) use ($search) {
                $inner->where('client_full_name', 'like', $search)
                    ->orWhere('client_email', 'like', $search)
                    ->orWhere('event_name', 'like', $search)
                    ->orWhere('event_type', 'like', $search)
                    ->orWhere('status', 'like', $search);
            });
        }

        $attention = $request->query('attention', 'all');
        if ($attention && $attention !== 'all') {
            $this->applyAttentionFilter($query, $attention);
        }

        if ($request->filled('department') && $request->query('department') !== 'all') {
            $query->whereHas('preparationTasks', fn ($taskQuery) => $taskQuery->where('department', $request->query('department')));
        }

        return $query;
    }

    private function preparationRow(Booking $booking): array
    {
        EventPreparationService::ensureDefaultTasks($booking);
        $booking->load(['payments', 'preparationTasks', 'user']);

        $tasks = $booking->preparationTasks;
        $completedTasks = $tasks->where('status', 'Done')->count();
        $taskTotal = $tasks->count();
        $readiness = $this->readinessFor($booking);

        return [
            'booking' => [
                'id' => $booking->id,
                'event_name' => $booking->event_name,
                'event_type' => $booking->event_type,
                'client_full_name' => $booking->client_full_name ?: $booking->user?->full_name ?: $booking->user?->username,
                'client_email' => $booking->client_email ?: $booking->user?->email,
                'event_date' => $booking->event_date,
                'event_time' => $booking->event_time,
                'pax' => $booking->pax,
                'venue_city' => $booking->venue_city,
                'venue_address_line' => $booking->venue_address_line,
                'status' => $booking->status,
                'review_status' => $booking->review_status,
                'total_cost' => $booking->total_cost,
            ],
            'readiness' => $readiness,
            'tasks' => $tasks->map(fn (EventPreparationTask $task) => [
                'id' => $task->id,
                'department' => $task->department,
                'label' => $task->label,
                'status' => $task->status,
                'due_at' => $task->due_at,
                'assigned_to' => $task->assigned_to,
                'completed_at' => $task->completed_at,
                'completed_by' => $task->completed_by,
            ])->values(),
            'task_progress' => [
                'completed' => $completedTasks,
                'total' => $taskTotal,
                'percent' => $taskTotal > 0 ? (int) round(($completedTasks / $taskTotal) * 100) : 0,
            ],
            'attention_flags' => $this->attentionFlags($readiness),
            'event_sheet' => $this->eventSheet($booking, $readiness),
        ];
    }

    private function applyAttentionFilter($query, string $attention): void
    {
        if ($attention === 'payment') {
            $query->where(function ($inner) {
                $inner->whereDoesntHave('payments')
                    ->orWhereHas('payments', fn ($paymentQuery) => $paymentQuery->whereNotIn('status', ['Paid', 'Verified', 'Refunded']));
            });
            return;
        }

        if ($attention === 'menu') {
            $query->where(fn ($inner) => $this->whereMissingSelectedMenu($inner));
            return;
        }

        if ($attention === 'venue') {
            $query->where(function ($inner) {
                $inner->where(fn ($address) => $address->whereNull('venue_address_line')->orWhere('venue_address_line', ''))
                    ->orWhere(fn ($city) => $city->whereNull('venue_city')->orWhere('venue_city', ''));
            });
            return;
        }

        if ($attention === 'headcount') {
            $query->where(fn ($inner) => $inner->whereNull('pax')->orWhere('pax', '<=', 0));
            return;
        }

        if ($attention === 'customer_messages') {
            $query->whereHas('user', fn ($userQuery) => $userQuery->whereHas('clientConversations', fn ($conversationQuery) => $conversationQuery->where('status', 'active')));
            return;
        }

        if ($attention === 'needs_attention') {
            $query->where(function ($inner) {
                $inner->whereDoesntHave('payments')
                    ->orWhereHas('payments', fn ($paymentQuery) => $paymentQuery->whereNotIn('status', ['Paid', 'Verified', 'Refunded']))
                    ->orWhere(fn ($menu) => $this->whereMissingSelectedMenu($menu))
                    ->orWhereNull('venue_address_line')
                    ->orWhere('venue_address_line', '')
                    ->orWhereNull('pax')
                    ->orWhere('pax', '<=', 0);
            });
        }
    }

    private function preparationSummary(Request $request): array
    {
        $base = $this->preparationBoardQuery($request->duplicate(query: array_diff_key($request->query(), array_flip(['attention', 'department', 'search', 'page']))));

        return [
            'upcoming' => (clone $base)->count(),
            'needs_attention' => tap(clone $base, fn ($query) => $this->applyAttentionFilter($query, 'needs_attention'))->count(),
            'payment_not_clear' => tap(clone $base, fn ($query) => $this->applyAttentionFilter($query, 'payment'))->count(),
            'menu_missing' => tap(clone $base, fn ($query) => $this->applyAttentionFilter($query, 'menu'))->count(),
            'venue_missing' => tap(clone $base, fn ($query) => $this->applyAttentionFilter($query, 'venue'))->count(),
        ];
    }

    public function updatePreparationTask(Request $request, EventPreparationTask $task)
    {
        $data = $request->validate([
            'status' => ['required', 'in:Pending,Done'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $isDone = $data['status'] === 'Done';

        $task->update([
            'status' => $data['status'],
            'assigned_to' => $data['assigned_to'] ?? $task->assigned_to,
            'completed_by' => $isDone ? Auth::id() : null,
            'completed_at' => $isDone ? now() : null,
        ]);

        return response()->json([
            'message' => 'Preparation task updated.',
            'task' => $task->fresh(),
        ]);
    }

    private function readinessFor(Booking $booking): array
    {
        $payments = $booking->payments;
        $hasPayments = $payments->isNotEmpty();
        $paymentReady = $hasPayments && $payments->every(fn ($payment) => in_array($payment->status, ['Paid', 'Verified', 'Refunded'], true));
        $menuReady = !empty($booking->selected_menu);
        $venueReady = filled($booking->venue_address_line) || filled($booking->venue_city);
        $headcountReady = (int) $booking->pax > 0;
        $tastingReady = true;

        if ($booking->food_tasting_id) {
            $tastingReady = FoodTasting::whereKey($booking->food_tasting_id)
                ->whereIn('status', ['Approved', 'Confirmed', 'Completed'])
                ->exists();
        }

        $customerMessagesReady = !Conversation::query()
            ->where('client_id', $booking->user_id)
            ->where('status', 'active')
            ->exists();

        return [
            'payment' => $paymentReady,
            'menu' => $menuReady,
            'venue' => $venueReady,
            'headcount' => $headcountReady,
            'tasting' => $tastingReady,
            'customer_messages' => $customerMessagesReady,
        ];
    }

    private function attentionFlags(array $readiness): array
    {
        $labels = [
            'payment' => 'Payment clearance needed',
            'menu' => 'Final menu needed',
            'venue' => 'Venue details needed',
            'headcount' => 'Final headcount needed',
            'tasting' => 'Tasting outcome needed',
            'customer_messages' => 'Customer messages open',
        ];

        return collect($readiness)
            ->filter(fn ($ready) => !$ready)
            ->keys()
            ->map(fn ($key) => ['key' => $key, 'label' => $labels[$key] ?? $key])
            ->values()
            ->all();
    }

    private function eventSheet(Booking $booking, array $readiness): array
    {
        return [
            'booking_ref' => str_pad((string) $booking->id, 5, '0', STR_PAD_LEFT),
            'client' => $booking->client_full_name ?: $booking->user?->full_name ?: $booking->user?->username,
            'event' => $booking->event_name ?: $booking->event_type,
            'schedule' => trim(($booking->event_date?->toDateString() ?? 'Date TBD') . ' ' . ($booking->event_time ?: 'Time TBD')),
            'headcount' => (int) $booking->pax,
            'venue' => trim(collect([$booking->venue_address_line, $booking->venue_city])->filter()->join(', ')) ?: 'Venue TBD',
            'menu_ready' => $readiness['menu'] ?? false,
            'payment_ready' => $readiness['payment'] ?? false,
            'operations_notes' => $booking->special_instructions,
        ];
    }

    private function whereMissingSelectedMenu($query): void
    {
        $query->whereNull('selected_menu')
            ->orWhereRaw("\"selected_menu\"::text in ('[]', '{}', 'null', '\"\"')");
    }
}
