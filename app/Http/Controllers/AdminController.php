<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\AuditLog;
use App\Models\MenuItem;
use App\Models\Payment;
use App\Models\PricingOverride;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
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
            'email'    => 'nullable|email|unique:users,email',
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
            'username' => ['nullable', 'string', Rule::unique('users', 'username')->ignore($id)],
            'email'    => ['nullable', 'email', Rule::unique('users', 'email')->ignore($id)],
            'phone'    => 'nullable|string',
            'password' => 'nullable|string|min:6',
            'role'     => 'nullable|in:Marketing,Accounting',
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

        $user->update($updates);

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

    public function getCustomers()
    {
        $customers = User::where('role', 'Client')
            ->select(['id', 'username', 'email', 'phone', 'role', 'created_at'])
            ->withCount('bookings')
            ->withMax('bookings', 'event_date')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($customers);
    }

    public function updateCustomer(Request $request, int $id)
    {
        $request->validate([
            'username' => ['nullable', 'string', Rule::unique('users', 'username')->ignore($id)],
            'email'    => ['nullable', 'email', Rule::unique('users', 'email')->ignore($id)],
            'phone'    => 'nullable|string',
            'password' => 'nullable|string|min:6',
        ]);

        $user = User::find($id);

        if (!$user || $user->role !== 'Client') {
            return response()->json(['error' => 'Cannot modify this user'], 403);
        }

        $updates = [];
        if ($request->has('username')) $updates['username'] = $request->username;
        if ($request->has('email'))    $updates['email'] = $request->email;
        if ($request->has('phone'))    $updates['phone'] = $request->phone;
        if ($request->has('password') && $request->password) {
            $updates['password'] = Hash::make($request->password);
        }

        if (empty($updates)) {
            return response()->json(['error' => 'No fields to update'], 400);
        }

        $user->update($updates);

        return response()->json(['message' => 'Customer account updated successfully']);
    }

    public function deleteCustomer(int $id)
    {
        $user = User::find($id);

        if (!$user || $user->role !== 'Client') {
            return response()->json(['error' => 'Cannot delete this user'], 403);
        }

        $user->delete();

        return response()->json(['message' => 'Customer account deleted successfully']);
    }

    // ==========================================
    // 2. Admin Booking Management
    // ==========================================

    public function getBookings()
    {
        $bookings = Booking::query()
            ->select([
                'id',
                'user_id',
                'event_date',
                'event_time',
                'pax',
                'budget',
                'package_id',
                'event_type',
                'client_full_name',
                'client_email',
                'client_phone',
                'venue_address_line',
                'venue_street',
                'venue_city',
                'venue_province',
                'venue_zip_code',
                'total_cost',
                'status',
                'live_status',
                'created_at',
            ])
            ->with([
                'user:id,username,email,phone,role',
                'payments:id,booking_id,amount,status,payment_type,due_date',
            ])
            ->whereNotIn('status', ['Cancelled', 'cancelled', 'Completed', 'completed'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($booking) {
                $payments = $booking->payments;
                $paidTotal = $payments
                    ->whereIn('status', ['Paid', 'Verified'])
                    ->sum(fn ($payment) => (float) $payment->amount);
                $pendingTotal = $payments
                    ->whereNotIn('status', ['Paid', 'Verified', 'Refunded'])
                    ->sum(fn ($payment) => (float) $payment->amount);

                return array_merge($booking->toArray(), [
                    'totalCost' => (float) ($booking->total_cost ?? $booking->budget ?? 0),
                    'username' => $booking->user->username ?? null,
                    'user_email' => $booking->user->email ?? null,
                    'user_phone' => $booking->user->phone ?? null,
                    'payments_count' => $payments->count(),
                    'paid_total' => $paidTotal,
                    'pending_payment_total' => $pendingTotal,
                ]);
            });

        return response()->json($bookings);
    }

    public function updateBookingStatus(Request $request, int $id)
    {
        $request->validate([
            'status' => 'required|in:Confirmed',
        ]);

        $booking = Booking::find($id);
        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        if ($booking->status === $request->status) {
            return response()->json([
                'success' => true,
                'message' => 'Booking status already up to date',
                'booking' => $booking,
            ]);
        }

        if ($booking->status !== 'Pending') {
            return response()->json(['error' => 'Only pending bookings can be approved from this screen.'], 422);
        }

        $booking->update(['status' => $request->status]);
        Cache::forget('admin.analytics.v4');
        $booking->refresh();

        try {
            $client = User::find($booking->user_id);
            if ($client) {
                $client->notify(new \App\Notifications\BookingStatusNotification($booking, $request->status));
            }
        } catch (\Exception $e) {
            Log::error("Notification failed on admin booking approval: {$e->getMessage()}");
        }

        return response()->json([
            'success' => true,
            'message' => 'Booking approved successfully',
            'booking' => $booking,
        ]);
    }

    // ==========================================
    // 3. Global Pricing Control
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
    // 4. Custom On-The-Fly Discounts
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
        Cache::forget('admin.analytics.v4');

        return response()->json([
            'message'        => 'Discount applied successfully',
            'new_total_cost' => $newTotalCost,
        ]);
    }

    // ==========================================
    // 5. Decision Support System (DSS): Analytics
    // ==========================================

    public function getAnalytics()
    {
        return response()->json(Cache::remember('admin.analytics.v4', now()->addSeconds(45), function () {
            $activeStatuses = ['Pending', 'Confirmed', 'Completed', 'Approved'];
            $settledStatuses = ['Paid', 'Verified'];
            $now = Carbon::now();
            $driver = DB::connection()->getDriverName();
            $monthExpression = $driver === 'pgsql'
                ? "to_char(event_date, 'YYYY-MM')"
                : "strftime('%Y-%m', event_date)";
            $monthNumberExpression = $driver === 'pgsql'
                ? "extract(month from event_date)"
                : "strftime('%m', event_date)";

            $summaryRow = DB::table('bookings')
                ->whereIn('status', $activeStatuses)
                ->selectRaw('SUM(COALESCE(total_cost, budget, 0)) as total_revenue')
                ->selectRaw('SUM(pax) as total_pax')
                ->selectRaw('COUNT(id) as total_bookings')
                ->selectRaw("SUM(CASE WHEN status = 'Confirmed' THEN 1 ELSE 0 END) as active_bookings")
                ->selectRaw("SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_bookings")
                ->first();

            $paymentTotals = Payment::query()
                ->selectRaw("SUM(CASE WHEN status IN ('Paid', 'Verified') THEN amount ELSE 0 END) as settled_revenue")
                ->selectRaw("SUM(CASE WHEN status NOT IN ('Paid', 'Verified', 'Refunded') THEN amount ELSE 0 END) as pending_revenue")
                ->first();

            $totalRevenue = (float) ($summaryRow->total_revenue ?? 0);
            $totalBookings = (int) ($summaryRow->total_bookings ?? 0);

            $revenueTrends = DB::table('bookings')
                ->whereIn('status', $activeStatuses)
                ->selectRaw("$monthExpression as month")
                ->selectRaw('SUM(COALESCE(total_cost, budget, 0)) as revenue')
                ->selectRaw('COUNT(id) as bookings')
                ->selectRaw('SUM(pax) as pax')
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->map(fn ($row) => [
                    'month' => $row->month,
                    'label' => Carbon::createFromFormat('Y-m', $row->month)->format('M Y'),
                    'revenue' => (float) $row->revenue,
                    'bookings' => (int) $row->bookings,
                    'pax' => (int) $row->pax,
                ]);

            $averageRevenue = $revenueTrends->avg('revenue') ?: 0;
            $revenueForecast = collect(range(0, 5))->map(function ($offset) use ($now, $revenueTrends, $averageRevenue) {
                $month = $now->copy()->subMonths(2)->addMonths($offset);
                $monthKey = $month->format('Y-m');
                $actual = $revenueTrends->firstWhere('month', $monthKey);
                $seasonLift = in_array((int) $month->format('n'), [5, 6, 11, 12], true) ? 1.18 : 1;

                return [
                    'month' => $month->format('M'),
                    'actual' => $actual['revenue'] ?? null,
                    'forecast' => round(($actual['revenue'] ?? $averageRevenue) * $seasonLift),
                ];
            });

            $projectedPaxDemand = Booking::query()
                ->whereIn('status', ['Pending', 'Confirmed'])
                ->whereDate('event_date', '>=', $now->toDateString())
                ->orderBy('event_date')
                ->limit(10)
                ->get(['event_date', 'pax', 'client_full_name', 'event_type'])
                ->map(fn ($booking) => [
                    'date' => $booking->event_date->format('M j'),
                    'pax' => (int) $booking->pax,
                    'client' => $booking->client_full_name,
                    'eventType' => $booking->event_type,
                ]);

            $packageNames = \App\Models\Package::pluck('name', 'id');
            $topPackages = DB::table('bookings')
                ->whereIn('bookings.status', $activeStatuses)
                ->whereNotNull('bookings.package_id')
                ->selectRaw('bookings.package_id as package_id')
                ->selectRaw('COUNT(bookings.id) as count')
                ->selectRaw('SUM(COALESCE(bookings.total_cost, bookings.budget, 0)) as revenue')
                ->groupBy('bookings.package_id')
                ->orderByDesc('count')
                ->limit(6)
                ->get()
                ->map(fn ($row) => [
                    'name' => $packageNames[(int) $row->package_id] ?? $row->package_id,
                    'count' => (int) $row->count,
                    'revenue' => (float) $row->revenue,
                ]);

            $menuSales = DB::table('booking_items')
                ->join('menu_items', 'booking_items.menu_item_id', '=', 'menu_items.id')
                ->join('bookings', 'booking_items.booking_id', '=', 'bookings.id')
                ->whereIn('bookings.status', $activeStatuses)
                ->select('menu_items.name', 'menu_items.category')
                ->selectRaw('COUNT(booking_items.id) as sales')
                ->selectRaw('SUM(bookings.pax) as pax_served')
                ->groupBy('menu_items.name', 'menu_items.category')
                ->orderByDesc('sales')
                ->get();

            $salesFrequency = ['All' => $menuSales->take(10)->values()];
            foreach (['starter', 'main', 'side', 'dessert', 'drink'] as $category) {
                $salesFrequency[$category] = $menuSales
                    ->where('category', $category)
                    ->take(8)
                    ->values();
            }

            $peakRows = DB::table('bookings')
                ->whereIn('status', $activeStatuses)
                ->selectRaw("$monthNumberExpression as month")
                ->selectRaw('COUNT(id) as count')
                ->selectRaw('SUM(pax) as pax')
                ->groupBy('month')
                ->get()
                ->keyBy(fn ($row) => (int) $row->month);
            $peakSeasons = collect(range(1, 12))->map(function ($month) use ($peakRows) {
                $row = $peakRows->get($month);
                return [
                    'month' => Carbon::createFromDate((int) now()->format('Y'), $month, 1)->format('M'),
                    'monthNumber' => $month,
                    'count' => (int) ($row->count ?? 0),
                    'pax' => (int) ($row->pax ?? 0),
                ];
            });

            return [
                'summary' => [
                    'totalRevenue' => $totalRevenue,
                    'settledRevenue' => (float) ($paymentTotals->settled_revenue ?? 0),
                    'pendingRevenue' => (float) ($paymentTotals->pending_revenue ?? 0),
                    'activeBookings' => (int) ($summaryRow->active_bookings ?? 0),
                    'pendingBookings' => (int) ($summaryRow->pending_bookings ?? 0),
                    'totalBookings' => $totalBookings,
                    'totalPax' => (int) ($summaryRow->total_pax ?? 0),
                    'averageBookingValue' => $totalBookings > 0 ? round($totalRevenue / $totalBookings, 2) : 0,
                ],
                'revenueTrends' => $revenueTrends,
                'revenueForecast' => $revenueForecast,
                'projectedPaxDemand' => $projectedPaxDemand,
                'salesFrequency' => $salesFrequency,
                'topSellers' => $topPackages,
                'peakSeasons' => $peakSeasons,
            ];
        }));
    }

    public function getAudits(Request $request)
    {
        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = AuditLog::query()
            ->when($request->query('role'), fn ($q, $role) => $q->where('role', $role))
            ->when($request->query('method'), fn ($q, $method) => $q->where('method', strtoupper($method)))
            ->when($request->query('search'), function ($q, $search) {
                $term = '%' . trim($search) . '%';
                $q->where(function ($inner) use ($term) {
                    $inner->where('username', 'like', $term)
                        ->orWhere('action', 'like', $term)
                        ->orWhere('path', 'like', $term);
                });
            })
            ->orderByDesc('created_at');

        return response()->json($query->paginate($perPage));
    }

    // ==========================================
    // 6. Custom Menu Items CRUD
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
        Cache::forget('admin.analytics.v4');

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
        Cache::forget('admin.analytics.v4');

        return response()->json($item);
    }

    public function deleteMenuItem(int $id)
    {
        $item = MenuItem::find($id);
        if (!$item) {
            return response()->json(['error' => 'Menu item not found'], 404);
        }

        $item->delete();
        Cache::forget('admin.analytics.v4');
        return response()->json(['message' => 'Menu item deleted successfully']);
    }
}
