<?php

namespace App\Http\Controllers;

use App\Http\Resources\BookingSummaryResource;
use App\Http\Resources\UserSummaryResource;
use App\Models\Booking;
use App\Models\AuditLog;
use App\Models\MenuItem;
use App\Models\PricingOverride;
use App\Models\User;
use App\Services\AdminReportService;
use App\Services\EventPreparationService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
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

    public function getEmployees(Request $request)
    {
        $query = User::whereIn('role', ['Marketing', 'Accounting'])
            ->when($request->query('search'), function ($q, $search) {
                $term = '%' . trim((string) $search) . '%';
                $q->where(fn ($inner) => $inner
                    ->where('full_name', 'like', $term)
                    ->orWhere('username', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('phone', 'like', $term));
            })
            ->orderBy('created_at', 'desc');

        if ($request->boolean('paginated')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
            $employees = $query->paginate($perPage, ['id', 'full_name', 'username', 'email', 'phone', 'role', 'created_at']);

            return ApiResponse::paginated($employees, UserSummaryResource::collection($employees->getCollection())->resolve());
        }

        $employees = $query->get(['id', 'full_name', 'username', 'email', 'phone', 'role', 'created_at']);

        return response()->json(UserSummaryResource::collection($employees)->resolve());
    }

    public function createEmployee(Request $request)
    {
        $request->validate([
            'full_name' => 'required|string|max:255',
            'username' => 'required|string|unique:users,username',
            'email'    => 'nullable|email|unique:users,email',
            'phone'    => 'nullable|string',
            'role'     => 'required|in:Marketing,Accounting',
        ]);

        $user = User::create([
            'full_name' => $request->full_name,
            'username' => $request->username,
            'password' => 'eloquestaff@2026',
            'email'    => $request->email,
            'phone'    => $request->phone,
            'role'     => $request->role,
        ]);

        return response()->json(['id' => $user->id, 'message' => 'Employee account created'], 201);
    }

    public function updateEmployee(Request $request, int $id)
    {
        $request->validate([
            'full_name' => ['nullable', 'string', 'max:255'],
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
        if ($request->has('full_name')) $updates['full_name'] = $request->full_name;
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

    public function getCustomers(Request $request)
    {
        $query = User::where('role', 'Client')
            ->select(['id', 'full_name', 'username', 'email', 'phone', 'role', 'created_at'])
            ->withCount('bookings')
            ->withMax('bookings', 'event_date')
            ->when($request->query('search'), function ($q, $search) {
                $term = '%' . trim((string) $search) . '%';
                $q->where(fn ($inner) => $inner
                    ->where('username', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('phone', 'like', $term));
            })
            ->orderBy('created_at', 'desc');

        if ($request->boolean('paginated')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
            return ApiResponse::paginated($query->paginate($perPage));
        }

        $customers = $query->get();

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

    public function getBookings(Request $request)
    {
        $query = Booking::query()
            ->select([
                'id',
                'user_id',
                'event_date',
                'event_time',
                'pax',
                'budget',
                'package_id',
                'event_type',
                'event_name',
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
                'review_status',
                'assigned_to',
                'clarification_request',
                'clarification_response',
                'clarification_requested_at',
                'clarification_responded_at',
                'reviewed_at',
                'live_status',
                'created_at',
            ])
            ->with([
                'user:id,full_name,username,email,phone,role',
                'assignee:id,full_name,username',
                'reviewTasks',
                'preparationTasks',
                'payments:id,booking_id,amount,status,payment_type,due_date',
            ])
            ->whereNotIn('status', ['Cancelled', 'cancelled', 'Completed', 'completed'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('search'), function ($q, $search) {
                $term = '%' . trim((string) $search) . '%';
                $q->where(fn ($inner) => $inner
                    ->where('client_full_name', 'like', $term)
                    ->orWhere('event_name', 'like', $term)
                    ->orWhere('client_email', 'like', $term)
                    ->orWhere('venue_city', 'like', $term));
            })
            ->orderBy('created_at', 'desc');

        if ($request->boolean('paginated')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
            $bookings = $query->paginate($perPage);
            return ApiResponse::paginated($bookings, BookingSummaryResource::collection($bookings->getCollection())->resolve());
        }

        $bookings = BookingSummaryResource::collection($query->get())->resolve();

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

        $booking->update([
            'status' => $request->status,
            'review_status' => 'Approved For Reservation',
            'reviewed_at' => now(),
        ]);
        EventPreparationService::ensureDefaultTasks($booking->fresh());
        Cache::put('admin.analytics.version', (int) Cache::get('admin.analytics.version', 1) + 1);
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
        Cache::put('admin.analytics.version', (int) Cache::get('admin.analytics.version', 1) + 1);

        return response()->json([
            'message'        => 'Discount applied successfully',
            'new_total_cost' => $newTotalCost,
        ]);
    }

    // ==========================================
    // 5. Decision Support System (DSS): Analytics
    // ==========================================

    public function getAnalytics(Request $request, AdminReportService $reports)
    {
        $filters = $this->analyticsFilters($request);

        return response()->json($reports->analytics($filters));
    }

    public function getAnalyticsSummary(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsSummary($this->analyticsFilters($request)));
    }

    public function getAnalyticsRevenue(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsRevenue($this->analyticsFilters($request)));
    }

    public function getAnalyticsPipeline(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsPipeline($this->analyticsFilters($request)));
    }

    public function getAnalyticsMenuPerformance(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsMenuPerformance($this->analyticsFilters($request)));
    }

    public function getAnalyticsCustomerExperience(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsCustomerExperience($this->analyticsFilters($request)));
    }

    public function getAnalyticsOperations(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsOperations($this->analyticsFilters($request)));
    }

    public function getAnalyticsForecasts(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsForecasts($this->analyticsFilters($request)));
    }

    private function analyticsFilters(Request $request): array
    {
        return array_filter($request->only([
            'date_from',
            'date_to',
            'event_type',
            'package_id',
            'booking_status',
            'payment_status',
            'city',
            'pax_min',
            'pax_max',
            'trend_months',
            'revenue_forecast_period',
            'revenue_forecast_horizon',
            'revenue_sma_window',
            'pax_projection_period',
            'pax_projection_horizon',
            'pax_sma_window',
            'pax_projection_year',
            'pax_projection_quarter',
            'snapshot_window',
        ]), fn ($value) => $value !== null && $value !== '');
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
        Cache::put('admin.analytics.version', (int) Cache::get('admin.analytics.version', 1) + 1);

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
        Cache::put('admin.analytics.version', (int) Cache::get('admin.analytics.version', 1) + 1);

        return response()->json($item);
    }

    public function deleteMenuItem(int $id)
    {
        $item = MenuItem::find($id);
        if (!$item) {
            return response()->json(['error' => 'Menu item not found'], 404);
        }

        $item->delete();
        Cache::put('admin.analytics.version', (int) Cache::get('admin.analytics.version', 1) + 1);
        return response()->json(['message' => 'Menu item deleted successfully']);
    }
}
