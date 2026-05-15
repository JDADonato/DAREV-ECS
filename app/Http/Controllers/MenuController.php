<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class MenuController extends Controller
{
    /**
     * Get all menu items with optional filtering
     */
    public function index(Request $request)
    {
        $query = MenuItem::query();

        // Filter by category
        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        // Filter by best seller
        if ($request->has('best_seller') && $request->boolean('best_seller')) {
            $query->whereRaw('is_best_seller is true');
        }

        // Filter by active status
        if ($request->has('active')) {
            $query->whereRaw('is_active is ' . ($request->boolean('active') ? 'true' : 'false'));
        }

        // Order by category and then name
        $items = $query->orderBy('category')
            ->orderBy('name')
            ->paginate($request->get('per_page', 50));

        return response()->json($items);
    }

    /**
     * Get a single menu item
     */
    public function show($id)
    {
        $item = MenuItem::findOrFail($id);
        return response()->json($item);
    }

    /**
     * Get all categories (Cached for 24 hours)
     */
    public function categories()
    {
        $categories = Cache::remember('menu_categories', now()->addHours(24), function () {
            return MenuItem::distinct()
                ->pluck('category')
                ->sort()
                ->values();
        });

        return response()->json($categories);
    }

    /**
     * Get best seller items (Cached for 24 hours)
     */
    public function bestsellers()
    {
        $items = Cache::remember('menu_bestsellers', now()->addHours(24), function () {
            return MenuItem::whereRaw('is_best_seller is true')
                ->whereRaw('is_active is true')
                ->orderBy('name')
                ->get();
        });

        return response()->json($items);
    }
}
