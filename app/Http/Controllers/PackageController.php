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
        $packages = Package::where('type', $type)
            ->whereRaw('is_active is true')
            ->orderBy('name')
            ->get();

        return response()->json($packages);
    }
}
