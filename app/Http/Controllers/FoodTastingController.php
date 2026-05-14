<?php

namespace App\Http\Controllers;

use App\Models\FoodTasting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * Ported from: server/controllers/foodTastingController.js
 * Handles food tasting scheduling for both guests and authenticated users.
 */
class FoodTastingController extends Controller
{
    /**
     * Create a food tasting request.
     * Ported from: foodTastingController.createTasting()
     * Supports both guest (unauthenticated) and logged-in users.
     */
    public function store(Request $request)
    {
        $request->validate([
            'guest_name'     => 'nullable|string',
            'guest_email'    => 'nullable|email',
            'guest_phone'    => 'nullable|string',
            'preferred_date' => 'required|date',
            'preferred_time' => 'required|string',
            'notes'          => 'nullable|string',
        ]);

        $userId = Auth::check() ? Auth::id() : null;

        $tasting = FoodTasting::create([
            'user_id'        => $userId,
            'guest_name'     => $request->guest_name,
            'guest_email'    => $request->guest_email,
            'guest_phone'    => $request->guest_phone,
            'preferred_date' => $request->preferred_date,
            'preferred_time' => $request->preferred_time,
            'notes'          => $request->notes,
        ]);

        return response()->json([
            'success'   => true,
            'message'   => 'Food tasting scheduled successfully!',
            'tastingId' => $tasting->id,
        ], 201);
    }

    /**
     * Get tastings for the authenticated user.
     * Ported from: foodTastingController.getMyTastings()
     */
    public function index()
    {
        $tastings = FoodTasting::where('user_id', Auth::id())
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($tastings);
    }
}
