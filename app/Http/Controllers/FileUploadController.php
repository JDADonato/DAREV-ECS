<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

/**
 * Ported from: server/index.js file upload routes
 * Handles file uploads (payment proofs, theme images, etc.)
 */
class FileUploadController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'image' => 'required|file|max:5120', // 5MB max
        ]);

        $file = $request->file('image');
        $path = $file->store('uploads', 'public');

        return response()->json([
            'url' => '/storage/' . $path,
        ]);
    }
}
