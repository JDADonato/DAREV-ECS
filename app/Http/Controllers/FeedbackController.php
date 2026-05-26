<?php

namespace App\Http\Controllers;

use App\Models\FeedbackRequest;
use App\Models\FeedbackResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FeedbackController extends Controller
{
    public function index()
    {
        $requests = FeedbackRequest::query()
            ->with('booking:id,event_date,event_name,event_type,client_full_name')
            ->where('user_id', Auth::id())
            ->where('status', 'Pending')
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>=', now());
            })
            ->latest()
            ->get()
            ->map(fn (FeedbackRequest $request) => [
                'token' => $request->token,
                'status' => $request->status,
                'expires_at' => $request->expires_at,
                'booking' => [
                    'id' => $request->booking?->id,
                    'event_date' => $request->booking?->event_date,
                    'event_name' => $request->booking?->event_name,
                    'event_type' => $request->booking?->event_type,
                    'client_full_name' => $request->booking?->client_full_name,
                ],
            ]);

        return response()->json($requests);
    }

    public function store(Request $request, string $token)
    {
        $feedbackRequest = FeedbackRequest::query()
            ->with('response')
            ->where('token', $token)
            ->where('user_id', Auth::id())
            ->first();

        if (!$feedbackRequest) {
            return response()->json(['error' => 'Feedback request not found.'], 404);
        }

        if ($feedbackRequest->status === 'Completed' || $feedbackRequest->response) {
            return response()->json(['error' => 'Feedback was already submitted.'], 422);
        }

        if ($feedbackRequest->expires_at && $feedbackRequest->expires_at->isPast()) {
            return response()->json(['error' => 'This feedback request has expired.'], 422);
        }

        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'food_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'service_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'communication_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'value_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'comments' => ['nullable', 'string', 'max:3000'],
            'testimonial_permission' => ['boolean'],
        ]);

        $response = FeedbackResponse::create([
            'feedback_request_id' => $feedbackRequest->id,
            'booking_id' => $feedbackRequest->booking_id,
            'user_id' => Auth::id(),
            'rating' => $data['rating'],
            'food_rating' => $data['food_rating'] ?? null,
            'service_rating' => $data['service_rating'] ?? null,
            'communication_rating' => $data['communication_rating'] ?? null,
            'value_rating' => $data['value_rating'] ?? null,
            'comments' => $data['comments'] ?? null,
            'testimonial_permission' => (bool) ($data['testimonial_permission'] ?? false),
            'follow_up_required' => (int) $data['rating'] <= 3,
        ]);

        $feedbackRequest->update([
            'status' => 'Completed',
            'completed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Thank you for your feedback.',
            'response' => $response,
        ], 201);
    }
}
