<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\User;
use App\Notifications\StaffAccountAccessNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
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

    public function test_admin_can_create_admin_account_but_regular_staff_actions_remain_protected(): void
    {
        Notification::fake();

        $admin = $this->user('Admin');

        $response = $this->actingAs($admin)
            ->postJson('/api/admin/employees', [
                'full_name' => 'Second Admin',
                'username' => 'second_admin',
                'email' => 'second.admin@example.test',
                'phone' => '09170000001',
                'role' => 'Admin',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Account created. Share the temporary password through a private channel.')
            ->assertJsonPath('email_delivery_status.status', 'sent');

        $created = User::where('username', 'second_admin')->firstOrFail();

        $this->assertSame('Admin', $created->role);
        $this->assertTrue((bool) $created->must_change_password);
        $this->assertNotEmpty($response->json('temporary_password'));
        $this->assertTrue($created->temporary_password_expires_at->between(now()->addHours(23), now()->addHours(25)));
        Notification::assertSentTo($created, StaffAccountAccessNotification::class);

        $this->actingAs($admin)
            ->getJson('/api/admin/employees?paginated=1&role=Admin&search=second_admin')
            ->assertOk()
            ->assertJsonFragment(['id' => $created->id]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/employees/{$created->id}")
            ->assertForbidden();

        $this->actingAs($admin)
            ->postJson("/api/admin/employees/{$created->id}/reset-password")
            ->assertForbidden();
    }

    public function test_reset_temporary_password_is_emailed_and_expires_within_one_day(): void
    {
        Notification::fake();

        $admin = $this->user('Admin');
        $staff = $this->user('Marketing');

        $response = $this->actingAs($admin)
            ->postJson("/api/admin/employees/{$staff->id}/reset-password")
            ->assertOk()
            ->assertJsonStructure(['temporary_password', 'temporary_password_expires_at', 'email_delivery', 'email_delivery_status' => ['status', 'message']])
            ->assertJsonPath('email_delivery_status.status', 'sent');

        $staff->refresh();

        $this->assertNotEmpty($response->json('temporary_password'));
        $this->assertTrue($staff->temporary_password_expires_at->between(now()->addHours(23), now()->addHours(25)));
        Notification::assertSentTo($staff, StaffAccountAccessNotification::class);
    }

    public function test_authenticated_users_can_refresh_csrf_token(): void
    {
        $admin = $this->user('Admin');

        $this->actingAs($admin)
            ->getJson('/api/session/csrf-token')
            ->assertOk()
            ->assertJsonStructure(['token']);
    }

    public function test_account_email_delivery_reports_missing_email(): void
    {
        $admin = $this->user('Admin');

        $response = $this->actingAs($admin)
            ->postJson('/api/admin/employees', [
                'full_name' => 'No Email Staff',
                'username' => 'no_email_staff',
                'role' => 'Marketing',
            ])
            ->assertCreated()
            ->assertJsonPath('email_delivery_status.status', 'skipped_no_email');

        $this->assertStringContainsString('No email address', $response->json('email_delivery'));
    }

    public function test_admin_can_view_delivery_diagnostics(): void
    {
        $admin = $this->user('Admin');

        $this->actingAs($admin)
            ->getJson('/api/admin/system-delivery')
            ->assertOk()
            ->assertJsonStructure([
                'session' => ['current_host', 'app_url', 'same_site', 'authenticated'],
                'mail' => ['mailer', 'from_address', 'configured'],
                'queue' => ['connection', 'worker_required'],
                'guidance',
            ]);
    }

    public function test_admin_required_password_change_redirects_to_admin_dashboard_and_hashes_password(): void
    {
        $admin = $this->user('Admin', [
            'must_change_password' => true,
            'temporary_password_expires_at' => now()->addDay(),
        ]);

        $this->actingAs($admin)
            ->post('/password/change-required', [
                'password' => 'NewSecurePassword123!',
                'password_confirmation' => 'NewSecurePassword123!',
            ])
            ->assertRedirect('/dashboard/admin');

        $admin->refresh();

        $this->assertFalse((bool) $admin->must_change_password);
        $this->assertNull($admin->temporary_password_expires_at);
        $this->assertNotSame('NewSecurePassword123!', $admin->password);
        $this->assertTrue(Hash::check('NewSecurePassword123!', $admin->password));
    }

    public function test_json_required_password_change_returns_final_account_state(): void
    {
        $admin = $this->user('Admin', [
            'must_change_password' => true,
            'temporary_password_expires_at' => now()->addDay(),
        ]);

        $this->actingAs($admin)
            ->postJson('/password/change-required', [
                'password' => 'NewSecurePassword123!',
                'password_confirmation' => 'NewSecurePassword123!',
            ])
            ->assertOk()
            ->assertJsonPath('redirect', '/dashboard/admin')
            ->assertJsonPath('role', 'Admin')
            ->assertJsonPath('must_change_password', false);

        $this->get('/dashboard/admin')->assertOk();
    }

    public function test_staff_roles_can_access_dashboard_after_required_password_change(): void
    {
        foreach ([
            'Marketing' => '/dashboard/marketing',
            'Accounting' => '/dashboard/accounting',
        ] as $role => $dashboard) {
            $user = $this->user($role, [
                'must_change_password' => true,
                'temporary_password_expires_at' => now()->addDay(),
            ]);

            $this->actingAs($user)
                ->postJson('/password/change-required', [
                    'password' => 'NewSecurePassword123!',
                    'password_confirmation' => 'NewSecurePassword123!',
                ])
                ->assertOk()
                ->assertJsonPath('redirect', $dashboard)
                ->assertJsonPath('role', $role)
                ->assertJsonPath('must_change_password', false);

            $this->get($dashboard)->assertOk();
            $this->post('/logout');
        }
    }

    public function test_inertia_admin_required_password_change_forces_dashboard_location(): void
    {
        $admin = $this->user('Admin', [
            'must_change_password' => true,
            'temporary_password_expires_at' => now()->addDay(),
        ]);

        $this->actingAs($admin)
            ->withHeader('X-Inertia', 'true')
            ->withHeader('X-Inertia-Version', 'test')
            ->withHeader('Accept', 'application/json')
            ->withHeader('X-Requested-With', 'XMLHttpRequest')
            ->post('/password/change-required', [
                'password' => 'NewSecurePassword123!',
                'password_confirmation' => 'NewSecurePassword123!',
            ])
            ->assertStatus(409)
            ->assertHeader('X-Inertia-Location', '/dashboard/admin');
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
