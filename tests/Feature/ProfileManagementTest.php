<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProfileManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_profile_preferences_and_contact_details(): void
    {
        $user = User::create([
            'full_name' => 'Original Name',
            'username' => 'client_' . uniqid(),
            'email' => 'client@example.test',
            'password' => 'password',
            'role' => 'Client',
        ]);

        $this->actingAs($user)
            ->put('/profile', [
                'full_name' => 'Updated Client',
                'username' => $user->username,
                'email' => $user->email,
                'phone' => '09170000000',
                'preferred_contact_method' => 'dashboard',
                'notification_preferences' => [
                    'booking_updates' => true,
                    'payment_reminders' => false,
                    'message_alerts' => true,
                    'announcements' => true,
                ],
                'profile_preferences' => [
                    'default_event_city' => 'Metro Manila',
                    'default_guest_count' => 120,
                    'planning_notes' => 'Prefers plated service.',
                ],
            ])
            ->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertSame('Updated Client', $user->full_name);
        $this->assertSame('dashboard', $user->preferred_contact_method);
        $this->assertFalse($user->notification_preferences['payment_reminders']);
        $this->assertSame('Metro Manila', $user->profile_preferences['default_event_city']);
    }

    public function test_email_change_clears_verification_and_password_change_requires_current_password(): void
    {
        $user = User::create([
            'username' => 'client_' . uniqid(),
            'email' => 'old@example.test',
            'email_verified_at' => now(),
            'password' => 'password123',
            'role' => 'Client',
        ]);

        $this->actingAs($user)
            ->put('/profile', [
                'username' => $user->username,
                'email' => 'new@example.test',
                'current_password' => 'wrong-password',
                'new_password' => 'newpassword123',
                'new_password_confirmation' => 'newpassword123',
            ])
            ->assertSessionHasErrors('current_password');

        $this->actingAs($user)
            ->put('/profile', [
                'username' => $user->username,
                'email' => 'new@example.test',
                'current_password' => 'password123',
                'new_password' => 'newpassword123',
                'new_password_confirmation' => 'newpassword123',
            ])
            ->assertSessionHasNoErrors();

        $this->assertNull($user->fresh()->email_verified_at);
        $this->assertTrue(password_verify('newpassword123', $user->fresh()->password));
    }

    public function test_avatar_upload_accepts_images_and_rejects_invalid_files(): void
    {
        Storage::fake('public');

        $user = User::create([
            'username' => 'client_' . uniqid(),
            'email' => 'client@example.test',
            'password' => 'password',
            'role' => 'Client',
        ]);

        $this->actingAs($user)
            ->put('/profile', [
                'username' => $user->username,
                'email' => $user->email,
                'avatar' => UploadedFile::fake()->create('not-image.pdf', 20, 'application/pdf'),
            ])
            ->assertSessionHasErrors('avatar');

        $this->actingAs($user)
            ->put('/profile', [
                'username' => $user->username,
                'email' => $user->email,
                'avatar' => UploadedFile::fake()->image('avatar.jpg', 200, 200),
            ])
            ->assertSessionHasNoErrors();

        Storage::disk('public')->assertExists($user->fresh()->avatar_path);
    }
}
