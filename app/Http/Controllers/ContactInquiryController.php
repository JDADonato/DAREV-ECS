<?php

namespace App\Http\Controllers;

use App\Models\ContactInquiry;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ContactInquiryController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:160'],
            'phone' => ['nullable', 'string', 'max:40'],
            'event_date' => ['nullable', 'date'],
            'pax' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'event_type' => ['nullable', 'string', 'max:120'],
            'concern_type' => ['nullable', Rule::in(['general', 'planning', 'availability', 'menu', 'pricing', 'tasting', 'active_booking'])],
            'subject' => ['required', 'string', 'max:160'],
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $inquiry = ContactInquiry::create([
            ...$validated,
            'concern_type' => $validated['concern_type'] ?? 'general',
            'status' => 'New',
            'source' => 'public_contact',
            'metadata' => [
                'ip' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
            ],
        ]);

        return response()->json([
            'message' => 'Your inquiry has been sent to our planning team.',
            'inquiry_id' => $inquiry->id,
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->query('per_page', 15), 1), 50);
        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $concernType = trim((string) $request->query('concern_type', ''));
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $inquiries = ContactInquiry::query()
            ->with('assignee:id,full_name,username')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('full_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('subject', 'like', "%{$search}%")
                        ->orWhere('message', 'like', "%{$search}%");
                });
            })
            ->when($status !== '', fn ($query) => $query->where('status', $status))
            ->when($concernType !== '', fn ($query) => $query->where('concern_type', $concernType))
            ->when($dateFrom, fn ($query) => $query->whereDate('event_date', '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate('event_date', '<=', $dateTo))
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'data' => $inquiries->items(),
            'summary' => [
                'new' => ContactInquiry::where('status', 'New')->count(),
                'open' => ContactInquiry::whereIn('status', ['New', 'In Review', 'Follow Up'])->count(),
                'resolved' => ContactInquiry::where('status', 'Resolved')->count(),
            ],
            'meta' => [
                'current_page' => $inquiries->currentPage(),
                'per_page' => $inquiries->perPage(),
                'total' => $inquiries->total(),
                'last_page' => $inquiries->lastPage(),
            ],
        ]);
    }

    public function update(Request $request, ContactInquiry $inquiry): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['sometimes', Rule::in(['New', 'In Review', 'Follow Up', 'Resolved', 'Closed'])],
            'assigned_to' => ['nullable', 'integer', Rule::exists('users', 'id')->where(fn ($query) => $query->whereIn('role', ['Marketing', 'Admin']))],
            'staff_notes' => ['nullable', 'string', 'max:3000'],
        ]);

        if (array_key_exists('status', $validated)) {
            $inquiry->status = $validated['status'];
            $inquiry->resolved_at = in_array($validated['status'], ['Resolved', 'Closed'], true) ? now() : null;
        }

        if (array_key_exists('assigned_to', $validated)) {
            $inquiry->assigned_to = $validated['assigned_to'] ?: null;
        }

        if (array_key_exists('staff_notes', $validated)) {
            $inquiry->staff_notes = $validated['staff_notes'];
        }

        $inquiry->save();

        return response()->json([
            'message' => 'Inquiry updated.',
            'inquiry' => $inquiry->fresh('assignee:id,full_name,username'),
        ]);
    }
}
