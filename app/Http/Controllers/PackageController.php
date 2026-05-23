<?php

namespace App\Http\Controllers;

use App\Models\Package;
use Illuminate\Http\Request;

class PackageController extends Controller
{
    /**
     * Get all packages
     */
    public function index(Request $request)
    {
        $packages = Package::whereRaw('is_active is true')
            ->orderBy('type')
            ->orderBy('name')
            ->paginate($request->get('per_page', 50));

        return response()->json($packages);
    }

    /**
     * Get a single package
     */
    public function show($id)
    {
        $package = Package::findOrFail($id);
        return response()->json($package);
    }

    /**
     * Get packages by type
     */
    public function byType($type)
    {
        $packages = Package::whereRaw('is_active is true')
            ->where(function ($query) use ($type) {
                $query->where('type', $type)
                    ->orWhereJsonContains('event_type_slugs', $type);
            })
            ->orderBy('name')
            ->get();

        return response()->json($packages);
    }
}
