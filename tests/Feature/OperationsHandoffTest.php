<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\EventPreparationTask;
use App\Models\FeedbackRequest;
use App\Models\User;
use App\Services\EventPreparationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OperationsHandoffTest extends TestCase
{
    use RefreshDatabase;

    public function test_approving_booking_creates_default_preparation_tasks_once(): void
    {
        $admin = $this->user('Admin');
        $booking = $this->booking(['status' => 'Pending']);

        $this->actingAs($admin)
            ->putJson("/api/admin/bookings/{$booking->id}/status", ['status' => 'Confirmed'])
            ->assertOk();

        $this->assertSame(6, EventPreparationTask::where('booking_id', $booking->id)->count());

        EventPreparationService::ensureDefaultTasks($booking->fresh());

        $this->assertSame(6, EventPreparationTask::where('booking_id', $booking->id)->count());
    }

    public function test_preparation_board_returns_upcoming_approved_bookings(): void
    {
        $marketing = $this->user('Marketing');
        $included = $this->booking([
            'status' => 'Confirmed',
            'event_date' => now()->addDays(10)->toDateString(),
        ]);
        $this->booking([
            'status' => 'Pending',
            'event_date' => now()->addDays(10)->toDateString(),
        ]);
        $this->booking([
            'status' => 'Confirmed',
            'event_date' => now()->addDays(45)->toDateString(),
        ]);

        $response = $this->actingAs($marketing)
            ->getJson('/api/operations/preparation-board')
            ->assertOk();

        $response->assertJsonCount(1)
            ->assertJsonPath('0.booking.id', $included->id)
            ->assertJsonPath('0.task_progress.total', 6);
    }

    public function test_staff_can_complete_and_reopen_preparation_task(): void
    {
        $marketing = $this->user('Marketing');
        $booking = $this->booking(['status' => 'Confirmed']);
        EventPreparationService::ensureDefaultTasks($booking);
        $task = EventPreparationTask::where('booking_id', $booking->id)->first();

        $this->actingAs($marketing)
            ->patchJson("/api/operations/preparation-tasks/{$task->id}", ['status' => 'Done'])
            ->assertOk()
            ->assertJsonPath('task.status', 'Done');

        $this->assertDatabaseHas('event_preparation_tasks', [
            'id' => $task->id,
            'status' => 'Done',
            'completed_by' => $marketing->id,
        ]);

        $this->actingAs($marketing)
            ->patchJson("/api/operations/preparation-tasks/{$task->id}", ['status' => 'Pending'])
            ->assertOk()
            ->assertJsonPath('task.status', 'Pending');

        $this->assertDatabaseHas('event_preparation_tasks', [
            'id' => $task->id,
            'status' => 'Pending',
            'completed_by' => null,
        ]);
    }

    public function test_completing_booking_creates_one_feedback_request(): void
    {
        $marketing = $this->user('Marketing');
        $booking = $this->booking(['status' => 'Confirmed']);

        $this->actingAs($marketing)
            ->putJson("/api/marketing/bookings/{$booking->id}/status", ['status' => 'Completed'])
            ->assertOk();

        $this->assertSame(1, FeedbackRequest::where('booking_id', $booking->id)->count());

        $this->actingAs($marketing)
            ->putJson("/api/marketing/bookings/{$booking->id}/status", ['status' => 'Completed'])
            ->assertOk();

        $this->assertSame(1, FeedbackRequest::where('booking_id', $booking->id)->count());
    }

    public function test_customer_submits_feedback_and_low_rating_requires_follow_up(): void
    {
        $client = $this->user('Client');
        $booking = $this->booking(['user_id' => $client->id, 'status' => 'Completed']);
        $request = EventPreparationService::ensureFeedbackRequest($booking);

        $this->actingAs($client)
            ->getJson('/api/customer/feedback-requests')
            ->assertOk()
            ->assertJsonPath('0.token', $request->token);

        $this->actingAs($client)
            ->postJson("/api/customer/feedback-requests/{$request->token}/responses", [
                'rating' => 3,
                'food_rating' => 4,
                'service_rating' => 3,
                'communication_rating' => 3,
                'value_rating' => 3,
                'comments' => 'Please follow up with us.',
                'testimonial_permission' => false,
            ])
            ->assertCreated()
            ->assertJsonPath('response.follow_up_required', true);

        $this->assertDatabaseHas('feedback_requests', [
            'id' => $request->id,
            'status' => 'Completed',
        ]);
        $this->assertDatabaseHas('feedback_responses', [
            'feedback_request_id' => $request->id,
            'follow_up_required' => true,
        ]);

        $this->actingAs($client)
            ->postJson("/api/customer/feedback-requests/{$request->token}/responses", ['rating' => 5])
            ->assertUnprocessable();
    }

    private function user(string $role): User
    {
        return User::create([
            'full_name' => "{$role} Tester",
            'username' => strtolower($role) . '_' . uniqid(),
            'email' => uniqid(strtolower($role) . '_') . '@example.test',
            'password' => 'password',
            'phone' => '09170000000',
            'role' => $role,
        ]);
    }

    private function booking(array $overrides = []): Booking
    {
        $clientId = $overrides['user_id'] ?? $this->user('Client')->id;

        return Booking::create(array_merge([
            'user_id' => $clientId,
            'event_date' => now()->addDays(14)->toDateString(),
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Operations Test Event',
            'event_type' => 'Wedding',
            'pax' => 100,
            'budget' => 100000,
            'package_id' => 'custom',
            'client_full_name' => 'Operations Client',
            'client_email' => 'client@example.test',
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Operations venue',
            'total_cost' => 100000,
            'selected_menu' => ['starter' => [['id' => 1, 'name' => 'Soup']]],
            'status' => 'Confirmed',
            'review_status' => 'Approved For Reservation',
        ], $overrides));
    }
}
