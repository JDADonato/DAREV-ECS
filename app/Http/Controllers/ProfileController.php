<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    public function update(Request $request)
    {
        $user = $request->user();
        $profilePreferences = $request->input('profile_preferences', []);
        if (is_array($profilePreferences) && ($profilePreferences['default_guest_count'] ?? null) === '') {
            $profilePreferences['default_guest_count'] = null;
            $request->merge(['profile_preferences' => $profilePreferences]);
        }

        $request->validate([
            'full_name' => ['nullable', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255', Rule::unique('users')->ignore($user->id)],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:255'],
            'preferred_contact_method' => ['nullable', Rule::in(['email', 'phone', 'dashboard'])],
            'notification_preferences' => ['nullable', 'array'],
            'notification_preferences.*' => ['boolean'],
            'profile_preferences' => ['nullable', 'array'],
            'profile_preferences.default_event_city' => ['nullable', 'string', 'max:120'],
            'profile_preferences.default_guest_count' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'profile_preferences.planning_notes' => ['nullable', 'string', 'max:1000'],
            'current_password' => ['nullable', 'required_with:new_password', 'string'],
            'new_password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'remove_avatar' => ['nullable', 'boolean'],
        ]);

        $changedFields = [];

        if ($request->filled('new_password')) {
            if (!Hash::check($request->current_password, $user->password)) {
                return back()->withErrors(['current_password' => 'The provided password does not match your current password.']);
            }
            $user->password = $request->new_password;
            $changedFields[] = 'password';
        }

        if ($request->boolean('remove_avatar') && $user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
            $user->avatar_path = null;
            $changedFields[] = 'avatar';
        }

        if ($request->hasFile('avatar')) {
            if ($user->avatar_path) {
                Storage::disk('public')->delete($user->avatar_path);
            }
            $user->avatar_path = $request->file('avatar')->store('profile-avatars', 'public');
            $changedFields[] = 'avatar';
        }

        if ($user->full_name !== $request->input('full_name')) {
            $changedFields[] = 'full_name';
        }
        $user->full_name = $request->input('full_name');

        if ($user->username !== $request->username) {
            $changedFields[] = 'username';
        }
        $user->username = $request->username;
        
        if ($user->email !== $request->email) {
            $user->email = $request->email;
            $user->email_verified_at = null; // Unverify so they have to get a new OTP
            $changedFields[] = 'email';
            
            $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $user->otp_code = $otp;
            $user->otp_expires_at = now()->addMinutes(15);
            try {
                \Illuminate\Support\Facades\Mail::to($user->email)->send(new \App\Mail\VerifyEmailOTP($otp));
                error_log("\n--- NEW EMAIL OTP FOR {$user->email} IS: {$otp} ---\n");
                \Illuminate\Support\Facades\Log::info("OTP Verification code for new email {$user->email}: {$otp}");
            } catch (\Exception $e) {
                error_log("\n--- FAILED TO SEND NEW EMAIL OTP TO {$user->email}. OTP IS: {$otp} ---\n" . $e->getMessage());
                \Illuminate\Support\Facades\Log::error("Failed to send OTP email: " . $e->getMessage());
            }
            
            $message = 'Profile updated! Please verify your new email address.';
        } else {
            $message = 'Profile updated successfully!';
        }

        if ($user->phone !== $request->phone) {
            $changedFields[] = 'phone';
        }
        $user->phone = $request->phone;
        $user->preferred_contact_method = $request->input('preferred_contact_method') ?: 'email';
        $user->notification_preferences = $request->input('notification_preferences', []);
        $user->profile_preferences = $request->input('profile_preferences', []);
        $user->save();

        $this->recordProfileAudit($request, array_values(array_unique($changedFields)));

        return back()->with('message', $message);
    }

    public function activity(Request $request)
    {
        if (!Schema::hasTable('audit_logs')) {
            return response()->json(['data' => []]);
        }

        $items = AuditLog::query()
            ->where('user_id', $request->user()->id)
            ->where('action', 'profile_update')
            ->latest()
            ->limit(8)
            ->get(['id', 'action', 'metadata', 'created_at']);

        return response()->json(['data' => $items]);
    }

    private function recordProfileAudit(Request $request, array $changedFields): void
    {
        if (empty($changedFields) || !Schema::hasTable('audit_logs')) {
            return;
        }

        $user = $request->user();
        AuditLog::create([
            'user_id' => $user->id,
            'username' => $user->username,
            'role' => $user->role,
            'action' => 'profile_update',
            'method' => $request->method(),
            'path' => $request->path(),
            'status_code' => 200,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
            'metadata' => ['changed_fields' => $changedFields],
        ]);
    }
}
