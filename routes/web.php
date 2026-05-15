<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\ClientDashboardController;
use App\Http\Controllers\EventTypeController;
use App\Http\Controllers\FileUploadController;
use App\Http\Controllers\FinanceController;
use App\Http\Controllers\FoodTastingController;
use App\Http\Controllers\MenuController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OpsController;
use App\Http\Controllers\PackageController;
use App\Http\Controllers\PaymentController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
| Ported from: server/index.js
| All routes translated from Express API to Laravel Inertia routes.
| Page names match the original client/src file structure.
|--------------------------------------------------------------------------
*/

// ─── Public Routes ───

Route::get('/', fn () => Inertia::render('LandingPage'))->name('home');
Route::get('/about', fn () => Inertia::render('About'))->name('about');
Route::get('/contact', fn () => Inertia::render('Contact'))->name('contact');

Route::middleware('guest')->group(function () {
    Route::get('/login', fn () => Inertia::render('Login'))->name('login');
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/register', fn () => Inertia::render('Register'))->name('register');
    Route::post('/register', [AuthController::class, 'register']);
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::post('/verify-otp', [AuthController::class, 'verifyOtp'])->name('verify.otp');
    Route::post('/resend-otp', [AuthController::class, 'resendOtp'])->name('resend.otp');

    // Profile Routes
    Route::get('/profile', fn () => Inertia::render('Profile/Edit'))->name('profile.edit');
    Route::put('/profile', [App\Http\Controllers\ProfileController::class, 'update'])->name('profile.update');

    // ─── Notification Routes ───
    Route::get('/api/notifications', [NotificationController::class, 'index']);
    Route::get('/api/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::put('/api/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::put('/api/notifications/read-all', [NotificationController::class, 'markAllAsRead']);

    // ─── Legacy Messaging Routes (kept for backward compatibility) ───
    Route::get('/api/messages/conversations', [MessageController::class, 'conversations']);
    Route::get('/api/messages/staff/available', [MessageController::class, 'availableStaff']);
    Route::get('/api/messages/unread-count', [MessageController::class, 'unreadCount']);
    Route::get('/api/messages/my-bookings', [MessageController::class, 'myBookings']);
    Route::get('/api/messages/{userId}', [MessageController::class, 'messages']);
    Route::post('/api/messages', [MessageController::class, 'send']);

    // ─── Phase 2: Chat Routes (WebSocket/Ticket System) ───
    Route::get('/api/chat/conversations', [ChatController::class, 'conversations']);
    Route::post('/api/chat/conversations', [ChatController::class, 'startConversation']);
    Route::get('/api/chat/unassigned', [ChatController::class, 'unassigned']);
    Route::get('/api/chat/my-chats', [ChatController::class, 'myChats']);
    Route::get('/api/chat/unread-count', [ChatController::class, 'unreadCount']);
    Route::get('/api/chat/my-bookings', [ChatController::class, 'myBookings']);
    Route::get('/api/chat/conversations/{conversation}/messages', [ChatController::class, 'messages']);
    Route::post('/api/chat/conversations/{conversation}/messages', [ChatController::class, 'sendMessage']);
    Route::post('/api/chat/conversations/{conversation}/claim', [ChatController::class, 'claim']);
    Route::post('/api/chat/conversations/{conversation}/resolve', [ChatController::class, 'resolve']);
    Route::post('/api/chat/conversations/{conversation}/transfer', [ChatController::class, 'transfer']);
    Route::get('/api/chat/staff/available', [ChatController::class, 'availableStaff']);
});

// Public pricing endpoint (used by menu components)
Route::get('/api/pricing', [AdminController::class, 'getPricingOverrides']);

// Public custom menu items endpoint (used by menu components to merge with static catalog)
Route::get('/api/menu-items', [AdminController::class, 'getMenuItems']);

// Public food tasting (guests can submit without auth)
Route::post('/api/food-tasting', [FoodTastingController::class, 'store']);

// Booking availability is public (calendar needs it without auth sometimes)
Route::get('/api/bookings/availability/{date}', [BookingController::class, 'checkAvailability']);

// ─── Menu API Endpoints (Database-backed) ───
Route::get('/api/menu', [MenuController::class, 'index']);
Route::get('/api/menu/categories', [MenuController::class, 'categories']);
Route::get('/api/menu/bestsellers', [MenuController::class, 'bestsellers']);
Route::get('/api/menu/{id}', [MenuController::class, 'show']);

// Event types API
Route::get('/api/event-types', [EventTypeController::class, 'index']);
Route::get('/api/event-types/slug/{slug}', [EventTypeController::class, 'bySlug']);
Route::get('/api/event-types/{id}', [EventTypeController::class, 'show']);

// Packages API
Route::get('/api/packages', [PackageController::class, 'index']);
Route::get('/api/packages/type/{type}', [PackageController::class, 'byType']);
Route::get('/api/packages/{id}', [PackageController::class, 'show']);

// ─── Client Routes ───

// Public Views (Client Side)
Route::get('/book', fn () => Inertia::render('client/BookingWizard'))->name('booking.wizard');
Route::get('/menu', fn () => Inertia::render('client/MenuGallery'))->name('menu.gallery');
Route::get('/food-tasting', fn () => Inertia::render('client/FoodTasting'))->name('food-tasting');

Route::middleware(['auth', 'role:Client'])->group(function () {
    // Dashboard — renders original ClientDashboard.jsx which fetches via API
    Route::get('/dashboard/client', fn () => Inertia::render('client/ClientDashboard'))->name('dashboard.client');
    Route::get('/pay', fn () => Inertia::render('client/PaymentPage'))->name('payment.page');
    Route::post('/checkout/initialize', [PaymentController::class, 'initializeCheckout'])->name('checkout.initialize');
    Route::get('/checkout/secure', [PaymentController::class, 'showSecureCheckout'])->middleware('signed')->name('checkout.secure');
    Route::post('/checkout/process', [PaymentController::class, 'processPayment'])->name('checkout.process');
    Route::get('/checkout/success', fn () => Inertia::render('client/PaymentSuccess'))->name('checkout.success');

    // Dashboard data API (used by original ClientDashboard.jsx fetch calls)
    Route::get('/api/dashboard/client', [ClientDashboardController::class, 'apiData']);

    // Booking API endpoints (JSON responses for React AJAX calls)
    Route::post('/api/bookings', [BookingController::class, 'store']);
    Route::put('/api/bookings/{id}/event-details', [BookingController::class, 'updateEventDetails']);
    Route::put('/api/bookings/{id}/cancel', [BookingController::class, 'cancel']);
    Route::put('/api/bookings/{id}/update', [BookingController::class, 'update']);
    Route::post('/api/bookings/pay', [BookingController::class, 'recordPayment']);

    // Food tasting (authenticated)
    Route::get('/api/food-tasting', [FoodTastingController::class, 'index']);

    // File upload
    Route::post('/api/upload', [FileUploadController::class, 'store']);
});

// ─── Ops Routes (Marketing + Admin) ───

Route::middleware(['auth', 'role:Marketing,Admin'])->group(function () {
    Route::get('/dashboard/ops', fn () => Inertia::render('DashboardOps'))->name('dashboard.ops');
    Route::get('/api/ops/bookings', [OpsController::class, 'getAllBookings']);
    Route::put('/api/ops/bookings/{id}/status', [OpsController::class, 'updateStatus']);
    Route::put('/api/ops/bookings/{id}/livestatus', [OpsController::class, 'updateLiveStatus']);
    Route::get('/api/ops/bookings/{id}', [OpsController::class, 'show']);
});

// ─── Finance Routes (Accounting) ───

Route::middleware(['auth', 'role:Accounting'])->group(function () {
    Route::get('/dashboard/finance', fn () => Inertia::render('DashboardFinance'))->name('dashboard.finance');
    Route::get('/api/finance/bookings', [FinanceController::class, 'getBookingsWithPayments']);
    Route::get('/api/finance/payments/pending', [FinanceController::class, 'getPendingPayments']);
    Route::put('/api/finance/payments/{id}/verify', [FinanceController::class, 'verifyPayment']);
    Route::put('/api/finance/payments/{id}', [FinanceController::class, 'updatePayment']);
    Route::get('/api/finance/ledger', [FinanceController::class, 'getLedger']);
    Route::post('/api/finance/remind/{paymentId}', [FinanceController::class, 'remindClient']);
    Route::get('/api/finance/refunds/queue', [FinanceController::class, 'getRefundQueue']);
    Route::post('/api/finance/refund/{bookingId}', [FinanceController::class, 'processRefund']);
});

// ─── Admin Routes ───

Route::middleware(['auth', 'role:Admin'])->group(function () {
    Route::get('/dashboard/admin', fn () => Inertia::render('DashboardAdmin'))->name('dashboard.admin');
    Route::get('/api/admin/employees', [AdminController::class, 'getEmployees']);
    Route::post('/api/admin/employees', [AdminController::class, 'createEmployee']);
    Route::put('/api/admin/employees/{id}', [AdminController::class, 'updateEmployee']);
    Route::delete('/api/admin/employees/{id}', [AdminController::class, 'deleteEmployee']);
    Route::post('/api/admin/pricing', [AdminController::class, 'updatePricingOverride']);
    Route::post('/api/admin/bookings/{id}/discount', [AdminController::class, 'applyDiscount']);
    Route::get('/api/admin/analytics', [AdminController::class, 'getAnalytics']);

    // Menu items CRUD
    Route::post('/api/admin/menu-items', [AdminController::class, 'createMenuItem']);
    Route::put('/api/admin/menu-items/{id}', [AdminController::class, 'updateMenuItem']);
    Route::delete('/api/admin/menu-items/{id}', [AdminController::class, 'deleteMenuItem']);
});

Route::fallback(function (Request $request) {
    if ($request->is('api/*')) {
        return response()->json(['error' => 'API endpoint not found.'], 404);
    }

    abort(404);
});
