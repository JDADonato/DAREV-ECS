<?php

namespace App\Http\Controllers;

use App\Models\EventType;
use Illuminate\Http\Request;

class EventTypeController extends Controller
{
    /**
     * Get all event types
     */
    public function index(Request $request)
    {
        $types = EventType::orderBy('label')
            ->paginate($request->get('per_page', 50));

        return response()->json($types);
    }

    /**
     * Get a single event type
     */
    public function show($id)
    {
        $type = EventType::findOrFail($id);
        return response()->json($type);
    }

    /**
     * Get event type by slug
     */
    public function bySlug($slug)
    {
        $type = EventType::where('slug', $slug)->firstOrFail();
        return response()->json($type);
    }
}
