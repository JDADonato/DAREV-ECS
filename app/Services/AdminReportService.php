<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AdminReportService
{
    public function widgetDefinitions(): array
    {
        return [
            ['id' => 'revenue_summary', 'name' => 'Revenue Summary', 'category' => 'Finance', 'description' => 'Collected, pending, overdue, and collection rate.'],
            ['id' => 'payment_breakdown', 'name' => 'Payment Status Breakdown', 'category' => 'Finance', 'description' => 'Counts and totals by payment status.'],
            ['id' => 'payment_aging', 'name' => 'Payment Aging', 'category' => 'Finance', 'description' => 'Unpaid balances grouped by urgency.'],
            ['id' => 'booking_pipeline', 'name' => 'Booking Pipeline', 'category' => 'Sales', 'description' => 'Bookings by operational status.'],
            ['id' => 'upcoming_workload', 'name' => 'Upcoming Workload', 'category' => 'Operations', 'description' => 'Next confirmed or pending events.'],
            ['id' => 'package_performance', 'name' => 'Package Performance', 'category' => 'Sales', 'description' => 'Package count and value.'],
            ['id' => 'menu_performance', 'name' => 'Menu Item Performance', 'category' => 'Menu', 'description' => 'Top selected dishes.'],
            ['id' => 'customer_growth', 'name' => 'Customer Growth', 'category' => 'Marketing', 'description' => 'New clients by month.'],
            ['id' => 'refunds_cancellations', 'name' => 'Refunds And Cancellations', 'category' => 'Finance', 'description' => 'Cancelled value and refunded payments.'],
            ['id' => 'operational_alerts', 'name' => 'Operational Alerts', 'category' => 'Operations', 'description' => 'A compact queue of issues needing action.'],
        ];
    }

    public function preview(array $widgetIds, array $filters = []): array
    {
        if (empty($widgetIds)) {
            $widgetIds = ['revenue_summary', 'booking_pipeline', 'payment_breakdown', 'upcoming_workload'];
        }

        return collect($widgetIds)
            ->map(fn ($id) => ['id' => $id, 'data' => $this->widgetData($id, $filters)])
            ->values()
            ->all();
    }

    public function widgetData(string $id, array $filters = []): array
    {
        return match ($id) {
            'revenue_summary' => $this->revenueSummary($filters),
            'payment_breakdown' => $this->paymentBreakdown($filters),
            'payment_aging' => ['rows' => $this->paymentAging($filters), 'action' => 'Oldest unpaid balances should be followed up first.'],
            'booking_pipeline' => $this->bookingPipeline($filters),
            'upcoming_workload' => $this->upcomingWorkload($filters),
            'package_performance' => $this->packagePerformance($filters),
            'menu_performance' => $this->menuPerformance($filters),
            'customer_growth' => $this->customerGrowth($filters),
            'refunds_cancellations' => $this->refundsAndCancellations($filters),
            'operational_alerts' => ['rows' => $this->operationalAlerts($filters), 'action' => 'Resolve danger and warning items before daily operations start.'],
            default => ['message' => 'Unknown widget.'],
        };
    }

    public function analytics(array $filters = []): array
    {
        $summary = $this->revenueSummary($filters);

        return [
            'summary' => [
                'settledRevenue' => $summary['settledRevenue'],
                'pendingRevenue' => $summary['pendingRevenue'],
                'overdueRevenue' => $summary['overdueRevenue'],
                'totalRevenue' => $summary['settledRevenue'] + $summary['pendingRevenue'],
                'collectionRate' => $summary['collectionRate'],
                'averageBookingValue' => $this->averageBookingValue($filters),
                'pendingBookings' => $this->countBookings($filters, ['Pending']),
                'activeBookings' => $this->countBookings($filters, ['Confirmed', 'Reserved']),
                'completedBookings' => $this->countBookings($filters, ['Completed']),
                'totalPax' => $this->bookingQuery($filters)->sum('pax') ?: 0,
            ],
            'revenueTrends' => $this->settledRevenueTrend($filters),
            'revenueHealth' => [
                'settledRevenueOverTime' => $this->settledRevenueTrend($filters),
                'paymentStatusBreakdown' => $this->paymentBreakdown($filters)['rows'],
                'paymentAging' => $this->paymentAging($filters),
            ],
            'paymentAging' => $this->paymentAging($filters),
            'bookingPipeline' => $this->bookingPipeline($filters)['rows'],
            'upcomingWorkload' => $this->upcomingWorkload($filters)['rows'],
            'packagePerformance' => $this->packagePerformance($filters)['rows'],
            'menuPerformance' => $this->menuPerformance($filters)['rows'],
            'customerExperience' => [
                'customerGrowth' => $this->customerGrowth($filters)['rows'],
                'feedbackSignals' => [],
            ],
            'operationsLoad' => $this->operationsLoad($filters),
            'alerts' => $this->operationalAlerts($filters),
            'operationalAlerts' => $this->operationalAlerts($filters),
            'revenueForecast' => [],
            'projectedPaxDemand' => $this->upcomingWorkload($filters)['rows'],
            'salesFrequency' => $this->legacySalesFrequency($filters),
            'topSellers' => $this->packagePerformance($filters)['rows'],
            'peakSeasons' => $this->operationsLoad($filters),
        ];
    }

    private function revenueSummary(array $filters): array
    {
        $paymentRows = $this->paymentQuery($filters)
            ->selectRaw("SUM(CASE WHEN payments.status IN ('Paid', 'Verified') THEN payments.amount ELSE 0 END) as settled")
            ->selectRaw("SUM(CASE WHEN payments.status NOT IN ('Paid', 'Verified', 'Refunded') THEN payments.amount ELSE 0 END) as pending")
            ->selectRaw("SUM(CASE WHEN payments.status NOT IN ('Paid', 'Verified', 'Refunded') AND payments.due_date < ? THEN payments.amount ELSE 0 END) as overdue", [today()->toDateString()])
            ->first();

        $settled = (float) ($paymentRows->settled ?? 0);
        $pending = (float) ($paymentRows->pending ?? 0);
        $overdue = (float) ($paymentRows->overdue ?? 0);
        $total = $settled + $pending;

        return [
            'settledRevenue' => $settled,
            'pendingRevenue' => $pending,
            'overdueRevenue' => $overdue,
            'collectionRate' => $total > 0 ? round(($settled / $total) * 100, 1) : 0,
            'action' => $overdue > 0 ? 'Prioritize overdue balances before upcoming events.' : 'Collections are current for the selected filters.',
        ];
    }

    private function paymentBreakdown(array $filters): array
    {
        $rows = $this->paymentQuery($filters)
            ->select('payments.status')
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('SUM(payments.amount) as total')
            ->groupBy('payments.status')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'label' => $row->status ?: 'Unknown',
                'count' => (int) $row->count,
                'total' => (float) $row->total,
            ])
            ->values()
            ->all();

        return ['rows' => $rows, 'action' => 'Use this to focus verification and reminder work.'];
    }

    private function bookingPipeline(array $filters): array
    {
        $rows = $this->bookingQuery($filters)
            ->select('status')
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('SUM(COALESCE(total_cost, budget, 0)) as value')
            ->groupBy('status')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($row) => [
                'label' => $row->status ?: 'Unknown',
                'count' => (int) $row->count,
                'value' => (float) $row->value,
            ])
            ->values()
            ->all();

        return ['rows' => $rows, 'action' => 'Pending bookings are the main conversion queue.'];
    }

    private function upcomingWorkload(array $filters): array
    {
        $rows = $this->bookingQuery($filters)
            ->whereDate('event_date', '>=', today())
            ->whereIn('status', ['Pending', 'Confirmed', 'Reserved'])
            ->orderBy('event_date')
            ->limit(10)
            ->get(['id', 'client_full_name', 'event_date', 'event_type', 'status', 'pax', 'venue_city'])
            ->map(fn ($booking) => [
                'id' => $booking->id,
                'client' => $booking->client_full_name ?: 'Client',
                'date' => optional($booking->event_date)->format('M j, Y'),
                'eventType' => $booking->event_type ?: 'Event',
                'status' => $booking->status,
                'pax' => (int) $booking->pax,
                'city' => $booking->venue_city,
            ])
            ->values()
            ->all();

        return ['rows' => $rows, 'action' => 'Check near-term pending events and missing logistics first.'];
    }

    private function packagePerformance(array $filters): array
    {
        $packageNames = DB::table('packages')->pluck('name', 'id');
        $rows = $this->bookingQuery($filters)
            ->selectRaw("COALESCE(bookings.package_id, 'Unassigned') as package_key")
            ->selectRaw('COUNT(bookings.id) as count')
            ->selectRaw('SUM(COALESCE(bookings.total_cost, bookings.budget, 0)) as revenue')
            ->groupBy('package_key')
            ->orderByDesc('revenue')
            ->limit(8)
            ->get()
            ->map(function ($row) use ($packageNames) {
                $packageKey = (string) ($row->package_key ?: 'Unassigned');

                return [
                    'label' => $packageNames[$packageKey] ?? ($packageKey === 'Unassigned' ? 'Unassigned' : $packageKey),
                    'count' => (int) $row->count,
                    'revenue' => (float) $row->revenue,
                ];
            })
            ->values()
            ->all();

        return ['rows' => $rows, 'action' => 'Use top packages for recommendations and promo focus.'];
    }

    private function menuPerformance(array $filters): array
    {
        $rows = DB::table('booking_items')
            ->join('menu_items', 'booking_items.menu_item_id', '=', 'menu_items.id')
            ->join('bookings', 'booking_items.booking_id', '=', 'bookings.id')
            ->when($filters['date_from'] ?? null, fn ($q, $date) => $q->where('bookings.event_date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($q, $date) => $q->where('bookings.event_date', '<=', $date))
            ->when($filters['event_type'] ?? null, fn ($q, $type) => $q->where('bookings.event_type', $type))
            ->select('menu_items.name as label', 'menu_items.category')
            ->selectRaw('COUNT(booking_items.id) as selections')
            ->selectRaw('SUM(bookings.pax) as pax_served')
            ->groupBy('menu_items.name', 'menu_items.category')
            ->orderByDesc('selections')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'label' => $row->label,
                'category' => $row->category,
                'selections' => (int) $row->selections,
                'paxServed' => (int) $row->pax_served,
            ])
            ->values()
            ->all();

        return ['rows' => $rows, 'action' => 'Top dishes should influence package defaults and purchasing.'];
    }

    private function customerGrowth(array $filters): array
    {
        $monthExpression = $this->monthExpression('created_at');

        $rows = DB::table('users')
            ->where('role', 'Client')
            ->when($filters['date_from'] ?? null, fn ($q, $date) => $q->where('created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($q, $date) => $q->where('created_at', '<=', $date))
            ->selectRaw("$monthExpression as month")
            ->selectRaw('COUNT(*) as count')
            ->groupBy('month')
            ->orderBy('month')
            ->limit(12)
            ->get()
            ->map(fn ($row) => ['label' => $row->month, 'count' => (int) $row->count])
            ->values()
            ->all();

        return ['rows' => $rows, 'action' => 'Growth dips can trigger marketing campaigns.'];
    }

    private function refundsAndCancellations(array $filters): array
    {
        $cancelledValue = $this->bookingQuery($filters)
            ->whereIn('status', ['Cancelled', 'cancelled'])
            ->sum(DB::raw('COALESCE(total_cost, budget, 0)'));

        $refunded = $this->paymentQuery($filters)
            ->where('payments.status', 'Refunded')
            ->sum('payments.amount');

        return [
            'cancelledValue' => (float) $cancelledValue,
            'refundedAmount' => (float) $refunded,
            'action' => 'Review cancellation reasons and refund exposure together.',
        ];
    }

    private function settledRevenueTrend(array $filters): array
    {
        $monthExpression = $this->monthExpression('payments.verified_at');

        return $this->paymentQuery($filters)
            ->whereIn('payments.status', ['Paid', 'Verified'])
            ->whereNotNull('payments.verified_at')
            ->selectRaw("$monthExpression as month")
            ->selectRaw('SUM(payments.amount) as revenue')
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn ($row) => [
                'month' => $row->month,
                'label' => Carbon::createFromFormat('Y-m', $row->month)->format('M Y'),
                'revenue' => (float) $row->revenue,
            ])
            ->values()
            ->all();
    }

    private function paymentAging(array $filters): array
    {
        $payments = $this->paymentQuery($filters)
            ->whereNotIn('payments.status', ['Paid', 'Verified', 'Refunded'])
            ->get(['payments.amount', 'payments.due_date']);

        $buckets = [
            'Not due' => 0,
            '1-7 days' => 0,
            '8-14 days' => 0,
            '15+ days' => 0,
        ];

        foreach ($payments as $payment) {
            $days = $payment->due_date ? Carbon::parse($payment->due_date)->diffInDays(today(), false) : -1;
            $bucket = $days <= 0 ? 'Not due' : ($days <= 7 ? '1-7 days' : ($days <= 14 ? '8-14 days' : '15+ days'));
            $buckets[$bucket] += (float) $payment->amount;
        }

        return collect($buckets)->map(fn ($value, $label) => ['label' => $label, 'value' => $value])->values()->all();
    }

    private function operationsLoad(array $filters): array
    {
        $monthExpression = $this->monthExpression('event_date');

        return $this->bookingQuery($filters)
            ->whereIn('status', ['Pending', 'Confirmed', 'Reserved', 'Completed'])
            ->selectRaw("$monthExpression as month")
            ->selectRaw('COUNT(*) as events')
            ->selectRaw('SUM(pax) as pax')
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn ($row) => ['label' => $row->month, 'events' => (int) $row->events, 'pax' => (int) $row->pax])
            ->values()
            ->all();
    }

    private function operationalAlerts(array $filters): array
    {
        $pendingOld = $this->bookingQuery($filters)->where('status', 'Pending')->where('created_at', '<=', now()->subHours(48))->count();
        $overduePayments = $this->paymentQuery($filters)->whereNotIn('payments.status', ['Paid', 'Verified', 'Refunded'])->where('payments.due_date', '<', today())->count();
        $upcomingMissing = $this->bookingQuery($filters)
            ->whereIn('status', ['Confirmed', 'Reserved'])
            ->whereBetween('event_date', [today(), today()->addDays(7)])
            ->where(function ($q) {
                $q->whereNull('venue_address_line')->orWhereNull('event_time');
            })
            ->count();

        return [
            ['label' => 'Pending bookings older than 48 hours', 'count' => $pendingOld, 'severity' => $pendingOld > 0 ? 'warning' : 'ok'],
            ['label' => 'Overdue unpaid payment milestones', 'count' => $overduePayments, 'severity' => $overduePayments > 0 ? 'danger' : 'ok'],
            ['label' => 'Events within 7 days missing logistics', 'count' => $upcomingMissing, 'severity' => $upcomingMissing > 0 ? 'warning' : 'ok'],
        ];
    }

    private function averageBookingValue(array $filters): float
    {
        $row = $this->bookingQuery($filters)
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('SUM(COALESCE(total_cost, budget, 0)) as value')
            ->first();

        return (int) ($row->count ?? 0) > 0 ? round(((float) $row->value) / (int) $row->count, 2) : 0;
    }

    private function countBookings(array $filters, array $statuses): int
    {
        return $this->bookingQuery($filters)->whereIn('status', $statuses)->count();
    }

    private function bookingQuery(array $filters)
    {
        return Booking::query()
            ->when($filters['date_from'] ?? null, fn ($q, $date) => $q->where('event_date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($q, $date) => $q->where('event_date', '<=', $date))
            ->when($filters['event_type'] ?? null, fn ($q, $type) => $q->where('event_type', $type))
            ->when($filters['booking_status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['package_id'] ?? null, fn ($q, $id) => $q->where('package_id', $id))
            ->when($filters['city'] ?? null, fn ($q, $city) => $q->where('venue_city', 'like', '%' . trim($city) . '%'))
            ->when($filters['pax_min'] ?? null, fn ($q, $pax) => $q->where('pax', '>=', (int) $pax))
            ->when($filters['pax_max'] ?? null, fn ($q, $pax) => $q->where('pax', '<=', (int) $pax));
    }

    private function paymentQuery(array $filters)
    {
        return Payment::query()
            ->leftJoin('bookings', 'payments.booking_id', '=', 'bookings.id')
            ->when($filters['date_from'] ?? null, fn ($q, $date) => $q->where('bookings.event_date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($q, $date) => $q->where('bookings.event_date', '<=', $date))
            ->when($filters['event_type'] ?? null, fn ($q, $type) => $q->where('bookings.event_type', $type))
            ->when($filters['booking_status'] ?? null, fn ($q, $status) => $q->where('bookings.status', $status))
            ->when($filters['payment_status'] ?? null, fn ($q, $status) => $q->where('payments.status', $status))
            ->when($filters['package_id'] ?? null, fn ($q, $id) => $q->where('bookings.package_id', $id))
            ->when($filters['city'] ?? null, fn ($q, $city) => $q->where('bookings.venue_city', 'like', '%' . trim($city) . '%'))
            ->when($filters['pax_min'] ?? null, fn ($q, $pax) => $q->where('bookings.pax', '>=', (int) $pax))
            ->when($filters['pax_max'] ?? null, fn ($q, $pax) => $q->where('bookings.pax', '<=', (int) $pax));
    }

    private function legacySalesFrequency(array $filters): array
    {
        $rows = $this->menuPerformance($filters)['rows'];
        $all = collect($rows)->map(fn ($row) => [
            'name' => $row['label'],
            'category' => $row['category'] ?? 'menu',
            'sales' => $row['selections'] ?? 0,
            'pax_served' => $row['paxServed'] ?? 0,
        ]);

        $grouped = ['All' => $all->values()->all()];
        foreach (['starter', 'main', 'side', 'dessert', 'drink'] as $category) {
            $grouped[$category] = $all->where('category', $category)->values()->all();
        }

        return $grouped;
    }

    private function monthExpression(string $column): string
    {
        return match (DB::getDriverName()) {
            'pgsql' => "TO_CHAR($column, 'YYYY-MM')",
            'mysql', 'mariadb' => "DATE_FORMAT($column, '%Y-%m')",
            default => "strftime('%Y-%m', $column)",
        };
    }
}
