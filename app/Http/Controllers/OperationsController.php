<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Conversation;
use App\Models\EventPreparationTask;
use App\Models\FoodTasting;
use App\Services\EventPreparationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class OperationsController extends Controller
{
    public function preparationBoard(Request $request)
    {
        $start = Carbon::today();
        $end = Carbon::today()->addDays((int) $request->query('days', 30));

        $bookings = Booking::query()
            ->with([
                'payments:id,booking_id,status',
                'preparationTasks' => fn ($query) => $query->orderBy('department')->orderBy('id'),
                'user:id,full_name,username,email',
            ])
            ->whereBetween('event_date', [$start->toDateString(), $end->toDateString()])
            ->whereIn('status', ['Confirmed', 'Reserved'])
            ->orderBy('event_date')
            ->orderBy('event_time')
            ->get();

        $rows = $bookings->map(function (Booking $booking) {
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
            ];
        })->values();

        return response()->json($rows);
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
}
