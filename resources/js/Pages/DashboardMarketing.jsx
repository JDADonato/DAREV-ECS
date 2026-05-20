import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { router } from '@inertiajs/react';
import StaffMessaging from '../Components/common/StaffMessaging';
import NotificationBell from '../Components/common/NotificationBell';
import FlashToast from '../Components/common/FlashToast';
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

const DashboardMarketing = () => {
    const { user, logout } = useAuth();
    const toast = useToast();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('calendar');
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [menuItems, setMenuItems] = useState([]);
    const [packages, setPackages] = useState([]);
    const [eventTypes, setEventTypes] = useState([]);
    const [eventTypeForm, setEventTypeForm] = useState({ label: '', slug: '', icon: 'sparkles', description: '', image: '' });
    const [editingEventTypeId, setEditingEventTypeId] = useState(null);
    const [activeMenuCategory, setActiveMenuCategory] = useState('starter');
    const [activeConfigTab, setActiveConfigTab] = useState('packages');
    const [packageForm, setPackageForm] = useState({ name: '', type: '', base_price_per_head: '', minimum_pax: 50, description: '', inclusions: '' });
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [updatingBookingIds, setUpdatingBookingIds] = useState({});

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
        if (activeTab === 'settings') {
            fetchMarketingSettings();
        }
    }, [activeTab]);

    useSmartRefresh({
        enabled: true,
        interval: activeTab === 'settings' ? 120000 : 90000,
        idleAfter: 180000,
        refresh: ({ silent = false } = {}) => {
            if (activeTab === 'settings') {
                fetchMarketingSettings();
            } else {
                fetchBookings({ silent });
            }
        },
    });

    const fetchBookings = async ({ silent = false } = {}) => {
        try {
            // Session auth - no token needed
            const response = await fetch('/api/marketing/bookings', {
                headers: {
                    'Accept': 'application/json',
                }
            });
            if (response.ok) {
                const data = await response.json();
                setBookings(data);
            }
        } catch (error) {
            console.error("Error fetching bookings:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleLogout = () => {
        router.post('/logout');
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
            toast.error('Network error. Please check your connection.');
        } finally {
            setUpdatingBookingIds(prev => { const n = { ...prev }; delete n[id]; return n; });
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
                setPackageForm(prev => ({ ...prev, type: prev.type || types[0]?.slug || '' }));
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
            const response = await fetch('/api/settings/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(packageForm),
            });
            if (response.ok) {
                setPackageForm({ name: '', type: eventTypes[0]?.slug || '', base_price_per_head: '', minimum_pax: 50, description: '', inclusions: '' });
                fetchMarketingSettings();
            }
        } catch (error) {
            console.error('Error creating package:', error);
        } finally {
            setSettingsSaving(false);
        }
    };

    const resetEventTypeForm = () => {
        setEditingEventTypeId(null);
        setEventTypeForm({ label: '', slug: '', icon: 'sparkles', description: '', image: '' });
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
        });
    };

    const handleDeleteEventType = async (eventType) => {
        if (!window.confirm(`Delete ${eventType.label}? Packages using this type will move to Other.`)) return;
        setSettingsSaving(true);
        try {
            const response = await fetch(`/api/settings/event-types/${eventType.id}`, { method: 'DELETE' });
            if (response.ok) fetchMarketingSettings();
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
        return `${time} • ${eventType} • ${client}`;
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

    const dashboardSummary = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
        const pending = bookings.filter(b => b.status === 'Pending');
        const confirmed = bookings.filter(b => b.status === 'Confirmed');
        const monthEvents = bookings.filter(b => b.event_date?.substring(0, 7) === monthKey);
        const upcoming = bookings.filter(b => {
            if (!b.event_date || !['Pending', 'Confirmed'].includes(b.status)) return false;
            const eventDate = new Date(b.event_date);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= now;
        });

        return {
            pending: pending.length,
            confirmed: confirmed.length,
            monthEvents: monthEvents.length,
            upcoming: upcoming.length,
            pipeline: pending.reduce((sum, booking) => sum + getBookingValue(booking), 0),
        };
    }, [bookings, selectedMonth]);

    const tabMeta = {
        calendar: 'Calendar',
        inquiries: 'Inquiries',
        documents: 'Documents',
        settings: 'Catalog',
        messages: 'Messages',
    };

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(selectedMonth);
        const firstDay = getFirstDayOfMonth(selectedMonth);
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="marketing-calendar-cell marketing-calendar-cell-empty"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBookings = bookings.filter(b => b.event_date && b.event_date.substring(0, 10) === dateStr);

            days.push(
                <div key={day} className="marketing-calendar-cell custom-scrollbar">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-black text-slate-700">{day}</span>
                        {dayBookings.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">{dayBookings.length}</span>}
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
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Comm Link (Email)</p>
                                        <p className="text-sm text-gray-700">{selectedBooking.client_email || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Comm Link (Phone)</p>
                                        <p className="text-sm text-gray-700">{selectedBooking.client_phone || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                                <h4 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-900">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    Temporal Constraints
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Execution Date</p>
                                        <p className="text-sm font-semibold text-gray-900">{formatDate(selectedBooking.event_date)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Start Time</p>
                                        <p className="text-sm text-gray-700">{formatTime(selectedBooking.event_time)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Status Payload</p>
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
                            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Financial Matrix</h4>
                            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">Headcount (Pax)</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedBooking.pax}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">Base Contract (PHP)</p>
                                    <p className="text-lg font-bold text-gray-900">{formatMoney(selectedBooking.total_cost || selectedBooking.budget)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">Logistics Toll (PHP)</p>
                                    <p className="text-lg font-bold text-orange-600">{formatMoney(selectedBooking.transport_fee)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">Labor Index (PHP)</p>
                                    <p className="text-lg font-bold text-orange-600">{formatMoney(selectedBooking.labor_surcharge)}</p>
                                </div>
                            </div>
                        </div>

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
                            <h3 className="text-lg font-bold text-white">Export Calendar as PDF</h3>
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
                            Export PDF
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderInquiries = () => {
        const pendingBookings = bookings.filter(b => b.status === 'Pending');
        return (
            <div className="space-y-4">
                <div className="marketing-panel flex flex-col gap-2 p-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="marketing-kicker">Lead Queue</p>
                        <h2 className="mt-1 text-xl font-bold text-slate-950">{pendingBookings.length} pending inquiries</h2>
                    </div>
                    <p className="text-sm font-semibold text-slate-500">Newest client requests that need a decision.</p>
                </div>

                {(
                    <div className="marketing-panel overflow-hidden">
                        <ul className="divide-y divide-amber-100/70">
                            {pendingBookings.length === 0 ? <li className="p-8 text-gray-500 text-center">No pending inquiries.</li> : null}
                            {pendingBookings.map(booking => (
                                <li key={booking.id} onClick={() => setSelectedBooking(booking)} className="block cursor-pointer transition-colors hover:bg-[#fffaf3]">
                                    <div className="px-6 py-5">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-primary-700 truncate">
                                                Booking #{booking.id} - {booking.client_full_name || booking.username}
                                            </p>
                                            <div className="ml-2 flex-shrink-0 flex">
                                                <p className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-yellow-100 text-yellow-800">
                                                    {booking.status}
                                                </p>
                                            </div>
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
                    </div>
                )}
            </div>
        );
    };

    const generatePDF = (booking, type) => {
        let menuHTML = '';
        if (type === 'Kitchen Prep List' && booking.selected_menu) {
            try {
                const menu = JSON.parse(booking.selected_menu);
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
                        <p><strong>Event Date:</strong> ${booking.event_date}</p>
                        <p><strong>Client:</strong> ${booking.client_full_name || booking.username}</p>
                        <p><strong>Email:</strong> ${booking.client_email || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${booking.client_phone || 'N/A'}</p>
                        <p><strong>Pax:</strong> ${booking.pax}</p>
                        <p><strong>Venue:</strong> ${[booking.venue_address_line, booking.venue_street, booking.venue_city, booking.venue_province, booking.venue_zip_code].filter(Boolean).join(', ') || 'N/A'}</p>
                        ${booking.special_instructions ? `<p><strong>Special Instructions/Restrictions:</strong> ${booking.special_instructions}</p>` : ''}
                        
                        ${type === 'Contract' ? `
                            <p><strong>Total Budget:</strong> ₱${(booking.total_cost || booking.budget || 0).toLocaleString()}</p>
                            <p><strong>Terms:</strong> 50% Downpayment required to secure date.</p>
                            <br><br>
                            <div style="display:flex; justify-content:space-between; margin-top:50px;">
                                <div>_____________________<br>Client Signature</div>
                                <div>_____________________<br>Eloquente Representative</div>
                            </div>
                        ` : `
                            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px dashed #ccc;">
                                <h3>Kitchen Prep Required</h3>
                                <ul>
                                    <li>Prep for ${booking.pax} pax (${booking.package_id || 'custom'} package)</li>
                                    <li>Staff allocation: ${Math.ceil(booking.pax / 20)} servers</li>
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
                <div className="border-b border-amber-100/80 bg-[#fffaf3] px-6 py-5">
                    <p className="marketing-kicker">Production Docs</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-950">{confirmedBookings.length} confirmed events ready for paperwork</h2>
                </div>
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
                <div className="border-b border-amber-100/80 bg-[#fffaf3] px-6 pt-5">
                    <p className="marketing-kicker">Client-Facing Catalog</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-950">Packages, event types, and dish pricing</h2>
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
                                <select required value={packageForm.type} onChange={e => setPackageForm({ ...packageForm, type: e.target.value })} className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100">
                                    {eventTypes.map(type => <option key={type.id} value={type.slug}>{type.label}</option>)}
                                </select>
                                <input required type="number" min="0" value={packageForm.base_price_per_head} onChange={e => setPackageForm({ ...packageForm, base_price_per_head: e.target.value })} placeholder="Price / head" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <input required type="number" min="1" value={packageForm.minimum_pax} onChange={e => setPackageForm({ ...packageForm, minimum_pax: e.target.value })} placeholder="Min pax" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <button disabled={settingsSaving} className="lg:col-span-3 rounded-lg bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60">{settingsSaving ? 'Saving...' : 'Create Package'}</button>
                                <textarea value={packageForm.description} onChange={e => setPackageForm({ ...packageForm, description: e.target.value })} placeholder="Description" className="lg:col-span-6 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <textarea value={packageForm.inclusions} onChange={e => setPackageForm({ ...packageForm, inclusions: e.target.value })} placeholder="Inclusions, one per line" className="lg:col-span-6 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                            </div>
                        </form>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Package</th>
                                        <th className="px-6 py-4 text-left">Event Type</th>
                                        <th className="px-6 py-4 text-right">Price / Head</th>
                                        <th className="px-6 py-4 text-right">Min Pax</th>
                                        <th className="px-6 py-4 text-left">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {packages.map(pkg => (
                                        <tr key={pkg.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-bold text-gray-900">{pkg.name}</td>
                                            <td className="px-6 py-4"><span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-black uppercase text-primary-700">{eventTypes.find(type => type.slug === pkg.type)?.label || pkg.type}</span></td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-900">PHP {Number(pkg.base_price_per_head || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right text-gray-600">{pkg.minimum_pax}</td>
                                            <td className="px-6 py-4 text-gray-600">{pkg.description || 'No description'}</td>
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
                                <input value={eventTypeForm.slug} onChange={e => setEventTypeForm({ ...eventTypeForm, slug: e.target.value })} placeholder="Slug (auto if blank)" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <input value={eventTypeForm.icon} onChange={e => setEventTypeForm({ ...eventTypeForm, icon: e.target.value })} placeholder="Icon key" className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <input value={eventTypeForm.image} onChange={e => setEventTypeForm({ ...eventTypeForm, image: e.target.value })} placeholder="Image URL" className="lg:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                <button disabled={settingsSaving} className="lg:col-span-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60">{settingsSaving ? 'Saving...' : editingEventTypeId ? 'Save Type' : 'Create Type'}</button>
                                <textarea value={eventTypeForm.description} onChange={e => setEventTypeForm({ ...eventTypeForm, description: e.target.value })} placeholder="Description" className="lg:col-span-10 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                                {editingEventTypeId && <button type="button" onClick={resetEventTypeForm} className="lg:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel Edit</button>}
                            </div>
                        </form>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Event Type</th>
                                        <th className="px-6 py-4 text-left">Slug</th>
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
                        <input value={eventTypeForm.slug} onChange={e => setEventTypeForm({ ...eventTypeForm, slug: e.target.value })} placeholder="Slug (auto if blank)" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <input value={eventTypeForm.icon} onChange={e => setEventTypeForm({ ...eventTypeForm, icon: e.target.value })} placeholder="Icon key" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <input value={eventTypeForm.image} onChange={e => setEventTypeForm({ ...eventTypeForm, image: e.target.value })} placeholder="Image URL" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
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
                <h1 className="mt-2 text-2xl font-bold text-slate-950">Loading campaign operations</h1>
                <p className="mt-2 text-sm font-medium text-slate-500">Pulling event schedules, lead queues, and catalog controls.</p>
            </div>
        </div>
    );

    return (
        <div className="marketing-page min-h-screen">
            <nav className="marketing-topbar sticky top-0 z-30">
                <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
                    <div className="flex min-h-16 flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="marketing-kicker">Eloquente</p>
                            <h1 className="text-xl font-bold font-display text-slate-950">Marketing Executive Dashboard</h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">Live workspace</div>
                            <NotificationBell variant="dark" />
                            <span className="text-sm font-bold text-slate-700">{user?.username}</span>
                            <button onClick={handleLogout} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-500 hover:text-slate-900">Logout</button>
                        </div>
                    </div>
                </div>
            </nav>
            <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
                <section className="marketing-command mb-5">
                    <div>
                        <p className="marketing-kicker">Marketing Operations</p>
                        <h2 className="mt-1 text-2xl font-bold text-slate-950">Event pipeline</h2>
                    </div>
                    <div className="marketing-metrics">
                        <div><span>Upcoming</span><strong>{dashboardSummary.upcoming}</strong></div>
                        <div><span>Pending</span><strong>{dashboardSummary.pending}</strong></div>
                        <div><span>This Month</span><strong>{dashboardSummary.monthEvents}</strong></div>
                        <div><span>Pipeline</span><strong>PHP {formatMoney(dashboardSummary.pipeline)}</strong></div>
                    </div>
                </section>

                <div className="marketing-nav-wrap mb-5">
                    <nav className="marketing-nav">
                        {['calendar', 'inquiries', 'documents', 'settings', 'messages'].map((tab) => {
                            return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`marketing-tab ${activeTab === tab ? 'marketing-tab-active' : ''}`}
                            >
                                <span>{tabMeta[tab]}</span>
                                {tab === 'inquiries' && dashboardSummary.pending > 0 && <em>{dashboardSummary.pending}</em>}
                                {tab === 'calendar' && dashboardSummary.monthEvents > 0 && <em>{dashboardSummary.monthEvents}</em>}
                            </button>
                            );
                        })}
                    </nav>
                </div>

                {activeTab === 'calendar' && (
                    <div className="marketing-panel p-5 lg:p-6">
                        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="marketing-kicker">Event Calendar</p>
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
                                    Export PDF
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

                {activeTab === 'inquiries' && renderInquiries()}
                {activeTab === 'documents' && renderDocuments()}
                {activeTab === 'settings' && renderSettings()}
                {activeTab === 'messages' && <StaffMessaging />}

            </main>
            {renderBookingModal()}
            {renderExportModal()}
            <FlashToast />
        </div>
    );
};

export default DashboardMarketing;
