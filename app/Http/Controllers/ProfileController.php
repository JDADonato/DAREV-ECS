<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    public function update(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'username' => ['required', 'string', 'max:255', Rule::unique('users')->ignore($user->id)],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:255'],
            'current_password' => ['nullable', 'required_with:new_password', 'string'],
            'new_password' => ['nullable', 'string', 'min:6'],
        ]);

        if ($request->filled('new_password')) {
            if (!Hash::check($request->current_password, $user->password)) {
                return back()->withErrors(['current_password' => 'The provided password does not match your current password.']);
            }
            $user->password = $request->new_password;
        }

        $user->username = $request->username;
        
        // If email changes, maybe require re-verification? For now just update.
        if ($user->email !== $request->email) {
            $user->email = $request->email;
            $user->email_verified_at = null; // Unverify so they have to get a new OTP
            
            // Optionally auto-send OTP here, but we'll let the layout handle showing the modal again.
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

        $user->phone = $request->phone;
        $user->save();

        return back()->with('message', $message);
    }
}
