<?php

namespace App\Http\Controllers;

use App\Models\FoodTasting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

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

    public function update(Request $request, $id)
    {
        $tasting = FoodTasting::where('id', $id)->where('user_id', Auth::id())->firstOrFail();
        
        $request->validate([
            'guest_name'     => 'nullable|string',
            'guest_email'    => 'nullable|email',
            'guest_phone'    => 'nullable|string',
            'preferred_date' => 'required|date',
            'preferred_time' => 'required|string',
            'notes'          => 'nullable|string',
        ]);

        $tasting->update($request->only([
            'guest_name', 'guest_email', 'guest_phone', 'preferred_date', 'preferred_time', 'notes'
        ]));

        return response()->json(['message' => 'Food tasting updated.']);
    }

    public function destroy($id)
    {
        $tasting = FoodTasting::where('id', $id)->where('user_id', Auth::id())->firstOrFail();
        
        $tasting->update(['status' => 'Cancelled']);

        return response()->json(['message' => 'Food tasting cancelled.']);
    }

    public function staffIndex(Request $request)
    {
        $query = FoodTasting::query()
            ->with('user:id,full_name,username,email,phone')
            ->latest('preferred_date')
            ->latest('created_at');

        if ($request->filled('status') && $request->query('status') !== 'All') {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('from')) {
            $query->whereDate('preferred_date', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('preferred_date', '<=', $request->query('to'));
        }

        return response()->json($query->limit(200)->get()->map(fn (FoodTasting $tasting) => [
            'id' => $tasting->id,
            'client_name' => $tasting->guest_name ?: $tasting->user?->full_name ?: $tasting->user?->username,
            'client_email' => $tasting->guest_email ?: $tasting->user?->email,
            'client_phone' => $tasting->guest_phone ?: $tasting->user?->phone,
            'preferred_date' => $tasting->preferred_date,
            'preferred_time' => $tasting->preferred_time,
            'status' => $tasting->status,
            'notes' => $tasting->notes,
            'outcome_notes' => $tasting->outcome_notes,
            'confirmed_at' => $tasting->confirmed_at,
            'completed_at' => $tasting->completed_at,
            'handled_by' => $tasting->handled_by,
        ]));
    }

    public function staffUpdate(Request $request, FoodTasting $tasting)
    {
        $data = $request->validate([
            'status' => ['required', 'in:Pending,Approved,Confirmed,Completed,Cancelled,Rescheduled'],
            'preferred_date' => ['nullable', 'date'],
            'preferred_time' => ['nullable', 'string', 'max:120'],
            'outcome_notes' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $status = $data['status'];
        $tasting->fill([
            'status' => $status,
            'preferred_date' => $data['preferred_date'] ?? $tasting->preferred_date,
            'preferred_time' => $data['preferred_time'] ?? $tasting->preferred_time,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $tasting->notes,
            'outcome_notes' => array_key_exists('outcome_notes', $data) ? $data['outcome_notes'] : $tasting->outcome_notes,
            'handled_by' => Auth::id(),
        ]);

        if (in_array($status, ['Approved', 'Confirmed'], true) && !$tasting->confirmed_at) {
            $tasting->confirmed_at = now();
        }

        if ($status === 'Completed' && !$tasting->completed_at) {
            $tasting->completed_at = now();
        }

        $tasting->save();

        return response()->json([
            'message' => 'Food tasting updated.',
            'tasting' => $tasting->fresh(),
        ]);
    }
}
