<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class RecordStaffAuditLog
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $user = $request->user();

        if (!$user || !in_array($user->role, ['Admin', 'Marketing', 'Accounting'], true)) {
            return $response;
        }

        if (!$this->shouldRecord($request)) {
            return $response;
        }

        try {
            if (!Schema::hasTable('audit_logs')) {
                return $response;
            }

            AuditLog::create([
                'user_id' => $user->id,
                'username' => $user->username,
                'role' => $user->role,
                'action' => $this->describeAction($request),
                'method' => $request->method(),
                'path' => '/' . ltrim($request->path(), '/'),
                'status_code' => $response->getStatusCode(),
                'ip_address' => $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 500, ''),
                'metadata' => [
                    'route' => optional($request->route())->getName(),
                    'target_id' => $request->route()?->parameter('id')
                        ?? $request->route()?->parameter('bookingId')
                        ?? $request->route()?->parameter('paymentId'),
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('Unable to record staff audit log.', [
                'message' => $e->getMessage(),
                'path' => $request->path(),
                'user_id' => $user->id,
            ]);
        }

        return $response;
    }

    private function shouldRecord(Request $request): bool
    {
        if ($request->is('api/admin/audits')) {
            return false;
        }

        if ($request->is('dashboard/admin', 'dashboard/marketing', 'dashboard/accounting')) {
            return true;
        }

        if ($request->is('api/admin/*', 'api/marketing/*', 'api/accounting/*', 'logout', 'profile')) {
            return !$request->isMethod('GET');
        }

        return false;
    }

    private function describeAction(Request $request): string
    {
        $method = $request->method();
        $path = '/' . ltrim($request->path(), '/');

        $phrases = [
            'POST /api/admin/employees' => 'Created a staff account',
            'PUT /api/admin/employees' => 'Updated a staff account',
            'DELETE /api/admin/employees' => 'Deleted a staff account',
            'PUT /api/admin/customers' => 'Updated a customer account',
            'DELETE /api/admin/customers' => 'Deleted a customer account',
            'POST /api/admin/pricing' => 'Changed pricing override',
            'PUT /api/admin/bookings' => 'Updated a booking',
            'POST /api/admin/bookings' => 'Changed booking financials',
            'POST /api/admin/menu-items' => 'Created a menu item',
            'PUT /api/admin/menu-items' => 'Updated a menu item',
            'DELETE /api/admin/menu-items' => 'Deleted a menu item',
            'POST /api/admin/packages' => 'Created a package',
            'PUT /api/admin/packages' => 'Updated a package',
            'POST /api/admin/event-types' => 'Created an event type',
            'PUT /api/admin/event-types' => 'Updated an event type',
            'DELETE /api/admin/event-types' => 'Deleted an event type',
            'PUT /api/accounting/payments' => 'Updated payment record',
            'POST /api/accounting/remind' => 'Sent payment reminder',
            'POST /api/accounting/refund' => 'Processed refund',
            'PUT /api/marketing/bookings' => 'Updated marketing booking status',
            'POST /logout' => 'Signed out',
            'GET /dashboard/admin' => 'Opened admin dashboard',
            'GET /dashboard/marketing' => 'Opened marketing dashboard',
            'GET /dashboard/accounting' => 'Opened accounting dashboard',
        ];

        foreach ($phrases as $prefix => $label) {
            if (str_starts_with("$method $path", $prefix)) {
                return $label;
            }
        }

        return match ($method) {
            'POST' => 'Created a record',
            'PUT', 'PATCH' => 'Updated a record',
            'DELETE' => 'Deleted a record',
            default => 'Viewed a staff page',
        };
    }
}
