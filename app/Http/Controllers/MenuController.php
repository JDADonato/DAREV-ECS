<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;
use Illuminate\Http\Request;

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
     * Get all categories
     */
    public function categories()
    {
        $categories = MenuItem::distinct()
            ->pluck('category')
            ->sort()
            ->values();

        return response()->json($categories);
    }

    /**
     * Get best seller items
     */
    public function bestsellers()
    {
        $items = MenuItem::whereRaw('is_best_seller is true')
            ->whereRaw('is_active is true')
            ->orderBy('name')
            ->get();

        return response()->json($items);
    }
}
