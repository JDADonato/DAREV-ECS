import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { router } from '@inertiajs/react';
import NotificationBell from '../Components/common/NotificationBell';
import FlashToast from '../Components/common/FlashToast';
import ConfirmModal from '../Components/common/ConfirmModal';
import PromptModal from '../Components/common/PromptModal';
import StaffPagination from '../Components/staff/StaffPagination';
import StaffWorkspaceLayout from '../Layouts/StaffWorkspaceLayout';
import StaffPageHeader from '../Components/staff/StaffPageHeader';
import StaffEmptyState from '../Components/staff/StaffEmptyState';
import StaffStatusBadge from '../Components/staff/StaffStatusBadge';
import useSmartRefresh from '../hooks/useSmartRefresh';
import {
    formatDate,
    formatFullAddress,
    formatMoney,
    formatTime,
    getBookingValue,
    getDateKey,
    getDaysInMonth,
    getFirstDayOfMonth,
    getSelectedDishes,
    titleCase,
} from '../utils/dashboardUtils';

const StaffMessaging = lazy(() => import('../Components/common/StaffMessaging'));
const AnnouncementManager = lazy(() => import('../Components/content/AnnouncementManager'));
const PreparationBoard = lazy(() => import('../Components/operations/PreparationBoard'));
import { getListData } from '../utils/apiResponses';

const PACKAGE_CATEGORY_OPTIONS = [
    { value: 'premium', label: 'Weddings & Debuts' },
    { value: 'birthday', label: 'Birthdays' },
    { value: 'standard', label: 'Standard Events' },
];

const SECURITY_OPTIONS = [
    { value: 'contingency', label: '10% Contingency' },
    { value: 'cash_bond', label: 'Php 1,500 Cash Bond' },
];

const MARKETING_BOOKINGS_URL = '/api/marketing/bookings?paginated=1&per_page=100';
const BOOKING_BACKED_TABS = ['calendar', 'intake', 'documents'];
const ACTIVE_CALENDAR_STATUSES = ['Confirmed', 'Reserved'];

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
const eventDisplayName = (booking) => booking?.event_name || booking?.event_type || booking?.client_full_name || 'Eloquente event';
const isActiveCalendarBooking = (booking) => (
    Boolean(booking?.event_date) && ACTIVE_CALENDAR_STATUSES.includes(booking.status)
);

const DashboardMarketing = () => {
    const { user, logout } = useAuth();
    const toast = useToast();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('today');
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [menuItems, setMenuItems] = useState([]);
    const [packages, setPackages] = useState([]);
    const [eventTypes, setEventTypes] = useState([]);
    const [eventTypeForm, setEventTypeForm] = useState(emptyEventTypeForm());
    const [editingEventTypeId, setEditingEventTypeId] = useState(null);
    const [activeMenuCategory, setActiveMenuCategory] = useState('starter');
    const [activeConfigTab, setActiveConfigTab] = useState('packages');
    const [packageForm, setPackageForm] = useState(emptyPackageForm());
    const [editingPackageId, setEditingPackageId] = useState(null);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [updatingBookingIds, setUpdatingBookingIds] = useState({});
    const [inquirySearch, setInquirySearch] = useState('');
    const [inquiryStatusFilter, setInquiryStatusFilter] = useState('all');
    const [inquiryAssignmentFilter, setInquiryAssignmentFilter] = useState('all');
    const [inquirySort, setInquirySort] = useState('eventDateAsc');
    const [inquiryDateFrom, setInquiryDateFrom] = useState('');
    const [inquiryDateTo, setInquiryDateTo] = useState('');
    const [inquiryPage, setInquiryPage] = useState(1);
    const [inquiryPerPage, setInquiryPerPage] = useState(25);
    const [availabilityMonth, setAvailabilityMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [availabilityOverrides, setAvailabilityOverrides] = useState([]);
    const [availabilityDate, setAvailabilityDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [availabilityForm, setAvailabilityForm] = useState({ is_locked: false, remaining_events: '', remaining_pax: '', note: '' });
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [availabilitySaving, setAvailabilitySaving] = useState(false);
    const [clarificationPrompt, setClarificationPrompt] = useState({ isOpen: false, bookingId: null });
    const [deleteEventTypeConfirm, setDeleteEventTypeConfirm] = useState({ isOpen: false, eventType: null });
    const [leadData, setLeadData] = useState({ data: [], meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 }, summary: { open: 0, new: 0, resolved: 0 } });
    const [leadLoading, setLeadLoading] = useState(false);
    const [leadFilters, setLeadFilters] = useState({ search: '', status: '', concern_type: '', date_from: '', date_to: '', page: 1, per_page: 15 });
    const [selectedLead, setSelectedLead] = useState(null);
    const [leadSaving, setLeadSaving] = useState(false);

    // PDF Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportMode, setExportMode] = useState('month'); // 'month' or 'range'
    const [exportMonthStart, setExportMonthStart] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [exportMonthEnd, setExportMonthEnd] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [exportDateStart, setExportDateStart] = useState('');
    const [exportDateEnd, setExportDateEnd] = useState('');

    useEffect(() => {
        fetchBookings();
    }, []);

    useEffect(() => {
        setInquiryPage(1);
    }, [inquirySearch, inquiryStatusFilter, inquiryAssignmentFilter, inquirySort, inquiryDateFrom, inquiryDateTo, inquiryPerPage]);

    useEffect(() => {
        if (activeTab === 'today') {
            fetchBookings();
            fetchContactLeads({ silent: true });
        } else if (activeTab === 'settings') {
            fetchMarketingSettings();
        } else if (activeTab === 'availability') {
            fetchAvailabilityOverrides();
        } else if (activeTab === 'leads') {
            fetchContactLeads();
        } else if (BOOKING_BACKED_TABS.includes(activeTab) && bookings.length === 0) {
            fetchBookings();
        }
    }, [activeTab, availabilityMonth]);

    useEffect(() => {
        if (activeTab !== 'leads') return;
        const timer = window.setTimeout(() => fetchContactLeads(), 250);
        return () => window.clearTimeout(timer);
    }, [leadFilters, activeTab]);

    useSmartRefresh({
        enabled: ['today', 'settings', 'availability', ...BOOKING_BACKED_TABS].includes(activeTab),
        interval: activeTab === 'settings' ? 120000 : 90000,
        idleAfter: 180000,
        refresh: ({ silent = false } = {}) => {
            if (activeTab === 'today') {
                fetchBookings({ silent });
            } else if (activeTab === 'settings') {
                fetchMarketingSettings();
            } else if (activeTab === 'availability') {
                fetchAvailabilityOverrides({ silent });
            } else if (BOOKING_BACKED_TABS.includes(activeTab)) {
                fetchBookings({ silent });
            }
        },
    });

    const fetchBookings = async ({ silent = false } = {}) => {
        try {
            // Session auth - no token needed
            const response = await fetch(MARKETING_BOOKINGS_URL, {
                headers: {
                    'Accept': 'application/json',
                }
            });
            if (response.ok) {
                const data = await response.json();
                setBookings(getListData(data));
            }
        } catch (error) {
            console.error("Error fetching bookings:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchContactLeads = async ({ silent = false } = {}) => {
        if (!silent) setLeadLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(leadFilters).forEach(([key, value]) => {
                if (value !== '' && value !== null && value !== undefined) params.set(key, value);
            });
            const response = await fetch(`/api/marketing/contact-inquiries?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) throw new Error('Lead load failed');
            setLeadData(await response.json());
        } catch (error) {
            console.error(error);
            if (!silent) toast.error('Could not load guest inquiries.');
        } finally {
            if (!silent) setLeadLoading(false);
        }
    };

    const updateLeadFilter = (field, value) => {
        setLeadFilters((current) => ({ ...current, [field]: value, page: field === 'page' ? value : 1 }));
    };

    const updateLead = async (id, changes) => {
        setLeadSaving(true);
        try {
            const response = await fetch(`/api/marketing/contact-inquiries/${id}`, {
                method: 'PATCH',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(changes),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Lead update failed');
            setSelectedLead(payload.inquiry);
            fetchContactLeads({ silent: true });
            toast.success('Lead updated.');
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Could not update this lead.');
        } finally {
            setLeadSaving(false);
        }
    };

    const handleLogout = () => {
        router.post('/logout');
    };

    const fetchAvailabilityOverrides = async ({ silent = false } = {}) => {
        if (!silent) setAvailabilityLoading(true);
        try {
            const response = await fetch(`/api/calendar-availability?month=${availabilityMonth}`, { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('Availability load failed');
            const data = await response.json();
            setAvailabilityOverrides(getListData(data));
        } catch (error) {
            console.error(error);
            toast.error('Could not load availability controls.');
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
            setAvailabilityForm({ is_locked: Boolean(data.isLocked), remaining_events: data.remainingEvents ?? '', remaining_pax: data.remainingPax ?? '', note: '' });
        } catch (error) {
            console.error(error);
        }
    };

    const saveAvailabilityOverride = async (event) => {
        event.preventDefault();
        setAvailabilitySaving(true);
        try {
            const response = await fetch(`/api/calendar-availability/${availabilityDate}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    is_locked: availabilityForm.is_locked,
                    remaining_events: availabilityForm.remaining_events === '' ? null : Number(availabilityForm.remaining_events),
                    remaining_pax: availabilityForm.remaining_pax === '' ? null : Number(availabilityForm.remaining_pax),
                    note: availabilityForm.note,
                }),
            });
            if (!response.ok) throw new Error('Save failed');
            toast.success('Availability updated.');
            fetchAvailabilityOverrides({ silent: true });
        } catch (error) {
            console.error(error);
            toast.error('Could not save availability override.');
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
            toast.success('Availability override cleared.');
            fetchAvailabilityOverrides({ silent: true });
        } catch (error) {
            console.error(error);
            toast.error('Could not clear availability override.');
        } finally {
            setAvailabilitySaving(false);
        }
    };

    const updateStatus = async (id, newStatus) => {
        if (updatingBookingIds[id]) return; // prevent double-click
        setUpdatingBookingIds(prev => ({ ...prev, [id]: newStatus }));

        // Optimistic update: remove from pending list immediately
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));

        try {
            const response = await fetch(`/api/marketing/bookings/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                if (data.booking) mergeUpdatedBooking(data.booking);
                const label = newStatus === 'Confirmed' ? 'approved' : 'declined';
                toast.success(`Booking #${id} has been ${label} successfully.`);
                fetchBookings(); // sync with server in background
            } else {
                // Revert on failure
                setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'Pending' } : b));
                toast.error('Failed to update booking status. Please try again.');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'Pending' } : b));
            toast.error('We could not update the booking. Please check your connection.');
        } finally {
            setUpdatingBookingIds(prev => { const n = { ...prev }; delete n[id]; return n; });
        }
    };

    const mergeUpdatedBooking = (updatedBooking) => {
        if (!updatedBooking?.id) return;
        setBookings(prev => prev.map(item => item.id === updatedBooking.id ? { ...item, ...updatedBooking } : item));
        setSelectedBooking(prev => prev?.id === updatedBooking.id ? { ...prev, ...updatedBooking } : prev);
    };

    const assignBooking = async (id) => {
        try {
            const response = await fetch(`/api/marketing/bookings/${id}/assign`, {
                method: 'PUT',
                headers: { 'Accept': 'application/json' },
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Assignment failed');
            mergeUpdatedBooking(data.booking);
            toast.success('Booking is now assigned to you.');
        } catch (error) {
            console.error(error);
            toast.error('We could not assign this booking right now.');
        }
    };

    const requestClarification = (id) => {
        setClarificationPrompt({ isOpen: true, bookingId: id });
    };

    const submitClarificationRequest = async (message) => {
        const id = clarificationPrompt.bookingId;
        if (!id) return;
        try {
            const response = await fetch(`/api/marketing/bookings/${id}/clarification`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Request failed');
            mergeUpdatedBooking(data.booking);
            setClarificationPrompt({ isOpen: false, bookingId: null });
            toast.success('Request sent to the customer dashboard.');
        } catch (error) {
            console.error(error);
            toast.error('We could not send the request right now.');
        }
    };

    const toggleReviewTask = async (bookingId, task) => {
        const nextStatus = task.status === 'Done' ? 'Pending' : 'Done';
        try {
            const response = await fetch(`/api/marketing/bookings/${bookingId}/review-tasks/${task.id}`, {
                method: 'PATCH',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: nextStatus }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Checklist update failed');
            mergeUpdatedBooking(data.booking);
        } catch (error) {
            console.error(error);
            toast.error('We could not update the checklist.');
        }
    };

    const updateLiveStatus = async (id, newLiveStatus) => {
        try {
            // Session auth - no token needed
            const response = await fetch(`/api/marketing/bookings/${id}/livestatus`, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ live_status: newLiveStatus })
            });

            if (response.ok) {
                // Update local state to reflect change immediately without closing modal
                setSelectedBooking({ ...selectedBooking, live_status: newLiveStatus });
                fetchBookings(); // Refresh background data
            }
        } catch (error) {
            console.error("Error updating live status:", error);
        }
    };

    const fetchMarketingSettings = async () => {
        try {
            const [menuRes, packageRes, eventRes] = await Promise.all([
                fetch('/api/menu-items'),
                fetch('/api/packages?per_page=100'),
                fetch('/api/event-types?per_page=100'),
            ]);
            if (menuRes.ok) setMenuItems(await menuRes.json());
            if (packageRes.ok) {
                const data = await packageRes.json();
                setPackages(data.data || data);
            }
            if (eventRes.ok) {
                const data = await eventRes.json();
                const types = data.data || data;
                setEventTypes(types);
                setPackageForm(prev => {
                    const defaultType = prev.type || types[0]?.slug || '';
                    return {
                        ...prev,
                        type: defaultType,
                        event_type_slugs: prev.event_type_slugs?.length ? prev.event_type_slugs : (defaultType ? [defaultType] : []),
                    };
                });
            }
        } catch (error) {
            console.error('Error fetching marketing settings:', error);
        }
    };

    const handleDishPricingUpdate = async (item, cost, adj) => {
        setSettingsSaving(true);
        try {
            const response = await fetch(`/api/settings/menu-items/${item.id}/pricing`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cost_per_head: cost, price_adj: adj }),
            });
            if (response.ok) fetchMarketingSettings();
        } catch (error) {
            console.error('Error updating dish pricing:', error);
        } finally {
            setSettingsSaving(false);
        }
    };

    const handlePackageSubmit = async (e) => {
        e.preventDefault();
        setSettingsSaving(true);
        try {
            const response = await fetch(editingPackageId ? `/api/settings/packages/${editingPackageId}` : '/api/settings/packages', {
                method: editingPackageId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(packageForm),
            });
            if (response.ok) {
                setEditingPackageId(null);
                setPackageForm(emptyPackageForm(eventTypes[0]?.slug || ''));
                fetchMarketingSettings();
            }
        } catch (error) {
            console.error('Error creating package:', error);
        } finally {
            setSettingsSaving(false);
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
        setSettingsSaving(true);
        try {
            const url = editingEventTypeId ? `/api/settings/event-types/${editingEventTypeId}` : '/api/settings/event-types';
            const response = await fetch(url, {
                method: editingEventTypeId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventTypeForm),
            });
            if (response.ok) {
                resetEventTypeForm();
                fetchMarketingSettings();
            }
        } catch (error) {
            console.error('Error saving event type:', error);
        } finally {
            setSettingsSaving(false);
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
        setDeleteEventTypeConfirm({ isOpen: true, eventType });
    };

    const confirmDeleteEventType = async () => {
        const eventType = deleteEventTypeConfirm.eventType;
        if (!eventType) return;
        setSettingsSaving(true);
        try {
            const response = await fetch(`/api/settings/event-types/${eventType.id}`, { method: 'DELETE' });
            if (response.ok) {
                setDeleteEventTypeConfirm({ isOpen: false, eventType: null });
                fetchMarketingSettings();
            }
        } catch (error) {
            console.error('Error deleting event type:', error);
        } finally {
            setSettingsSaving(false);
        }
    };

    const getCalendarEventLabel = (booking) => {
        const time = formatTime(booking.event_time);
        const eventType = titleCase(booking.event_type || booking.package_type || booking.type) || 'Event';
        const client = booking.client_full_name || booking.username || 'Unnamed client';
        return `${time} / ${eventType} / ${client}`;
    };

    const getCompactClientName = (booking) => {
        const name = booking.client_full_name || booking.username || 'Client';
        const parts = String(name).trim().split(/\s+/);
        return parts.length > 1 ? parts[parts.length - 1] : name;
    };

    const getCalendarEventPrimary = (booking) => (
        titleCase(booking.event_type || booking.package_type || booking.type) || `Booking #${booking.id}`
    );

    const getCalendarEventSecondary = (booking) => {
        const pax = booking.pax ? ` · ${booking.pax} pax` : '';
        return `${formatTime(booking.event_time)} · ${getCompactClientName(booking)}${pax}`;
    };

    const getCalendarEventTitle = (booking) => {
        const parts = [
            `Booking #${booking.id}`,
            getCalendarEventLabel(booking),
            booking.pax ? `${booking.pax} pax` : null,
            booking.status ? `Status: ${booking.status}` : null,
        ].filter(Boolean);
        return parts.join('\n');
    };

    const [selectedBooking, setSelectedBooking] = useState(null);

    const marketingBookingIndexes = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
        const byDate = new Map();
        const pending = [];
        let confirmed = 0;
        let monthEvents = 0;
        let upcoming = 0;
        let pipeline = 0;

        bookings.forEach((booking) => {
            const showOnCalendar = isActiveCalendarBooking(booking);

            if (booking.event_date) {
                const dateKey = booking.event_date.substring(0, 10);
                if (showOnCalendar) {
                    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
                    byDate.get(dateKey).push(booking);
                    if (booking.event_date.substring(0, 7) === monthKey) monthEvents += 1;
                }
            }

            if (booking.status === 'Pending') {
                pending.push(booking);
                pipeline += getBookingValue(booking);
            }
            if (booking.status === 'Confirmed') confirmed += 1;

            if (!booking.event_date || !['Pending', 'Confirmed'].includes(booking.status)) return;
            const eventDate = new Date(booking.event_date);
            eventDate.setHours(0, 0, 0, 0);
            if (eventDate >= now && ['Pending', 'Confirmed'].includes(booking.status)) upcoming += 1;
        });

        return {
            byDate,
            pending: pending.length,
            confirmed,
            monthEvents,
            upcoming,
            pipeline,
        };
    }, [bookings, selectedMonth]);

    const dashboardSummary = marketingBookingIndexes;

        const tabMeta = {
            today: 'Today',
            intake: 'Intake',
            leads: 'Guest Inquiries',
            calendar: 'Calendar',
        availability: 'Availability',
        preparation: 'Preparation',
        inquiries: 'Booking Review',
        documents: 'Event Documents',
        content: 'Announcements',
        settings: 'Menu And Packages',
        messages: 'Messages',
    };

        const marketingSummary = useMemo(() => {
            const pending = bookings.filter(b => b.status === 'Pending' || ['Submitted', 'Under Review', 'Needs Customer Details', 'Clarification Received'].includes(b.review_status));
            const needsDetails = pending.filter(b => String(b.review_status || '').toLowerCase() === 'needs customer details' || b.clarification_request);
            const upcoming = bookings.filter(b => b.event_date && ['Confirmed', 'Reserved'].includes(b.status));
            const now = new Date();
        const nextSeven = new Date();
        nextSeven.setDate(now.getDate() + 7);
        const urgent = pending.filter(b => {
            if (!b.event_date) return false;
            const date = new Date(b.event_date);
            return date >= now && date <= nextSeven;
        });

        return {
            pending: pending.length,
            needsDetails: needsDetails.length,
            upcoming: upcoming.length,
            urgent: urgent.length,
            pipeline: pending.reduce((sum, b) => sum + getBookingValue(b), 0),
            pendingRows: pending,
            upcomingRows: upcoming,
            urgentRows: urgent,
        };
    }, [bookings]);

    const renderToday = () => (
        <div className="staff-today-grid">
            <section className="staff-work-surface">
                <div className="staff-surface-head">
                    <div>
                        <p className="marketing-kicker">Priority queue</p>
                        <h3 className="mt-1 text-lg font-black text-slate-950">Marketing work needing action</h3>
                    </div>
                </div>
                <div className="p-4">
                    <div className="staff-priority-list">
                        <button type="button" onClick={() => setActiveTab('intake')} className="staff-priority-item">
                            <div><h3>Booking intake</h3><p>{marketingSummary.pending} submitted bookings are waiting for review or approval.</p></div>
                            <StaffStatusBadge tone={marketingSummary.pending > 0 ? 'warn' : 'good'}>{marketingSummary.pending}</StaffStatusBadge>
                        </button>
                        <button type="button" onClick={() => setActiveTab('intake')} className="staff-priority-item">
                            <div><h3>Needs customer details</h3><p>{marketingSummary.needsDetails} bookings are blocked by missing or clarified information.</p></div>
                            <StaffStatusBadge tone={marketingSummary.needsDetails > 0 ? 'danger' : 'good'}>{marketingSummary.needsDetails}</StaffStatusBadge>
                        </button>
                        <button type="button" onClick={() => setActiveTab('leads')} className="staff-priority-item">
                            <div><h3>Guest inquiries</h3><p>{leadData.summary?.open || 0} contact-form messages need triage, assignment, or follow-up.</p></div>
                            <StaffStatusBadge tone={(leadData.summary?.open || 0) > 0 ? 'warn' : 'good'}>{leadData.summary?.open || 0}</StaffStatusBadge>
                        </button>
                        <button type="button" onClick={() => setActiveTab('preparation')} className="staff-priority-item">
                            <div><h3>Upcoming handoffs</h3><p>{marketingSummary.upcoming} confirmed or reserved events need preparation visibility.</p></div>
                            <StaffStatusBadge tone={marketingSummary.upcoming > 0 ? 'warn' : 'good'}>{marketingSummary.upcoming}</StaffStatusBadge>
                        </button>
                        <button type="button" onClick={() => setActiveTab('messages')} className="staff-priority-item">
                            <div><h3>Customer messages</h3><p>Open the shared inbox to claim, answer, transfer, or resolve customer conversations.</p></div>
                            <StaffStatusBadge tone="muted">Inbox</StaffStatusBadge>
                        </button>
                    </div>
                </div>
            </section>

            <section className="staff-work-surface">
                <div className="staff-surface-head">
                    <div>
                        <p className="marketing-kicker">Next events</p>
                        <h3 className="mt-1 text-lg font-black text-slate-950">Upcoming approved bookings</h3>
                    </div>
                </div>
                {marketingSummary.upcomingRows.length === 0 ? (
                    <StaffEmptyState title="No upcoming approved events" message="Confirmed or reserved events will appear here for preparation follow-up." />
                ) : (
                    <div className="p-4 staff-priority-list">
                        {marketingSummary.upcomingRows.slice(0, 6).map((booking) => (
                            <button key={booking.id} type="button" onClick={() => setSelectedBooking(booking)} className="staff-priority-item">
                                <div>
                                    <h3>{eventDisplayName(booking)}</h3>
                                    <p>{formatDate(booking.event_date)} / {booking.pax || 0} pax / {booking.client_full_name || booking.username || 'Customer'}</p>
                                </div>
                                <StaffStatusBadge tone="good">{booking.status}</StaffStatusBadge>
                            </button>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(selectedMonth);
        const firstDay = getFirstDayOfMonth(selectedMonth);
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="marketing-calendar-cell marketing-calendar-cell-empty"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBookings = marketingBookingIndexes.byDate.get(dateStr) || [];

            days.push(
                <div key={day} className="marketing-calendar-cell custom-scrollbar">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-black text-slate-700">{day}</span>
                        {dayBookings.length > 0 && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">{dayBookings.length}</span>}
                    </div>
                    {dayBookings.map(booking => (
                        <div
                            key={booking.id}
                            className={`marketing-event-chip mb-1 cursor-pointer rounded-lg px-2 py-1 text-[11px] font-bold transition-transform hover:-translate-y-0.5 ${booking.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' :
                                booking.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                                    'bg-slate-100 text-slate-700'
                                }`}
                            title={getCalendarEventTitle(booking)}
                            onClick={() => setSelectedBooking(booking)}
                        >
                            <span className="marketing-event-primary">{getCalendarEventPrimary(booking)}</span>
                            <span className="marketing-event-secondary">{getCalendarEventSecondary(booking)}</span>
                        </div>
                    ))}
                </div>
            );
        }

        return days;
    };

    const renderBookingModal = () => {
        if (!selectedBooking) return null;
        const selectedDishes = getSelectedDishes(selectedBooking);
        const isApproved = selectedBooking.status === 'Confirmed';
        const reviewStatus = selectedBooking.review_status || (selectedBooking.status === 'Pending' ? 'Submitted' : selectedBooking.status);

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
                <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>
                <div className="relative flex max-h-[90vh] w-full max-w-2xl animate-fadeIn flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-amber-100 bg-[#fffaf3] px-6 py-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-950">Event Brief</h3>
                            <p className="mt-1 text-xs font-bold text-slate-500">Reference: #BK-{selectedBooking.id.toString().padStart(4, '0')}</p>
                        </div>
                        <button onClick={() => setSelectedBooking(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto bg-white p-6">
                        <div className="rounded-xl border border-[#720101]/10 bg-[#fffaf3] p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="marketing-kicker">Review workflow</p>
                                    <h4 className="mt-1 text-lg font-black text-slate-950">{reviewStatus}</h4>
                                    <p className="mt-1 text-sm font-semibold text-slate-500">
                                        Owner: {selectedBooking.assigned_name || 'Unassigned'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {!selectedBooking.assigned_to && (
                                        <button onClick={() => assignBooking(selectedBooking.id)} className="rounded-lg border border-[#720101]/15 bg-white px-3 py-2 text-xs font-black text-[#720101] hover:bg-[#720101]/5">
                                            Claim booking
                                        </button>
                                    )}
                                    <button onClick={() => requestClarification(selectedBooking.id)} className="rounded-lg border border-[#f0aa0b]/40 bg-[#fff7e8] px-3 py-2 text-xs font-black text-[#9f6500] hover:bg-[#fff0cf]">
                                        Request details
                                    </button>
                                </div>
                            </div>
                            {selectedBooking.clarification_request && (
                                <div className="mt-4 rounded-lg border border-[#f0aa0b]/30 bg-white p-3">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-[#9f6500]">Customer details requested</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">{selectedBooking.clarification_request}</p>
                                    <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-slate-400">Customer response</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">{selectedBooking.clarification_response || 'Waiting for customer response.'}</p>
                                </div>
                            )}
                            {Array.isArray(selectedBooking.review_tasks) && selectedBooking.review_tasks.length > 0 && (
                                <div className="mt-4 border-t border-[#720101]/10 pt-4">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Review checklist</p>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        {selectedBooking.review_tasks.filter(task => task.task_type === 'review').map(task => (
                                            <button
                                                key={task.id}
                                                onClick={() => toggleReviewTask(selectedBooking.id, task)}
                                                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${task.status === 'Done' ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-200 bg-white text-slate-600 hover:border-[#720101]/20'}`}
                                            >
                                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${task.status === 'Done' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    {task.status === 'Done' ? 'OK' : ''}
                                                </span>
                                                {task.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                                <h4 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-900">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    Client Logic
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Primary Entity</p>
                                        <p className="text-sm font-semibold text-gray-900">{selectedBooking.client_full_name || selectedBooking.username || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Contact (Email)</p>
                                        <p className="text-sm text-gray-700">{selectedBooking.client_email || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Contact (Phone)</p>
                                        <p className="text-sm text-gray-700">{selectedBooking.client_phone || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                                <h4 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-900">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    Schedule
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Event Date</p>
                                        <p className="text-sm font-semibold text-gray-900">{formatDate(selectedBooking.event_date)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Start Time</p>
                                        <p className="text-sm text-gray-700">{formatTime(selectedBooking.event_time)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Booking Status</p>
                                        <span className={`inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {selectedBooking.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Event Venue</h4>
                            <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-4">
                                <p className="text-xs text-gray-500 font-medium">Venue Address</p>
                                <p className="mt-1 text-sm font-bold text-gray-900">{formatFullAddress(selectedBooking)}</p>
                                {selectedBooking.venue_building_details && (
                                    <p className="mt-2 text-xs font-medium text-gray-600">{selectedBooking.venue_building_details}</p>
                                )}
                            </div>
                        </div>

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

                        <div>
                            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Financial Summary</h4>
                            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">Headcount (Pax)</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedBooking.pax}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">Event Total (PHP)</p>
                                    <p className="text-lg font-bold text-gray-900">{formatMoney(selectedBooking.total_cost || selectedBooking.budget)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">Travel Fee (PHP)</p>
                                    <p className="text-lg font-bold text-orange-600">{formatMoney(selectedBooking.transport_fee)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">Extra Service Hours (PHP)</p>
                                    <p className="text-lg font-bold text-orange-600">{formatMoney(selectedBooking.labor_surcharge)}</p>
                                </div>
                            </div>
                        </div>

                        {selectedBooking.preparation_tasks?.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Preparation Tasks</h4>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {selectedBooking.preparation_tasks.map(task => (
                                        <div key={task.id} className={`rounded-lg border px-4 py-3 ${task.status === 'Done' ? 'border-emerald-100 bg-emerald-50' : 'border-amber-100 bg-[#fffaf3]'}`}>
                                            <p className="text-sm font-bold text-gray-900">{task.label}</p>
                                            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">{task.department} / {task.status}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isApproved && (
                            <div>
                                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2 flex items-center gap-1">
                                    <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Live Status Tracking
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {['Not Started', 'On the Way', 'Preparing', 'Serving', 'Completed'].map(status => {
                                        const isActive = selectedBooking.live_status === status || (!selectedBooking.live_status && status === 'Not Started');
                                        return (
                                            <button
                                                key={status}
                                                onClick={() => updateLiveStatus(selectedBooking.id, status)}
                                                className={`px-4 py-2 text-xs font-bold rounded-full border transition-colors ${isActive ? 'bg-primary-600 text-white border-primary-600 shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                            >
                                                {status}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end border-t border-amber-100 bg-[#fffaf3] px-6 py-4">
                        <button onClick={() => setSelectedBooking(null)} className="marketing-primary-btn px-6 py-2 text-sm">
                            Done
                        </button>
                    </div>
                </div>
            </div>
        );
    };
    // ---- PDF Export Functions ----
    const getExportDateRange = () => {
        if (exportMode === 'range') {
            return { start: exportDateStart, end: exportDateEnd };
        } else {
            // Month range
            const [startYear, startMonth] = exportMonthStart.split('-').map(Number);
            const [endYear, endMonth] = exportMonthEnd.split('-').map(Number);
            const start = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
            const lastDay = new Date(endYear, endMonth, 0).getDate();
            const end = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            return { start, end };
        }
    };

    const exportCalendarPDF = () => {
        const { start, end } = getExportDateRange();

        if (!start || !end || start > end) {
            toast.warning('Please select a valid date range.');
            return;
        }

        const filteredBookings = bookings.filter(b => {
            const dateKey = getDateKey(b.event_date);
            return dateKey >= start && dateKey <= end;
        });

        // Group bookings by date
        const grouped = {};
        filteredBookings.forEach(b => {
            const dateKey = getDateKey(b.event_date);
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(b);
        });

        const sortedDates = Object.keys(grouped).sort();

        // Build month calendars for the range
        const startDate = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T00:00:00');
        let calendarHTML = '';

        let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        while (current <= endMonth) {
            const year = current.getFullYear();
            const month = current.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDay = new Date(year, month, 1).getDay();
            const monthName = current.toLocaleString('default', { month: 'long', year: 'numeric' });

            calendarHTML += `
                <div class="month-block">
                    <h3 class="month-title">${monthName}</h3>
                    <table class="calendar-table">
                        <thead>
                            <tr>
                                <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>
                            </tr>
                        </thead>
                        <tbody>`;

            let dayCount = 1;
            for (let week = 0; week < 6; week++) {
                if (dayCount > daysInMonth) break;
                calendarHTML += '<tr>';
                for (let dow = 0; dow < 7; dow++) {
                    if ((week === 0 && dow < firstDay) || dayCount > daysInMonth) {
                        calendarHTML += '<td class="empty"></td>';
                    } else {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCount).padStart(2, '0')}`;
                        const dayEvents = grouped[dateStr] || [];
                        const eventsHTML = dayEvents.map(ev =>
                            `<div class="event ${ev.status === 'Confirmed' ? 'confirmed' : ev.status === 'Pending' ? 'pending' : 'other'}">${ev.client_full_name || ev.username} (${ev.pax} pax)</div>`
                        ).join('');
                        calendarHTML += `<td><div class="day-num">${dayCount}</div>${eventsHTML}</td>`;
                        dayCount++;
                    }
                }
                calendarHTML += '</tr>';
            }

            calendarHTML += `</tbody></table></div>`;
            current = new Date(year, month + 1, 1);
        }

        // Summary table
        let summaryHTML = '';
        if (sortedDates.length > 0) {
            summaryHTML = `
                <div class="summary-section">
                    <h3>Event Schedule Summary</h3>
                    <table class="summary-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Client</th>
                                <th>Pax</th>
                                <th>Venue</th>
                                <th>Contact</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredBookings.sort((a, b) => getDateKey(a.event_date).localeCompare(getDateKey(b.event_date))).map(b => `
                                <tr>
                                    <td>${formatDate(b.event_date)}</td>
                                    <td>${formatTime(b.event_time)}</td>
                                    <td>${b.client_full_name || b.username}</td>
                                    <td>${b.pax}</td>
                                    <td class="small-text">${[b.venue_address_line, b.venue_street, b.venue_city, b.venue_province].filter(Boolean).join(', ') || '-'}</td>
                                    <td class="small-text">${[b.client_email, b.client_phone].filter(Boolean).join(' / ') || '-'}</td>
                                    <td><span class="status-badge ${b.status === 'Confirmed' ? 'confirmed' : b.status === 'Pending' ? 'pending' : 'other'}">${b.status}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <p class="total-line">Total Events: ${filteredBookings.length} | Total Pax: ${filteredBookings.reduce((s, b) => s + (b.pax || 0), 0)}</p>
                </div>
            `;
        } else {
            summaryHTML = '<p style="text-align:center; color:#666; margin-top:20px;">No events found in the selected date range.</p>';
        }

        const content = `
            <html>
                <head>
                    <title>Eloquente Calendar Export</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; font-size: 11px; }
                        .header { text-align: center; margin-bottom: 25px; border-bottom: 3px solid #d4a843; padding-bottom: 15px; }
                        .header h1 { font-size: 22px; color: #333; margin-bottom: 4px; }
                        .header p { color: #666; font-size: 12px; }
                        .month-block { margin-bottom: 30px; page-break-inside: avoid; }
                        .month-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
                        .calendar-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                        .calendar-table th { background: #f5f5f5; padding: 6px; text-align: center; font-size: 10px; font-weight: 600; text-transform: uppercase; border: 1px solid #ddd; }
                        .calendar-table td { border: 1px solid #ddd; padding: 4px; vertical-align: top; height: 70px; }
                        .calendar-table td.empty { background: #fafafa; }
                        .day-num { font-weight: bold; font-size: 12px; margin-bottom: 2px; }
                        .event { font-size: 8px; padding: 2px 4px; margin-bottom: 2px; border-radius: 3px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
                        .event.confirmed { background: #d1fae5; color: #065f46; }
                        .event.pending { background: #fef3c7; color: #92400e; }
                        .event.other { background: #f3f4f6; color: #374151; }
                        .summary-section { margin-top: 30px; page-break-before: always; }
                        .summary-section h3 { font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
                        .summary-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                        .summary-table th { background: #f5f5f5; padding: 8px 6px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; border: 1px solid #ddd; }
                        .summary-table td { padding: 6px; border: 1px solid #ddd; font-size: 10px; }
                        .summary-table .small-text { font-size: 9px; }
                        .status-badge { padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
                        .status-badge.confirmed { background: #d1fae5; color: #065f46; }
                        .status-badge.pending { background: #fef3c7; color: #92400e; }
                        .status-badge.other { background: #f3f4f6; color: #374151; }
                        .total-line { margin-top: 10px; font-weight: 600; font-size: 12px; }
                        .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
                        @media print { body { padding: 15px; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>ELOQUENTE CATERING SERVICES</h1>
                        <p>Event Calendar — ${start} to ${end}</p>
                        <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                    </div>
                    ${calendarHTML}
                    ${summaryHTML}
                    <div class="footer">
                        Generated by Eloquente Marketing Module
                    </div>
                    <script>window.print();</script>
                </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(content);
        win.document.close();
        setShowExportModal(false);
    };

    const renderExportModal = () => {
        if (!showExportModal) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowExportModal(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="px-6 py-4 bg-primary-600">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">Download Calendar Report</h3>
                            <button onClick={() => setShowExportModal(false)} className="text-white hover:text-gray-200 text-2xl leading-none">&times;</button>
                        </div>
                        <p className="text-sm text-white opacity-80">Select the range to include</p>
                    </div>

                    <div className="px-6 py-5 space-y-4">
                        {/* Toggle Mode */}
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setExportMode('month')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${exportMode === 'month' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}
                            >
                                Month Range
                            </button>
                            <button
                                onClick={() => setExportMode('range')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${exportMode === 'range' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}
                            >
                                Date Range
                            </button>
                        </div>

                        {exportMode === 'month' ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">From Month</label>
                                    <input
                                        type="month"
                                        value={exportMonthStart}
                                        onChange={e => setExportMonthStart(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">To Month</label>
                                    <input
                                        type="month"
                                        value={exportMonthEnd}
                                        onChange={e => setExportMonthEnd(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">From Date</label>
                                    <input
                                        type="date"
                                        value={exportDateStart}
                                        onChange={e => setExportDateStart(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">To Date</label>
                                    <input
                                        type="date"
                                        value={exportDateEnd}
                                        onChange={e => setExportDateEnd(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 bg-gray-50 border-t flex space-x-3">
                        <button
                            onClick={() => setShowExportModal(false)}
                            className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={exportCalendarPDF}
                            className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center justify-center"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Download Report
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderAvailability = () => (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <form onSubmit={saveAvailabilityOverride} className="marketing-panel p-6">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
                    <input type="month" value={availabilityMonth} onChange={(event) => setAvailabilityMonth(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Date</span>
                        <input type="date" value={availabilityDate} onChange={(event) => selectAvailabilityDate(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" />
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                        <input type="checkbox" checked={availabilityForm.is_locked} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, is_locked: event.target.checked }))} />
                        <span className="text-sm font-black text-red-800">Fully lock this date</span>
                    </label>
                    <label className="block">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Remaining event slots</span>
                        <input type="number" min="0" value={availabilityForm.remaining_events} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, remaining_events: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" />
                    </label>
                    <label className="block">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Remaining pax</span>
                        <input type="number" min="0" value={availabilityForm.remaining_pax} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, remaining_pax: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" />
                    </label>
                </div>
                <label className="mt-4 block">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Internal note</span>
                    <textarea rows={4} value={availabilityForm.note} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, note: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Reason for lock or capacity adjustment" />
                </label>
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button type="button" onClick={clearAvailabilityOverride} disabled={availabilitySaving} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 disabled:opacity-50">Clear Override</button>
                    <button type="submit" disabled={availabilitySaving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{availabilitySaving ? 'Saving...' : 'Save Availability'}</button>
                </div>
            </form>

            <aside className="marketing-panel p-5">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Month overrides</h3>
                    <span className="rounded-md bg-primary-50 px-3 py-1 text-xs font-black text-primary-700">{availabilityOverrides.length}</span>
                </div>
                {availabilityLoading ? (
                    <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Loading availability...</p>
                ) : availabilityOverrides.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">No overrides for this month.</p>
                ) : (
                    <div className="space-y-3">
                        {availabilityOverrides.map((item) => (
                            <button key={item.id} type="button" onClick={() => selectAvailabilityDate(item.date)} className={`w-full rounded-xl border p-4 text-left transition ${availabilityDate === item.date ? 'border-primary-300 bg-primary-50' : 'border-slate-100 bg-slate-50 hover:bg-white'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-black text-slate-950">{formatDate(item.date)}</span>
                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${item.is_locked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{item.is_locked ? 'Locked' : 'Limited'}</span>
                                </div>
                                <p className="mt-2 text-xs font-bold text-slate-500">{item.remainingEvents} slots / {Number(item.remainingPax || 0).toLocaleString()} pax remaining</p>
                                {item.note && <p className="mt-2 text-xs font-semibold text-slate-400">{item.note}</p>}
                            </button>
                        ))}
                    </div>
                )}
            </aside>
        </div>
    );

    const concernLabels = {
        general: 'General',
        planning: 'Planning',
        availability: 'Availability',
        menu: 'Menu',
        pricing: 'Pricing',
        tasting: 'Tasting',
        active_booking: 'Active booking',
    };

    const renderPublicLeads = () => (
        <div className="space-y-4">
            <div className="marketing-panel staff-filter-bar">
                <input value={leadFilters.search} onChange={(event) => updateLeadFilter('search', event.target.value)} placeholder="Search name, email, phone, subject, or message" className="staff-control" />
                <select value={leadFilters.status} onChange={(event) => updateLeadFilter('status', event.target.value)} className="staff-control">
                    <option value="">All statuses</option>
                    {['New', 'In Review', 'Follow Up', 'Resolved', 'Closed'].map(status => <option key={status} value={status}>{status}</option>)}
                </select>
                <select value={leadFilters.concern_type} onChange={(event) => updateLeadFilter('concern_type', event.target.value)} className="staff-control">
                    <option value="">All concerns</option>
                    {Object.entries(concernLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input type="date" value={leadFilters.date_from} onChange={(event) => updateLeadFilter('date_from', event.target.value)} className="staff-control" />
                <input type="date" value={leadFilters.date_to} onChange={(event) => updateLeadFilter('date_to', event.target.value)} className="staff-control" />
            </div>

            <div className="marketing-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                         <thead className="border-b border-amber-100 bg-[#fffaf3] text-xs font-black uppercase tracking-widest text-slate-500">
                             <tr>
                                <th className="px-5 py-4">Guest</th>
                                 <th className="px-5 py-4">Concern</th>
                                <th className="px-5 py-4">Event</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-amber-100/70">
                             {leadLoading ? (
                                <tr><td colSpan="5" className="px-5 py-10 text-center font-bold text-slate-500">Loading guest inquiries...</td></tr>
                            ) : leadData.data.length === 0 ? (
                                <tr><td colSpan="5" className="px-5 py-10"><StaffEmptyState title="No guest inquiries found" message="Questions from the Contact page will appear here." /></td></tr>
                             ) : leadData.data.map((lead) => (
                                <tr key={lead.id} className="hover:bg-[#fffaf3]">
                                    <td className="px-5 py-4">
                                        <p className="font-black text-slate-950">{lead.full_name}</p>
                                        <p className="mt-1 text-xs font-semibold text-slate-500">{lead.email}{lead.phone ? ` / ${lead.phone}` : ''}</p>
                                        <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-400">{lead.subject}</p>
                                    </td>
                                    <td className="px-5 py-4"><StaffStatusBadge tone="muted">{concernLabels[lead.concern_type] || 'General'}</StaffStatusBadge></td>
                                    <td className="px-5 py-4 text-sm font-bold text-slate-600">
                                        <p>{lead.event_type || 'Not specified'}</p>
                                        <p className="mt-1 text-xs text-slate-400">{lead.event_date ? formatDate(lead.event_date) : 'No date'}{lead.pax ? ` / ${lead.pax} pax` : ''}</p>
                                    </td>
                                    <td className="px-5 py-4"><StaffStatusBadge tone={lead.status === 'Resolved' || lead.status === 'Closed' ? 'good' : lead.status === 'New' ? 'warn' : 'muted'}>{lead.status}</StaffStatusBadge></td>
                                    <td className="px-5 py-4 text-right">
                                        <button type="button" onClick={() => setSelectedLead(lead)} className="rounded-lg bg-[#720101] px-4 py-2 text-xs font-black text-white">Review</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <StaffPagination page={leadData.meta.current_page} perPage={leadData.meta.per_page} total={leadData.meta.total} onPageChange={(page) => updateLeadFilter('page', page)} onPerPageChange={(perPage) => updateLeadFilter('per_page', perPage)} />
            </div>

            {selectedLead && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm" onClick={() => setSelectedLead(null)}>
                     <aside className="custom-scrollbar h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                         <div className="flex items-start justify-between gap-4">
                             <div>
                                <p className="marketing-kicker">Guest inquiry</p>
                                 <h3 className="mt-2 text-2xl font-black text-slate-950">{selectedLead.full_name}</h3>
                                <p className="mt-1 text-sm font-bold text-slate-500">{selectedLead.email}{selectedLead.phone ? ` / ${selectedLead.phone}` : ''}</p>
                            </div>
                            <button type="button" onClick={() => setSelectedLead(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-500">Close</button>
                        </div>
                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            <select value={selectedLead.status || 'New'} disabled={leadSaving} onChange={(event) => updateLead(selectedLead.id, { status: event.target.value })} className="staff-control">
                                {['New', 'In Review', 'Follow Up', 'Resolved', 'Closed'].map(status => <option key={status}>{status}</option>)}
                            </select>
                            <button type="button" disabled={leadSaving} onClick={() => updateLead(selectedLead.id, { assigned_to: user?.id, status: selectedLead.status === 'New' ? 'In Review' : selectedLead.status })} className="rounded-lg bg-[#720101] px-4 py-3 text-sm font-black text-white disabled:opacity-60">Assign to me</button>
                        </div>
                        <div className="mt-6 rounded-2xl border border-amber-100 bg-[#fffaf3] p-5">
                            <p className="text-xs font-black uppercase tracking-widest text-[#9f6500]">{concernLabels[selectedLead.concern_type] || 'General'} / {selectedLead.event_type || 'No event type'}</p>
                            <h4 className="mt-2 text-lg font-black text-slate-950">{selectedLead.subject}</h4>
                            <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600">{selectedLead.message}</p>
                            <p className="mt-4 text-xs font-bold text-slate-400">{selectedLead.event_date ? formatDate(selectedLead.event_date) : 'No event date'}{selectedLead.pax ? ` / ${selectedLead.pax} pax` : ''}</p>
                        </div>
                        <label className="mt-6 block">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Internal notes</span>
                            <textarea rows={6} value={selectedLead.staff_notes || ''} onChange={(event) => setSelectedLead((current) => ({ ...current, staff_notes: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold" />
                        </label>
                        <div className="mt-4 flex justify-end gap-3">
                            <button type="button" disabled={leadSaving} onClick={() => updateLead(selectedLead.id, { staff_notes: selectedLead.staff_notes || '' })} className="rounded-lg border border-[#720101]/20 bg-white px-4 py-3 text-sm font-black text-[#720101] disabled:opacity-60">Save notes</button>
                            <button type="button" disabled={leadSaving} onClick={() => updateLead(selectedLead.id, { status: 'Resolved', staff_notes: selectedLead.staff_notes || '' })} className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60">Mark resolved</button>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );

    const renderInquiries = () => {
        const pendingBookings = bookings
            .filter(b => b.status === 'Pending' || ['Submitted', 'Under Review', 'Needs Customer Details', 'Clarification Received'].includes(b.review_status))
            .filter((booking) => {
                const query = inquirySearch.trim().toLowerCase();
                const reviewStatus = String(booking.review_status || booking.status || '').toLowerCase();
                const assigned = Boolean(booking.assigned_to);
                const eventTime = booking.event_date ? new Date(booking.event_date).getTime() : 0;
                const fromTime = inquiryDateFrom ? new Date(inquiryDateFrom).getTime() : null;
                const toTime = inquiryDateTo ? new Date(inquiryDateTo).getTime() : null;

                if (inquiryStatusFilter !== 'all' && reviewStatus !== inquiryStatusFilter) return false;
                if (inquiryAssignmentFilter === 'assigned' && !assigned) return false;
                if (inquiryAssignmentFilter === 'unassigned' && assigned) return false;
                if (fromTime !== null && eventTime < fromTime) return false;
                if (toTime !== null && eventTime > toTime) return false;
                if (!query) return true;

                return [
                    `booking #${booking.id}`,
                    String(booking.id),
                    booking.event_name,
                    booking.event_type,
                    booking.client_full_name,
                    booking.username,
                    booking.client_email,
                    booking.client_phone,
                    booking.venue_city,
                    booking.assigned_name,
                ].filter(Boolean).join(' ').toLowerCase().includes(query);
            })
            .sort((a, b) => {
                if (inquirySort === 'az' || inquirySort === 'za') {
                    const left = eventDisplayName(a).toLowerCase();
                    const right = eventDisplayName(b).toLowerCase();
                    return inquirySort === 'az' ? left.localeCompare(right) : right.localeCompare(left);
                }
                const leftDate = new Date(inquirySort === 'oldest' || inquirySort === 'newest' ? (a.created_at || a.event_date) : a.event_date || 0).getTime();
                const rightDate = new Date(inquirySort === 'oldest' || inquirySort === 'newest' ? (b.created_at || b.event_date) : b.event_date || 0).getTime();
                return inquirySort === 'oldest' || inquirySort === 'eventDateAsc' ? leftDate - rightDate : rightDate - leftDate;
            });
        const pagedPendingBookings = pendingBookings.slice((inquiryPage - 1) * inquiryPerPage, inquiryPage * inquiryPerPage);
        return (
            <div className="space-y-4">
                <div className="marketing-panel staff-filter-bar">
                    <input value={inquirySearch} onChange={(event) => setInquirySearch(event.target.value)} placeholder="Search booking, customer, phone, or city" className="staff-control" />
                    <select value={inquiryStatusFilter} onChange={(event) => setInquiryStatusFilter(event.target.value)} className="staff-control">
                        <option value="all">All statuses</option>
                        <option value="submitted">Submitted</option>
                        <option value="under review">Under Review</option>
                        <option value="needs customer details">Needs Customer Details</option>
                        <option value="clarification received">Clarification Received</option>
                    </select>
                    <select value={inquiryAssignmentFilter} onChange={(event) => setInquiryAssignmentFilter(event.target.value)} className="staff-control">
                        <option value="all">All owners</option>
                        <option value="assigned">Assigned</option>
                        <option value="unassigned">Unassigned</option>
                    </select>
                    <select value={inquirySort} onChange={(event) => setInquirySort(event.target.value)} className="staff-control">
                        <option value="eventDateAsc">Event date ascending</option>
                        <option value="eventDateDesc">Event date descending</option>
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="az">A-Z</option>
                        <option value="za">Z-A</option>
                    </select>
                    <input type="date" value={inquiryDateFrom} onChange={(event) => setInquiryDateFrom(event.target.value)} className="staff-control" />
                    <input type="date" value={inquiryDateTo} onChange={(event) => setInquiryDateTo(event.target.value)} className="staff-control" />
                </div>

                {(
                    <div className="marketing-panel overflow-hidden">
                        <ul className="divide-y divide-amber-100/70">
                            {pendingBookings.length === 0 ? <li className="p-8 text-gray-500 text-center">No pending inquiries.</li> : null}
                            {pagedPendingBookings.map(booking => (
                                <li key={booking.id} onClick={() => setSelectedBooking(booking)} className="block cursor-pointer transition-colors hover:bg-[#fffaf3]">
                                    <div className="px-6 py-5">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-primary-700 truncate">
                                                Booking #{booking.id} - {eventDisplayName(booking)}
                                            </p>
                                            <div className="ml-2 flex-shrink-0 flex">
                                                <p className="inline-flex rounded-md bg-yellow-100 px-3 py-1 text-xs font-bold leading-5 text-yellow-800">
                                                    {booking.review_status || booking.status}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                                            <span>Owner: {booking.assigned_name || 'Unassigned'}</span>
                                            {booking.clarification_request && (
                                                <span className="text-[#9f6500]">
                                                    {booking.clarification_response ? 'Customer responded' : 'Waiting for customer details'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-3 sm:flex sm:justify-between items-center">
                                            <div className="sm:flex gap-6">
                                                <p className="flex items-center text-sm text-gray-600">
                                                    <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    {formatDate(booking.event_date)}
                                                </p>
                                                <p className="flex items-center text-sm text-gray-600">
                                                    <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                    {booking.pax} pax
                                                </p>
                                                <p className="flex items-center text-sm text-gray-600">
                                                    <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    PHP {formatMoney(booking.budget)}
                                                </p>
                                            </div>
                                            <div className="mt-4 flex items-center text-sm sm:mt-0 space-x-3">
                                                {!booking.assigned_to && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); assignBooking(booking.id); }}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#720101]/15 bg-white px-4 py-1.5 font-bold text-[#720101] transition-colors hover:bg-[#720101]/5"
                                                    >
                                                        Claim
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); requestClarification(booking.id); }}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#f0aa0b]/40 bg-[#fff7e8] px-4 py-1.5 font-bold text-[#9f6500] transition-colors hover:bg-[#fff0cf]"
                                                >
                                                    Ask details
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateStatus(booking.id, 'Confirmed'); }}
                                                    disabled={!!updatingBookingIds[booking.id]}
                                                    className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-1.5 font-bold text-emerald-700 transition-colors hover:bg-emerald-100${updatingBookingIds[booking.id] ? ' opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    {updatingBookingIds[booking.id] === 'Confirmed' ? (
                                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                                    ) : (
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    )}
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateStatus(booking.id, 'Cancelled'); }}
                                                    disabled={!!updatingBookingIds[booking.id]}
                                                    className={`inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-1.5 font-bold text-rose-700 transition-colors hover:bg-rose-100${updatingBookingIds[booking.id] ? ' opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    {updatingBookingIds[booking.id] === 'Cancelled' ? (
                                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                                    ) : (
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    )}
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <StaffPagination page={inquiryPage} perPage={inquiryPerPage} total={pendingBookings.length} onPageChange={setInquiryPage} onPerPageChange={setInquiryPerPage} />
                    </div>
                )}
            </div>
        );
    };

    const generatePDF = (booking, type) => {
        let menuHTML = '';
        if (type === 'Kitchen Prep List' && booking.selected_menu) {
            try {
                const menu = typeof booking.selected_menu === 'string'
                    ? JSON.parse(booking.selected_menu)
                    : booking.selected_menu;
                const categories = { starters: 'Starters', mains: 'Main Courses', sides: 'Side Dishes', desserts: 'Desserts', drinks: 'Beverages' };
                let dishList = '';
                Object.keys(menu).forEach(cat => {
                    if (menu[cat] && menu[cat].length > 0) {
                        const items = menu[cat].map(item => {
                            if (typeof item === 'object' && item !== null) return item.name;
                            const dish = DISHES[cat]?.find(d => d.id === item);
                            return dish ? dish.name : item;
                        }).join(', ');
                        dishList += `<li><strong>${categories[cat] || cat}:</strong> ${items}</li>`;
                    }
                });
                if (dishList) {
                    menuHTML = `
                        <h4 style="margin-top: 20px; text-decoration: underline;">Selected Menu</h4>
                        <ul style="line-height: 1.6;">${dishList}</ul>
                    `;
                }
            } catch (e) {
                console.error("Error parsing menu for PDF:", e);
            }
        }

        const content = `
            <html>
                <head>
                    <title>${type} - Booking #${booking.id}</title>
                    <style>
                        body { font-family: serif; padding: 40px; }
                        h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
                        .header { margin-bottom: 30px; }
                        .details { margin-bottom: 30px; line-height: 1.6; }
                        .footer { margin-top: 50px; text-align: center; font-size: 0.8em; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>ELOQUENTE CATERING SERVICES</h1>
                        <h2 style="text-align:center">${type.toUpperCase()}</h2>
                    </div>

                    <div class="details">
                        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                        <p><strong>Event Date:</strong> ${formatDate(booking.event_date)}</p>
                        <p><strong>Client:</strong> ${booking.client_full_name || booking.username}</p>
                        <p><strong>Email:</strong> ${booking.client_email || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${booking.client_phone || 'N/A'}</p>
                        <p><strong>Pax:</strong> ${booking.pax}</p>
                        <p><strong>Venue:</strong> ${[booking.venue_address_line, booking.venue_street, booking.venue_city, booking.venue_province, booking.venue_zip_code].filter(Boolean).join(', ') || 'N/A'}</p>
                        ${booking.special_instructions ? `<p><strong>Special Notes:</strong> ${booking.special_instructions}</p>` : ''}
                        
                        ${type === 'Contract' ? `
                            <p><strong>Total Budget:</strong> PHP {(booking.total_cost || booking.budget || 0).toLocaleString()}</p>
                            <p><strong>Terms:</strong> 50% Downpayment required to secure date.</p>
                            <br><br>
                            <div style="display:flex; justify-content:space-between; margin-top:50px;">
                                <div>_____________________<br>Client Signature</div>
                                <div>_____________________<br>Eloquente Representative</div>
                            </div>
                        ` : `
                            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px dashed #ccc;">
                                <h3>Kitchen Preparation</h3>
                                <ul>
                                    <li>Prepare service for ${booking.pax} guests</li>
                                    <li>Suggested service team: ${Math.ceil(booking.pax / 20)} staff</li>
                                </ul>
                                ${menuHTML}
                            </div>
                        `}
                    </div>

                    <div class="footer">
                        Generated by Eloquente Marketing Module
                    </div>
                    <script>window.print();</script>
                </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(content);
        win.document.close();
    };

    const renderDocuments = () => {
        const confirmedBookings = bookings.filter(b => b.status === 'Confirmed');
        return (
            <div className="marketing-panel overflow-hidden">
                <ul className="divide-y divide-amber-100/70">
                    {confirmedBookings.length === 0 ? <li className="p-6 text-gray-500 text-center">No confirmed events for documentation.</li> : null}
                    {confirmedBookings.map(booking => (
                        <li key={booking.id} className="block hover:bg-[#fffaf3]">
                            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        Booking #{booking.id} - {booking.client_full_name || booking.username}
                                    </h3>
                                    <p className="mt-1 text-sm font-medium text-gray-500">
                                        {formatDate(booking.event_date)} at {formatTime(booking.event_time)}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={() => generatePDF(booking, 'Contract')}
                                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                                    >
                                        Generate Contract
                                    </button>
                                    <button
                                        onClick={() => generatePDF(booking, 'Kitchen Prep List')}
                                        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
                                    >
                                        Generate Prep List
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    const renderSettings = () => {
        const categories = ['starter', 'main', 'side', 'dessert', 'drink'];
        const visibleItems = menuItems.filter(item => item.category === activeMenuCategory);

        return (
            <>
            <div className="marketing-panel overflow-hidden">
                <div className="border-b border-amber-100/80 bg-[#fffaf3] px-6 pt-2">
                    <nav className="flex gap-2 overflow-x-auto">
                        {[
                            ['packages', 'Packages'],
                            ['eventTypes', 'Event Types'],
                            ['menuItems', 'Menu Items'],
                        ].map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setActiveConfigTab(key)}
                                className={`whitespace-nowrap rounded-t-lg px-4 py-3 text-sm font-black transition-colors ${activeConfigTab === key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:bg-white/70 hover:text-gray-800'}`}
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
                                <input required value={packageForm.name} onChange={e => setPackageForm({ ...packageForm, name: e.target.value })} placeholder="Package name" className="lg:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <select required value={packageForm.type} onChange={e => setPackageForm({ ...packageForm, type: e.target.value, event_type_slugs: packageForm.event_type_slugs?.includes(e.target.value) ? packageForm.event_type_slugs : [...(packageForm.event_type_slugs || []), e.target.value] })} className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100">
                                    {eventTypes.map(type => <option key={type.id} value={type.slug}>{type.label}</option>)}
                                </select>
                                <select value={packageForm.package_category} onChange={e => setPackageForm({ ...packageForm, package_category: e.target.value })} className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100">
                                    {PACKAGE_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <input required type="number" min="0" value={packageForm.base_price_per_head} onChange={e => setPackageForm({ ...packageForm, base_price_per_head: e.target.value })} placeholder="Price / head" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <input required type="number" min="1" value={packageForm.minimum_pax} onChange={e => setPackageForm({ ...packageForm, minimum_pax: e.target.value })} placeholder="Min pax" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <button disabled={settingsSaving} className="lg:col-span-1 rounded-lg bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60">{settingsSaving ? 'Saving...' : editingPackageId ? 'Save' : 'Create'}</button>
                                <label className="lg:col-span-4 text-xs font-black uppercase tracking-wide text-slate-500">
                                    Connected event types
                                    <select multiple value={packageForm.event_type_slugs || []} onChange={e => setPackageForm({ ...packageForm, event_type_slugs: Array.from(e.target.selectedOptions).map(option => option.value) })} className="mt-2 min-h-28 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium normal-case outline-none focus:ring-2 focus:ring-primary-100">
                                        {eventTypes.map(type => <option key={type.id} value={type.slug}>{type.label}</option>)}
                                    </select>
                                </label>
                                <textarea value={packageForm.description} onChange={e => setPackageForm({ ...packageForm, description: e.target.value })} placeholder="Description" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <textarea value={packageForm.inclusions} onChange={e => setPackageForm({ ...packageForm, inclusions: e.target.value })} placeholder="Inclusions, one per line" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <textarea value={packageForm.amenities} onChange={e => setPackageForm({ ...packageForm, amenities: e.target.value })} placeholder="Amenities, one per line" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <textarea value={packageForm.applicable_setups} onChange={e => setPackageForm({ ...packageForm, applicable_setups: e.target.value })} placeholder="Applicable setup notes, one per line" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <select value={packageForm.security_type} onChange={e => setPackageForm({ ...packageForm, security_type: e.target.value, security_label: e.target.value === 'contingency' ? '10% Contingency' : 'Php 1,500 Cash Bond' })} className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100">
                                    {SECURITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <input value={packageForm.security_label} onChange={e => setPackageForm({ ...packageForm, security_label: e.target.value })} placeholder="Security label" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
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
                                            <input type="number" min="0" value={packageForm.menu_structure?.[key] ?? 0} onChange={e => setPackageForm({ ...packageForm, menu_structure: { ...(packageForm.menu_structure || {}), [key]: Number(e.target.value || 0) } })} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold normal-case outline-none focus:ring-2 focus:ring-primary-100" />
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
                                    {packages.map(pkg => (
                                        <tr key={pkg.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-bold text-gray-900">{pkg.name}</td>
                                            <td className="px-6 py-4"><span className="rounded-md bg-primary-50 px-2.5 py-1 text-xs font-black uppercase text-primary-700">{eventTypes.find(type => type.slug === pkg.type)?.label || pkg.type}</span></td>
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
                    </div>
                )}

                {activeConfigTab === 'eventTypes' && (
                    <div>
                        <form onSubmit={handleEventTypeSubmit} className="border-b border-gray-100 p-6">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                                <input required value={eventTypeForm.label} onChange={e => setEventTypeForm({ ...eventTypeForm, label: e.target.value })} placeholder="Event type name" className="lg:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <input value={eventTypeForm.slug} onChange={e => setEventTypeForm({ ...eventTypeForm, slug: e.target.value })} placeholder="Short name (optional)" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <input value={eventTypeForm.icon} onChange={e => setEventTypeForm({ ...eventTypeForm, icon: e.target.value })} placeholder="Icon name" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <input value={eventTypeForm.image} onChange={e => setEventTypeForm({ ...eventTypeForm, image: e.target.value })} placeholder="Image link" className="lg:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <button disabled={settingsSaving} className="lg:col-span-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60">{settingsSaving ? 'Saving...' : editingEventTypeId ? 'Save Type' : 'Create Type'}</button>
                                <select value={eventTypeForm.package_category} onChange={e => setEventTypeForm({ ...eventTypeForm, package_category: e.target.value })} className="lg:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100">
                                    {PACKAGE_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <select value={eventTypeForm.security_type} onChange={e => setEventTypeForm({ ...eventTypeForm, security_type: e.target.value, security_label: e.target.value === 'contingency' ? '10% Contingency' : 'Php 1,500 Cash Bond' })} className="lg:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100">
                                    {SECURITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <input value={eventTypeForm.security_label} onChange={e => setEventTypeForm({ ...eventTypeForm, security_label: e.target.value })} placeholder="Security label" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <textarea value={eventTypeForm.description} onChange={e => setEventTypeForm({ ...eventTypeForm, description: e.target.value })} placeholder="Description" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <textarea value={eventTypeForm.applicable_setups} onChange={e => setEventTypeForm({ ...eventTypeForm, applicable_setups: e.target.value })} placeholder="Applicable setups, one per line" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <textarea value={eventTypeForm.security_description} onChange={e => setEventTypeForm({ ...eventTypeForm, security_description: e.target.value })} placeholder="Security term explanation" className="lg:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
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
                                    {eventTypes.map(type => (
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
                    </div>
                )}

                {activeConfigTab === 'menuItems' && (
                    <div>
                        <div className="border-b border-gray-100 p-6">
                            <nav className="flex gap-2 overflow-x-auto">
                                {categories.map(category => (
                                    <button key={category} onClick={() => setActiveMenuCategory(category)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold capitalize transition-colors ${activeMenuCategory === category ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        {category}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Menu Item</th>
                                        <th className="px-6 py-4 text-left">Category</th>
                                        <th className="px-6 py-4 text-right">Cost / Head</th>
                                        <th className="px-6 py-4 text-right">Price Adj</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {visibleItems.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{item.name}</div>
                                                <div className="text-xs text-gray-500">{item.description || 'No description'}</div>
                                            </td>
                                            <td className="px-6 py-4 capitalize text-gray-600">{item.category}</td>
                                            <td className="px-6 py-4 text-right"><input id={`marketing_cost_${item.id}`} type="number" defaultValue={item.cost_per_head} className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-right text-sm font-bold outline-none focus:ring-2 focus:ring-primary-100" /></td>
                                            <td className="px-6 py-4 text-right"><input id={`marketing_adj_${item.id}`} type="number" defaultValue={item.price_adj || 0} className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-right text-sm font-bold outline-none focus:ring-2 focus:ring-primary-100" /></td>
                                            <td className="px-6 py-4 text-right"><button onClick={() => handleDishPricingUpdate(item, document.getElementById(`marketing_cost_${item.id}`).value, document.getElementById(`marketing_adj_${item.id}`).value)} disabled={settingsSaving} className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-60">Save</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {visibleItems.length === 0 && <div className="p-8 text-center text-sm text-gray-500">No menu items in this category.</div>}
                        </div>
                    </div>
                )}
            </div>

            {false && <>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Preset Packages by Event Type</h3>
                        <p className="text-xs text-gray-500 mt-1">Create reusable package presets for client booking flows.</p>
                    </div>
                    <form onSubmit={handlePackageSubmit} className="p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                        <input required value={packageForm.name} onChange={e => setPackageForm({ ...packageForm, name: e.target.value })} placeholder="Package name" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <select required value={packageForm.type} onChange={e => setPackageForm({ ...packageForm, type: e.target.value })} className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100">
                            {eventTypes.map(type => <option key={type.id} value={type.slug}>{type.label}</option>)}
                        </select>
                        <input required type="number" min="0" value={packageForm.base_price_per_head} onChange={e => setPackageForm({ ...packageForm, base_price_per_head: e.target.value })} placeholder="Price / head" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <input required type="number" min="1" value={packageForm.minimum_pax} onChange={e => setPackageForm({ ...packageForm, minimum_pax: e.target.value })} placeholder="Min pax" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <button disabled={settingsSaving} className="rounded-lg bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60">{settingsSaving ? 'Saving...' : 'Create'}</button>
                        <textarea value={packageForm.description} onChange={e => setPackageForm({ ...packageForm, description: e.target.value })} placeholder="Description" className="md:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <textarea value={packageForm.inclusions} onChange={e => setPackageForm({ ...packageForm, inclusions: e.target.value })} placeholder="Inclusions, one per line" className="md:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                    </form>
                    <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {packages.map(pkg => (
                            <div key={pkg.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs font-black uppercase text-primary-600">{pkg.type}</p>
                                <h4 className="mt-1 font-bold text-gray-900">{pkg.name}</h4>
                                <p className="text-sm text-gray-600">PHP {Number(pkg.base_price_per_head || 0).toLocaleString()} / head · min {pkg.minimum_pax} pax</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Event Types</h3>
                        <p className="text-xs text-gray-500 mt-1">Create, edit, or delete the event categories used by package presets.</p>
                    </div>
                    <form onSubmit={handleEventTypeSubmit} className="p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                        <input required value={eventTypeForm.label} onChange={e => setEventTypeForm({ ...eventTypeForm, label: e.target.value })} placeholder="Event type name" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <input value={eventTypeForm.slug} onChange={e => setEventTypeForm({ ...eventTypeForm, slug: e.target.value })} placeholder="Short name (optional)" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <input value={eventTypeForm.icon} onChange={e => setEventTypeForm({ ...eventTypeForm, icon: e.target.value })} placeholder="Icon name" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <input value={eventTypeForm.image} onChange={e => setEventTypeForm({ ...eventTypeForm, image: e.target.value })} placeholder="Image link" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <textarea value={eventTypeForm.description} onChange={e => setEventTypeForm({ ...eventTypeForm, description: e.target.value })} placeholder="Description" className="md:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <div className="md:col-span-2 flex gap-2">
                            {editingEventTypeId && <button type="button" onClick={resetEventTypeForm} className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>}
                            <button disabled={settingsSaving} className="flex-1 rounded-lg bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60">{settingsSaving ? 'Saving...' : editingEventTypeId ? 'Save Type' : 'Create Type'}</button>
                        </div>
                    </form>
                    <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {eventTypes.map(type => (
                            <div key={type.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs font-black uppercase text-primary-600">{type.slug}</p>
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

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Dish Pricing</h3>
                    </div>
                    <div className="border-b border-gray-100 px-6 pt-2">
                        <nav className="-mb-px flex space-x-8 overflow-x-auto">
                            {categories.map(category => (
                                <button key={category} onClick={() => setActiveMenuCategory(category)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm capitalize transition-colors ${activeMenuCategory === category ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                    {category}
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {visibleItems.map(item => (
                            <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <h4 className="font-bold text-gray-900">{item.name}</h4>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <input id={`marketing_cost_${item.id}`} type="number" defaultValue={item.cost_per_head} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold" />
                                    <input id={`marketing_adj_${item.id}`} type="number" defaultValue={item.price_adj || 0} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold" />
                                </div>
                                <button onClick={() => handleDishPricingUpdate(item, document.getElementById(`marketing_cost_${item.id}`).value, document.getElementById(`marketing_adj_${item.id}`).value)} disabled={settingsSaving} className="mt-3 w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60">Save Pricing</button>
                            </div>
                        ))}
                    </div>
                </div>
            </>}
            </>
        );
    };

    if (loading) return (
        <div className="marketing-page flex min-h-screen items-center justify-center p-6">
            <div className="marketing-panel w-full max-w-md p-8 text-center">
                <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-amber-100 border-t-primary-700"></div>
                <p className="marketing-kicker">Marketing Workspace</p>
                <h1 className="mt-2 text-2xl font-bold text-slate-950">Loading marketing workspace</h1>
                <p className="mt-2 text-sm font-medium text-slate-500">Pulling event schedules, lead queues, and catalog controls.</p>
            </div>
        </div>
    );

    return (
        <StaffWorkspaceLayout
            title="Marketing Workspace"
            roleLabel="Marketing team"
            username={user?.username}
            active={activeTab}
            onNavigate={setActiveTab}
            onLogout={handleLogout}
            navGroups={[
                {
                    label: 'Daily work',
                     items: [
                         { id: 'today', label: 'Today', count: marketingSummary.pending + marketingSummary.needsDetails },
                         { id: 'intake', label: 'Intake', count: dashboardSummary.pending },
                        { id: 'leads', label: 'Guest Inquiries', count: leadData.summary?.open || 0 },
                         { id: 'calendar', label: 'Calendar', count: dashboardSummary.monthEvents },
                        { id: 'preparation', label: 'Preparation', count: marketingSummary.upcoming },
                        { id: 'messages', label: 'Messages' },
                    ],
                },
                {
                    label: 'Operations',
                    items: [
                        { id: 'availability', label: 'Availability' },
                        { id: 'documents', label: 'Documents' },
                        { id: 'content', label: 'Announcements' },
                        { id: 'settings', label: 'Menu Setup' },
                    ],
                },
            ]}
        >
                <StaffPageHeader
                    eyebrow={activeTab === 'today' ? 'Today' : 'Marketing workflow'}
                    title={activeTab === 'today' ? 'Booking workbench' : tabMeta[activeTab]}
                    metrics={[
                        { label: 'Upcoming', value: dashboardSummary.upcoming },
                        { label: 'Pending', value: dashboardSummary.pending },
                        { label: 'This Month', value: dashboardSummary.monthEvents },
                        { label: 'Pipeline', value: `PHP ${formatMoney(dashboardSummary.pipeline)}` },
                    ]}
                />

                {activeTab === 'today' && renderToday()}

                {activeTab === 'calendar' && (
                    <div className="marketing-panel p-5 lg:p-6">
                        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                                    {selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => setShowExportModal(true)}
                                    className="marketing-primary-btn flex items-center px-4 py-2 text-sm"
                                >
                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Download Report
                                </button>
                                <button
                                    onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Prev
                                </button>
                                <button
                                    onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-amber-100 bg-amber-100/70">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="bg-[#fffaf3] py-3 text-center text-xs font-black uppercase tracking-wide text-slate-500">
                                    {day}
                                </div>
                            ))}
                            {renderCalendar()}
                        </div>
                    </div>
                )}

                {activeTab === 'intake' && renderInquiries()}
                {activeTab === 'leads' && renderPublicLeads()}
                {activeTab === 'availability' && renderAvailability()}
                {activeTab === 'preparation' && (
                    <Suspense fallback={<div className="rounded-2xl border border-[#ead8cc] bg-white p-6 text-sm font-bold text-slate-500">Loading preparation board...</div>}>
                        <PreparationBoard />
                    </Suspense>
                )}
                {activeTab === 'documents' && renderDocuments()}
                {activeTab === 'content' && (
                    <Suspense fallback={<div className="rounded-2xl border border-[#ead8cc] bg-white p-6 text-sm font-bold text-slate-500">Loading content tools...</div>}>
                        <AnnouncementManager user={user} />
                    </Suspense>
                )}
                {activeTab === 'settings' && renderSettings()}
                {activeTab === 'messages' && (
                    <Suspense fallback={<div className="rounded-2xl border border-[#ead8cc] bg-white p-6 text-sm font-bold text-slate-500">Loading messages...</div>}>
                        <StaffMessaging />
                    </Suspense>
                )}
            {renderBookingModal()}
            {renderExportModal()}
            <PromptModal
                isOpen={clarificationPrompt.isOpen}
                title="Request customer details"
                message="Tell the customer exactly what the team needs before this booking can move forward."
                label="Details needed"
                placeholder="Example: Please confirm the final venue access time and updated headcount."
                minLength={5}
                confirmText="Send Request"
                onCancel={() => setClarificationPrompt({ isOpen: false, bookingId: null })}
                onConfirm={submitClarificationRequest}
            />
            <ConfirmModal
                isOpen={deleteEventTypeConfirm.isOpen}
                title={`Delete ${deleteEventTypeConfirm.eventType?.label || 'event type'}?`}
                message="Packages using this event type will move to Other."
                confirmText="Delete"
                tone="danger"
                onCancel={() => setDeleteEventTypeConfirm({ isOpen: false, eventType: null })}
                onConfirm={confirmDeleteEventType}
                busy={settingsSaving}
            />
            <FlashToast />
        </StaffWorkspaceLayout>
    );
};

export default DashboardMarketing;
