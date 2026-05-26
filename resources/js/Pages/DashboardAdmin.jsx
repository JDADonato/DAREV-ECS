import React, { Suspense, lazy, useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { router } from '@inertiajs/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from '../Components/charts/LazyRecharts';
import { CalendarDays, CheckCircle2, ChevronDown, ClipboardList, CreditCard, Filter, Package, RefreshCw, Users } from 'lucide-react';
import useCachedJson from '../hooks/useCachedJson';
import useSmartRefresh from '../hooks/useSmartRefresh';
import ConfirmModal from '../Components/common/ConfirmModal';
import { getListData } from '../utils/apiResponses';
import {
    formatBookingRef,
    formatCurrency,
    formatDate,
    formatDateTime,
    formatFullAddress,
    formatTime,
    getBookingTotal,
    getErrorMessage,
    getSelectedDishes,
    normalizeStatus,
    paginate,
} from '../utils/dashboardUtils';
import { paymentTypeLabel, staffPaymentStatus } from '../utils/statusLabels';

const AnnouncementManager = lazy(() => import('../Components/content/AnnouncementManager'));
const PaymentTermEditorModal = lazy(() => import('../Components/finance/PaymentTermEditorModal'));
const PreparationBoard = lazy(() => import('../Components/operations/PreparationBoard'));

const paymentLabel = paymentTypeLabel;

const PACKAGE_CATEGORY_OPTIONS = [
    { value: 'premium', label: 'Weddings & Debuts' },
    { value: 'birthday', label: 'Birthdays' },
    { value: 'standard', label: 'Standard Events' },
];

const SECURITY_OPTIONS = [
    { value: 'contingency', label: '10% Contingency' },
    { value: 'cash_bond', label: 'Php 1,500 Cash Bond' },
];

const FORECAST_PERIOD_OPTIONS = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
];

const SMA_WINDOW_OPTIONS = [2, 3, 4, 5, 6];
const FORECAST_HORIZON_OPTIONS = [3, 4, 6, 8, 12];
const ANALYTICS_YEARS = [2024, 2025, 2026];
const SNAPSHOT_WINDOW_OPTIONS = [
    { value: 'all', label: 'All time' },
    { value: '3m', label: 'Last 3 months' },
    { value: '6m', label: 'Last 6 months' },
    { value: '12m', label: 'Last 12 months' },
    { value: '24m', label: 'Last 24 months' },
    { value: 'ytd', label: 'Year to date' },
];

const MENU_CATEGORY_OPTIONS = [
    { value: 'all', label: 'All dish types' },
    { value: 'starter', label: 'Starters' },
    { value: 'main', label: 'Mains' },
    { value: 'side', label: 'Sides' },
    { value: 'dessert', label: 'Desserts' },
    { value: 'drink', label: 'Drinks' },
];

const PERFORMANCE_LIMIT_OPTIONS = [5, 8, 10, 15, 20];

const DEFAULT_ANALYTICS_FILTERS = {
    trend_months: '6',
    revenue_forecast_period: 'quarterly',
    revenue_forecast_horizon: '4',
    revenue_sma_window: '3',
    pax_projection_period: 'monthly',
    pax_projection_horizon: '6',
    pax_sma_window: '3',
    pax_projection_year: '',
    pax_projection_quarter: '',
    snapshot_window: 'all',
};

const ADMIN_EMPLOYEES_URL = '/api/admin/employees?paginated=1&per_page=100';
const ADMIN_CUSTOMERS_URL = '/api/admin/customers?paginated=1&per_page=100';
const ADMIN_BOOKINGS_URL = '/api/admin/bookings?paginated=1&per_page=100';

const emptyPackageForm = (defaultType = '') => ({
    name: '',
    type: defaultType,
    package_category: 'standard',
    event_type_slugs: defaultType ? [defaultType] : [],
    base_price_per_head: '',
    minimum_pax: 1,
    description: '',
    inclusions: '',
    amenities: '',
    applicable_setups: '',
    menu_structure: { starter: 1, main: 2, side: 1, dessert: 1, drink: 1 },
    security_type: 'cash_bond',
    security_label: 'Php 1,500 Cash Bond',
});

const emptyEventTypeForm = () => ({
    label: '',
    slug: '',
    icon: 'sparkles',
    description: '',
    image: '',
    package_category: 'standard',
    applicable_setups: '',
    security_type: 'cash_bond',
    security_label: 'Php 1,500 Cash Bond',
    security_description: 'Refundable deposit for broken plates or missing equipment.',
});

const linesToText = (value) => Array.isArray(value) ? value.join('\n') : (value || '');
const getCategoryLabel = (value) => PACKAGE_CATEGORY_OPTIONS.find(option => option.value === value)?.label || value || 'Standard Events';
const getSecurityLabel = (value) => SECURITY_OPTIONS.find(option => option.value === value)?.label || value || 'Cash Bond';

const DashboardAdmin = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [profileForm, setProfileForm] = useState({
        username: user?.username || '',
        email: user?.email || '',
        phone: user?.phone || '',
        current_password: '',
        new_password: '',
    });
    const [profileProcessing, setProfileProcessing] = useState(false);
    const [profileErrors, setProfileErrors] = useState({});

    // ==========================================
    // EMPLOYEE MANAGEMENT STATE
    // ==========================================
    const [employees, setEmployees] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [empLoading, setEmpLoading] = useState(false);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [empModal, setEmpModal] = useState({ open: false, mode: 'add', data: null });
    const [empForm, setEmpForm] = useState({ full_name: '', username: '', password: '', role: 'Marketing', email: '', phone: '' });
    const [empFormLoading, setEmpFormLoading] = useState(false);

    // ==========================================
    // PRICING CONTROL STATE
    // ==========================================
    const [pricingOverrides, setPricingOverrides] = useState({});
    const [pricingLoading, setPricingLoading] = useState(false);
    const [activeMenuCategory, setActiveMenuCategory] = useState('starter');
    const [activeConfigTab, setActiveConfigTab] = useState('packages');
    const [packages, setPackages] = useState([]);
    const [eventTypes, setEventTypes] = useState([]);
    const [eventTypeForm, setEventTypeForm] = useState(emptyEventTypeForm());
    const [editingEventTypeId, setEditingEventTypeId] = useState(null);
    const [packageForm, setPackageForm] = useState(emptyPackageForm());
    const [editingPackageId, setEditingPackageId] = useState(null);
    const [packageSaving, setPackageSaving] = useState(false);

    // ==========================================
    // CUSTOM MENU ITEMS STATE
    // ==========================================
    const [customMenuItems, setCustomMenuItems] = useState([]);
    const [menuItemModal, setMenuItemModal] = useState({ open: false, mode: 'add', data: null });
    const [menuItemForm, setMenuItemForm] = useState({
        name: '', category: 'starter', cost_per_head: '', price_adj: '0',
        image: '', description: '', is_best_seller: false
    });
    const [menuItemFormLoading, setMenuItemFormLoading] = useState(false);

    // ==========================================
    // DISCOUNTS STATE
    // ==========================================
    const [bookings, setBookings] = useState([]);
    const [bookingsLoading, setBookingsLoading] = useState(false);
    const [bookingSearch, setBookingSearch] = useState('');
    const [bookingStatusFilter, setBookingStatusFilter] = useState('All');
    const [bookingSort, setBookingSort] = useState('latest');
    const [approvingBookingId, setApprovingBookingId] = useState(null);
    const [discountModal, setDiscountModal] = useState({ open: false, data: null });
    const [discountForm, setDiscountForm] = useState({ discount_type: 'fixed', discount_value: 0 });
    const [discountLoading, setDiscountLoading] = useState(false);
    const [refundQueue, setRefundQueue] = useState([]);
    const [refundLoading, setRefundLoading] = useState(false);
    const [processingRefundId, setProcessingRefundId] = useState(null);

    const [eventDetailsModal, setEventDetailsModal] = useState({ open: false, data: null });
    const [editPaymentModal, setEditPaymentModal] = useState({ isOpen: false, payment: null, booking: null });

    // ==========================================
    // ANALYTICS STATE
    // ==========================================
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsFilters, setAnalyticsFilters] = useState(DEFAULT_ANALYTICS_FILTERS);
    const [activeAnalyticsFilterPanel, setActiveAnalyticsFilterPanel] = useState(null);
    const [packageViewFilters, setPackageViewFilters] = useState({
        limit: '8',
        sort: 'revenue',
        minBookings: '',
    });
    const [menuViewFilters, setMenuViewFilters] = useState({
        category: 'all',
        limit: '10',
        sort: 'selections',
    });
    const [paymentRiskFilters, setPaymentRiskFilters] = useState({
        status: 'all',
        minBalance: '',
    });
    const [workloadFilters, setWorkloadFilters] = useState({
        status: 'all',
        minPax: '',
    });
    const [alertFilters, setAlertFilters] = useState({
        severity: 'all',
    });
    const [activeDashboardFilterPanel, setActiveDashboardFilterPanel] = useState(null);
    const [reportWidgets, setReportWidgets] = useState([]);
    const [reportTemplates, setReportTemplates] = useState([]);
    const [reportTemplateId, setReportTemplateId] = useState('');
    const [reportBuilder, setReportBuilder] = useState({
        name: 'Management Snapshot',
        description: 'Finance, bookings, menu performance, and operational alerts.',
        widgets: ['revenue_summary', 'payment_breakdown', 'booking_pipeline', 'operational_alerts'],
        filters: { date_from: '', date_to: '', booking_status: '', payment_status: '', city: '' },
    });
    const [reportPreview, setReportPreview] = useState([]);
    const [reportView, setReportView] = useState('build');
    const [reportDraggedIndex, setReportDraggedIndex] = useState(null);
    const [reportDraggedWidgetId, setReportDraggedWidgetId] = useState(null);
    const [reportDropIndex, setReportDropIndex] = useState(null);
    const [reportLibraryCollapsed, setReportLibraryCollapsed] = useState(false);
    const [reportLibraryExpanded, setReportLibraryExpanded] = useState(false);
    const [reportSetupOpen, setReportSetupOpen] = useState(false);
    const [reportLibraryDropActive, setReportLibraryDropActive] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportSaving, setReportSaving] = useState(false);
    const reportPreviewTimerRef = useRef(null);
    const [audits, setAudits] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditSearch, setAuditSearch] = useState('');
    const [auditRoleFilter, setAuditRoleFilter] = useState('All');
    const [availabilityMonth, setAvailabilityMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [availabilityOverrides, setAvailabilityOverrides] = useState([]);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [availabilitySaving, setAvailabilitySaving] = useState(false);
    const [availabilityDate, setAvailabilityDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [availabilityForm, setAvailabilityForm] = useState({ is_locked: false, remaining_events: '', remaining_pax: '', note: '' });

    const analyticsSummary = analytics?.summary || {};
    const revenueTrendData = analytics?.revenueTrends || [];
    const revenueHealth = analytics?.revenueHealth || {};
    const paymentStatusBreakdown = revenueHealth.paymentStatusBreakdown || [];
    const paymentAgingData = analytics?.paymentAging || revenueHealth.paymentAging || [];
    const bookingPipelineData = analytics?.bookingPipeline || [];
    const upcomingWorkloadData = analytics?.upcomingWorkload || analytics?.projectedPaxDemand || [];
    const packagePerformanceData = analytics?.packagePerformance || analytics?.topSellers || [];
    const menuPerformanceData = analytics?.menuPerformance || [];
    const operationsLoadData = analytics?.operationsLoad || [];
    const operationalAlerts = analytics?.operationalAlerts || analytics?.alerts || [];
    const topSellerData = analytics?.topSellers || [];
    const peakSeasonData = analytics?.peakSeasons || [];
    const revenueForecast = analytics?.revenueForecast || {};
    const revenueForecastData = revenueForecast.rows || [];
    const revenueForecastSummary = revenueForecast.summary || {};
    const paxDemandProjection = analytics?.paxDemandProjection || {};
    const paxDemandData = paxDemandProjection.rows || [];
    const paxDemandSummary = paxDemandProjection.summary || {};
    const businessSnapshot = analytics?.businessSnapshot || {};
    const businessSnapshotCards = businessSnapshot.cards || [];
    const visiblePackagePerformanceData = useMemo(() => {
        const minBookings = Number(packageViewFilters.minBookings || 0);
        const rows = packagePerformanceData
            .filter(pkg => Number(pkg.count || 0) >= minBookings)
            .sort((a, b) => {
                if (packageViewFilters.sort === 'bookings') return Number(b.count || 0) - Number(a.count || 0);
                if (packageViewFilters.sort === 'name') return String(a.label || a.name || '').localeCompare(String(b.label || b.name || ''));
                return Number(b.revenue || 0) - Number(a.revenue || 0);
            });

        return rows.slice(0, Number(packageViewFilters.limit || 8));
    }, [packagePerformanceData, packageViewFilters]);
    const visibleMenuPerformanceData = useMemo(() => {
        const rows = menuPerformanceData
            .filter(row => menuViewFilters.category === 'all' || row.category === menuViewFilters.category)
            .sort((a, b) => {
                if (menuViewFilters.sort === 'pax') return Number(b.paxServed || 0) - Number(a.paxServed || 0);
                if (menuViewFilters.sort === 'name') return String(a.label || '').localeCompare(String(b.label || ''));
                return Number(b.selections || 0) - Number(a.selections || 0);
            });

        return rows.slice(0, Number(menuViewFilters.limit || 10));
    }, [menuPerformanceData, menuViewFilters]);
    const visiblePaymentStatusBreakdown = useMemo(() => (
        paymentStatusBreakdown.filter(row => paymentRiskFilters.status === 'all' || String(row.label || '').toLowerCase() === paymentRiskFilters.status)
    ), [paymentStatusBreakdown, paymentRiskFilters.status]);
    const visiblePaymentAgingData = useMemo(() => {
        const minBalance = Number(paymentRiskFilters.minBalance || 0);
        return paymentAgingData.filter(bucket => Number(bucket.value || 0) >= minBalance);
    }, [paymentAgingData, paymentRiskFilters.minBalance]);
    const visibleUpcomingWorkloadData = useMemo(() => {
        const minPax = Number(workloadFilters.minPax || 0);
        return upcomingWorkloadData.filter(event => {
            const status = String(event.status || '').toLowerCase();
            const statusMatches = workloadFilters.status === 'all' || status === workloadFilters.status;
            return statusMatches && Number(event.pax || 0) >= minPax;
        });
    }, [upcomingWorkloadData, workloadFilters]);
    const visibleOperationalAlerts = useMemo(() => (
        operationalAlerts.filter(alert => alertFilters.severity === 'all' || alert.severity === alertFilters.severity)
    ), [operationalAlerts, alertFilters.severity]);
    const maxPackageRevenue = Math.max(...visiblePackagePerformanceData.map(pkg => Number(pkg.revenue || 0)), 1);
    const visibleReportWidgetIds = reportBuilder.widgets;
    const reportCanvasOffset = 0;
    const visibleReportLibraryWidgets = reportLibraryExpanded ? reportWidgets : reportWidgets.slice(0, 6);
    const reportBookingStatusOptions = useMemo(() => {
        const statuses = bookings.map(booking => booking.status).filter(Boolean);
        return Array.from(new Set(['Pending', 'Confirmed', 'Reserved', 'Completed', 'Cancelled', ...statuses]));
    }, [bookings]);
    const reportPaymentStatusOptions = useMemo(() => {
        const statuses = bookings.flatMap(booking => (booking.payments || []).map(payment => payment.status)).filter(Boolean);
        return Array.from(new Set(['Pending', 'Paid', 'Verified', 'Refunded', 'Overdue', ...statuses]));
    }, [bookings]);
    const reportCityOptions = useMemo(() => (
        Array.from(new Set(bookings.map(booking => booking.venue_city || booking.city).filter(Boolean))).sort()
    ), [bookings]);

    // Toast notification
    const [toast, setToast] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', confirmText: 'Confirm', tone: 'default', busy: false, onConfirm: null });
    const { bustCache: bustAdminCache, fetchCachedJson } = useCachedJson(['/api/admin/audits?per_page=100']);
    const [packagePage, setPackagePage] = useState(1);
    const [eventTypePage, setEventTypePage] = useState(1);
    const [menuItemPage, setMenuItemPage] = useState(1);
    const [employeePage, setEmployeePage] = useState(1);
    const [customerPage, setCustomerPage] = useState(1);
    const [bookingPage, setBookingPage] = useState(1);
    const [auditPage, setAuditPage] = useState(1);
    const rowsPerPage = 8;

    useEffect(() => {
        setProfileForm(prev => ({
            ...prev,
            username: user?.username || '',
            email: user?.email || '',
            phone: user?.phone || '',
        }));
    }, [user?.username, user?.email, user?.phone]);

    const handleLogout = () => {
        router.post('/logout');
    };

    const updateProfileField = (field, value) => {
        setProfileForm(prev => ({ ...prev, [field]: value }));
        setProfileErrors(prev => ({ ...prev, [field]: undefined }));
    };

    const submitProfile = (event) => {
        event.preventDefault();
        setProfileProcessing(true);
        router.put('/profile', profileForm, {
            preserveScroll: true,
            onSuccess: () => {
                setProfileForm(prev => ({ ...prev, current_password: '', new_password: '' }));
                setProfileErrors({});
                showToast('Profile updated.');
            },
            onError: (errors) => {
                setProfileErrors(errors || {});
                showToast('Please review the profile fields.', 'error');
            },
            onFinish: () => setProfileProcessing(false),
        });
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const closeConfirmDialog = () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', confirmText: 'Confirm', tone: 'default', busy: false, onConfirm: null });
    };

    const formatAnalyticsCardValue = (value, format) => {
        if (format === 'currency') return formatCurrency(value || 0);
        if (format === 'percent') return `${Number(value || 0).toLocaleString()}%`;
        return Number(value || 0).toLocaleString();
    };

    const refreshCurrentTab = ({ silent = false } = {}) => {
        if (activeTab === 'users') {
            bustAdminCache(ADMIN_EMPLOYEES_URL, ADMIN_CUSTOMERS_URL);
            fetchEmployees({ silent });
            fetchCustomers({ silent });
        } else if (activeTab === 'configuration') {
            bustAdminCache('/api/pricing', '/api/menu-items', '/api/packages?per_page=100', '/api/event-types?per_page=100');
            fetchPricingOverrides({ silent });
            fetchCustomMenuItems();
            fetchPackages();
        } else if (activeTab === 'dashboard' || activeTab === 'analytics') {
            bustAdminCache('/api/admin/analytics');
            fetchAnalytics({ silent });
        } else if (activeTab === 'reports') {
            fetchReportBuilder({ silent });
            fetchReportPreview({ silent });
        } else if (activeTab === 'bookings') {
            bustAdminCache(ADMIN_BOOKINGS_URL);
            fetchBookings({ silent });
        } else if (activeTab === 'refunds') {
            bustAdminCache('/api/admin/refunds/queue');
            fetchRefundQueue({ silent });
        } else if (activeTab === 'availability') {
            fetchAvailabilityOverrides({ silent });
        } else if (activeTab === 'audits') {
            bustAdminCache('/api/admin/audits?per_page=100');
            fetchAudits({ silent });
        }
    };

    const bookingStatusStyles = {
        pending: 'bg-amber-100 text-amber-800 border-amber-200',
        confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
    const pageMeta = {
        dashboard: {
            eyebrow: 'Daily work',
            title: 'Overview',
            description: 'Priority bookings, payments, refunds, and activity that need attention.',
        },
        analytics: {
            eyebrow: 'Business insight',
            title: 'Analytics',
            description: 'Understand revenue, bookings, menu demand, and operational workload.',
        },
        configuration: {
            eyebrow: 'Management',
            title: 'Business Setup',
            description: 'Maintain packages, event types, pricing, and operating rules.',
        },
        reports: {
            eyebrow: 'Admin reporting',
            title: 'Report Builder',
            description: 'Choose the exact information to preview, save, or export.',
        },
        profile: {
            eyebrow: 'Admin profile',
            title: 'My Account',
            description: 'Update your admin contact details and password.',
        },
        content: {
            eyebrow: 'Customer communications',
            title: 'Announcements',
            description: 'Publish customer announcements, advisories, promos, and email-ready updates.',
        },
        availability: {
            eyebrow: 'Calendar control',
            title: 'Availability',
            description: 'Lock dates and control remaining event slots or guest capacity.',
        },
        users: {
            eyebrow: 'Access & clients',
            title: 'People Directory',
            description: 'Staff credentials, client accounts, and booking activity.',
        },
        bookings: {
            eyebrow: 'Daily work',
            title: 'Bookings',
            description: 'Approve requests, review payment exposure, and manage adjustments.',
        },
        refunds: {
            eyebrow: 'Finance control',
            title: 'Refund Queue',
            description: 'Process cancelled booking refunds while retaining reservation fees.',
        },
        preparation: {
            eyebrow: 'Operations handoff',
            title: 'Preparation Board',
            description: 'Track readiness and event preparation tasks for upcoming approved bookings.',
        },
        audits: {
            eyebrow: 'Control history',
            title: 'Audits',
            description: 'Monitor staff and admin activity across Eloquente operations.',
        },
    };
    const adminNavGroups = [
        {
            label: 'Daily Work',
            items: [
                { id: 'dashboard', label: 'Overview' },
                { id: 'bookings', label: 'Bookings' },
                { id: 'preparation', label: 'Preparation' },
                { id: 'refunds', label: 'Refunds' },
            ],
        },
        {
            label: 'Business Insight',
            items: [
                { id: 'analytics', label: 'Analytics' },
                { id: 'reports', label: 'Reports' },
            ],
        },
        {
            label: 'Management',
            items: [
                { id: 'content', label: 'Announcements' },
                { id: 'availability', label: 'Availability' },
                { id: 'users', label: 'Users' },
                { id: 'configuration', label: 'Business Setup' },
                { id: 'audits', label: 'Audits' },
                { id: 'profile', label: 'Profile' },
            ],
        },
    ];
    const currentPage = pageMeta[activeTab] || pageMeta.dashboard;
    const bookingStats = useMemo(() => {
        const activeBookings = bookings.filter((booking) => normalizeStatus(booking.status) === 'confirmed');
        const pendingBookings = bookings.filter((booking) => normalizeStatus(booking.status) === 'pending');

        return {
            total: bookings.length,
            pending: pendingBookings.length,
            active: activeBookings.length,
            value: bookings.reduce((sum, booking) => sum + getBookingTotal(booking), 0),
        };
    }, [bookings]);

    const refundStats = useMemo(() => {
        return refundQueue.reduce((stats, item) => {
            const totalPaid = Number(item.total_paid || 0);
            const fee = totalPaid * 0.1;
            stats.count += 1;
            stats.paid += totalPaid;
            stats.fees += fee;
            stats.refundable += Math.max(totalPaid - fee, 0);
            return stats;
        }, { count: 0, paid: 0, fees: 0, refundable: 0 });
    }, [refundQueue]);

    const visibleBookings = useMemo(() => {
        const query = bookingSearch.trim().toLowerCase();

        return bookings
            .filter((booking) => {
                const status = normalizeStatus(booking.status);
                if (bookingStatusFilter === 'Pending' && status !== 'pending') return false;
                if (bookingStatusFilter === 'Active' && status !== 'confirmed') return false;

                if (!query) return true;

                const searchable = [
                    formatBookingRef(booking.id),
                    booking.client_full_name,
                    booking.client_name,
                    booking.client_email,
                    booking.client_phone,
                    booking.event_type,
                    booking.username,
                    booking.user_email,
                    booking.user_phone,
                ].filter(Boolean).join(' ').toLowerCase();

                return searchable.includes(query);
            })
            .sort((a, b) => {
                if (bookingSort === 'az' || bookingSort === 'za') {
                    const left = String(a.client_full_name || a.client_name || a.username || '').toLowerCase();
                    const right = String(b.client_full_name || b.client_name || b.username || '').toLowerCase();
                    return bookingSort === 'az' ? left.localeCompare(right) : right.localeCompare(left);
                }

                const leftDate = new Date(a.created_at || a.event_date || 0).getTime();
                const rightDate = new Date(b.created_at || b.event_date || 0).getTime();
                return bookingSort === 'oldest' ? leftDate - rightDate : rightDate - leftDate;
            });
    }, [bookings, bookingSearch, bookingStatusFilter, bookingSort]);

    const visibleAudits = useMemo(() => {
        const query = auditSearch.trim().toLowerCase();

        return audits.filter((audit) => {
            if (auditRoleFilter !== 'All' && audit.role !== auditRoleFilter) return false;
            if (!query) return true;

            return [
                audit.username,
                audit.role,
                audit.action,
                audit.path,
                audit.method,
            ].filter(Boolean).join(' ').toLowerCase().includes(query);
        });
    }, [audits, auditSearch, auditRoleFilter]);

    const paginatedPackages = paginate(packages, packagePage, rowsPerPage);
    const paginatedEventTypes = paginate(eventTypes, eventTypePage, rowsPerPage);
    const paginatedMenuItems = paginate(getMergedDishes(activeMenuCategory), menuItemPage, rowsPerPage);
    const paginatedEmployees = paginate(employees, employeePage, rowsPerPage);
    const paginatedCustomers = paginate(customers, customerPage, rowsPerPage);
    const paginatedBookings = paginate(visibleBookings, bookingPage, rowsPerPage);
    const paginatedAudits = paginate(visibleAudits, auditPage, 12);

    const PaginationControls = ({ pageInfo, onPageChange }) => (
        <div className="admin-pagination">
            <span>
                Showing <strong>{pageInfo.start}</strong>-<strong>{pageInfo.end}</strong> of <strong>{pageInfo.total}</strong>
            </span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={pageInfo.page <= 1}
                    onClick={() => onPageChange(pageInfo.page - 1)}
                    className="admin-page-btn"
                >
                    Prev
                </button>
                <span className="text-xs font-black text-slate-500">Page {pageInfo.page} / {pageInfo.totalPages}</span>
                <button
                    type="button"
                    disabled={pageInfo.page >= pageInfo.totalPages}
                    onClick={() => onPageChange(pageInfo.page + 1)}
                    className="admin-page-btn"
                >
                    Next
                </button>
            </div>
        </div>
    );

    useEffect(() => {
        if (activeTab === 'users') {
            fetchEmployees();
            fetchCustomers();
        } else if (activeTab === 'configuration') {
            fetchPricingOverrides();
            fetchCustomMenuItems();
            fetchPackages();
        } else if (activeTab === 'dashboard' || activeTab === 'analytics') {
            if (activeTab === 'analytics' && (!packages.length || !eventTypes.length)) {
                fetchPackages();
            }
            fetchAnalytics();
        } else if (activeTab === 'reports') {
            fetchReportBuilder();
            fetchReportPreview();
        } else if (activeTab === 'bookings') {
            fetchBookings();
        } else if (activeTab === 'refunds') {
            fetchRefundQueue();
        } else if (activeTab === 'availability') {
            fetchAvailabilityOverrides();
        } else if (activeTab === 'audits') {
            fetchAudits();
        }
    }, [activeTab, availabilityMonth]);

    useSmartRefresh({
        enabled: ['dashboard', 'analytics', 'reports', 'bookings', 'preparation', 'refunds', 'users', 'configuration', 'availability', 'audits'].includes(activeTab),
        interval: activeTab === 'dashboard' || activeTab === 'analytics' ? 120000 : 90000,
        idleAfter: 180000,
        refresh: refreshCurrentTab,
    });

    useEffect(() => () => {
        if (reportPreviewTimerRef.current) {
            clearTimeout(reportPreviewTimerRef.current);
        }
    }, []);

    useEffect(() => {
        setMenuItemPage(1);
    }, [activeMenuCategory]);

    useEffect(() => {
        setBookingPage(1);
    }, [bookingSearch, bookingStatusFilter, bookingSort]);

    useEffect(() => {
        setAuditPage(1);
    }, [auditSearch, auditRoleFilter]);

    const fetchAvailabilityOverrides = async ({ silent = false } = {}) => {
        if (!silent) setAvailabilityLoading(true);
        try {
            const response = await fetch(`/api/calendar-availability?month=${availabilityMonth}`, {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) throw new Error('Availability load failed');
            const data = await response.json();
            setAvailabilityOverrides(getListData(data));
        } catch (error) {
            console.error(error);
            showToast('Could not load availability controls', 'error');
        } finally {
            if (!silent) setAvailabilityLoading(false);
        }
    };

    const selectAvailabilityDate = async (date) => {
        setAvailabilityDate(date);
        const existing = availabilityOverrides.find(item => item.date === date);
        if (existing) {
            setAvailabilityForm({
                is_locked: Boolean(existing.is_locked),
                remaining_events: existing.remainingEvents ?? '',
                remaining_pax: existing.remainingPax ?? '',
                note: existing.note || '',
            });
            return;
        }

        setAvailabilityForm({ is_locked: false, remaining_events: '', remaining_pax: '', note: '' });
        try {
            const response = await fetch(`/api/bookings/availability/${date}`, { headers: { Accept: 'application/json' } });
            if (!response.ok) return;
            const data = await response.json();
            setAvailabilityForm({
                is_locked: Boolean(data.isLocked),
                remaining_events: data.remainingEvents ?? '',
                remaining_pax: data.remainingPax ?? '',
                note: '',
            });
        } catch (error) {
            console.error(error);
        }
    };

    const saveAvailabilityOverride = async (event) => {
        event.preventDefault();
        setAvailabilitySaving(true);
        try {
            const payload = {
                is_locked: availabilityForm.is_locked,
                remaining_events: availabilityForm.remaining_events === '' ? null : Number(availabilityForm.remaining_events),
                remaining_pax: availabilityForm.remaining_pax === '' ? null : Number(availabilityForm.remaining_pax),
                note: availabilityForm.note,
            };
            const response = await fetch(`/api/calendar-availability/${availabilityDate}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error('Save failed');
            showToast('Availability updated.');
            fetchAvailabilityOverrides({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('Could not save availability override', 'error');
        } finally {
            setAvailabilitySaving(false);
        }
    };

    const clearAvailabilityOverride = async () => {
        setAvailabilitySaving(true);
        try {
            const response = await fetch(`/api/calendar-availability/${availabilityDate}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('Clear failed');
            setAvailabilityForm({ is_locked: false, remaining_events: '', remaining_pax: '', note: '' });
            showToast('Availability override cleared.');
            fetchAvailabilityOverrides({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('Could not clear availability override', 'error');
        } finally {
            setAvailabilitySaving(false);
        }
    };

    const fetchEmployees = async ({ silent = false } = {}) => {
        if (!silent) setEmpLoading(true);
        try {
            const data = await fetchCachedJson(ADMIN_EMPLOYEES_URL, 60000);
            setEmployees(getListData(data));
        } catch (error) {
            console.error(error);
            showToast("Could not load employees", 'error');
        } finally {
            if (!silent) setEmpLoading(false);
        }
    };

    const fetchCustomers = async ({ silent = false } = {}) => {
        if (!silent) setCustomerLoading(true);
        try {
            const data = await fetchCachedJson(ADMIN_CUSTOMERS_URL, 60000);
            setCustomers(getListData(data));
        } catch (error) {
            console.error(error);
            showToast("Could not load customers", 'error');
        } finally {
            if (!silent) setCustomerLoading(false);
        }
    };

    const fetchPricingOverrides = async ({ silent = false } = {}) => {
        if (!silent) setPricingLoading(true);
        try {
            const data = await fetchCachedJson('/api/pricing', 60000);
            setPricingOverrides(data.overrides || {});
        } catch (error) {
            console.error(error);
            showToast("Could not load pricing", 'error');
        } finally {
            if (!silent) setPricingLoading(false);
        }
    };

    const handlePricingUpdate = async (item_type, item_id, new_price) => {
        if (!new_price || isNaN(new_price) || new_price < 0) {
            return showToast("Invalid price amount", 'error');
        }
        try {
            // Session auth - no token needed
            const res = await fetch('/api/admin/pricing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: `${item_type}_${item_id}`,
                    item_type,
                    item_id,
                    new_price: parseFloat(new_price)
                })
            });

            if (res.ok) {
                showToast("Price updated successfully");
                bustAdminCache('/api/pricing');
                fetchPricingOverrides();
            } else {
                showToast("Could not update price", 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Could not update price. Please try again.", 'error');
        }
    };

    const fetchPackages = async () => {
        try {
            const [packageData, eventData] = await Promise.all([
                fetchCachedJson('/api/packages?per_page=100', 60000),
                fetchCachedJson('/api/event-types?per_page=100', 60000),
            ]);
            setPackages(packageData.data || packageData);
            const types = eventData.data || eventData;
            setEventTypes(types);
            setPackageForm(prev => {
                const defaultType = prev.type || types[0]?.slug || '';
                return {
                    ...prev,
                    type: defaultType,
                    event_type_slugs: prev.event_type_slugs?.length ? prev.event_type_slugs : (defaultType ? [defaultType] : []),
                };
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handlePackageSubmit = async (e) => {
        e.preventDefault();
        setPackageSaving(true);
        try {
            const res = await fetch(editingPackageId ? `/api/admin/packages/${editingPackageId}` : '/api/admin/packages', {
                method: editingPackageId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(packageForm),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast(editingPackageId ? 'Package preset updated' : 'Package preset created');
                setEditingPackageId(null);
                setPackageForm(emptyPackageForm(eventTypes[0]?.slug || ''));
                bustAdminCache('/api/packages?per_page=100');
                fetchPackages();
            } else {
                showToast(getErrorMessage(data, 'Could not create package'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not create package. Please try again.', 'error');
        } finally {
            setPackageSaving(false);
        }
    };

    const startEditingPackage = (pkg) => {
        const defaultType = pkg.type || eventTypes[0]?.slug || '';
        setEditingPackageId(pkg.id);
        setPackageForm({
            name: pkg.name || '',
            type: defaultType,
            package_category: pkg.package_category || 'standard',
            event_type_slugs: pkg.event_type_slugs?.length ? pkg.event_type_slugs : (defaultType ? [defaultType] : []),
            base_price_per_head: pkg.base_price_per_head ?? '',
            minimum_pax: pkg.minimum_pax ?? 1,
            description: pkg.description || '',
            inclusions: linesToText(pkg.inclusions),
            amenities: linesToText(pkg.amenities),
            applicable_setups: linesToText(pkg.applicable_setups),
            menu_structure: {
                starter: Number(pkg.menu_structure?.starter ?? pkg.menu_structure?.starters ?? 0),
                main: Number(pkg.menu_structure?.main ?? pkg.menu_structure?.mains ?? 0),
                side: Number(pkg.menu_structure?.side ?? pkg.menu_structure?.sides ?? 0),
                dessert: Number(pkg.menu_structure?.dessert ?? pkg.menu_structure?.desserts ?? 0),
                drink: Number(pkg.menu_structure?.drink ?? pkg.menu_structure?.refreshments ?? 0),
            },
            security_type: pkg.security_type || 'cash_bond',
            security_label: pkg.security_label || (pkg.security_type === 'contingency' ? '10% Contingency' : 'Php 1,500 Cash Bond'),
        });
    };

    const resetPackageForm = () => {
        setEditingPackageId(null);
        setPackageForm(emptyPackageForm(eventTypes[0]?.slug || ''));
    };

    const resetEventTypeForm = () => {
        setEditingEventTypeId(null);
        setEventTypeForm(emptyEventTypeForm());
    };

    const handleEventTypeSubmit = async (e) => {
        e.preventDefault();
        setPackageSaving(true);
        try {
            const url = editingEventTypeId ? `/api/admin/event-types/${editingEventTypeId}` : '/api/admin/event-types';
            const res = await fetch(url, {
                method: editingEventTypeId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventTypeForm),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast(editingEventTypeId ? 'Event type updated' : 'Event type created');
                resetEventTypeForm();
                bustAdminCache('/api/event-types?per_page=100', '/api/packages?per_page=100');
                fetchPackages();
            } else {
                showToast(getErrorMessage(data, 'Could not save event type'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not save event type. Please try again.', 'error');
        } finally {
            setPackageSaving(false);
        }
    };

    const startEditingEventType = (eventType) => {
        setEditingEventTypeId(eventType.id);
        setEventTypeForm({
            label: eventType.label || '',
            slug: eventType.slug || '',
            icon: eventType.icon || 'sparkles',
            description: eventType.description || '',
            image: eventType.image || '',
            package_category: eventType.package_category || 'standard',
            applicable_setups: linesToText(eventType.applicable_setups),
            security_type: eventType.security_type || 'cash_bond',
            security_label: eventType.security_label || (eventType.security_type === 'contingency' ? '10% Contingency' : 'Php 1,500 Cash Bond'),
            security_description: eventType.security_description || '',
        });
    };

    const handleDeleteEventType = async (eventType) => {
        setConfirmDialog({
            isOpen: true,
            title: `Delete ${eventType.label}?`,
            message: 'Packages using this event type will move to Other.',
            confirmText: 'Delete',
            tone: 'danger',
            onConfirm: () => confirmDeleteEventType(eventType),
        });
    };

    const confirmDeleteEventType = async (eventType) => {
        closeConfirmDialog();
        setPackageSaving(true);
        try {
            const res = await fetch(`/api/admin/event-types/${eventType.id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Event type deleted');
                bustAdminCache('/api/event-types?per_page=100', '/api/packages?per_page=100');
                fetchPackages();
            } else {
                const data = await res.json().catch(() => ({}));
                showToast(getErrorMessage(data, 'Could not delete event type'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not delete event type. Please try again.', 'error');
        } finally {
            setPackageSaving(false);
        }
    };

    // ==========================================
    // CUSTOM MENU ITEMS HANDLERS
    // ==========================================

    const fetchCustomMenuItems = async () => {
        try {
            const data = await fetchCachedJson('/api/menu-items', 60000);
            setCustomMenuItems(data);
        } catch (error) {
            console.error(error);
        }
    };

    const openMenuItemModal = () => {
        setMenuItemForm({
            name: '', category: activeMenuCategory, cost_per_head: '', price_adj: '0',
            image: '', description: '', is_best_seller: false
        });
        setMenuItemModal({ open: true, mode: 'add', data: null });
    };

    const openEditMenuItemModal = (item) => {
        setMenuItemForm({
            name: item.name || '',
            category: item.category || activeMenuCategory,
            cost_per_head: item.costPerHead ?? '',
            price_adj: item.priceAdj ?? '0',
            image: item.image || '',
            description: item.description || '',
            is_best_seller: Boolean(item.isBestSeller),
        });
        setMenuItemModal({ open: true, mode: 'edit', data: item });
    };

    const handleMenuItemSubmit = async (e) => {
        e.preventDefault();
        setMenuItemFormLoading(true);
        const isEditing = menuItemModal.mode === 'edit';
        const menuItemId = menuItemModal.data?._dbId;

        if (isEditing && !menuItemId) {
            setMenuItemFormLoading(false);
            return showToast('Unable to find menu item to edit', 'error');
        }

        try {
            const res = await fetch(isEditing ? `/api/admin/menu-items/${menuItemId}` : '/api/admin/menu-items', {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...menuItemForm,
                    cost_per_head: parseFloat(menuItemForm.cost_per_head) || 0,
                    price_adj: parseFloat(menuItemForm.price_adj) || 0,
                    image: menuItemForm.image || null,
                })
            });

            if (res.ok) {
                showToast(isEditing ? 'Menu item updated successfully' : 'Menu item added successfully');
                setMenuItemModal({ open: false, mode: 'add', data: null });
                bustAdminCache('/api/menu-items', '/api/admin/analytics');
                fetchCustomMenuItems();
            } else {
                const err = await res.json();
                showToast(err.message || (isEditing ? 'Could not update menu item' : 'Could not add menu item'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not save menu item. Please try again.', 'error');
        } finally {
            setMenuItemFormLoading(false);
        }
    };

    const handleDeleteMenuItem = async (id) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete menu item?',
            message: 'This dish will no longer be available in the menu catalog.',
            confirmText: 'Delete',
            tone: 'danger',
            onConfirm: () => confirmDeleteMenuItem(id),
        });
    };

    const confirmDeleteMenuItem = async (id) => {
        closeConfirmDialog();
        try {
            const res = await fetch(`/api/admin/menu-items/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Menu item deleted');
                bustAdminCache('/api/menu-items', '/api/admin/analytics');
                fetchCustomMenuItems();
            } else {
                showToast('Could not delete menu item', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not delete menu item. Please try again.', 'error');
        }
    };

    // Menu items are loaded from the app data source.
    const MENU_CATEGORIES = ['starter', 'main', 'side', 'dessert', 'drink'];

    function getMergedDishes(category) {
        return customMenuItems
            .filter(item => item.category === category)
            .map(item => ({
                id: item.dish_id,
                _dbId: item.id,
                name: item.name,
                category: item.category,
                costPerHead: parseFloat(item.cost_per_head),
                priceAdj: parseFloat(item.price_adj),
                image: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
                isBestSeller: item.is_best_seller,
                description: item.description || '',
                _isCustom: true,
            }));
    }

    const fetchAnalytics = async ({ silent = false, filters = analyticsFilters } = {}) => {
        if (!silent) setAnalyticsLoading(true);
        try {
            const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''));
            const query = params.toString() ? `?${params.toString()}` : '';
            const fetchPart = async (path) => {
                const res = await fetch(`${path}${query}`);
                if (!res.ok) throw new Error(`Analytics request failed: ${path}`);
                return res.json();
            };
            const [summary, revenueHealth, pipeline, menu, customerExperience, operations, forecasts] = await Promise.all([
                fetchPart('/api/admin/analytics/summary'),
                fetchPart('/api/admin/analytics/revenue'),
                fetchPart('/api/admin/analytics/pipeline'),
                fetchPart('/api/admin/analytics/menu-performance'),
                fetchPart('/api/admin/analytics/customer-experience'),
                fetchPart('/api/admin/analytics/operations'),
                fetchPart('/api/admin/analytics/forecasts'),
            ]);

            setAnalytics({
                summary: summary.summary || {},
                businessSnapshot: summary.businessSnapshot || {},
                revenueTrends: revenueHealth.settledRevenueOverTime || [],
                revenueHealth,
                paymentAging: revenueHealth.paymentAging || [],
                bookingPipeline: pipeline.bookingPipeline || [],
                upcomingWorkload: pipeline.upcomingWorkload || [],
                packagePerformance: menu.packagePerformance || [],
                menuPerformance: menu.menuPerformance || [],
                customerExperience,
                operationsLoad: operations.operationsLoad || [],
                alerts: operations.alerts || [],
                operationalAlerts: operations.alerts || [],
                revenueForecast: forecasts.revenueForecast || {},
                paxDemandProjection: forecasts.paxDemandProjection || {},
                projectedPaxDemand: forecasts.projectedPaxDemand || [],
                topSellers: menu.packagePerformance || [],
                peakSeasons: operations.operationsLoad || [],
            });
        } catch (error) {
            console.error(error);
        } finally {
            if (!silent) setAnalyticsLoading(false);
        }
    };

    const fetchReportBuilder = async ({ silent = false } = {}) => {
        if (!silent) setReportLoading(true);
        try {
            const [widgetsRes, templatesRes] = await Promise.all([
                fetch('/api/admin/report-widgets'),
                fetch('/api/admin/report-templates'),
            ]);
            const [widgets, templates] = await Promise.all([widgetsRes.json(), templatesRes.json()]);
            setReportWidgets(Array.isArray(widgets) ? widgets : []);
            setReportTemplates(Array.isArray(templates) ? templates : []);
        } catch (error) {
            console.error(error);
            showToast('Could not load report builder', 'error');
        } finally {
            if (!silent) setReportLoading(false);
        }
    };

    const fetchReportPreview = async ({ silent = false, builder = reportBuilder } = {}) => {
        if (!silent) setReportLoading(true);
        try {
            const res = await fetch('/api/admin/report-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    widgets: builder.widgets,
                    filters: Object.fromEntries(Object.entries(builder.filters || {}).filter(([, value]) => value !== '')),
                }),
            });
            const data = await res.json();
            setReportPreview(data.widgets || []);
        } catch (error) {
            console.error(error);
            showToast('Could not preview report', 'error');
        } finally {
            if (!silent) setReportLoading(false);
        }
    };

    const scheduleReportPreview = ({ builder = reportBuilder, delay = 350 } = {}) => {
        if (reportPreviewTimerRef.current) {
            clearTimeout(reportPreviewTimerRef.current);
        }

        reportPreviewTimerRef.current = setTimeout(() => {
            fetchReportPreview({ silent: true, builder });
        }, delay);
    };

    const previewReport = async () => {
        setReportView('preview');
        await fetchReportPreview();
    };

    const saveReportTemplate = async () => {
        setReportSaving(true);
        try {
            const payload = {
                name: reportBuilder.name,
                description: reportBuilder.description,
                layout_json: reportBuilder.widgets.map((id, index) => ({ id, order: index + 1 })),
                filters_json: reportBuilder.filters,
            };
            const url = reportTemplateId ? `/api/admin/report-templates/${reportTemplateId}` : '/api/admin/report-templates';
            const res = await fetch(url, {
                method: reportTemplateId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Save failed');
            const template = await res.json();
            setReportTemplateId(String(template.id));
            await fetchReportBuilder({ silent: true });
            showToast('Saved report updated');
            return template;
        } catch (error) {
            console.error(error);
            showToast('Could not save report', 'error');
            return null;
        } finally {
            setReportSaving(false);
        }
    };

    const createNewSavedReport = () => {
        setReportTemplateId('');
        setReportBuilder({
            name: 'Management Snapshot',
            description: 'Finance, bookings, menu performance, and operational alerts.',
            widgets: ['revenue_summary', 'payment_breakdown', 'booking_pipeline', 'operational_alerts'],
            filters: { date_from: '', date_to: '', booking_status: '', payment_status: '', city: '' },
        });
        setReportView('build');
        setReportSetupOpen(true);
    };

    const duplicateSavedReport = () => {
        setReportTemplateId('');
        setReportBuilder(prev => ({
            ...prev,
            name: `${prev.name || 'Report'} Copy`,
        }));
        setReportSetupOpen(true);
        showToast('Editing a new copy. Save it when ready.');
    };

    const deleteSavedReport = async () => {
        if (!reportTemplateId) return;
        setConfirmDialog({
            isOpen: true,
            title: 'Delete saved report?',
            message: 'This removes the saved report template from the builder.',
            confirmText: 'Delete',
            tone: 'danger',
            onConfirm: confirmDeleteSavedReport,
        });
    };

    const confirmDeleteSavedReport = async () => {
        closeConfirmDialog();
        try {
            const res = await fetch(`/api/admin/report-templates/${reportTemplateId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            setReportTemplateId('');
            await fetchReportBuilder({ silent: true });
            showToast('Saved report deleted');
        } catch (error) {
            console.error(error);
            showToast('Could not delete saved report', 'error');
        }
    };

    const runReportExport = async (format = 'csv') => {
        const template = await saveReportTemplate();
        if (!template?.id) return;
        try {
            const res = await fetch(`/api/admin/report-templates/${template.id}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filters: reportBuilder.filters }),
            });
            if (!res.ok) throw new Error('Run failed');
            const run = await res.json();
            window.location.href = `/api/admin/report-runs/${run.id}/export?format=${format}`;
        } catch (error) {
            console.error(error);
            showToast('Could not download report', 'error');
        }
    };

    const loadReportTemplate = (id) => {
        setReportTemplateId(id);
        const template = reportTemplates.find(item => String(item.id) === String(id));
        if (!template) return;

        const widgets = (template.layout_json || [])
            .map(item => typeof item === 'string' ? item : item.id)
            .filter(Boolean);
        const nextBuilder = {
            name: template.name || 'Management Snapshot',
            description: template.description || '',
            widgets: widgets.length ? widgets : reportBuilder.widgets,
            filters: template.filters_json || reportBuilder.filters,
        };
        setReportBuilder(nextBuilder);
        setReportView('build');
        scheduleReportPreview({ builder: nextBuilder });
    };

    const reorderReportWidgets = (fromIndex, toIndex) => {
        const next = [...reportBuilder.widgets];
        if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= next.length || toIndex >= next.length || fromIndex === toIndex) return;
        const [moved] = next.splice(fromIndex, 1);
        next.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, moved);
        const nextBuilder = { ...reportBuilder, widgets: next };
        setReportBuilder(nextBuilder);
        scheduleReportPreview({ builder: nextBuilder });
    };

    const addReportWidgetAt = (widgetId, index = reportBuilder.widgets.length) => {
        if (!widgetId || reportBuilder.widgets.includes(widgetId)) return;
        const next = [...reportBuilder.widgets];
        next.splice(Math.max(0, Math.min(index, next.length)), 0, widgetId);
        const nextBuilder = { ...reportBuilder, widgets: next };
        setReportBuilder(nextBuilder);
        setReportView('build');
        scheduleReportPreview({ builder: nextBuilder });
    };

    const handleReportDrop = (index) => {
        if (reportDraggedWidgetId) {
            addReportWidgetAt(reportDraggedWidgetId, index);
        } else if (Number.isInteger(reportDraggedIndex)) {
            reorderReportWidgets(reportDraggedIndex, index);
        }
        setReportDraggedWidgetId(null);
        setReportDraggedIndex(null);
        setReportDropIndex(null);
    };

    const removeDraggedReportWidget = () => {
        if (!Number.isInteger(reportDraggedIndex)) return;
        const nextBuilder = {
            ...reportBuilder,
            widgets: reportBuilder.widgets.filter((_, itemIndex) => itemIndex !== reportDraggedIndex),
        };
        setReportBuilder(nextBuilder);
        scheduleReportPreview({ builder: nextBuilder });
        setReportDraggedIndex(null);
        setReportDraggedWidgetId(null);
        setReportDropIndex(null);
        setReportLibraryDropActive(false);
    };

    const moveReportWidget = (index, direction) => {
        reorderReportWidgets(index, index + direction);
    };

    const formatReportPreviewValue = (key, value) => {
        if (value === null || value === undefined || value === '') return 'None';
        if (typeof value === 'number') {
            const lowerKey = String(key).toLowerCase();
            if (lowerKey.includes('revenue') || lowerKey.includes('amount') || lowerKey.includes('total') || lowerKey.includes('value') || lowerKey.includes('balance')) {
                return formatCurrency(value);
            }
            if (lowerKey.includes('rate') || lowerKey.includes('percent')) {
                return `${Number(value || 0).toLocaleString()}%`;
            }
            return Number(value).toLocaleString();
        }
        return String(value);
    };

    const humanizeReportKey = (key) => String(key || '')
        .replace(/[_-]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, char => char.toUpperCase());

    const getReportSummaryMetrics = (data = {}) => Object.entries(data)
        .filter(([key, value]) => key !== 'action' && !Array.isArray(value) && value !== null && typeof value !== 'object')
        .map(([key, value]) => ({
            label: humanizeReportKey(key),
            value: formatReportPreviewValue(key, value),
        }));

    const updateReportFilter = (key, value) => {
        setReportBuilder({ ...reportBuilder, filters: { ...reportBuilder.filters, [key]: value } });
    };

    const summarizeReportWidget = (widget) => {
        const data = widget.data || {};
        if (Array.isArray(data.rows)) {
            return `${data.rows.length} rows`;
        }
        const numericKeys = Object.keys(data).filter(key => typeof data[key] === 'number');
        return numericKeys.length ? numericKeys.map(key => `${key}: ${key.toLowerCase().includes('rate') ? `${data[key]}%` : formatCurrency(data[key])}`).join(' | ') : (data.message || 'Ready');
    };

    const toggleAnalyticsFilterPanel = (panel) => {
        setActiveAnalyticsFilterPanel(current => current === panel ? null : panel);
    };

    const toggleDashboardFilterPanel = (panel) => {
        setActiveDashboardFilterPanel(current => current === panel ? null : panel);
    };

    const renderAnalyticsFilterButton = (panel, label = 'Filters') => (
        <button
            type="button"
            onClick={() => toggleAnalyticsFilterPanel(panel)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#720101]/15 bg-[#fff7e8] px-3 py-2 text-xs font-black text-[#720101] transition-colors hover:bg-[#fff1d0]"
            aria-expanded={activeAnalyticsFilterPanel === panel}
        >
            <Filter className="h-4 w-4" />
            {label}
            <ChevronDown className={`h-4 w-4 transition-transform ${activeAnalyticsFilterPanel === panel ? 'rotate-180' : ''}`} />
        </button>
    );

    const renderDashboardFilterButton = (panel, label = 'Filters') => (
        <button
            type="button"
            onClick={() => toggleDashboardFilterPanel(panel)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#720101]/15 bg-[#fff7e8] px-3 py-2 text-xs font-black text-[#720101] transition-colors hover:bg-[#fff1d0]"
            aria-expanded={activeDashboardFilterPanel === panel}
        >
            <Filter className="h-4 w-4" />
            {label}
            <ChevronDown className={`h-4 w-4 transition-transform ${activeDashboardFilterPanel === panel ? 'rotate-180' : ''}`} />
        </button>
    );

    const fetchAudits = async ({ silent = false } = {}) => {
        if (!silent) setAuditLoading(true);
        try {
            const data = await fetchCachedJson('/api/admin/audits?per_page=100', 15000);
            setAudits(data.data || []);
        } catch (error) {
            console.error(error);
            showToast(getErrorMessage(error, 'Could not load audit logs'), 'error');
        } finally {
            if (!silent) setAuditLoading(false);
        }
    };

    const fetchBookings = async ({ silent = false } = {}) => {
        if (!silent) setBookingsLoading(true);
        try {
            const data = await fetchCachedJson(ADMIN_BOOKINGS_URL, 30000);
            setBookings(getListData(data));
        } catch (error) {
            console.error(error);
            showToast(getErrorMessage(error, "Could not load bookings"), 'error');
        } finally {
            if (!silent) setBookingsLoading(false);
        }
    };

    const fetchRefundQueue = async ({ silent = false } = {}) => {
        if (!silent) setRefundLoading(true);
        try {
            const data = await fetchCachedJson('/api/admin/refunds/queue', 15000);
            setRefundQueue(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            showToast(getErrorMessage(error, 'Could not load refund requests'), 'error');
        } finally {
            if (!silent) setRefundLoading(false);
        }
    };

    const handleApproveBooking = async (booking) => {
        if (!booking || normalizeStatus(booking.status) !== 'pending') return;
        setApprovingBookingId(booking.id);

        try {
            const res = await fetch(`/api/admin/bookings/${booking.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Confirmed' }),
            });

            if (res.ok) {
                showToast("Booking approved and customer notified");
                bustAdminCache(ADMIN_BOOKINGS_URL, '/api/admin/analytics');
                fetchBookings();
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(getErrorMessage(err, "Could not approve booking"), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Could not approve booking. Please try again.", 'error');
        } finally {
            setApprovingBookingId(null);
        }
    };

    const handleDiscountSubmit = async (e) => {
        e.preventDefault();
        setDiscountLoading(true);
        try {
            // Session auth - no token needed
            const res = await fetch(`/api/admin/bookings/${discountModal.data.id}/discount`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(discountForm)
            });

            if (res.ok) {
                showToast("Discount applied successfully");
                setDiscountModal({ open: false, data: null });
                bustAdminCache(ADMIN_BOOKINGS_URL, '/api/admin/analytics');
                fetchBookings();
            } else {
                showToast("Could not apply discount", 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Could not apply discount. Please try again.", 'error');
        } finally {
            setDiscountLoading(false);
        }
    };

    const handleProcessRefund = async (bookingId) => {
        setConfirmDialog({
            isOpen: true,
            title: `Process refund for booking #${bookingId}?`,
            message: 'The non-refundable reservation fee will be retained and a refund case will be recorded.',
            confirmText: 'Process Refund',
            tone: 'danger',
            onConfirm: () => confirmProcessRefund(bookingId),
        });
    };

    const confirmProcessRefund = async (bookingId) => {
        closeConfirmDialog();
        setProcessingRefundId(bookingId);
        try {
            const res = await fetch(`/api/admin/refund/${bookingId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                showToast(data.message || 'Refund processed successfully');
                bustAdminCache('/api/admin/refunds/queue', '/api/admin/analytics');
                fetchRefundQueue();
                if (bookings.length > 0) fetchBookings({ silent: true });
            } else {
                const message = data?.details?.[0] || getErrorMessage(data, 'Could not process refund');
                showToast(message, 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not process refund. Please try again.', 'error');
        } finally {
            setProcessingRefundId(null);
        }
    };

    const handleEmpSubmit = async (e) => {
        e.preventDefault();
        setEmpFormLoading(true);
        try {
            const isCustomerEdit = empModal.mode === 'edit' && empModal.data?.role === 'Client';
            const url = empModal.mode === 'add'
                ? '/api/admin/employees'
                : isCustomerEdit
                    ? `/api/admin/customers/${empModal.data.id}`
                    : `/api/admin/employees/${empModal.data.id}`;
            const method = empModal.mode === 'add' ? 'POST' : 'PUT';

            // Only send password if provided (for edits)
            const payload = { ...empForm };
            if (empModal.mode === 'edit' && !payload.password) {
                delete payload.password;
            }
            if (isCustomerEdit) {
                delete payload.role;
            }

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast(`${isCustomerEdit ? 'Customer' : 'Employee'} ${empModal.mode === 'add' ? 'created' : 'updated'} successfully`);
                setEmpModal({ open: false, mode: 'add', data: null });
                bustAdminCache(ADMIN_EMPLOYEES_URL, ADMIN_CUSTOMERS_URL);
                fetchEmployees();
                fetchCustomers();
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(getErrorMessage(err, "Could not save account"), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Could not save account. Please try again.", 'error');
        } finally {
            setEmpFormLoading(false);
        }
    };

    const handleDeleteEmployee = async (id) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete employee account?',
            message: 'This staff account will lose access to the system.',
            confirmText: 'Delete',
            tone: 'danger',
            onConfirm: () => confirmDeleteEmployee(id),
        });
    };

    const confirmDeleteEmployee = async (id) => {
        closeConfirmDialog();
        try {
            // Session auth - no token needed
            const res = await fetch(`/api/admin/employees/${id}`, {
                method: 'DELETE',
                headers: { }
            });
            if (res.ok) {
                showToast("Employee deleted successfully");
                bustAdminCache(ADMIN_EMPLOYEES_URL);
                fetchEmployees();
            } else {
                showToast("Could not delete employee", 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Could not delete employee. Please try again.", 'error');
        }
    };

    const handleDeleteCustomer = async (id) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete customer account?',
            message: 'This will also remove records tied to the account, including bookings.',
            confirmText: 'Delete',
            tone: 'danger',
            onConfirm: () => confirmDeleteCustomer(id),
        });
    };

    const confirmDeleteCustomer = async (id) => {
        closeConfirmDialog();
        try {
            const res = await fetch(`/api/admin/customers/${id}`, {
                method: 'DELETE',
                headers: { }
            });
            if (res.ok) {
                showToast("Customer deleted successfully");
                bustAdminCache(ADMIN_CUSTOMERS_URL, ADMIN_BOOKINGS_URL, '/api/admin/analytics');
                fetchCustomers();
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(getErrorMessage(err, "Could not delete customer"), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Could not delete customer. Please try again.", 'error');
        }
    };

    const openEmpModal = (mode, employee = null) => {
        if (mode === 'add') {
            setEmpForm({ full_name: '', username: '', password: '', role: 'Marketing', email: '', phone: '' });
        } else {
            setEmpForm({
                full_name: employee.full_name || '',
                username: employee.username,
                password: '', // blank password for editing implies no change
                role: employee.role,
                email: employee.email || '',
                phone: employee.phone || ''
            });
        }
        setEmpModal({ open: true, mode, data: employee });
    };

    const openCustomerModal = (customer) => {
        setEmpForm({
            full_name: customer.full_name || '',
            username: customer.username,
            password: '',
            role: 'Client',
            email: customer.email || '',
            phone: customer.phone || ''
        });
        setEmpModal({ open: true, mode: 'edit', data: customer });
    };


    return (
        <div className="admin-page min-h-screen overflow-hidden">
            {/* Sidebar Navigation */}
            <aside className="fixed inset-y-0 left-0 z-30 flex w-72 admin-sidebar flex-col">
                <div className="p-5 pb-2">
                    <div className="admin-brand-mark">
                        <div>
                            <p className="admin-kicker">Eloquente Catering</p>
                            <h1 className="text-2xl font-black font-display tracking-wide text-[#720101]">Admin Console</h1>
                            <p className="mt-1 text-xs font-bold uppercase text-[#5c4b45]">Owner operations</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 py-3">
                    {adminNavGroups.map((group) => (
                        <div key={group.label} className="staff-nav-group">
                            <p className="staff-nav-section-label">{group.label}</p>
                            <div className="mt-2 space-y-1">
                                {group.items.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id)}
                                        className={`admin-nav-item w-full flex items-center justify-between gap-3 px-3.5 py-2.5 transition-all ${activeTab === item.id ? 'admin-nav-item-active' : 'text-[#5c4b45] hover:text-[#720101]'}`}
                                    >
                                        <span className="font-bold text-sm">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="border-t border-[#720101]/10 bg-[#fffaf3]/95 p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-[#720101] flex items-center justify-center text-[#f0aa0b] font-bold">
                            {user?.username?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#241612] truncate">{user?.username}</p>
                            <p className="text-xs font-semibold text-[#720101]/55 truncate">Administrator</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#720101] hover:bg-[#5f0101] text-white rounded-lg transition-colors text-sm font-bold">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="ml-72 flex h-screen flex-col min-w-0 overflow-y-auto admin-main relative">
                <header className="admin-header px-8 py-5 flex items-center justify-between sticky top-0 z-20">
                    <div>
                        <p className="admin-kicker">{currentPage.eyebrow}</p>
                        <h2 className="text-2xl font-bold text-[#1a1a1a]">{currentPage.title}</h2>
                        <p className="mt-1 text-sm font-medium text-slate-500">{currentPage.description}</p>
                    </div>
                </header>

                <div className="p-8">
                    {activeTab === 'dashboard' && (
                        <div className="animate-fadeIn">
                            <div className="space-y-6">
                                <section className="admin-panel overflow-hidden">
                                    <div className="flex flex-col gap-4 border-b border-gray-100 bg-[#fffaf3] p-6 xl:flex-row xl:items-center xl:justify-between">
                                        <div>
                                            <p className="admin-kicker">Daily work</p>
                                            <h3 className="mt-1 text-2xl font-black text-gray-950">What needs attention today</h3>
                                            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-gray-500">A focused view of bookings, collections, refunds, and activity that may need staff action.</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {renderDashboardFilterButton('dashboardSnapshot', businessSnapshot.label || 'Timeframe')}
                                            <button onClick={() => fetchAnalytics()} disabled={analyticsLoading} className="admin-button-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-black">
                                                <RefreshCw className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
                                                {analyticsLoading ? 'Refreshing...' : 'Refresh'}
                                            </button>
                                        </div>
                                    </div>
                                    {activeDashboardFilterPanel === 'dashboardSnapshot' && (
                                        <div className="border-b border-gray-100 bg-white p-5">
                                            <label className="block max-w-xs text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Overview timeframe</span>
                                                <select
                                                    value={analyticsFilters.snapshot_window}
                                                    onChange={(event) => {
                                                        const nextFilters = { ...analyticsFilters, snapshot_window: event.target.value };
                                                        setAnalyticsFilters(nextFilters);
                                                        fetchAnalytics({ filters: nextFilters });
                                                    }}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none"
                                                >
                                                    {SNAPSHOT_WINDOW_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </label>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
                                        {[
                                            ['Total revenue', formatCurrency(analyticsSummary.totalRevenue || 0), `Collected ${formatCurrency(analyticsSummary.settledRevenue || 0)}`],
                                            ['Collection rate', `${analyticsSummary.collectionRate || 0}%`, `Pending ${formatCurrency(analyticsSummary.pendingRevenue || 0)}`],
                                            ['Active bookings', analyticsSummary.activeBookings || 0, `${analyticsSummary.pendingBookings || 0} pending requests`],
                                            ['Total pax', Number(analyticsSummary.totalPax || 0).toLocaleString(), `Avg booking ${formatCurrency(analyticsSummary.averageBookingValue || 0)}`],
                                        ].map(([label, value, hint]) => (
                                            <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                                                <p className="mt-2 text-2xl font-black text-gray-950">{value}</p>
                                                <p className="mt-1 text-xs font-semibold text-gray-500">{hint}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                                    <section className="admin-panel p-6 xl:col-span-2">
                                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="admin-kicker">Financial pulse</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Collected Revenue Trend</h3>
                                                <p className="mt-1 text-sm font-semibold text-gray-500">Verified collections across the selected historical window.</p>
                                            </div>
                                            {renderDashboardFilterButton('dashboardRevenue', `Last ${analyticsFilters.trend_months} months`)}
                                        </div>
                                        {activeDashboardFilterPanel === 'dashboardRevenue' && (
                                            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Trend window</span>
                                                    <select
                                                        value={analyticsFilters.trend_months}
                                                        onChange={(event) => {
                                                            const nextFilters = { ...analyticsFilters, trend_months: event.target.value };
                                                            setAnalyticsFilters(nextFilters);
                                                            fetchAnalytics({ filters: nextFilters });
                                                        }}
                                                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none"
                                                    >
                                                        {[3, 6, 9, 12, 18, 24].map(months => <option key={months} value={months}>Last {months} months</option>)}
                                                    </select>
                                                </label>
                                            </div>
                                        )}
                                        <div className="h-72">
                                            {revenueTrendData.length ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={revenueTrendData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                                        <Line type="monotone" dataKey="revenue" stroke="#720101" strokeWidth={3} dot={{ r: 4 }} name="Collected" />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No collected revenue for this window.</div>}
                                        </div>
                                    </section>

                                    <section className="admin-panel p-6">
                                        <div className="mb-5 flex items-start justify-between gap-3">
                                            <div>
                                                <p className="admin-kicker">Attention center</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Operational Alerts</h3>
                                                <p className="mt-1 text-sm font-semibold text-gray-500">Items that need admin action.</p>
                                            </div>
                                            {renderDashboardFilterButton('dashboardAlerts', alertFilters.severity === 'all' ? 'Severity' : alertFilters.severity)}
                                        </div>
                                        {activeDashboardFilterPanel === 'dashboardAlerts' && (
                                            <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    Alert severity
                                                    <select value={alertFilters.severity} onChange={(e) => setAlertFilters({ ...alertFilters, severity: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                        <option value="all">All severities</option>
                                                        <option value="danger">Danger</option>
                                                        <option value="warning">Warning</option>
                                                        <option value="success">Healthy</option>
                                                    </select>
                                                </label>
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            {visibleOperationalAlerts.map((alert) => (
                                                <div key={alert.label} className={`rounded-xl border p-4 ${alert.severity === 'danger' ? 'border-red-200 bg-red-50' : alert.severity === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 bg-emerald-50'}`}>
                                                    <div className="flex items-start justify-between gap-4">
                                                        <p className="text-sm font-black text-gray-900">{alert.label}</p>
                                                        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-gray-950 shadow-sm">{alert.count}</span>
                                                    </div>
                                                    <button onClick={() => alert.label.includes('payment') ? setActiveTab('refunds') : setActiveTab('bookings')} className="mt-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900">Open queue</button>
                                                </div>
                                            ))}
                                            {!visibleOperationalAlerts.length && <div className="rounded-xl bg-gray-50 p-6 text-sm font-bold text-gray-400">No alerts match this severity.</div>}
                                        </div>
                                    </section>
                                </div>

                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                    <section className="admin-panel p-6">
                                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="admin-kicker">Collections</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Payment Risk</h3>
                                                <p className="mt-1 text-sm font-semibold text-gray-500">Payment exposure by status and aging bucket.</p>
                                            </div>
                                            {renderDashboardFilterButton('dashboardPayment', paymentRiskFilters.status === 'all' ? 'Risk filters' : paymentRiskFilters.status)}
                                        </div>
                                        {activeDashboardFilterPanel === 'dashboardPayment' && (
                                            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    <span className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /> Payment status</span>
                                                    <select value={paymentRiskFilters.status} onChange={(e) => setPaymentRiskFilters({ ...paymentRiskFilters, status: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                        <option value="all">All statuses</option>
                                                        {paymentStatusBreakdown.map(row => <option key={row.label} value={String(row.label || '').toLowerCase()}>{row.label}</option>)}
                                                    </select>
                                                </label>
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    Minimum aging balance
                                                    <input type="number" min="0" value={paymentRiskFilters.minBalance} onChange={(e) => setPaymentRiskFilters({ ...paymentRiskFilters, minBalance: e.target.value })} placeholder="Show all" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none" />
                                                </label>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                            <div className="h-56">
                                                {visiblePaymentStatusBreakdown.length ? (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={visiblePaymentStatusBreakdown}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                            <RechartsTooltip formatter={(value, name) => name === 'total' ? formatCurrency(value) : value} />
                                                            <Bar dataKey="total" fill="#f0aa0b" radius={[6, 6, 0, 0]} name="Amount" />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No payment rows.</div>}
                                            </div>
                                            <div className="space-y-3">
                                                {visiblePaymentAgingData.map((bucket) => (
                                                    <div key={bucket.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="text-sm font-black text-gray-800">{bucket.label}</span>
                                                            <span className="text-sm font-black text-gray-950">{formatCurrency(bucket.value || 0)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {!visiblePaymentAgingData.length && <div className="rounded-xl bg-gray-50 p-6 text-sm font-bold text-gray-400">No aging balances match this filter.</div>}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="admin-panel p-6">
                                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="admin-kicker">Workload</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Booking Pipeline & Next Events</h3>
                                                <p className="mt-1 text-sm font-semibold text-gray-500">Operational volume and near-term service load.</p>
                                            </div>
                                            {renderDashboardFilterButton('dashboardWorkload', workloadFilters.status === 'all' ? 'Workload filters' : workloadFilters.status)}
                                        </div>
                                        {activeDashboardFilterPanel === 'dashboardWorkload' && (
                                            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Upcoming status</span>
                                                    <select value={workloadFilters.status} onChange={(e) => setWorkloadFilters({ ...workloadFilters, status: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                        <option value="all">All statuses</option>
                                                        {Array.from(new Set(upcomingWorkloadData.map(event => String(event.status || '').toLowerCase()).filter(Boolean))).map(status => <option key={status} value={status}>{status}</option>)}
                                                    </select>
                                                </label>
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Minimum pax</span>
                                                    <input type="number" min="0" value={workloadFilters.minPax} onChange={(e) => setWorkloadFilters({ ...workloadFilters, minPax: e.target.value })} placeholder="Show all" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none" />
                                                </label>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                            {bookingPipelineData.slice(0, 3).map((row) => (
                                                <div key={row.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                                                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{row.label}</p>
                                                    <p className="mt-2 text-2xl font-black text-gray-950">{row.count}</p>
                                                    <p className="text-xs font-bold text-amber-700">{formatCurrency(row.value || 0)}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-5 overflow-hidden rounded-xl border border-gray-100">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-xs font-black uppercase tracking-widest text-gray-500">
                                                    <tr><th className="px-4 py-3 text-left">Upcoming Event</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-right">Pax</th><th className="px-4 py-3 text-left">Status</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {visibleUpcomingWorkloadData.slice(0, 6).map((event) => (
                                                        <tr key={event.id || `${event.client}-${event.date}`}>
                                                            <td className="px-4 py-3 font-bold text-gray-900">{event.client || event.eventType || 'Event'}</td>
                                                            <td className="px-4 py-3 text-gray-600">{event.date}</td>
                                                            <td className="px-4 py-3 text-right font-bold text-gray-900">{event.pax}</td>
                                                            <td className="px-4 py-3 text-gray-600">{event.status || event.eventType}</td>
                                                        </tr>
                                                    ))}
                                                    {!visibleUpcomingWorkloadData.length && <tr><td colSpan="4" className="px-4 py-8 text-center font-bold text-gray-400">No upcoming events match this filter.</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                </div>

                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                                    <section className="admin-panel p-6">
                                        <div className="mb-5 flex items-start justify-between gap-3">
                                            <div>
                                                <p className="admin-kicker">Sales mix</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Top Packages</h3>
                                            </div>
                                            {renderDashboardFilterButton('dashboardPackages', `Top ${packageViewFilters.limit}`)}
                                        </div>
                                        {activeDashboardFilterPanel === 'dashboardPackages' && (
                                            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                <select value={packageViewFilters.limit} onChange={(e) => setPackageViewFilters({ ...packageViewFilters, limit: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none">
                                                    {PERFORMANCE_LIMIT_OPTIONS.map(value => <option key={value} value={value}>Top {value} packages</option>)}
                                                </select>
                                                <select value={packageViewFilters.sort} onChange={(e) => setPackageViewFilters({ ...packageViewFilters, sort: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none">
                                                    <option value="revenue">Revenue</option>
                                                    <option value="bookings">Bookings</option>
                                                    <option value="name">Package name</option>
                                                </select>
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            {visiblePackagePerformanceData.slice(0, 5).map((pkg) => (
                                                <div key={pkg.label || pkg.name}>
                                                    <div className="flex items-center justify-between gap-3 text-sm">
                                                        <span className="truncate font-black text-gray-800">{pkg.label || pkg.name}</span>
                                                        <span className="font-black text-amber-700">{formatCurrency(pkg.revenue || 0)}</span>
                                                    </div>
                                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                                                        <div className="h-full rounded-full bg-[#720101]" style={{ width: `${Math.max(8, (Number(pkg.revenue || 0) / maxPackageRevenue) * 100)}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="admin-panel p-6">
                                        <div className="mb-5 flex items-start justify-between gap-3">
                                            <div>
                                                <p className="admin-kicker">Menu velocity</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Top Dishes</h3>
                                            </div>
                                            {renderDashboardFilterButton('dashboardMenu', MENU_CATEGORY_OPTIONS.find(option => option.value === menuViewFilters.category)?.label || 'Dish type')}
                                        </div>
                                        {activeDashboardFilterPanel === 'dashboardMenu' && (
                                            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                <select value={menuViewFilters.category} onChange={(e) => setMenuViewFilters({ ...menuViewFilters, category: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none">
                                                    {MENU_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                                <select value={menuViewFilters.sort} onChange={(e) => setMenuViewFilters({ ...menuViewFilters, sort: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none">
                                                    <option value="selections">Selections</option>
                                                    <option value="pax">Pax served</option>
                                                    <option value="name">Dish name</option>
                                                </select>
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            {visibleMenuPerformanceData.slice(0, 6).map((dish) => (
                                                <div key={dish.label} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-black text-gray-900">{dish.label}</p>
                                                        <p className="text-xs font-bold uppercase text-gray-400">{dish.category}</p>
                                                    </div>
                                                    <span className="text-sm font-black text-[#720101]">{menuViewFilters.sort === 'pax' ? dish.paxServed : dish.selections}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="admin-panel p-6">
                                        <div className="mb-5">
                                            <p className="admin-kicker">Demand intensity</p>
                                            <h3 className="mt-1 text-lg font-black text-gray-950">Peak Season Heatmap</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">Monthly event load for planning purchasing and staffing.</p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 text-center text-xs sm:grid-cols-4">
                                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => {
                                                const val = peakSeasonData.find(item => item.month === month)?.events || peakSeasonData.find(item => item.month === month)?.count || 0;
                                                const bgColor = val <= 3 ? 'bg-green-100 text-green-800' : val <= 6 ? 'bg-yellow-200 text-yellow-800' : val <= 8 ? 'bg-orange-300 text-orange-900' : 'bg-red-500 text-white font-bold';
                                                return (
                                                    <div key={month} className={`rounded-xl p-3 ${bgColor}`}>
                                                        <span className="block font-black">{month}</span>
                                                        <span className="text-[11px] font-bold">{val} events</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </div>
                            </div>

                            <div className="hidden">
                            <section className="admin-hero rounded-2xl p-6 text-white">
                                <div className="max-w-3xl">
                                    <p className="text-xs font-black uppercase text-[#f0aa0b]">Today’s operating picture</p>
                                    <h3 className="mt-2 text-3xl font-black">Keep service decisions tied to actual bookings.</h3>
                                    <p className="mt-2 max-w-2xl text-sm font-medium text-white/72">Revenue, menu movement, demand, and payment exposure stay refreshed from current operations.</p>
                                </div>
                            </section>

                            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="admin-metric-card overflow-hidden">
                                    <div className="px-5 py-5">
                                        <dt className="text-sm font-bold text-slate-500 truncate flex items-center gap-2">
                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Total Revenue
                                        </dt>
                                        <dd className="mt-2 text-3xl font-extrabold text-gray-900">{formatCurrency(analyticsSummary.totalRevenue)}</dd>
                                        <p className="mt-2 text-xs font-semibold text-emerald-700">Settled: {formatCurrency(analyticsSummary.settledRevenue)}</p>
                                    </div>
                                </div>
                                <div className="admin-metric-card overflow-hidden">
                                    <div className="px-5 py-5">
                                        <dt className="text-sm font-bold text-slate-500 truncate flex items-center gap-2">
                                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                            Pending Bookings
                                        </dt>
                                        <dd className="mt-2 text-3xl font-extrabold text-gray-900">{analyticsSummary.pendingBookings || 0}</dd>
                                        <p className="mt-2 text-xs font-semibold text-amber-700">Needs approval or follow-up</p>
                                    </div>
                                </div>
                                <div className="admin-metric-card overflow-hidden">
                                    <div className="px-5 py-5">
                                        <dt className="text-sm font-bold text-slate-500 truncate flex items-center gap-2">
                                            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            Confirmed Bookings
                                        </dt>
                                        <dd className="mt-2 text-3xl font-extrabold text-gray-900">{analyticsSummary.activeBookings || 0}</dd>
                                        <p className="mt-2 text-xs font-semibold text-[#720101]">Events moving through service</p>
                                    </div>
                                </div>
                                <div className="admin-metric-card overflow-hidden">
                                    <div className="px-5 py-5">
                                        <dt className="text-sm font-bold text-slate-500 truncate flex items-center gap-2">
                                            <svg className="w-4 h-4 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m8-4a4 4 0 10-8 0 4 4 0 008 0z" /></svg>
                                            Total Pax
                                        </dt>
                                        <dd className="mt-2 text-3xl font-extrabold text-gray-900">{Number(analyticsSummary.totalPax || 0).toLocaleString()}</dd>
                                        <p className="mt-2 text-xs font-semibold text-slate-500">Avg. value: {formatCurrency(analyticsSummary.averageBookingValue)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Revenue Trends */}
                                <div className="admin-panel p-6">
                                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                        Revenue Trends (Last {analyticsFilters.trend_months || 6} Months)
                                    </h3>
                                    <div className="mb-4 flex justify-end">
                                        <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                            Window
                                            <select
                                                value={analyticsFilters.trend_months}
                                                onChange={(event) => {
                                                    const nextFilters = { ...analyticsFilters, trend_months: event.target.value };
                                                    setAnalyticsFilters(nextFilters);
                                                    fetchAnalytics({ filters: nextFilters });
                                                }}
                                                className="ml-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-gray-800 outline-none focus:ring-2 focus:ring-amber-100"
                                            >
                                                {[3, 6, 9, 12, 18, 24].map(months => <option key={months} value={months}>Last {months} months</option>)}
                                            </select>
                                        </label>
                                    </div>
                                    <div className="h-64 flex items-end justify-between gap-2 overflow-hidden">
                                        {(revenueTrendData.length ? revenueTrendData : []).map((item, i) => {
                                            const maxRevenue = Math.max(...revenueTrendData.map(row => row.revenue || 0), 1);
                                            const val = Math.max(8, Math.round(((item.revenue || 0) / maxRevenue) * 100));
                                            return (
                                            <div key={i} className="w-full h-full flex flex-col items-center justify-end gap-2 group">
                                                <div className="w-full bg-[#f8ead5] rounded-t-md relative flex items-end justify-center group-hover:bg-[#f0d9b4] transition-colors" style={{ height: `${val}%` }}>
                                                    <div className="absolute -top-8 bg-gray-900 text-white text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                        {formatCurrency(item.revenue)}
                                                    </div>
                                                    <div className="w-full bg-[#720101] rounded-t-md opacity-80" style={{ height: `${val > 50 ? val - 20 : val}%` }}></div>
                                                </div>
                                                <span className="text-xs font-medium text-gray-500">{item.label || item.month}</span>
                                            </div>
                                        )})}
                                    </div>
                                </div>

                                {/* Market Intelligence: Top Sellers */}
                                <div className="admin-panel p-6">
                                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                        Market Intelligence (Top Sellers)
                                    </h3>
                                    <div className="space-y-6">
                                        {topSellerData.map((item, i) => {
                                            const maxCount = Math.max(...topSellerData.map(row => row.count || 0), 1);
                                            return (
                                            <div key={i}>
                                                <div className="flex justify-between text-sm mb-2">
                                                    <span className="font-bold text-gray-700">{item.label || item.name}</span>
                                                    <span className="text-gray-500 font-bold">{item.count} Bookings</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                                    <div className="bg-[#720101] h-3 rounded-full" style={{ width: `${Math.max(10, (item.count / maxCount) * 100)}%` }}></div>
                                                </div>
                                            </div>
                                        )})}
                                    </div>
                                </div>

                                {/* Peak Season Heatmap Placeholder */}
                                <div className="admin-panel p-6 lg:col-span-2">
                                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        Peak Season Heatmap (Demand Intensity)
                                    </h3>
                                    <div className="grid grid-cols-6 md:grid-cols-12 gap-3 text-center text-xs">
                                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => {
                                            const val = peakSeasonData.find(item => item.month === month)?.events || peakSeasonData.find(item => item.month === month)?.count || 0;
                                            const bgColor = val <= 3 ? 'bg-green-100 text-green-800' : val <= 6 ? 'bg-yellow-200 text-yellow-800' : val <= 8 ? 'bg-orange-300 text-orange-900' : 'bg-red-500 text-white font-bold shadow-sm';

                                            return (
                                                <div key={i} className={`flex flex-col items-center justify-center p-4 rounded-xl ${bgColor} transition-transform hover:scale-105 cursor-default`}>
                                                    <span className="font-bold text-sm mb-1">{month}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-6 flex items-center justify-end gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 rounded"></div> Low</span>
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-200 rounded"></div> Med</span>
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-300 rounded"></div> High</span>
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded"></div> Peak</span>
                                    </div>
                                </div>
                            </div>

                            </div>
                        </div>
                    )}
                    {activeTab === 'analytics' && (
                        <div className="animate-fadeIn space-y-6">
                            <section className="admin-panel overflow-hidden">
                                <div className="flex flex-col gap-4 border-b border-gray-100 bg-[#fffaf3] p-6 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <p className="admin-kicker">Predictive Intelligence</p>
                                        <h3 className="mt-1 text-2xl font-black text-gray-950">Business Forecasting & Operational Signals</h3>
                                        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-gray-500">Forecast revenue and guest demand with simple moving averages, then review the operational signals admins need for staffing, purchasing, and payment follow-up.</p>
                                    </div>
                                    <button onClick={() => fetchAnalytics()} disabled={analyticsLoading} className="admin-button-primary inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 text-sm font-black sm:w-auto">
                                        <RefreshCw className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
                                        {analyticsLoading ? 'Refreshing...' : 'Refresh Analytics'}
                                    </button>
                                </div>
                                <div className="p-5">
                                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <h4 className="text-lg font-black text-gray-950">Business Snapshot</h4>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">High-signal metrics for revenue, demand, bookings, and collection health.</p>
                                        </div>
                                        {renderAnalyticsFilterButton('snapshot', businessSnapshot.label || 'Timeframe')}
                                    </div>
                                    {activeAnalyticsFilterPanel === 'snapshot' && (
                                        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Snapshot timeframe</span>
                                                <select
                                                    value={analyticsFilters.snapshot_window}
                                                    onChange={(event) => {
                                                        const nextFilters = { ...analyticsFilters, snapshot_window: event.target.value };
                                                        setAnalyticsFilters(nextFilters);
                                                        fetchAnalytics({ filters: nextFilters });
                                                    }}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none focus:ring-2 focus:ring-amber-100"
                                                >
                                                    {SNAPSHOT_WINDOW_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </label>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        {businessSnapshotCards.map((card) => (
                                            <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{card.label}</p>
                                                <p className="mt-2 text-2xl font-black text-gray-950">{formatAnalyticsCardValue(card.value, card.format)}</p>
                                                <p className="mt-1 text-xs font-semibold text-gray-500">{card.hint}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {businessSnapshot.insight && (
                                        <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">{businessSnapshot.insight}</p>
                                    )}
                                </div>
                            </section>

                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                <section className="admin-panel p-6">
                                    <div className="border-b border-gray-100 pb-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <p className="admin-kicker">Finance Forecast</p>
                                                <h3 className="mt-1 text-xl font-black text-gray-950">Revenue Forecast Using SMA</h3>
                                                <p className="mt-2 text-sm font-semibold leading-6 text-gray-500">Projects short-term collected revenue by smoothing verified payment history.</p>
                                            </div>
                                            {renderAnalyticsFilterButton('revenueForecast', `${analyticsFilters.revenue_forecast_period} forecast`)}
                                        </div>
                                        {activeAnalyticsFilterPanel === 'revenueForecast' && <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-3">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Period
                                                <select value={analyticsFilters.revenue_forecast_period} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, revenue_forecast_period: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {FORECAST_PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Smoothing
                                                <select value={analyticsFilters.revenue_sma_window} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, revenue_sma_window: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {SMA_WINDOW_OPTIONS.map(value => <option key={value} value={value}>{value}-period SMA</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Forecast
                                                <select value={analyticsFilters.revenue_forecast_horizon} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, revenue_forecast_horizon: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {FORECAST_HORIZON_OPTIONS.map(value => <option key={value} value={value}>{value} periods ahead</option>)}
                                                </select>
                                            </label>
                                            <button type="button" onClick={() => fetchAnalytics()} className="rounded-xl bg-[#720101] px-4 py-2.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-[#8d0808] sm:col-span-3">Apply Forecast Filters</button>
                                        </div>}
                                    </div>
                                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {[
                                            ['Next forecast', formatCurrency(revenueForecastSummary.nextForecast || 0)],
                                            ['Last actual', formatCurrency(revenueForecastSummary.lastActual || 0)],
                                            ['Movement', `${revenueForecastSummary.changePercent || 0}% ${revenueForecastSummary.direction === 'up' ? 'increase' : 'decrease'}`],
                                        ].map(([label, value]) => (
                                            <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                                                <p className="mt-1 text-lg font-black text-gray-950">{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-6 h-80">
                                        {revenueForecastData.length ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={revenueForecastData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                                    <Bar dataKey="revenue" fill="#720101" radius={[6, 6, 0, 0]} name="Actual collected" />
                                                    <Bar dataKey="forecast" fill="#f0aa0b" radius={[6, 6, 0, 0]} name="SMA forecast" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No revenue data available.</div>}
                                    </div>
                                    <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">{revenueForecast.insight}</p>
                                </section>

                                <section className="admin-panel p-6">
                                    <div className="border-b border-gray-100 pb-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <p className="admin-kicker">Operations Forecast</p>
                                                <h3 className="mt-1 text-xl font-black text-gray-950">Moving Averages for Pax Demand Projection</h3>
                                                <p className="mt-2 text-sm font-semibold leading-6 text-gray-500">Smooths historical guest demand so culinary and logistics planning is not distorted by one-off spikes.</p>
                                            </div>
                                            {renderAnalyticsFilterButton('paxForecast', `${analyticsFilters.pax_projection_period} demand`)}
                                        </div>
                                        {activeAnalyticsFilterPanel === 'paxForecast' && <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-3">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Period
                                                <select value={analyticsFilters.pax_projection_period} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, pax_projection_period: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {FORECAST_PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Year
                                                <select value={analyticsFilters.pax_projection_year} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, pax_projection_year: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    <option value="">All years</option>
                                                    {ANALYTICS_YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Quarter
                                                <select value={analyticsFilters.pax_projection_quarter} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, pax_projection_quarter: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    <option value="">All quarters</option>
                                                    {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Smoothing
                                                <select value={analyticsFilters.pax_sma_window} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, pax_sma_window: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {SMA_WINDOW_OPTIONS.map(value => <option key={value} value={value}>{value}-period SMA</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 sm:col-span-2">
                                                Forecast horizon
                                                <select value={analyticsFilters.pax_projection_horizon} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, pax_projection_horizon: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {FORECAST_HORIZON_OPTIONS.map(value => <option key={value} value={value}>{value} periods ahead</option>)}
                                                </select>
                                            </label>
                                            <button type="button" onClick={() => fetchAnalytics()} className="rounded-xl bg-[#720101] px-4 py-2.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-[#8d0808] sm:col-span-3">Apply Demand Filters</button>
                                        </div>}
                                    </div>
                                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {[
                                            ['Next pax forecast', Number(paxDemandSummary.nextForecast || 0).toLocaleString()],
                                            ['Forecast horizon pax', Number(paxDemandSummary.forecastPax || 0).toLocaleString()],
                                            ['Peak historical period', paxDemandSummary.peakPeriod || 'No data'],
                                        ].map(([label, value]) => (
                                            <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                                                <p className="mt-1 text-lg font-black text-gray-950">{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-6 h-80">
                                        {paxDemandData.length ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={paxDemandData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                    <RechartsTooltip />
                                                    <Bar dataKey="pax" fill="#2563eb" radius={[6, 6, 0, 0]} name="Actual pax" />
                                                    <Bar dataKey="forecast" fill="#22c55e" radius={[6, 6, 0, 0]} name="SMA forecast" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No pax demand data available.</div>}
                                    </div>
                                    <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">{paxDemandProjection.insight}</p>
                                </section>
                            </div>

                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                <section className="admin-panel p-6">
                                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h3 className="text-lg font-black text-gray-950">Collected Revenue Trend</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">Historical verified collections ending at the current month.</p>
                                        </div>
                                        {renderAnalyticsFilterButton('revenueTrend', `Last ${analyticsFilters.trend_months} months`)}
                                    </div>
                                    {activeAnalyticsFilterPanel === 'revenueTrend' && (
                                        <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Trend window</span>
                                                <select
                                                    value={analyticsFilters.trend_months}
                                                    onChange={(event) => {
                                                        const nextFilters = { ...analyticsFilters, trend_months: event.target.value };
                                                        setAnalyticsFilters(nextFilters);
                                                        fetchAnalytics({ filters: nextFilters });
                                                    }}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none"
                                                >
                                                    {[3, 6, 9, 12, 18, 24].map(months => <option key={months} value={months}>Last {months} months</option>)}
                                                </select>
                                            </label>
                                        </div>
                                    )}
                                    <div className="h-72">
                                        {revenueTrendData.length ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={revenueTrendData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                                    <Line type="monotone" dataKey="revenue" stroke="#720101" strokeWidth={3} dot={{ r: 4 }} name="Collected" />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No collected revenue for this window.</div>}
                                    </div>
                                </section>

                                <section className="admin-panel p-6">
                                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h3 className="text-lg font-black text-gray-950">Payment Risk</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">Balances by payment status and aging bucket.</p>
                                        </div>
                                        {renderAnalyticsFilterButton('paymentRisk', paymentRiskFilters.status === 'all' ? 'Risk filters' : paymentRiskFilters.status)}
                                    </div>
                                    {activeAnalyticsFilterPanel === 'paymentRisk' && (
                                        <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                <span className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /> Payment status</span>
                                                <select value={paymentRiskFilters.status} onChange={(e) => setPaymentRiskFilters({ ...paymentRiskFilters, status: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    <option value="all">All statuses</option>
                                                    {paymentStatusBreakdown.map(row => <option key={row.label} value={String(row.label || '').toLowerCase()}>{row.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Minimum aging balance
                                                <input type="number" min="0" value={paymentRiskFilters.minBalance} onChange={(e) => setPaymentRiskFilters({ ...paymentRiskFilters, minBalance: e.target.value })} placeholder="Show all" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none" />
                                            </label>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                        <div className="h-64">
                                            {visiblePaymentStatusBreakdown.length ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={visiblePaymentStatusBreakdown}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                        <RechartsTooltip formatter={(value, name) => name === 'total' ? formatCurrency(value) : value} />
                                                        <Bar dataKey="total" fill="#f0aa0b" radius={[6, 6, 0, 0]} name="Amount" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No payment rows.</div>}
                                        </div>
                                        <div className="space-y-3">
                                            {visiblePaymentAgingData.map((bucket) => (
                                                <div key={bucket.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-sm font-black text-gray-800">{bucket.label}</span>
                                                        <span className="text-sm font-black text-gray-950">{formatCurrency(bucket.value || 0)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {!visiblePaymentAgingData.length && <div className="rounded-xl bg-gray-50 p-6 text-sm font-bold text-gray-400">No aging balances match this filter.</div>}
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                <section className="admin-panel overflow-hidden">
                                    <div className="flex flex-col gap-3 border-b border-gray-100 bg-white p-6 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="admin-kicker">Sales Mix</p>
                                            <h3 className="mt-1 text-lg font-black text-gray-950">Package Performance</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">Which packages are producing bookings and value.</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="inline-flex items-center gap-2 rounded-xl bg-[#fff7e8] px-3 py-2 text-xs font-black text-[#720101]">
                                                <Package className="h-4 w-4" />
                                                {visiblePackagePerformanceData.length} of {packagePerformanceData.length}
                                            </span>
                                            {renderAnalyticsFilterButton('packagePerformance', `Top ${packageViewFilters.limit}`)}
                                        </div>
                                    </div>
                                    {activeAnalyticsFilterPanel === 'packagePerformance' && (
                                        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 bg-gray-50 p-5 sm:grid-cols-3">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Show
                                                <select value={packageViewFilters.limit} onChange={(e) => setPackageViewFilters({ ...packageViewFilters, limit: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {PERFORMANCE_LIMIT_OPTIONS.map(value => <option key={value} value={value}>Top {value} packages</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Sort by
                                                <select value={packageViewFilters.sort} onChange={(e) => setPackageViewFilters({ ...packageViewFilters, sort: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    <option value="revenue">Revenue</option>
                                                    <option value="bookings">Bookings</option>
                                                    <option value="name">Package name</option>
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Min bookings
                                                <input type="number" min="0" value={packageViewFilters.minBookings} onChange={(e) => setPackageViewFilters({ ...packageViewFilters, minBookings: e.target.value })} placeholder="Show all" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none" />
                                            </label>
                                        </div>
                                    )}
                                    <div className="max-h-[31rem] space-y-3 overflow-y-auto p-6">
                                        {visiblePackagePerformanceData.map((pkg) => (
                                            <div key={pkg.label || pkg.name} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-black text-gray-950">{pkg.label || pkg.name}</p>
                                                        <p className="mt-1 text-xs font-bold text-gray-500">{pkg.count} bookings</p>
                                                    </div>
                                                    <p className="shrink-0 text-right font-black text-amber-700">{formatCurrency(pkg.revenue || 0)}</p>
                                                </div>
                                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                                                    <div className="h-full rounded-full bg-[#720101]" style={{ width: `${Math.max(8, (Number(pkg.revenue || 0) / maxPackageRevenue) * 100)}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                        {!visiblePackagePerformanceData.length && <div className="rounded-xl bg-gray-50 p-6 text-sm font-bold text-gray-400">No package data for the selected filters.</div>}
                                    </div>
                                </section>

                                <section className="admin-panel overflow-hidden">
                                    <div className="flex flex-col gap-3 border-b border-gray-100 bg-white p-6 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="admin-kicker">Dish Velocity</p>
                                            <h3 className="mt-1 text-lg font-black text-gray-950">Menu Performance</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">Dish selections from actual booking items.</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="inline-flex items-center gap-2 rounded-xl bg-[#fff7e8] px-3 py-2 text-xs font-black text-[#720101]">
                                                <ClipboardList className="h-4 w-4" />
                                                Top {visibleMenuPerformanceData.length}
                                            </span>
                                            {renderAnalyticsFilterButton('menuPerformance', MENU_CATEGORY_OPTIONS.find(option => option.value === menuViewFilters.category)?.label || 'Dish type')}
                                        </div>
                                    </div>
                                    {activeAnalyticsFilterPanel === 'menuPerformance' && (
                                        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 bg-gray-50 p-5 sm:grid-cols-3">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Dish type
                                                <select value={menuViewFilters.category} onChange={(e) => setMenuViewFilters({ ...menuViewFilters, category: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {MENU_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Show
                                                <select value={menuViewFilters.limit} onChange={(e) => setMenuViewFilters({ ...menuViewFilters, limit: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {PERFORMANCE_LIMIT_OPTIONS.map(value => <option key={value} value={value}>Top {value} dishes</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Rank by
                                                <select value={menuViewFilters.sort} onChange={(e) => setMenuViewFilters({ ...menuViewFilters, sort: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    <option value="selections">Selections</option>
                                                    <option value="pax">Pax served</option>
                                                    <option value="name">Dish name</option>
                                                </select>
                                            </label>
                                        </div>
                                    )}
                                    <div className="h-[31rem] p-6">
                                        {visibleMenuPerformanceData.length ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={visibleMenuPerformanceData} layout="vertical" margin={{ left: 24, right: 12, top: 6, bottom: 6 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                    <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#374151', fontWeight: 700 }} width={150} />
                                                    <RechartsTooltip />
                                                    <Bar dataKey={menuViewFilters.sort === 'pax' ? 'paxServed' : 'selections'} fill="#720101" radius={[0, 6, 6, 0]} name={menuViewFilters.sort === 'pax' ? 'Pax served' : 'Selections'} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No menu selections for the selected filters.</div>}
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}
                    {activeTab === 'configuration' && (
                        <div className="animate-fadeIn">
                            <div className="animate-fadeIn">
                                {pricingLoading ? (
                                    <div className="p-8 text-center text-gray-500">Loading pricing configuration...</div>
                                ) : (
                                    <>
                                    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                                        <div className="border-b border-gray-100 bg-gray-50 px-6 pt-5">
                                            <nav className="flex gap-2 overflow-x-auto">
                                                {[
                                                    ['packages', 'Packages'],
                                                    ['eventTypes', 'Event Types'],
                                                    ['menuItems', 'Menu Items'],
                                                ].map(([key, label]) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => setActiveConfigTab(key)}
                                                        className={`whitespace-nowrap rounded-t-lg px-4 py-3 text-sm font-black transition-colors ${activeConfigTab === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-white/70 hover:text-gray-800'}`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </nav>
                                        </div>

                                        {activeConfigTab === 'packages' && (
                                            <div>
                                                <form onSubmit={handlePackageSubmit} className="border-b border-gray-100 p-6">
                                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                                                        <input required value={packageForm.name} onChange={e => setPackageForm({ ...packageForm, name: e.target.value })} placeholder="Package name" className="lg:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <select required value={packageForm.type} onChange={e => setPackageForm({ ...packageForm, type: e.target.value, event_type_slugs: packageForm.event_type_slugs?.includes(e.target.value) ? packageForm.event_type_slugs : [...(packageForm.event_type_slugs || []), e.target.value] })} className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100">
                                                            {eventTypes.map(type => <option key={type.id} value={type.slug}>{type.label}</option>)}
                                                        </select>
                                                        <select value={packageForm.package_category} onChange={e => setPackageForm({ ...packageForm, package_category: e.target.value })} className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100">
                                                            {PACKAGE_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                        </select>
                                                        <input required type="number" min="0" value={packageForm.base_price_per_head} onChange={e => setPackageForm({ ...packageForm, base_price_per_head: e.target.value })} placeholder="Price / head" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <input required type="number" min="1" value={packageForm.minimum_pax} onChange={e => setPackageForm({ ...packageForm, minimum_pax: e.target.value })} placeholder="Min pax" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <button disabled={packageSaving} className="lg:col-span-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{packageSaving ? 'Saving...' : editingPackageId ? 'Save' : 'Create'}</button>
                                                        <label className="lg:col-span-4 text-xs font-black uppercase tracking-wide text-slate-500">
                                                            Connected event types
                                                            <select multiple value={packageForm.event_type_slugs || []} onChange={e => setPackageForm({ ...packageForm, event_type_slugs: Array.from(e.target.selectedOptions).map(option => option.value) })} className="mt-2 min-h-28 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium normal-case outline-none focus:ring-2 focus:ring-indigo-100">
                                                                {eventTypes.map(type => <option key={type.id} value={type.slug}>{type.label}</option>)}
                                                            </select>
                                                        </label>
                                                        <textarea value={packageForm.description} onChange={e => setPackageForm({ ...packageForm, description: e.target.value })} placeholder="Description" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <textarea value={packageForm.inclusions} onChange={e => setPackageForm({ ...packageForm, inclusions: e.target.value })} placeholder="Inclusions, one per line" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <textarea value={packageForm.amenities} onChange={e => setPackageForm({ ...packageForm, amenities: e.target.value })} placeholder="Amenities, one per line" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <textarea value={packageForm.applicable_setups} onChange={e => setPackageForm({ ...packageForm, applicable_setups: e.target.value })} placeholder="Applicable setup notes, one per line" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <select value={packageForm.security_type} onChange={e => setPackageForm({ ...packageForm, security_type: e.target.value, security_label: e.target.value === 'contingency' ? '10% Contingency' : 'Php 1,500 Cash Bond' })} className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100">
                                                            {SECURITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                        </select>
                                                        <input value={packageForm.security_label} onChange={e => setPackageForm({ ...packageForm, security_label: e.target.value })} placeholder="Security label" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <div className="lg:col-span-12 grid grid-cols-2 gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 md:grid-cols-5">
                                                            {[
                                                                ['starter', 'Starters'],
                                                                ['main', 'Main Dish'],
                                                                ['side', 'Sides'],
                                                                ['dessert', 'Dessert'],
                                                                ['drink', 'Refreshments'],
                                                            ].map(([key, label]) => (
                                                                <label key={key} className="text-xs font-black uppercase tracking-wide text-slate-500">
                                                                    {label}
                                                                    <input type="number" min="0" value={packageForm.menu_structure?.[key] ?? 0} onChange={e => setPackageForm({ ...packageForm, menu_structure: { ...(packageForm.menu_structure || {}), [key]: Number(e.target.value || 0) } })} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold normal-case outline-none focus:ring-2 focus:ring-indigo-100" />
                                                                </label>
                                                            ))}
                                                        </div>
                                                        {editingPackageId && <button type="button" onClick={resetPackageForm} className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel Package Edit</button>}
                                                    </div>
                                                </form>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500">
                                                            <tr>
                                                                <th className="px-6 py-4 text-left">Package</th>
                                                                <th className="px-6 py-4 text-left">Event Type</th>
                                                                <th className="px-6 py-4 text-left">Category</th>
                                                                <th className="px-6 py-4 text-left">Connected To</th>
                                                                <th className="px-6 py-4 text-right">Price / Head</th>
                                                                <th className="px-6 py-4 text-right">Min Pax</th>
                                                                <th className="px-6 py-4 text-left">Description</th>
                                                                <th className="px-6 py-4 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {paginatedPackages.items.map(pkg => (
                                                                <tr key={pkg.id} className="hover:bg-gray-50">
                                                                    <td className="px-6 py-4 font-bold text-gray-900">{pkg.name}</td>
                                                                    <td className="px-6 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black uppercase text-indigo-700">{eventTypes.find(type => type.slug === pkg.type)?.label || pkg.type}</span></td>
                                                                    <td className="px-6 py-4 text-gray-600">{getCategoryLabel(pkg.package_category)}</td>
                                                                    <td className="px-6 py-4 text-gray-600">{(pkg.event_type_slugs || [pkg.type]).map(slug => eventTypes.find(type => type.slug === slug)?.label || slug).join(', ')}</td>
                                                                    <td className="px-6 py-4 text-right font-bold text-gray-900">PHP {Number(pkg.base_price_per_head || 0).toLocaleString()}</td>
                                                                    <td className="px-6 py-4 text-right text-gray-600">{pkg.minimum_pax}</td>
                                                                    <td className="px-6 py-4 text-gray-600">{pkg.description || 'No description'}</td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        <button type="button" onClick={() => startEditingPackage(pkg)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-700 border border-gray-200 hover:bg-gray-50">Edit</button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <PaginationControls pageInfo={paginatedPackages} onPageChange={setPackagePage} />
                                            </div>
                                        )}

                                        {activeConfigTab === 'eventTypes' && (
                                            <div>
                                                <form onSubmit={handleEventTypeSubmit} className="border-b border-gray-100 p-6">
                                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                                                        <input required value={eventTypeForm.label} onChange={e => setEventTypeForm({ ...eventTypeForm, label: e.target.value })} placeholder="Event type name" className="lg:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <input value={eventTypeForm.slug} onChange={e => setEventTypeForm({ ...eventTypeForm, slug: e.target.value })} placeholder="Short name (optional)" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <input value={eventTypeForm.icon} onChange={e => setEventTypeForm({ ...eventTypeForm, icon: e.target.value })} placeholder="Icon name" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <input value={eventTypeForm.image} onChange={e => setEventTypeForm({ ...eventTypeForm, image: e.target.value })} placeholder="Image link" className="lg:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <button disabled={packageSaving} className="lg:col-span-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{packageSaving ? 'Saving...' : editingEventTypeId ? 'Save Type' : 'Create Type'}</button>
                                                        <select value={eventTypeForm.package_category} onChange={e => setEventTypeForm({ ...eventTypeForm, package_category: e.target.value })} className="lg:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100">
                                                            {PACKAGE_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                        </select>
                                                        <select value={eventTypeForm.security_type} onChange={e => setEventTypeForm({ ...eventTypeForm, security_type: e.target.value, security_label: e.target.value === 'contingency' ? '10% Contingency' : 'Php 1,500 Cash Bond' })} className="lg:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100">
                                                            {SECURITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                        </select>
                                                        <input value={eventTypeForm.security_label} onChange={e => setEventTypeForm({ ...eventTypeForm, security_label: e.target.value })} placeholder="Security label" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <textarea value={eventTypeForm.description} onChange={e => setEventTypeForm({ ...eventTypeForm, description: e.target.value })} placeholder="Description" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <textarea value={eventTypeForm.applicable_setups} onChange={e => setEventTypeForm({ ...eventTypeForm, applicable_setups: e.target.value })} placeholder="Applicable setups, one per line" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        <textarea value={eventTypeForm.security_description} onChange={e => setEventTypeForm({ ...eventTypeForm, security_description: e.target.value })} placeholder="Security term explanation" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                        {editingEventTypeId && <button type="button" onClick={resetEventTypeForm} className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel Edit</button>}
                                                    </div>
                                                </form>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500">
                                                            <tr>
                                                                <th className="px-6 py-4 text-left">Event Type</th>
                                                                <th className="px-6 py-4 text-left">Short Name</th>
                                                                <th className="px-6 py-4 text-left">Category</th>
                                                                <th className="px-6 py-4 text-left">Security</th>
                                                                <th className="px-6 py-4 text-left">Icon</th>
                                                                <th className="px-6 py-4 text-left">Description</th>
                                                                <th className="px-6 py-4 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {paginatedEventTypes.items.map(type => (
                                                                <tr key={type.id} className="hover:bg-gray-50">
                                                                    <td className="px-6 py-4 font-bold text-gray-900">{type.label}</td>
                                                                    <td className="px-6 py-4"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black uppercase text-gray-700">{type.slug}</span></td>
                                                                    <td className="px-6 py-4 text-gray-600">{getCategoryLabel(type.package_category)}</td>
                                                                    <td className="px-6 py-4 text-gray-600">{type.security_label || getSecurityLabel(type.security_type)}</td>
                                                                    <td className="px-6 py-4 text-gray-600">{type.icon}</td>
                                                                    <td className="px-6 py-4 text-gray-600">{type.description || 'No description'}</td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        <button onClick={() => startEditingEventType(type)} className="mr-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-700 border border-gray-200 hover:bg-gray-50">Edit</button>
                                                                        <button onClick={() => handleDeleteEventType(type)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100">Delete</button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <PaginationControls pageInfo={paginatedEventTypes} onPageChange={setEventTypePage} />
                                            </div>
                                        )}

                                        {activeConfigTab === 'menuItems' && (
                                            <div>
                                                <div className="flex flex-col gap-4 border-b border-gray-100 p-6 lg:flex-row lg:items-center lg:justify-between">
                                                    <nav className="flex gap-2 overflow-x-auto">
                                                        {MENU_CATEGORIES.map(category => (
                                                            <button key={category} onClick={() => setActiveMenuCategory(category)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold capitalize transition-colors ${activeMenuCategory === category ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                                                {category}
                                                            </button>
                                                        ))}
                                                    </nav>
                                                    <button onClick={openMenuItemModal} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">Add Menu Item</button>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500">
                                                            <tr>
                                                                <th className="px-6 py-4 text-left">Menu Item</th>
                                                                <th className="px-6 py-4 text-left">Category</th>
                                                                <th className="px-6 py-4 text-right">Current Price</th>
                                                                <th className="px-6 py-4 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {paginatedMenuItems.items.map(item => {
                                                                return (
                                                                    <tr key={item.id} className="hover:bg-gray-50">
                                                                        <td className="px-6 py-4">
                                                                            <div className="flex items-center gap-3">
                                                                                <img src={item.image} alt={item.name} className="h-12 w-12 rounded-lg object-cover ring-1 ring-gray-200" />
                                                                                <div className="min-w-0">
                                                                                    <div className="font-bold text-gray-900">{item.name}</div>
                                                                                    <div className="line-clamp-1 text-xs text-gray-500">{item.description || 'No description'}</div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4 capitalize text-gray-600">{item.category}</td>
                                                                        <td className="px-6 py-4 text-right font-bold text-gray-900">PHP {Number(item.costPerHead || 0).toLocaleString()}</td>
                                                                        <td className="px-6 py-4 text-right">
                                                                            <button onClick={() => openEditMenuItemModal(item)} className="mr-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">Edit</button>
                                                                            {item._isCustom && <button onClick={() => handleDeleteMenuItem(item._dbId)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100">Delete</button>}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                    {getMergedDishes(activeMenuCategory).length === 0 && <div className="p-8 text-center text-sm text-gray-500">No menu items in this category.</div>}
                                                </div>
                                                <PaginationControls pageInfo={paginatedMenuItems} onPageChange={setMenuItemPage} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="hidden">
                                        {/* Menu Pricing (Custom Pricing) */}
                                        <div className="bg-white shadow overflow-hidden rounded-xl border border-gray-100">
                                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Preset Packages by Event Type</h3>
                                                <p className="text-xs text-gray-500 mt-1">Create reusable package offers for weddings, corporate events, social events, and other inquiries.</p>
                                            </div>
                                            <form onSubmit={handlePackageSubmit} className="p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                                                <input required value={packageForm.name} onChange={e => setPackageForm({ ...packageForm, name: e.target.value })} placeholder="Package name" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                <select required value={packageForm.type} onChange={e => setPackageForm({ ...packageForm, type: e.target.value })} className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100">
                                                    {eventTypes.map(type => <option key={type.id} value={type.slug}>{type.label}</option>)}
                                                </select>
                                                <input required type="number" min="0" value={packageForm.base_price_per_head} onChange={e => setPackageForm({ ...packageForm, base_price_per_head: e.target.value })} placeholder="Price / head" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                <input required type="number" min="1" value={packageForm.minimum_pax} onChange={e => setPackageForm({ ...packageForm, minimum_pax: e.target.value })} placeholder="Min pax" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                <button disabled={packageSaving} className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{packageSaving ? 'Saving...' : 'Create'}</button>
                                                <textarea value={packageForm.description} onChange={e => setPackageForm({ ...packageForm, description: e.target.value })} placeholder="Description" className="md:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                <textarea value={packageForm.inclusions} onChange={e => setPackageForm({ ...packageForm, inclusions: e.target.value })} placeholder="Inclusions, one per line" className="md:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                            </form>
                                            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                                                {packages.map(pkg => (
                                                    <div key={pkg.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                                        <p className="text-xs font-black uppercase text-indigo-500">{pkg.type}</p>
                                                        <h4 className="mt-1 font-bold text-gray-900">{pkg.name}</h4>
                                                        <p className="text-sm text-gray-600">PHP {Number(pkg.base_price_per_head || 0).toLocaleString()} / head · min {pkg.minimum_pax} pax</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-white shadow overflow-hidden rounded-xl border border-gray-100">
                                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Event Types</h3>
                                                <p className="text-xs text-gray-500 mt-1">Create, modify, or delete event categories used by package presets.</p>
                                            </div>
                                            <form onSubmit={handleEventTypeSubmit} className="p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                                                <input required value={eventTypeForm.label} onChange={e => setEventTypeForm({ ...eventTypeForm, label: e.target.value })} placeholder="Event type name" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                <input value={eventTypeForm.slug} onChange={e => setEventTypeForm({ ...eventTypeForm, slug: e.target.value })} placeholder="Short name (optional)" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                <input value={eventTypeForm.icon} onChange={e => setEventTypeForm({ ...eventTypeForm, icon: e.target.value })} placeholder="Icon name" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                <input value={eventTypeForm.image} onChange={e => setEventTypeForm({ ...eventTypeForm, image: e.target.value })} placeholder="Image link" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                <textarea value={eventTypeForm.description} onChange={e => setEventTypeForm({ ...eventTypeForm, description: e.target.value })} placeholder="Description" className="md:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                                                <div className="md:col-span-2 flex gap-2">
                                                    {editingEventTypeId && <button type="button" onClick={resetEventTypeForm} className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>}
                                                    <button disabled={packageSaving} className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{packageSaving ? 'Saving...' : editingEventTypeId ? 'Save Type' : 'Create Type'}</button>
                                                </div>
                                            </form>
                                            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                                                {eventTypes.map(type => (
                                                    <div key={type.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                                        <p className="text-xs font-black uppercase text-indigo-500">{type.slug}</p>
                                                        <h4 className="mt-1 font-bold text-gray-900">{type.label}</h4>
                                                        <p className="text-sm text-gray-600 line-clamp-2">{type.description || 'No description'}</p>
                                                        <div className="mt-3 flex gap-2">
                                                            <button onClick={() => startEditingEventType(type)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-700 border border-gray-200 hover:bg-gray-50">Edit</button>
                                                            <button onClick={() => handleDeleteEventType(type)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100">Delete</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-white shadow overflow-hidden rounded-xl border border-gray-100">
                                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Menu Items (Premium Add-ons)</h3>
                                            </div>
                                            <div className="border-b border-gray-100 px-6 pt-2">
                                                <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                                                    {MENU_CATEGORIES.map(category => (
                                                        <button
                                                            key={category}
                                                            onClick={() => setActiveMenuCategory(category)}
                                                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm capitalize transition-colors ${activeMenuCategory === category ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                                        >
                                                            {category}
                                                        </button>
                                                    ))}
                                                </nav>
                                            </div>
                                            <div className="p-6 bg-gray-50">
                                                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm animate-fadeIn">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                            {getMergedDishes(activeMenuCategory).map(item => {
                                                                const overrideId = `dish_${item.id}`;
                                                                const currentPrice = pricingOverrides[overrideId] !== undefined ? pricingOverrides[overrideId] : item.costPerHead;

                                                                return (
                                                                    <div key={item.id} className="overflow-hidden border border-gray-200 rounded-2xl bg-white flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-md relative group">
                                                                        {/* Delete button for custom items */}
                                                                        {item._isCustom && (
                                                                            <button
                                                                                onClick={() => handleDeleteMenuItem(item._dbId)}
                                                                                className="absolute top-3 left-3 z-20 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                                                title="Delete this menu item"
                                                                            >
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                            </button>
                                                                        )}
                                                                        <div className="h-48 w-full relative">
                                                                            <img src={item.image} alt={item.name} className="object-cover w-full h-full" />
                                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                                                            {item._isCustom && (
                                                                                <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded shadow-lg uppercase tracking-wider border border-emerald-400">
                                                                                    Custom Item
                                                                                </div>
                                                                            )}
                                                                            {!item._isCustom && pricingOverrides[overrideId] !== undefined && (
                                                                                <div className="absolute top-3 right-3 bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded shadow-lg uppercase tracking-wider border border-indigo-400">
                                                                                    Custom Price
                                                                                </div>
                                                                            )}
                                                                            <h5 className="absolute bottom-3 left-4 right-4 font-bold text-white text-lg leading-tight text-shadow-sm">{item.name}</h5>
                                                                        </div>
                                                                        <div className="p-5 flex flex-col flex-grow bg-white">
                                                                            <p className="text-sm text-gray-500 mb-4 flex-grow line-clamp-2">{item.description}</p>
                                                                            
                                                                            <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
                                                                                <div className="flex-1 flex items-center bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 focus-within:bg-white transition-all shadow-inner">
                                                                                    <span className="text-gray-400 font-bold text-base mr-1">+₱</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        id={`price_input_${item.id}`}
                                                                                        defaultValue={currentPrice}
                                                                                        className="w-full text-base font-bold text-gray-900 bg-transparent outline-none"
                                                                                    />
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const el = document.getElementById(`price_input_${item.id}`);
                                                                                        handlePricingUpdate('dish', item.id, el.value);
                                                                                    }}
                                                                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shadow-md hover:shadow-lg active:transform active:scale-95"
                                                                                >
                                                                                    Save
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {getMergedDishes(activeMenuCategory).length === 0 && (
                                                                <div className="text-sm text-gray-400 italic">No items in this category.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                            </div>
                                        </div>
                                    </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    {
                        activeTab === 'reports' && (
                            <div className="animate-fadeIn admin-report-page">
                                <section className="admin-report-setup admin-report-setup-compact">
                                    <div className="admin-report-setup-summary">
                                        <div>
                                            <p className="admin-kicker">Report setup</p>
                                            <h3 className="mt-1 text-lg font-black text-gray-950">{reportBuilder.name || 'Untitled report'}</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">{reportBuilder.description || 'Choose blocks, apply filters, then export.'}</p>
                                        </div>
                                        <div className="admin-report-filter-chips">
                                            {Object.entries(reportBuilder.filters || {}).filter(([, value]) => value).slice(0, 3).map(([key, value]) => (
                                                <span key={key}>{humanizeReportKey(key)}: {value}</span>
                                            ))}
                                            {!Object.values(reportBuilder.filters || {}).some(Boolean) && <span>No filters applied</span>}
                                        </div>
                                        <div className="admin-report-summary-actions">
                                            <button type="button" onClick={() => setReportSetupOpen(open => !open)} className="admin-button-secondary px-4 py-2 text-sm font-black">
                                                {reportSetupOpen ? 'Hide Details' : 'Edit Report'}
                                            </button>
                                            <button type="button" onClick={createNewSavedReport} className="admin-button-secondary px-4 py-2 text-sm font-black">New Report</button>
                                        </div>
                                    </div>

                                    {reportSetupOpen && (
                                    <div className="mt-5">
                                    <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1.5fr]">
                                        <label className="admin-field-label">
                                            Saved report
                                            <select value={reportTemplateId} onChange={(e) => loadReportTemplate(e.target.value)} className="admin-input mt-2">
                                                <option value="">Unsaved report</option>
                                                {reportTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
                                            </select>
                                        </label>
                                        <label className="admin-field-label">
                                            Report name
                                            <input value={reportBuilder.name} onChange={(e) => setReportBuilder({ ...reportBuilder, name: e.target.value })} className="admin-input mt-2" />
                                        </label>
                                        <label className="admin-field-label">
                                            Short description
                                            <input value={reportBuilder.description} onChange={(e) => setReportBuilder({ ...reportBuilder, description: e.target.value })} className="admin-input mt-2" />
                                        </label>
                                    </div>
                                    <div className="admin-report-manage-actions">
                                        <button type="button" onClick={createNewSavedReport} className="admin-mini-button">Start New</button>
                                        <button type="button" onClick={duplicateSavedReport} className="admin-mini-button" disabled={!reportTemplateId}>Save As Copy</button>
                                        <button type="button" onClick={deleteSavedReport} className="admin-mini-button admin-mini-button-danger" disabled={!reportTemplateId}>Delete Saved Report</button>
                                    </div>
                                    <div className="admin-report-filter-grid">
                                        <label className="admin-field-label">
                                            From
                                            <input type="date" value={reportBuilder.filters.date_from || ''} onChange={(e) => updateReportFilter('date_from', e.target.value)} className="admin-input mt-2" />
                                        </label>
                                        <label className="admin-field-label">
                                            To
                                            <input type="date" value={reportBuilder.filters.date_to || ''} onChange={(e) => updateReportFilter('date_to', e.target.value)} className="admin-input mt-2" />
                                        </label>
                                        <label className="admin-field-label">
                                            Booking status
                                            <input list="report-booking-status-options" value={reportBuilder.filters.booking_status || ''} onChange={(e) => updateReportFilter('booking_status', e.target.value)} placeholder="All booking statuses" className="admin-input mt-2" />
                                        </label>
                                        <label className="admin-field-label">
                                            Payment status
                                            <input list="report-payment-status-options" value={reportBuilder.filters.payment_status || ''} onChange={(e) => updateReportFilter('payment_status', e.target.value)} placeholder="All payment statuses" className="admin-input mt-2" />
                                        </label>
                                        <label className="admin-field-label">
                                            City
                                            <input list="report-city-options" value={reportBuilder.filters.city || ''} onChange={(e) => updateReportFilter('city', e.target.value)} placeholder="All cities" className="admin-input mt-2" />
                                        </label>
                                        <datalist id="report-booking-status-options">
                                            {reportBookingStatusOptions.map(option => <option key={option} value={option} />)}
                                        </datalist>
                                        <datalist id="report-payment-status-options">
                                            {reportPaymentStatusOptions.map(option => <option key={option} value={option} />)}
                                        </datalist>
                                        <datalist id="report-city-options">
                                            {reportCityOptions.map(option => <option key={option} value={option} />)}
                                        </datalist>
                                    </div>
                                    </div>
                                    )}
                                </section>

                                <div className="admin-report-actions">
                                    <div className="admin-report-view-toggle">
                                        <button type="button" onClick={() => setReportView('build')} className={reportView === 'build' ? 'is-active' : ''}>Build</button>
                                        <button type="button" onClick={previewReport} className={reportView === 'preview' ? 'is-active' : ''}>Preview</button>
                                    </div>
                                    <button onClick={saveReportTemplate} disabled={reportSaving} className="admin-button-secondary px-5 py-2.5 text-sm font-black">{reportSaving ? 'Saving...' : 'Save Report'}</button>
                                    <button onClick={() => runReportExport('csv')} className="admin-button-secondary px-5 py-2.5 text-sm font-black">Download Spreadsheet</button>
                                    <button onClick={() => runReportExport('pdf')} className="admin-button-secondary px-5 py-2.5 text-sm font-black">Download PDF</button>
                                </div>

                                <div className={`admin-report-workspace ${reportLibraryCollapsed ? 'is-library-collapsed' : ''}`}>
                                    <aside
                                        className={`admin-report-rail ${reportLibraryCollapsed ? 'is-collapsed' : ''} ${reportLibraryDropActive ? 'is-drop-active' : ''}`}
                                        onDragOver={(event) => {
                                            if (Number.isInteger(reportDraggedIndex)) {
                                                event.preventDefault();
                                                setReportLibraryDropActive(true);
                                            }
                                        }}
                                        onDragLeave={() => setReportLibraryDropActive(false)}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            removeDraggedReportWidget();
                                        }}
                                    >
                                        <div className="admin-report-rail-head">
                                            <div>
                                                <p className="admin-kicker">1. Choose blocks</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Report Library</h3>
                                                {!reportLibraryCollapsed && <p className="mt-1 text-sm font-semibold text-gray-500">Drag blocks into the report canvas.</p>}
                                            </div>
                                            <button type="button" onClick={() => setReportLibraryCollapsed(collapsed => !collapsed)} className="admin-mini-button">
                                                {reportLibraryCollapsed ? 'Open' : 'Collapse'}
                                            </button>
                                        </div>
                                        {!reportLibraryCollapsed && (
                                        <div className="admin-report-library-drop">Drop used blocks here to remove them</div>
                                        )}
                                        {!reportLibraryCollapsed && (
                                        <div className="mt-4 grid gap-2">
                                            {visibleReportLibraryWidgets.map(widget => {
                                                const selected = reportBuilder.widgets.includes(widget.id);
                                                return (
                                                    <button
                                                        key={widget.id}
                                                        type="button"
                                                        draggable={!selected}
                                                        disabled={selected}
                                                        onDragStart={() => {
                                                            if (!selected) {
                                                                setReportDraggedWidgetId(widget.id);
                                                                setReportDraggedIndex(null);
                                                            }
                                                        }}
                                                        onDragEnd={() => {
                                                            setReportDraggedWidgetId(null);
                                                            setReportDropIndex(null);
                                                        }}
                                                        onClick={() => {
                                                            const nextBuilder = { ...reportBuilder, widgets: [...reportBuilder.widgets, widget.id] };
                                                            setReportBuilder(nextBuilder);
                                                            scheduleReportPreview({ builder: nextBuilder });
                                                        }}
                                                        className={`admin-report-widget ${selected ? 'admin-report-widget-selected' : ''}`}
                                                    >
                                                        <span>
                                                            {widget.name}
                                                            <small>{widget.category}</small>
                                                        </span>
                                                        <strong>{selected ? 'Used' : 'Drag'}</strong>
                                                    </button>
                                                );
                                            })}
                                            {reportWidgets.length > 6 && (
                                                <button type="button" onClick={() => setReportLibraryExpanded(expanded => !expanded)} className="admin-report-library-more">
                                                    {reportLibraryExpanded ? 'Show less' : `See all ${reportWidgets.length} blocks`}
                                                </button>
                                            )}
                                        </div>
                                        )}
                                    </aside>

                                    <section className="admin-report-main">
                                        <div className="admin-report-canvas-head">
                                            <div>
                                                <p className="admin-kicker">{reportView === 'preview' ? 'Report preview' : 'Report canvas'}</p>
                                                <h3 className="mt-1 text-xl font-black text-gray-950">{reportView === 'preview' ? reportBuilder.name || 'Preview' : 'Arrange Selected Blocks'}</h3>
                                                <p className="mt-1 text-sm font-semibold text-gray-500">
                                                    {reportView === 'preview'
                                                        ? 'This is how the report will read before you download or save it.'
                                                        : 'Drag blocks to reorder them, or use the move buttons for precise control.'}
                                                </p>
                                            </div>
                                            <div className="admin-report-canvas-tools">
                                                <span>{reportBuilder.widgets.length} blocks</span>
                                            </div>
                                        </div>

                                        {reportView === 'build' ? (
                                        <div
                                            className={`admin-report-canvas-body ${reportDraggedWidgetId !== null || reportDraggedIndex !== null ? 'is-drop-ready' : ''}`}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                if (!reportBuilder.widgets.length) setReportDropIndex(0);
                                            }}
                                            onDrop={() => handleReportDrop(reportBuilder.widgets.length)}
                                        >
                                            <div className="mt-4 space-y-2">
                                                <div
                                                    className={`admin-report-drop-zone ${reportDropIndex === 0 ? 'is-active' : ''}`}
                                                    onDragOver={(event) => {
                                                        event.preventDefault();
                                                        setReportDropIndex(0);
                                                    }}
                                                    onDrop={(event) => {
                                                        event.stopPropagation();
                                                        handleReportDrop(0);
                                                    }}
                                                />
                                                {visibleReportWidgetIds.map((id, visibleIndex) => {
                                                    const index = reportCanvasOffset + visibleIndex;
                                                    const meta = reportWidgets.find(widget => widget.id === id) || { name: id, category: 'Custom' };
                                                    return (
                                                        <React.Fragment key={`${id}-${index}`}>
                                                        <div
                                                            className={`admin-report-selected-row ${reportDraggedIndex === index ? 'is-dragging' : ''}`}
                                                            draggable
                                                            onDragStart={() => {
                                                                setReportDraggedIndex(index);
                                                                setReportDraggedWidgetId(null);
                                                            }}
                                                            onDragOver={(event) => {
                                                                event.preventDefault();
                                                                setReportDropIndex(index);
                                                            }}
                                                            onDrop={(event) => {
                                                                event.stopPropagation();
                                                                handleReportDrop(index);
                                                            }}
                                                            onDragEnd={() => {
                                                                setReportDraggedIndex(null);
                                                                setReportDropIndex(null);
                                                            }}
                                                        >
                                                            <div>
                                                                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Block {index + 1} - {meta.category}</p>
                                                                <p className="mt-1 font-black text-gray-950">{meta.name}</p>
                                                                {meta.description && <p className="mt-1 text-sm font-semibold text-gray-500">{meta.description}</p>}
                                                            </div>
                                                            <div className="flex flex-wrap justify-end gap-2">
                                                                <button onClick={() => moveReportWidget(index, -1)} className="admin-mini-button">Up</button>
                                                                <button onClick={() => moveReportWidget(index, 1)} className="admin-mini-button">Down</button>
                                                                <button
                                                                    onClick={() => {
                                                                        const nextBuilder = { ...reportBuilder, widgets: reportBuilder.widgets.filter((_, itemIndex) => itemIndex !== index) };
                                                                        setReportBuilder(nextBuilder);
                                                                        scheduleReportPreview({ builder: nextBuilder });
                                                                    }}
                                                                    className="admin-mini-button admin-mini-button-danger"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`admin-report-drop-zone ${reportDropIndex === index + 1 ? 'is-active' : ''}`}
                                                            onDragOver={(event) => {
                                                                event.preventDefault();
                                                                setReportDropIndex(index + 1);
                                                            }}
                                                            onDrop={(event) => {
                                                                event.stopPropagation();
                                                                handleReportDrop(index + 1);
                                                            }}
                                                        />
                                                        </React.Fragment>
                                                    );
                                                })}
                                                {!reportBuilder.widgets.length && <div className="admin-empty-state">Choose at least one block to build a report.</div>}
                                            </div>
                                        </div>
                                        ) : (
                                        <div className="admin-report-preview-canvas">
                                            <div className="space-y-4">
                                                {reportPreview.map(widget => {
                                                    const meta = reportWidgets.find(item => item.id === widget.id) || { name: widget.id };
                                                    const data = widget.data || {};
                                                    const rows = widget.data?.rows || [];
                                                    const summaryMetrics = getReportSummaryMetrics(data);
                                                    return (
                                                        <div key={widget.id} className="admin-report-preview-block">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="font-black text-gray-950">{meta.name}</p>
                                                                    <p className="mt-1 text-xs font-semibold text-gray-500">{widget.data?.action || summarizeReportWidget(widget)}</p>
                                                                </div>
                                                                {!!rows.length && <span className="text-xs font-black uppercase tracking-wider text-[#9f6500]">{summarizeReportWidget(widget)}</span>}
                                                            </div>
                                                            {summaryMetrics.length > 0 && (
                                                                <div className="admin-report-metric-grid">
                                                                    {summaryMetrics.map(metric => (
                                                                        <div key={`${widget.id}-${metric.label}`} className="admin-report-metric">
                                                                            <span>{metric.label}</span>
                                                                            <strong>{metric.value}</strong>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {rows.length > 0 && (
                                                                <div className="mt-3 divide-y divide-gray-100">
                                                                    {rows.slice(0, 12).map((row, i) => (
                                                                        <div key={i} className="flex items-center justify-between gap-3 py-2">
                                                                            <span className="text-xs font-bold text-gray-700">{row.label || row.client || row.date || 'Row'}</span>
                                                                            <span className="text-xs font-black text-gray-950">{row.total ? formatCurrency(row.total) : row.value ? formatCurrency(row.value) : row.revenue ? formatCurrency(row.revenue) : row.count ?? row.selections ?? row.pax ?? ''}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {!reportPreview.length && <div className="admin-empty-state">Preview your report to check the result before saving or downloading.</div>}
                                            </div>
                                        </div>
                                        )}
                                    </section>
                                </div>
                            </div>
                        )
                    }
                    {activeTab === 'content' && (
                        <Suspense fallback={<div className="rounded-2xl border border-[#ead8cc] bg-white p-6 text-sm font-bold text-slate-500">Loading content tools...</div>}>
                            <AnnouncementManager variant="admin" user={user} />
                        </Suspense>
                    )}
                    {activeTab === 'profile' && (
                        <div className="animate-fadeIn admin-profile-page">
                            <section className="admin-profile-identity">
                                <div className="admin-profile-avatar">
                                    {user?.username?.charAt(0).toUpperCase() || 'A'}
                                </div>
                                <div>
                                    <p className="admin-kicker">Administrator</p>
                                    <h3 className="mt-1 text-2xl font-black text-gray-950">{user?.username || 'Admin user'}</h3>
                                    <p className="mt-1 text-sm font-semibold text-gray-500">{user?.email || 'No email saved'}</p>
                                </div>
                            </section>

                            <form onSubmit={submitProfile} className="admin-profile-form">
                                <div>
                                    <p className="admin-kicker">Account details</p>
                                    <h3 className="mt-1 text-xl font-black text-gray-950">Profile Settings</h3>
                                    <p className="mt-1 text-sm font-semibold text-gray-500">Keep the admin contact information accurate for system records.</p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="admin-field-label">
                                        Username
                                        <input value={profileForm.username} onChange={(event) => updateProfileField('username', event.target.value)} className="admin-input mt-2" />
                                        {profileErrors.username && <span className="admin-field-error">{profileErrors.username}</span>}
                                    </label>
                                    <label className="admin-field-label">
                                        Email address
                                        <input type="email" value={profileForm.email} onChange={(event) => updateProfileField('email', event.target.value)} className="admin-input mt-2" />
                                        {profileErrors.email && <span className="admin-field-error">{profileErrors.email}</span>}
                                    </label>
                                    <label className="admin-field-label">
                                        Phone number
                                        <input value={profileForm.phone} onChange={(event) => updateProfileField('phone', event.target.value)} className="admin-input mt-2" />
                                        {profileErrors.phone && <span className="admin-field-error">{profileErrors.phone}</span>}
                                    </label>
                                    <div className="hidden md:block" />
                                    <label className="admin-field-label">
                                        Current password
                                        <input type="password" value={profileForm.current_password} onChange={(event) => updateProfileField('current_password', event.target.value)} placeholder="Only needed to change password" className="admin-input mt-2" />
                                        {profileErrors.current_password && <span className="admin-field-error">{profileErrors.current_password}</span>}
                                    </label>
                                    <label className="admin-field-label">
                                        New password
                                        <input type="password" value={profileForm.new_password} onChange={(event) => updateProfileField('new_password', event.target.value)} placeholder="Leave blank to keep current" className="admin-input mt-2" />
                                        {profileErrors.new_password && <span className="admin-field-error">{profileErrors.new_password}</span>}
                                    </label>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#720101]/10 pt-5">
                                    <p className="text-sm font-semibold text-gray-500">Password fields can stay blank if you are only updating contact details.</p>
                                    <button type="submit" disabled={profileProcessing} className="admin-button-primary px-5 py-2.5 text-sm font-black">
                                        {profileProcessing ? 'Saving...' : 'Save Profile'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                    {activeTab === 'availability' && (
                        <div className="animate-fadeIn grid gap-6 lg:grid-cols-[1fr_360px]">
                            <form onSubmit={saveAvailabilityOverride} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <p className="admin-kicker">Selected date</p>
                                        <h3 className="mt-1 text-xl font-black text-gray-950">Control daily availability</h3>
                                    </div>
                                    <input type="month" value={availabilityMonth} onChange={(event) => setAvailabilityMonth(event.target.value)} className="admin-input max-w-48" />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Date</span>
                                        <input type="date" value={availabilityDate} onChange={(event) => selectAvailabilityDate(event.target.value)} className="admin-input mt-2" />
                                    </label>
                                    <label className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/50 px-4 py-3">
                                        <input type="checkbox" checked={availabilityForm.is_locked} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, is_locked: event.target.checked }))} className="h-4 w-4" />
                                        <span className="text-sm font-black text-red-800">Fully lock this date</span>
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Remaining event slots</span>
                                        <input type="number" min="0" value={availabilityForm.remaining_events} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, remaining_events: event.target.value }))} className="admin-input mt-2" />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Remaining pax</span>
                                        <input type="number" min="0" value={availabilityForm.remaining_pax} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, remaining_pax: event.target.value }))} className="admin-input mt-2" />
                                    </label>
                                </div>
                                <label className="mt-4 block">
                                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Internal note</span>
                                    <textarea rows={4} value={availabilityForm.note} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, note: event.target.value }))} className="admin-input mt-2" placeholder="Reason for lock or capacity adjustment" />
                                </label>
                                <div className="mt-6 flex flex-wrap justify-end gap-3">
                                    <button type="button" onClick={clearAvailabilityOverride} disabled={availabilitySaving} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-black text-gray-600 hover:bg-gray-50 disabled:opacity-50">Clear Override</button>
                                    <button type="submit" disabled={availabilitySaving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50">{availabilitySaving ? 'Saving...' : 'Save Availability'}</button>
                                </div>
                            </form>

                            <aside className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Month overrides</h3>
                                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{availabilityOverrides.length}</span>
                                </div>
                                {availabilityLoading ? (
                                    <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500">Loading availability...</p>
                                ) : availabilityOverrides.length === 0 ? (
                                    <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500">No overrides for this month.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {availabilityOverrides.map((item) => (
                                            <button key={item.id} type="button" onClick={() => selectAvailabilityDate(item.date)} className={`w-full rounded-xl border p-4 text-left transition ${availabilityDate === item.date ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-gray-50 hover:bg-white'}`}>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-black text-gray-950">{formatDate(item.date)}</span>
                                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${item.is_locked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{item.is_locked ? 'Locked' : 'Limited'}</span>
                                                </div>
                                                <p className="mt-2 text-xs font-bold text-gray-500">{item.remainingEvents} slots / {Number(item.remainingPax || 0).toLocaleString()} pax remaining</p>
                                                {item.note && <p className="mt-2 text-xs font-semibold text-gray-400">{item.note}</p>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </aside>
                        </div>
                    )}
                    {
                        activeTab === 'users' && (
                            <div className="animate-fadeIn">
                                <div className="flex justify-end mb-6">
                                    <button onClick={() => openEmpModal('add')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-colors self-start">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        Add Employee
                                    </button>
                                </div>

                                <div className="space-y-8">
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Staff Users</h3>
                                                <p className="text-xs text-gray-500 mt-1">Marketing and Accounting personnel accounts.</p>
                                            </div>
                                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1">{employees.length} staff</span>
                                        </div>

                                        <div className="bg-white shadow overflow-x-auto sm:rounded-xl border border-gray-100">
                                            {empLoading ? (
                                                <div className="p-8 text-center text-gray-500">Loading staff accounts...</div>
                                            ) : employees.length === 0 ? (
                                                <div className="p-12 text-center text-gray-500">No employee accounts found.</div>
                                            ) : (
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Created</th>
                                                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-100">
                                                        {paginatedEmployees.items.map(emp => (
                                                            <tr key={emp.id} className="hover:bg-gray-50/80 transition-colors">
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center">
                                                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center text-indigo-700 font-bold">
                                                                            {(emp.full_name || emp.username).charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="ml-4">
                                                                            <div className="text-sm font-bold text-gray-900">{emp.full_name || emp.username}</div>
                                                                            <div className="text-xs text-gray-500">@{emp.username}{emp.phone ? ` / ${emp.phone}` : ' / No phone'}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-700">{emp.email || <span className="text-gray-400 italic">No email</span>}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${emp.role === 'Marketing' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
                                                                        {emp.role}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                                        Active
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-500">{formatDate(emp.created_at)}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                    <button onClick={() => openEmpModal('edit', emp)} className="text-indigo-600 hover:text-indigo-900 mr-4 font-semibold">Edit</button>
                                                                    <button onClick={() => handleDeleteEmployee(emp.id)} className="text-red-500 hover:text-red-700 font-semibold">Delete</button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                        {!empLoading && employees.length > 0 && (
                                            <PaginationControls pageInfo={paginatedEmployees} onPageChange={setEmployeePage} />
                                        )}
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Customer Users</h3>
                                                <p className="text-xs text-gray-500 mt-1">Registered client accounts with contact details and booking activity.</p>
                                            </div>
                                            <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded-full px-3 py-1">{customers.length} customers</span>
                                        </div>

                                        <div className="bg-white shadow overflow-x-auto sm:rounded-xl border border-gray-100">
                                            {customerLoading ? (
                                                <div className="p-8 text-center text-gray-500">Loading customer accounts...</div>
                                            ) : customers.length === 0 ? (
                                                <div className="p-12 text-center text-gray-500">No customer accounts found.</div>
                                            ) : (
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Bookings</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Registered</th>
                                                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-100">
                                                        {paginatedCustomers.items.map(customer => (
                                                            <tr key={customer.id} className="hover:bg-gray-50/80 transition-colors">
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center">
                                                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-bold">
                                                                            {customer.username.charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="ml-4">
                                                                            <div className="text-sm font-bold text-gray-900">{customer.username}</div>
                                                                            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                                                                                {customer.role}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm text-gray-700">{customer.email || <span className="text-gray-400 italic">No email</span>}</div>
                                                                    <div className="text-xs text-gray-500 mt-1">{customer.phone || 'No phone'}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm font-bold text-gray-900">{customer.bookings_count || 0}</div>
                                                                    <div className="text-xs text-gray-500">Latest: {formatDate(customer.bookings_max_event_date)}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-500">{formatDate(customer.created_at)}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                    <button onClick={() => openCustomerModal(customer)} className="text-indigo-600 hover:text-indigo-900 mr-4 font-semibold">Edit</button>
                                                                    <button onClick={() => handleDeleteCustomer(customer.id)} className="text-red-500 hover:text-red-700 font-semibold">Delete</button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                        {!customerLoading && customers.length > 0 && (
                                            <PaginationControls pageInfo={paginatedCustomers} onPageChange={setCustomerPage} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    }
                    {
                        activeTab === 'bookings' && (
                            <div className="animate-fadeIn">
                                <div className="mb-6 flex justify-end">
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        {[
                                            { label: 'Current', value: bookingStats.total },
                                            { label: 'Pending', value: bookingStats.pending },
                                            { label: 'Active', value: bookingStats.active },
                                            { label: 'Expected Value', value: formatCurrency(bookingStats.value) },
                                        ].map((stat) => (
                                            <div key={stat.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{stat.label}</p>
                                                <p className="mt-1 text-lg font-black text-gray-900">{stat.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                        <div className="relative flex-1">
                                            <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <input
                                                type="search"
                                                value={bookingSearch}
                                                onChange={(e) => setBookingSearch(e.target.value)}
                                                placeholder="Search booking ref, client, email, phone, event type..."
                                                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                                                {['All', 'Pending', 'Active'].map((filter) => (
                                                    <button
                                                        key={filter}
                                                        type="button"
                                                        onClick={() => setBookingStatusFilter(filter)}
                                                        className={`rounded-md px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${bookingStatusFilter === filter ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                                    >
                                                        {filter}
                                                    </button>
                                                ))}
                                            </div>
                                            <select
                                                value={bookingSort}
                                                onChange={(e) => setBookingSort(e.target.value)}
                                                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                            >
                                                <option value="latest">Latest to Oldest</option>
                                                <option value="oldest">Oldest to Latest</option>
                                                <option value="az">A-Z</option>
                                                <option value="za">Z-A</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white shadow-sm overflow-hidden sm:rounded-xl border border-gray-200">
                                    {bookingsLoading ? (
                                        <div className="p-10 text-center text-sm font-semibold text-gray-500">Loading bookings...</div>
                                    ) : visibleBookings.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                                                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            </div>
                                            <h3 className="text-base font-black text-gray-900">No bookings match this view</h3>
                                            <p className="mt-1 text-sm text-gray-500">Try clearing the search or switching filters.</p>
                                        </div>
                                    ) : (
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Booking</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Event</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-100">
                                                {paginatedBookings.items.map(booking => {
                                                    const status = normalizeStatus(booking.status);
                                                    return (
                                                    <tr key={booking.id} className="hover:bg-gray-50/80 transition-colors cursor-pointer" onClick={() => setEventDetailsModal({ open: true, data: booking })}>
                                                        <td className="px-6 py-4">
                                                            <div className="text-sm font-black text-gray-900">{formatBookingRef(booking.id)}</div>
                                                            <div className="text-xs font-medium text-gray-500">Submitted {formatDate(booking.created_at)}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-sm font-bold text-gray-900">{booking.client_full_name || booking.client_name || booking.username || 'Unnamed client'}</div>
                                                            <div className="text-xs text-gray-500">{booking.client_email || booking.user_email || 'No email'} / {booking.client_phone || booking.user_phone || 'No phone'}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-sm font-bold text-gray-900">{formatDate(booking.event_date)} / {formatTime(booking.event_time)}</div>
                                                            <div className="text-xs text-gray-500">{booking.event_type || 'Event'} / {booking.pax} pax</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-sm font-black text-gray-900">{formatCurrency(getBookingTotal(booking))}</div>
                                                            {Number(booking.discount_value || 0) > 0 && (
                                                                <div className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                                                                    Discounted
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wider ${bookingStatusStyles[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                                                {status === 'confirmed' ? 'Active' : booking.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex justify-end gap-2">
                                                                {status === 'pending' && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleApproveBooking(booking);
                                                                        }}
                                                                        disabled={approvingBookingId === booking.id}
                                                                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
                                                                    >
                                                                        {approvingBookingId === booking.id ? 'Approving...' : 'Approve'}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDiscountForm({ discount_type: booking.discount_type || 'fixed', discount_value: booking.discount_value || 0 });
                                                                        setDiscountModal({ open: true, data: booking });
                                                                    }}
                                                                    className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 transition-colors hover:bg-indigo-100"
                                                                >
                                                                    Discount
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                                {!bookingsLoading && visibleBookings.length > 0 && (
                                    <PaginationControls pageInfo={paginatedBookings} onPageChange={setBookingPage} />
                                )}
                            </div>
                        )
                    }
                    {activeTab === 'preparation' && (
                        <Suspense fallback={<div className="rounded-2xl border border-[#ead8cc] bg-white p-6 text-sm font-bold text-slate-500">Loading preparation board...</div>}>
                            <PreparationBoard />
                        </Suspense>
                    )}
                    {
                        activeTab === 'refunds' && (
                            <div className="animate-fadeIn space-y-5">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                    {[
                                        { label: 'Queued Cases', value: refundStats.count },
                                        { label: 'Paid Exposure', value: formatCurrency(refundStats.paid) },
                                        { label: 'Reservation Fees', value: formatCurrency(refundStats.fees) },
                                        { label: 'Refundable', value: formatCurrency(refundStats.refundable) },
                                    ].map((stat) => (
                                        <div key={stat.label} className="admin-metric-card px-5 py-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                                            <p className="mt-1 text-xl font-black text-gray-950">{stat.value}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="admin-panel overflow-hidden">
                                    <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="text-base font-black text-gray-950">Cancelled bookings with refundable payments</h3>
                                            <p className="mt-1 text-sm font-medium text-gray-500">Refunds retain the non-refundable 10% reservation fee and update the payment records.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { bustAdminCache('/api/admin/refunds/queue'); fetchRefundQueue(); }}
                                            className="admin-button-secondary px-4 py-2 text-sm font-bold"
                                        >
                                            Refresh Queue
                                        </button>
                                    </div>

                                    {refundLoading ? (
                                        <div className="p-10 text-center text-sm font-semibold text-gray-500">Loading refund queue...</div>
                                    ) : refundQueue.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                                                <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <h3 className="text-base font-black text-gray-900">No refunds waiting</h3>
                                            <p className="mt-1 text-sm text-gray-500">Cancelled bookings with verified payments will appear here.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-100">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Booking</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Client</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Event Date</th>
                                                        <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Paid</th>
                                                        <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Refund</th>
                                                        <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 bg-white">
                                                    {refundQueue.map((item) => {
                                                        const totalPaid = Number(item.total_paid || 0);
                                                        const penalty = totalPaid * 0.1;
                                                        const refundAmount = Math.max(totalPaid - penalty, 0);

                                                        return (
                                                            <tr key={item.booking_id} className="transition-colors hover:bg-gray-50">
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm font-black text-gray-900">{formatBookingRef(item.booking_id)}</div>
                                                                    <div className="text-xs font-medium text-gray-500">Cancelled booking</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm font-bold text-gray-900">{item.client_full_name || 'Unnamed client'}</div>
                                                                    <div className="text-xs text-gray-500">{item.client_email || 'No email'}</div>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm font-bold text-gray-700">{formatDate(item.event_date)}</td>
                                                                <td className="px-6 py-4 text-right text-sm font-black text-gray-900">{formatCurrency(totalPaid)}</td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <div className="text-sm font-black text-[#720101]">{formatCurrency(refundAmount)}</div>
                                                                    <div className="text-xs font-semibold text-gray-400">{formatCurrency(penalty)} retained</div>
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleProcessRefund(item.booking_id)}
                                                                        disabled={processingRefundId === item.booking_id}
                                                                        className="rounded-lg bg-[#720101] px-4 py-2 text-xs font-black text-white transition-colors hover:bg-[#5f0101] disabled:opacity-60"
                                                                    >
                                                                        {processingRefundId === item.booking_id ? 'Processing...' : 'Process Refund'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }
                    {
                        activeTab === 'audits' && (
                            <div className="animate-fadeIn space-y-5">
                                <div className="flex justify-end">
                                    <button onClick={() => { bustAdminCache('/api/admin/audits?per_page=100'); fetchAudits(); }} className="admin-button-secondary px-4 py-2 text-sm font-bold">
                                        Refresh Logs
                                    </button>
                                </div>

                                <div className="admin-panel p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                        <div className="relative flex-1">
                                            <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <input value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder="Search user, action, route, or method..." className="w-full border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                                        </div>
                                        <select value={auditRoleFilter} onChange={(e) => setAuditRoleFilter(e.target.value)} className="admin-select px-4 py-3 text-sm font-bold outline-none">
                                            <option value="All">All Roles</option>
                                            <option value="Admin">Admin</option>
                                            <option value="Marketing">Marketing</option>
                                            <option value="Accounting">Accounting</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="admin-panel overflow-hidden">
                                    {auditLoading ? (
                                        <div className="p-10 text-center text-sm font-semibold text-gray-500">Loading audit trail...</div>
                                    ) : visibleAudits.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <h3 className="text-base font-black text-gray-900">No audit activity yet</h3>
                                            <p className="mt-1 text-sm text-gray-500">Staff activity will appear here as admins, marketing, and accounting users work in the system.</p>
                                        </div>
                                    ) : (
                                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                                            <thead>
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Time</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Staff</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Route</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {paginatedAudits.items.map((audit) => (
                                                    <tr key={audit.id}>
                                                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-700">{formatDateTime(audit.created_at)}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-black text-gray-900">{audit.username || 'Unknown'}</div>
                                                            <div className="text-xs font-bold text-[#720101]">{audit.role || 'Staff'}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-gray-900">{audit.action}</div>
                                                            <div className="mt-1 text-xs text-gray-500">{audit.method}</div>
                                                        </td>
                                                        <td className="px-6 py-4 max-w-sm">
                                                            <code className="rounded bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">{audit.path}</code>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${Number(audit.status_code) >= 400 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                {audit.status_code || 'OK'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                                {!auditLoading && visibleAudits.length > 0 && (
                                    <PaginationControls pageInfo={paginatedAudits} onPageChange={setAuditPage} />
                                )}
                            </div>
                        )
                    }
                </div >
            </main >

            {/* Employee Add/Edit Modal */}
            {
                empModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEmpModal({ open: false, mode: 'add', data: null })}></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="text-lg font-bold text-gray-900">
                                    {empModal.mode === 'add' ? 'Provision New Account' : empModal.data?.role === 'Client' ? 'Modify Customer Account' : 'Modify Staff Credentials'}
                                </h3>
                            </div>
                            <form onSubmit={handleEmpSubmit} className="p-6">
                                <div className="space-y-4">
                                    {empModal.data?.role !== 'Client' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Full Name</label>
                                            <input type="text" required value={empForm.full_name} onChange={e => setEmpForm({ ...empForm, full_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium" />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Username</label>
                                        <input type="text" required value={empForm.username} onChange={e => setEmpForm({ ...empForm, username: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Email (Optional)</label>
                                            <input type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Phone (Optional)</label>
                                            <input type="text" value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" />
                                        </div>
                                    </div>
                                    {empModal.mode === 'add' && empModal.data?.role !== 'Client' && (
                                        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">
                                            Default password: eloquestaff@2026
                                        </div>
                                    )}
                                    {empModal.mode === 'edit' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">New Password</label>
                                            <input type="text" minLength="6" value={empForm.password} onChange={e => setEmpForm({ ...empForm, password: e.target.value })} placeholder="Leave blank to keep current" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Privilege Level</label>
                                        {empModal.data?.role === 'Client' ? (
                                            <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">
                                                Client / Customer
                                            </div>
                                        ) : (
                                            <select value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium">
                                                <option value="Marketing">Marketing</option>
                                                <option value="Accounting">Accounting</option>
                                            </select>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-8 flex justify-end gap-3">
                                    <button type="button" onClick={() => setEmpModal({ open: false, mode: 'add', data: null })} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                                    <button type="submit" disabled={empFormLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50">
                                        {empFormLoading ? 'Configuring...' : empModal.mode === 'add' ? 'Create Account' : 'Update Account'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Discount Modal */}
            {
                discountModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setDiscountModal({ open: false, data: null })}></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="text-lg font-bold text-gray-900">Apply Booking Discount</h3>
                                <p className="text-xs text-gray-500 mt-1">{discountModal.data?.client_full_name || discountModal.data?.client_name || discountModal.data?.username}'s Event (#BK-{discountModal.data?.id.toString().padStart(4, '0')})</p>
                            </div>
                            <form onSubmit={handleDiscountSubmit} className="p-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Discount Type</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className={`border rounded-lg p-3 flex cursor-pointer transition-colors ${discountForm.discount_type === 'fixed' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                                <input type="radio" name="discount_type" value="fixed" checked={discountForm.discount_type === 'fixed'} onChange={() => setDiscountForm({ ...discountForm, discount_type: 'fixed' })} className="hidden" />
                                                <div className="font-bold text-sm text-center w-full">Fixed Amount (₱)</div>
                                            </label>
                                            <label className={`border rounded-lg p-3 flex cursor-pointer transition-colors ${discountForm.discount_type === 'percentage' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                                <input type="radio" name="discount_type" value="percentage" checked={discountForm.discount_type === 'percentage'} onChange={() => setDiscountForm({ ...discountForm, discount_type: 'percentage' })} className="hidden" />
                                                <div className="font-bold text-sm text-center w-full">Percentage (%)</div>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Discount Value</label>
                                        <div className="relative">
                                            {discountForm.discount_type === 'fixed' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₱</span>}
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                value={discountForm.discount_value}
                                                onChange={e => setDiscountForm({ ...discountForm, discount_value: parseFloat(e.target.value) || 0 })}
                                                className={`w-full ${discountForm.discount_type === 'fixed' ? 'pl-8' : 'px-4'} py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-lg font-bold`}
                                            />
                                            {discountForm.discount_type === 'percentage' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 flex justify-end gap-3">
                                    <button type="button" onClick={() => setDiscountModal({ open: false, data: null })} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                                    <button type="submit" disabled={discountLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50">
                                        {discountLoading ? 'Applying...' : 'Apply Discount'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Event Details Modal */}
            {
                eventDetailsModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEventDetailsModal({ open: false, data: null })}></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-fadeIn overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Event Intelligence Dashboard</h3>
                                    <p className="text-xs text-gray-500 mt-1">Reference: #BK-{eventDetailsModal.data?.id.toString().padStart(4, '0')}</p>
                                </div>
                                <button onClick={() => setEventDetailsModal({ open: false, data: null })} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8 bg-white">
                                {(() => {
                                    const selectedDishes = getSelectedDishes(eventDetailsModal.data);
                                    return (
                                        <>
                                {/* Core Client Logic */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                                        <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            Client Logic
                                        </h4>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Primary Entity</p>
                                                <p className="text-sm font-semibold text-gray-900">{eventDetailsModal.data?.client_full_name || eventDetailsModal.data?.username || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Contact (Email)</p>
                                                <p className="text-sm text-gray-700">{eventDetailsModal.data?.client_email || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Contact (Phone)</p>
                                                <p className="text-sm text-gray-700">{eventDetailsModal.data?.client_phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Schedule */}
                                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            Schedule
                                        </h4>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Event Date</p>
                                                <p className="text-sm font-semibold text-gray-900">{eventDetailsModal.data?.event_date}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Start Time</p>
                                                <p className="text-sm text-gray-700">{formatTime(eventDetailsModal.data?.event_time)}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Booking Status</p>
                                                <span className={`inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${eventDetailsModal.data?.status === 'Confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {eventDetailsModal.data?.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Venue Matrix */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Event Venue</h4>
                                    <div className="bg-rose-50/50 rounded-lg p-4 border border-rose-100">
                                        <p className="text-xs text-gray-500 font-medium">Venue Address</p>
                                        <p className="mt-1 text-sm font-bold text-gray-900">{formatFullAddress(eventDetailsModal.data)}</p>
                                        {eventDetailsModal.data?.venue_building_details && (
                                            <p className="mt-2 text-xs font-medium text-gray-600">{eventDetailsModal.data.venue_building_details}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Selected Dishes */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Selected Dishes</h4>
                                    {selectedDishes.length === 0 ? (
                                        <div className="bg-gray-50 rounded-lg p-4 text-sm font-medium text-gray-500">No dishes selected for this booking.</div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {selectedDishes.map((dish, index) => (
                                                <div key={`${dish.category}-${dish.name}-${index}`} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{dish.category}</p>
                                                    <p className="mt-1 text-sm font-bold text-gray-900">{dish.name}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Financial Matrix */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Financial Matrix</h4>
                                    <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Headcount (Pax)</p>
                                            <p className="text-lg font-bold text-gray-900">{eventDetailsModal.data?.pax}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Event Total (₱)</p>
                                            <p className="text-lg font-bold text-gray-900">{eventDetailsModal.data?.total_cost?.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Travel Fee (₱)</p>
                                            <p className="text-lg font-bold text-orange-600">{eventDetailsModal.data?.transport_fee?.toLocaleString() || '0'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Extra Service Hours (₱)</p>
                                            <p className="text-lg font-bold text-orange-600">{eventDetailsModal.data?.labor_surcharge?.toLocaleString() || '0'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Payment Schedule</h4>
                                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Term</th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Amount</th>
                                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500">Due Date</th>
                                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500">Status</th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {(eventDetailsModal.data?.payments || []).map(payment => (
                                                    <tr key={payment.id}>
                                                        <td className="px-4 py-3 font-semibold text-gray-900">{paymentLabel(payment.payment_type)}</td>
                                                        <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(payment.amount)}</td>
                                                        <td className="px-4 py-3 text-center text-gray-600">{formatDate(payment.due_date)}</td>
                                                        <td className="px-4 py-3 text-center text-gray-600">{staffPaymentStatus(payment.status, payment.due_date).label}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            {payment.status === 'Pending' || payment.status === 'Rejected' ? (
                                                                <button onClick={() => setEditPaymentModal({ isOpen: true, payment, booking: eventDetailsModal.data })} className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 transition-colors hover:bg-indigo-100">Edit Term</button>
                                                            ) : (
                                                                <span className="text-xs font-semibold text-gray-400">Locked</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(eventDetailsModal.data?.payments || []).length === 0 && (
                                                    <tr>
                                                        <td colSpan="5" className="px-4 py-6 text-center text-sm text-gray-500">No payment schedule found.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {eventDetailsModal.data?.preparation_tasks?.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Preparation Tasks</h4>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {eventDetailsModal.data.preparation_tasks.map(task => (
                                                <div key={task.id} className={`rounded-lg border px-4 py-3 ${task.status === 'Done' ? 'border-emerald-100 bg-emerald-50' : 'border-amber-100 bg-[#fffaf3]'}`}>
                                                    <p className="text-sm font-bold text-gray-900">{task.label}</p>
                                                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">{task.department} / {task.status}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                                <button onClick={() => setEventDetailsModal({ open: false, data: null })} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
                                    Acknowledge
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {editPaymentModal.isOpen && (
                <Suspense fallback={null}>
                    <PaymentTermEditorModal
                        isOpen={editPaymentModal.isOpen}
                        onClose={() => setEditPaymentModal({ isOpen: false, payment: null, booking: null })}
                        booking={editPaymentModal.booking}
                        payment={editPaymentModal.payment}
                        onSuccess={() => {
                            setEditPaymentModal({ isOpen: false, payment: null, booking: null });
                            setEventDetailsModal({ open: false, data: null });
                            showToast('Payment terms updated');
                            fetchBookings();
                        }}
                    />
                </Suspense>
            )}

            {/* Add New Menu Item Modal */}
            {menuItemModal.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fadeIn">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuItemModal.mode === 'edit' ? 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' : 'M12 4v16m8-8H4'} /></svg>
                                {menuItemModal.mode === 'edit' ? 'Edit Menu Item' : 'Add New Menu Item'}
                            </h3>
                            <button onClick={() => setMenuItemModal({ open: false, mode: 'add', data: null })} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleMenuItemSubmit} className="p-6 space-y-5">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Dish Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={menuItemForm.name}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, name: e.target.value })}
                                    placeholder="e.g. Garlic Butter Shrimp"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all text-sm"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
                                <select
                                    value={menuItemForm.category}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, category: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all text-sm bg-white capitalize"
                                >
                                    <option value="starter">Starter</option>
                                    <option value="main">Main</option>
                                    <option value="side">Side</option>
                                    <option value="dessert">Dessert</option>
                                    <option value="drink">Drink</option>
                                </select>
                            </div>

                            {/* Cost & Price Adj */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Cost Per Head (₱) <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={menuItemForm.cost_per_head}
                                        onChange={e => setMenuItemForm({ ...menuItemForm, cost_per_head: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Price Adjustment (₱)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={menuItemForm.price_adj}
                                        onChange={e => setMenuItemForm({ ...menuItemForm, price_adj: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all text-sm"
                                    />
                                </div>
                            </div>

                            {/* Image Link */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Image Link</label>
                                <input
                                    type="url"
                                    value={menuItemForm.image}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, image: e.target.value })}
                                    placeholder="https://images.unsplash.com/..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all text-sm"
                                />
                                <p className="text-xs text-gray-400 mt-1">Leave blank to use a standard menu image.</p>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
                                <textarea
                                    rows="3"
                                    value={menuItemForm.description}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, description: e.target.value })}
                                    placeholder="A brief description of the dish..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all text-sm resize-none"
                                />
                            </div>

                            {/* Best Seller Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={menuItemForm.is_best_seller}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, is_best_seller: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Mark as Best Seller</span>
                            </label>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setMenuItemModal({ open: false, mode: 'add', data: null })}
                                    className="px-6 py-2.5 text-sm font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={menuItemFormLoading}
                                    className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50"
                                >
                                    {menuItemFormLoading ? (menuItemModal.mode === 'edit' ? 'Saving...' : 'Adding...') : (menuItemModal.mode === 'edit' ? 'Save Changes' : 'Add Menu Item')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                tone={confirmDialog.tone}
                busy={confirmDialog.busy}
                onCancel={closeConfirmDialog}
                onConfirm={confirmDialog.onConfirm}
            />

            {/* Toast */}
            {
                toast && (
                    <div className="pointer-events-none fixed bottom-5 right-5 z-50 animate-slideUp">
                        <div className="pointer-events-auto flex max-w-[360px] items-start gap-3 rounded-xl bg-[#fffaf3] px-4 py-3 text-sm shadow-[0_10px_30px_rgba(50,35,20,0.18)]">
                            <span className={`min-w-0 flex-1 font-semibold leading-5 ${toast.type === 'error' ? 'text-[#8b0000]' : 'text-[#374151]'}`}>{toast.message}</span>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default DashboardAdmin;
