<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\MenuItem;
use App\Models\PricingOverride;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

/**
 * Ported from: server/controllers/adminController.js
 * Employee CRUD, pricing, discounts, and analytics.
 */
class AdminController extends Controller
{
    /**
     * Show the Admin dashboard page.
     */
    public function index()
    {
        return Inertia::render('Admin/DashboardAdmin');
    }

    // ==========================================
    // 1. Employee Account Management (RBAC)
    // ==========================================

    public function getEmployees()
    {
        $employees = User::whereIn('role', ['Marketing', 'Accounting'])
            ->orderBy('created_at', 'desc')
            ->get(['id', 'username', 'email', 'phone', 'role', 'created_at']);

        return response()->json($employees);
    }

    public function createEmployee(Request $request)
    {
        $request->validate([
            'username' => 'required|string|unique:users,username',
            'password' => 'required|string|min:6',
            'email'    => 'nullable|email',
            'phone'    => 'nullable|string',
            'role'     => 'required|in:Marketing,Accounting',
        ]);

        $user = User::create([
            'username' => $request->username,
            'password' => $request->password,
            'email'    => $request->email,
            'phone'    => $request->phone,
            'role'     => $request->role,
        ]);

        return response()->json(['id' => $user->id, 'message' => 'Employee account created'], 201);
    }

    public function updateEmployee(Request $request, int $id)
    {
        $request->validate([
            'role' => 'nullable|in:Marketing,Accounting',
        ]);

        $user = User::find($id);

        if (!$user || in_array($user->role, ['Admin', 'Client'])) {
            return response()->json(['error' => 'Cannot modify this user'], 403);
        }

        $updates = [];
        if ($request->has('username')) $updates['username'] = $request->username;
        if ($request->has('email'))    $updates['email'] = $request->email;
        if ($request->has('phone'))    $updates['phone'] = $request->phone;
        if ($request->has('role'))     $updates['role'] = $request->role;
        if ($request->has('password') && $request->password) {
            $updates['password'] = Hash::make($request->password);
        }

        if (empty($updates)) {
            return response()->json(['error' => 'No fields to update'], 400);
        }

        try {
            $user->update($updates);
        } catch (\Illuminate\Database\QueryException $e) {
            if (str_contains($e->getMessage(), 'UNIQUE constraint failed')) {
                return response()->json(['error' => 'Username is already taken'], 400);
            }
            throw $e;
        }

        return response()->json(['message' => 'Employee account updated successfully']);
    }

    public function deleteEmployee(int $id)
    {
        $user = User::find($id);

        if (!$user || in_array($user->role, ['Admin', 'Client'])) {
            return response()->json(['error' => 'Cannot delete this user'], 403);
        }

        $user->delete();

        return response()->json(['message' => 'Employee account deleted successfully']);
    }

    // ==========================================
    // 2. Global Pricing Control
    // ==========================================

    public function getPricingOverrides()
    {
        try {
            $overrides = PricingOverride::all();
            $pricingMap = [];
            foreach ($overrides as $item) {
                $pricingMap[$item->id] = $item->new_price;
            }
            return response()->json(['overrides' => $pricingMap]);
        } catch (\Exception $e) {
            return response()->json(['overrides' => []]);
        }
    }

    public function updatePricingOverride(Request $request)
    {
        $request->validate([
            'id'        => 'required|string',
            'item_type' => 'required|string',
            'item_id'   => 'required|string',
            'new_price' => 'required|numeric',
        ]);

        PricingOverride::updateOrCreate(
            ['id' => $request->id],
            [
                'item_type' => $request->item_type,
                'item_id'   => $request->item_id,
                'new_price' => $request->new_price,
            ]
        );

        return response()->json(['message' => 'Pricing updated successfully']);
    }

    // ==========================================
    // 3. Custom On-The-Fly Discounts
    // ==========================================

    public function applyDiscount(Request $request, int $id)
    {
        $request->validate([
            'discount_value' => 'nullable|numeric',
            'discount_type'  => 'nullable|in:fixed,percentage',
        ]);

        $booking = Booking::find($id);
        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $originalAmount = $booking->budget ?? $booking->total_cost ?? 0;
        $discountValue = $request->discount_value ?? 0;
        $discountType = $request->discount_type ?? 'fixed';

        if ($discountType === 'percentage') {
            $deduction = $originalAmount * ($discountValue / 100);
            $newTotalCost = $originalAmount - $deduction;
        } elseif ($discountType === 'fixed') {
            $newTotalCost = $originalAmount - $discountValue;
        } else {
            $newTotalCost = $originalAmount;
        }

        $newTotalCost = max(0, $newTotalCost);

        $booking->update([
            'discount_value' => $discountValue,
            'discount_type'  => $discountType,
            'total_cost'     => $newTotalCost,
        ]);

        return response()->json([
            'message'        => 'Discount applied successfully',
            'new_total_cost' => $newTotalCost,
        ]);
    }

    // ==========================================
    // 4. Decision Support System (DSS): Analytics
    // ==========================================

    public function getAnalytics()
    {
        // Revenue Trends by month
        $revenueTrends = DB::table('bookings')
            ->whereIn('status', ['Completed', 'Approved', 'Pending'])
            ->select(
                DB::raw("strftime('%Y-%m', event_date) as month"),
                DB::raw('SUM(total_cost) as revenue')
            )
            ->groupBy('month')
            ->orderBy('month', 'asc')
            ->get();

        // Top Sellers by package
        $topSellers = DB::table('bookings')
            ->whereNotNull('package_id')
            ->where('status', '!=', 'Cancelled')
            ->select('package_id', DB::raw('COUNT(id) as count'))
            ->groupBy('package_id')
            ->orderBy('count', 'desc')
            ->get();

        // Peak Seasons heatmap
        $peakSeasons = DB::table('bookings')
            ->where('status', '!=', 'Cancelled')
            ->select(
                DB::raw("strftime('%m', event_date) as month"),
                DB::raw('COUNT(id) as count')
            )
            ->groupBy('month')
            ->orderBy('count', 'desc')
            ->get();

        return response()->json([
            'revenueTrends' => $revenueTrends,
            'topSellers'    => $topSellers,
            'peakSeasons'   => $peakSeasons,
        ]);
    }

    // ==========================================
    // 5. Custom Menu Items CRUD
    // ==========================================

    public function getMenuItems()
    {
        $items = MenuItem::orderBy('category')->orderBy('name')->get();
        return response()->json($items);
    }

    public function createMenuItem(Request $request)
    {
        $request->validate([
            'name'          => 'required|string|max:255',
            'category'      => 'required|in:starter,main,side,dessert,drink',
            'cost_per_head' => 'required|numeric|min:0',
            'price_adj'     => 'nullable|numeric|min:0',
            'image'         => 'nullable|string',
            'description'   => 'nullable|string',
            'is_best_seller' => 'nullable|boolean',
        ]);

        $dishId = 'custom_' . strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $request->name)) . '_' . time();

        $item = MenuItem::create([
            'dish_id'        => $dishId,
            'name'           => $request->name,
            'category'       => $request->category,
            'cost_per_head'  => $request->cost_per_head,
            'price_adj'      => $request->price_adj ?? 0,
            'image'          => $request->image ?? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
            'description'    => $request->description ?? '',
            'is_best_seller' => $request->is_best_seller ?? false,
        ]);

        return response()->json($item, 201);
    }

    public function updateMenuItem(Request $request, int $id)
    {
        $item = MenuItem::find($id);
        if (!$item) {
            return response()->json(['error' => 'Menu item not found'], 404);
        }

        $request->validate([
            'name'          => 'nullable|string|max:255',
            'category'      => 'nullable|in:starter,main,side,dessert,drink',
            'cost_per_head' => 'nullable|numeric|min:0',
            'price_adj'     => 'nullable|numeric|min:0',
            'image'         => 'nullable|string',
            'description'   => 'nullable|string',
            'is_best_seller' => 'nullable|boolean',
        ]);

        $item->update($request->only([
            'name', 'category', 'cost_per_head', 'price_adj',
            'image', 'description', 'is_best_seller',
        ]));

        return response()->json($item);
    }

    public function deleteMenuItem(int $id)
    {
        $item = MenuItem::find($id);
        if (!$item) {
            return response()->json(['error' => 'Menu item not found'], 404);
        }

        $item->delete();
        return response()->json(['message' => 'Menu item deleted successfully']);
    }
}
