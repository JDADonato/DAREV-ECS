<?php

namespace App\Http\Controllers;

use App\Mail\AnnouncementEmail;
use App\Models\Announcement;
use App\Models\AnnouncementRead;
use App\Services\AnnouncementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class AnnouncementController extends Controller
{
    public function __construct(private AnnouncementService $service)
    {
    }

    public function index(Request $request)
    {
        $query = Announcement::with(['creator:id,username', 'recipients', 'reads'])
            ->withCount([
                'recipients as sent_count' => fn ($q) => $q->where('status', 'sent'),
                'recipients as failed_count' => fn ($q) => $q->where('status', 'failed'),
                'reads as read_count',
            ])
            ->latest();

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['slug'] = $this->service->uniqueSlug($data['title']);
        $data['created_by'] = $request->user()->id;
        $data['updated_by'] = $request->user()->id;

        $announcement = Announcement::create($data);

        return response()->json($announcement->fresh(['creator:id,username']), 201);
    }

    public function update(Request $request, Announcement $announcement)
    {
        $data = $this->validated($request, $announcement->id);
        $data['slug'] = $this->service->uniqueSlug($data['title'], $announcement->id);
        $data['updated_by'] = $request->user()->id;

        $announcement->update($data);

        return response()->json($announcement->fresh(['creator:id,username']));
    }

    public function publish(Request $request, Announcement $announcement)
    {
        return response()->json($this->service->publish($announcement, $request->user()));
    }

    public function archive(Request $request, Announcement $announcement)
    {
        return response()->json($this->service->archive($announcement, $request->user()));
    }

    public function sendTest(Request $request, Announcement $announcement)
    {
        $data = $request->validate(['email' => 'required|email']);
        Mail::to($data['email'])->queue(new AnnouncementEmail($announcement));

        return response()->json(['message' => 'Test email queued.']);
    }

    public function customerIndex(Request $request)
    {
        $user = $request->user();
        $hasBookings = $user->bookings()->exists();

        $announcements = Announcement::visibleNow()
            ->where(function ($query) use ($user, $hasBookings) {
                $query->where('visibility', 'all_customers')
                    ->orWhere(fn ($q) => $q->where('visibility', 'active_clients')->whereRaw($hasBookings ? '1=1' : '1=0'))
                    ->orWhere(fn ($q) => $q->where('visibility', 'specific_roles')->whereJsonContains('visibility_roles', $user->role))
                    ->orWhere(fn ($q) => $q->where('visibility', 'specific_users')->whereJsonContains('specific_user_ids', $user->id));
            })
            ->with(['reads' => fn ($q) => $q->where('user_id', $user->id)])
            ->orderByRaw("CASE WHEN type = 'urgent' THEN 0 ELSE 1 END")
            ->latest('published_at')
            ->get()
            ->map(fn ($announcement) => array_merge($announcement->toArray(), [
                'is_read' => $announcement->reads->isNotEmpty(),
            ]));

        return response()->json($announcements);
    }

    public function markRead(Request $request, Announcement $announcement)
    {
        AnnouncementRead::updateOrCreate(
            ['announcement_id' => $announcement->id, 'user_id' => $request->user()->id],
            ['read_at' => now()]
        );

        return response()->json(['message' => 'Announcement marked as read.']);
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'title' => 'required|string|max:255',
            'summary' => 'nullable|string|max:500',
            'body' => 'nullable|string',
            'type' => ['required', Rule::in(['general', 'promo', 'event_reminder', 'holiday_advisory', 'menu_update', 'service_notice', 'urgent'])],
            'status' => ['nullable', Rule::in(['draft', 'scheduled', 'published', 'archived'])],
            'visibility' => ['required', Rule::in(['all_customers', 'active_clients', 'specific_roles', 'specific_users'])],
            'visibility_roles' => 'nullable|array',
            'visibility_roles.*' => 'string',
            'specific_user_ids' => 'nullable|array',
            'specific_user_ids.*' => 'integer|exists:users,id',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'send_email' => 'boolean',
            'email_subject' => 'nullable|string|max:255',
            'email_body' => 'nullable|string',
            'cta_label' => 'nullable|string|max:80',
            'cta_url' => 'nullable|string|max:255',
            'image_path' => 'nullable|string|max:255',
        ]);
    }
}
