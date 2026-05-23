<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Illuminate\Support\Facades\Mail;
use App\Mail\VerifyEmailOTP;
use Illuminate\Support\Facades\Log;

/**
 * Ported from: server/controllers/authController.js
 * Handles registration, login, and logout.
 * Replaces JWT-based auth with Laravel session-based auth.
 */
class AuthController extends Controller
{
    /**
     * Show login page.
     */
    public function showLogin()
    {
        return Inertia::render('Auth/Login');
    }

    /**
     * Show registration page.
     */
    public function showRegister()
    {
        return Inertia::render('Auth/Register');
    }

    /**
     * Handle login request.
     * Ported from: authController.login()
     */
    public function login(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
            'remember' => 'nullable|boolean',
        ]);

        $user = User::where('username', $request->username)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['Invalid Credentials'],
            ]);
        }

        $remember = $request->boolean('remember', false);
        Auth::login($user, $remember);
        $request->session()->regenerate();

        // Redirect based on role. Avoid redirect()->intended() here because
        // unauthenticated API fetches can store /api/* as the intended URL,
        // which makes Inertia receive plain JSON instead of a page response.
        return redirect($this->getDashboardRoute($user->role))
            ->with('message', 'Welcome back, ' . $user->username . '! We\'re glad to see you again.');
    }

    public function register(Request $request)
    {
        $request->validate([
            'username' => 'required|string|unique:users,username',
            'password' => 'required|string|min:6',
            'email'    => 'required|email|unique:users,email',
            'phone'    => 'nullable|string',
        ]);

        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $user = User::create([
            'username' => $request->username,
            'password' => $request->password, // Auto-hashed by User model cast
            'role'     => 'Client', // Public registration is always Client
            'email'    => $request->email,
            'phone'    => $request->phone,
            'otp_code' => $otp,
            'otp_expires_at' => now()->addMinutes(15),
        ]);

        try {
            Mail::to($user->email)->send(new VerifyEmailOTP($otp));
            error_log("\n--- OTP FOR {$user->email} IS: {$otp} ---\n");
            Log::info("OTP Verification code for {$user->email}: {$otp}");
        } catch (\Exception $e) {
            error_log("\n--- FAILED TO SEND OTP TO {$user->email}. OTP IS: {$otp} ---\n" . $e->getMessage());
            Log::error("Failed to send OTP email: " . $e->getMessage());
        }

        Auth::login($user);
        $request->session()->regenerate();

        return redirect('/')
            ->with('message', 'Please check your email for the verification code.')
            ->with('requires_otp', true);
    }

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'otp' => 'required|string',
        ]);

        $user = Auth::user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Already verified']);
        }

        if ($user->otp_code !== $request->otp) {
            throw ValidationException::withMessages([
                'otp' => ['Invalid verification code.'],
            ]);
        }

        if (now()->isAfter($user->otp_expires_at)) {
            throw ValidationException::withMessages([
                'otp' => ['Verification code has expired. Please request a new one.'],
            ]);
        }

        $user->update([
            'email_verified_at' => now(),
            'otp_code' => null,
            'otp_expires_at' => null,
        ]);

        return redirect('/')
            ->with('message', 'Email verified successfully! Welcome to Eloquente Catering.');
    }

    public function resendOtp(Request $request)
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Already verified']);
        }

        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $user->update([
            'otp_code' => $otp,
            'otp_expires_at' => now()->addMinutes(15),
        ]);

        try {
            Mail::to($user->email)->send(new VerifyEmailOTP($otp));
            error_log("\n--- RESENT OTP FOR {$user->email} IS: {$otp} ---\n");
            Log::info("Resent OTP Verification code for {$user->email}: {$otp}");
        } catch (\Exception $e) {
            error_log("\n--- FAILED TO SEND OTP TO {$user->email}. OTP IS: {$otp} ---\n" . $e->getMessage());
            Log::error("Failed to resend OTP email: " . $e->getMessage());
        }

        return back()->with('message', 'A new verification code has been sent to your email.');
    }

    /**
     * Handle logout request.
     */
    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    /**
     * Get dashboard route based on user role.
     */
    private function getDashboardRoute(string $role): string
    {
        return match ($role) {
            'Client'     => '/',
            'Marketing'  => '/dashboard/marketing',
            'Accounting' => '/dashboard/accounting',
            'Admin'      => '/dashboard/admin',
            default      => '/',
        };
    }
}
