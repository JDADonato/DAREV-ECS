<?php

namespace App\Http\Controllers;

use App\Models\CalendarAvailabilityOverride;
use App\Services\CalendarAvailabilityService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CalendarAvailabilityController extends Controller
{
    public function index(Request $request, CalendarAvailabilityService $availability)
    {
        $data = $request->validate([
            'month' => ['required', 'date_format:Y-m'],
        ]);

        return response()->json([
            'data' => $availability->monthOverrides($data['month'])->values(),
        ]);
    }

    public function upsert(Request $request, string $date, CalendarAvailabilityService $availability)
    {
        $dateString = Carbon::parse($date)->toDateString();
        $data = $request->validate([
            'is_locked' => ['nullable', 'boolean'],
            'remaining_events' => ['nullable', 'integer', 'min:0'],
            'remaining_pax' => ['nullable', 'integer', 'min:0'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $current = $availability->availabilityForDate($dateString);
        $maxEventsOverride = array_key_exists('remaining_events', $data) && $data['remaining_events'] !== null
            ? $current['currentEvents'] + (int) $data['remaining_events']
            : null;
        $maxPaxOverride = array_key_exists('remaining_pax', $data) && $data['remaining_pax'] !== null
            ? $current['currentPax'] + (int) $data['remaining_pax']
            : null;

        $override = CalendarAvailabilityOverride::whereDate('date', $dateString)->first();
        $payload = [
            'is_locked' => DB::raw(!empty($data['is_locked']) ? 'true' : 'false'),
            'max_events_override' => $maxEventsOverride,
            'max_pax_override' => $maxPaxOverride,
            'note' => $data['note'] ?? null,
            'updated_by' => Auth::id(),
            'updated_at' => now(),
        ];

        if ($override) {
            DB::table('calendar_availability_overrides')
                ->where('id', $override->id)
                ->update($payload);
        } else {
            $id = DB::table('calendar_availability_overrides')->insertGetId([
                'date' => $dateString,
                ...$payload,
                'created_by' => Auth::id(),
                'created_at' => now(),
            ]);
            $override = CalendarAvailabilityOverride::find($id);
        }

        return response()->json([
            'message' => 'Availability updated.',
            'override' => $availability->serializeOverride($override->fresh(['creator', 'updater'])),
        ]);
    }

    public function destroy(string $date): \Illuminate\Http\JsonResponse
    {
        $dateString = Carbon::parse($date)->toDateString();
        CalendarAvailabilityOverride::whereDate('date', $dateString)->delete();

        return response()->json(['message' => 'Availability override cleared.']);
    }
}
