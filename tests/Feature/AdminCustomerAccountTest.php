<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class AdminCustomerAccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_deactivated_customers_are_hidden_from_default_customer_list(): void
    {
        $admin = $this->user('Admin');
        $active = $this->user('Client', ['username' => 'active_customer']);
        $deactivated = $this->user('Client', [
            'username' => 'deactivated_customer',
            'account_status' => 'deactivated',
            'deactivated_at' => now(),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/customers?paginated=1')
            ->assertOk()
            ->assertJsonFragment(['id' => $active->id])
            ->assertJsonMissing(['id' => $deactivated->id]);

        $this->actingAs($admin)
            ->getJson('/api/admin/customers?paginated=1&status=deactivated')
            ->assertOk()
            ->assertJsonFragment(['id' => $deactivated->id])
            ->assertJsonMissing(['id' => $active->id]);
    }

    public function test_customer_with_bookings_is_deactivated_and_can_be_reactivated(): void
    {
        $admin = $this->user('Admin');
        $customer = $this->user('Client');

        Booking::create([
            'user_id' => $customer->id,
            'event_date' => now()->addMonth()->toDateString(),
            'event_time' => '18:00',
            'pax' => 80,
            'event_type' => 'Wedding',
            'status' => 'Pending',
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Customer account deactivated. Booking and payment records were preserved.');

        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'account_status' => 'deactivated',
        ]);
        $this->assertStringStartsWith('deactivated+' . $customer->id, $customer->fresh()->email);

        $this->actingAs($admin)
            ->getJson('/api/admin/customers?paginated=1')
            ->assertOk()
            ->assertJsonMissing(['id' => $customer->id]);

        $this->actingAs($admin)
            ->postJson("/api/admin/customers/{$customer->id}/reactivate")
            ->assertOk();

        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'account_status' => 'active',
        ]);
    }

    public function test_deactivating_customer_frees_original_email_for_new_registration(): void
    {
        $admin = $this->user('Admin');
        $customer = $this->user('Client', ['email' => 'reuse@example.test']);

        Booking::create([
            'user_id' => $customer->id,
            'event_date' => now()->addMonth()->toDateString(),
            'event_time' => '18:00',
            'pax' => 80,
            'event_type' => 'Wedding',
            'status' => 'Pending',
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/customers/{$customer->id}")
            ->assertOk();

        Auth::logout();

        $this->post('/register', [
            'username' => 'reuse_user',
            'email' => 'reuse@example.test',
            'password' => 'password123',
            'phone' => '09170000000',
        ])->assertRedirect();

        $this->assertDatabaseHas('users', [
            'username' => 'reuse_user',
            'email' => 'reuse@example.test',
            'role' => 'Client',
        ]);
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::create(array_merge([
            'full_name' => "{$role} Tester",
            'username' => strtolower($role) . '_' . uniqid(),
            'email' => uniqid(strtolower($role) . '_') . '@example.test',
            'password' => 'password',
            'phone' => '09170000000',
            'role' => $role,
            'email_verified_at' => now(),
            'account_status' => 'active',
        ], $overrides));
    }
}
