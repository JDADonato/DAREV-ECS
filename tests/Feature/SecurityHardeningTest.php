<?php

namespace Tests\Feature;

use App\Mail\VerifyEmailOTP;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_sends_otp_without_logging_the_secret_code(): void
    {
        Mail::fake();
        Log::spy();

        $this->post('/register', [
            'username' => 'secure_client',
            'email' => 'secure-client@example.test',
            'phone' => '09170000000',
            'password' => 'password123',
        ])->assertRedirect('/');

        $user = User::where('username', 'secure_client')->firstOrFail();

        Mail::assertQueued(VerifyEmailOTP::class);
        $this->assertNotNull($user->otp_code);

        Log::shouldHaveReceived('info')
            ->withArgs(fn ($message, $context = []) => $message === 'OTP verification email sent.'
                && ($context['user_id'] ?? null) === $user->id);

        $this->assertOtpLoggingStringsWereRemoved();
    }

    public function test_resend_otp_does_not_log_the_new_secret_code(): void
    {
        Mail::fake();
        Log::spy();

        $user = User::create([
            'username' => 'unverified_client',
            'email' => 'unverified@example.test',
            'password' => 'password123',
            'role' => 'Client',
            'otp_code' => '111111',
            'otp_expires_at' => now()->addMinutes(15),
        ]);

        $this->actingAs($user)
            ->post('/resend-otp')
            ->assertRedirect();

        $user->refresh();

        Mail::assertQueued(VerifyEmailOTP::class);
        $this->assertNotSame('111111', $user->otp_code);

        Log::shouldHaveReceived('info')
            ->withArgs(fn ($message, $context = []) => $message === 'OTP verification email resent.'
                && ($context['user_id'] ?? null) === $user->id);

        $this->assertOtpLoggingStringsWereRemoved();
    }

    public function test_resend_otp_enforces_cooldown_and_exposes_retry_seconds(): void
    {
        Mail::fake();

        $user = User::create([
            'username' => 'cooldown_client',
            'email' => 'cooldown@example.test',
            'password' => 'password123',
            'role' => 'Client',
            'otp_code' => '111111',
            'otp_expires_at' => now()->addMinutes(15),
            'otp_resend_available_at' => now()->addSeconds(45),
        ]);

        $this->actingAs($user)
            ->postJson('/resend-otp')
            ->assertStatus(429)
            ->assertJsonStructure(['error', 'retry_after_seconds']);
    }

    public function test_forgot_password_reset_is_single_use_for_active_accounts(): void
    {
        Mail::fake();

        $user = User::create([
            'username' => 'reset_client',
            'email' => 'reset-client@example.test',
            'password' => 'old-password',
            'role' => 'Client',
            'account_status' => 'active',
        ]);

        $this->post('/forgot-password', ['email' => $user->email])
            ->assertSessionHas('message');

        $record = DB::table('password_reset_tokens')->where('email', $user->email)->first();
        $this->assertNotNull($record);

        $token = 'known-reset-token';
        DB::table('password_reset_tokens')->where('email', $user->email)->update([
            'token' => \Illuminate\Support\Facades\Hash::make($token),
            'created_at' => now(),
        ]);

        $this->post('/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertRedirect('/login');

        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('new-password-123', $user->fresh()->password));

        $this->post('/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'another-password-123',
            'password_confirmation' => 'another-password-123',
        ])->assertSessionHasErrors('email');
    }

    public function test_deactivated_account_does_not_receive_reset_token(): void
    {
        $user = User::create([
            'username' => 'inactive_client',
            'email' => 'inactive-client@example.test',
            'password' => 'password123',
            'role' => 'Client',
            'account_status' => 'deactivated',
        ]);

        $this->post('/forgot-password', ['email' => $user->email])
            ->assertSessionHas('message');

        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
    }

    public function test_upload_endpoint_accepts_images_and_rejects_non_images(): void
    {
        Storage::fake('public');

        $client = $this->user('Client');

        $this->actingAs($client)
            ->post('/api/upload', [
                'image' => UploadedFile::fake()->create('payment-proof.pdf', 100, 'application/pdf'),
            ])
            ->assertSessionHasErrors('image');

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=');

        $response = $this->actingAs($client)
            ->post('/api/upload', [
                'image' => UploadedFile::fake()->createWithContent('payment-proof.png', $png),
            ])
            ->assertOk()
            ->assertJsonStructure(['url']);

        $this->assertStringStartsWith('/storage/uploads/', $response->json('url'));
    }

    public function test_login_route_is_rate_limited(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->from('/login')->post('/login', [
                'username' => 'missing-user',
                'password' => 'wrong-password',
            ]);
        }

        $this->from('/login')->post('/login', [
            'username' => 'missing-user',
            'password' => 'wrong-password',
        ])->assertTooManyRequests();
    }

    public function test_api_routes_are_not_globally_exempted_from_csrf(): void
    {
        $bootstrap = file_get_contents(base_path('bootstrap/app.php'));

        $this->assertStringNotContainsString("'api/*'", $bootstrap);
        $this->assertStringContainsString("'webhook/paymongo'", $bootstrap);
    }

    public function test_frontend_fetch_wrapper_adds_csrf_header_for_same_origin_mutations(): void
    {
        $bootstrapJs = file_get_contents(resource_path('js/bootstrap.js'));

        $this->assertStringContainsString('window.fetch = (input, init = {}) =>', $bootstrapJs);
        $this->assertStringContainsString("headers.set('X-CSRF-TOKEN', token);", $bootstrapJs);
        $this->assertStringContainsString("headers.set('X-Requested-With', 'XMLHttpRequest');", $bootstrapJs);
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
            'email_verified_at' => now(),
        ]);
    }

    private function assertOtpLoggingStringsWereRemoved(): void
    {
        $controller = file_get_contents(app_path('Http/Controllers/AuthController.php'));

        $this->assertStringNotContainsString('OTP Verification code', $controller);
        $this->assertStringNotContainsString('Resent OTP Verification code', $controller);
        $this->assertStringNotContainsString('OTP FOR', $controller);
        $this->assertStringNotContainsString('RESENT OTP FOR', $controller);
        $this->assertStringNotContainsString('FAILED TO SEND OTP TO', $controller);
    }
}
