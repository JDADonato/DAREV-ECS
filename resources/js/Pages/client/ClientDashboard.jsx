import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { router } from '@inertiajs/react';
import ChatBubble from '../../Components/common/ChatBubble';
import { fetchMenuItemsFromAPI } from '../../utils/menuUtils';
import ClientNavbar from '../../Components/common/ClientNavbar';
import ReceiptModal from '../../Components/common/ReceiptModal';

const peso = (value) => `₱${Number(value || 0).toLocaleString()}`;
const settledStatuses = ['Paid', 'Verified'];
const isSettledPaymentStatus = (status) => settledStatuses.includes(status);
const menuCategories = [
    { id: 'starter', label: 'Starters' },
    { id: 'main', label: 'Main Courses' },
    { id: 'side', label: 'Sides' },
    { id: 'dessert', label: 'Desserts' },
    { id: 'drink', label: 'Refreshments' },
];
const dashboardSections = ['details', 'menu', 'tastings', 'payments', 'history'];

const readStoredDashboardValue = (key, fallback = null) => {
    if (typeof window === 'undefined') return fallback;

    try {
        return localStorage.getItem(key) || fallback;
    } catch (e) {
        return fallback;
    }
};

const writeStoredDashboardValue = (key, value) => {
    if (typeof window === 'undefined' || value === null || value === undefined) return;

    try {
        localStorage.setItem(key, String(value));
    } catch (e) {
        // Ignore storage errors so dashboard navigation still works normally.
    }
};

const buildJourneySteps = (booking, payments) => {
    const bookingPayments = payments.filter((payment) => payment.booking_id === booking.id);
    const total = Number(booking.total_cost || 0);
    const paid = bookingPayments
        .filter((payment) => isSettledPaymentStatus(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const isApproved = ['Confirmed', 'Reserved', 'Completed'].includes(booking.status);
    const hasReservation = bookingPayments.some((payment) => payment.payment_type === 'Reservation' && isSettledPaymentStatus(payment.status)) || (total > 0 && paid / total >= 0.1);
    const eventDetailsDone = Boolean(booking.venue_address_line && booking.event_time && (booking.event_timeline || booking.special_instructions || booking.color_motif));
    const menuDone = Boolean(booking.selected_menu);
    const paymentsDone = bookingPayments.length > 0 && bookingPayments.every((payment) => isSettledPaymentStatus(payment.status));

    return [
        { label: 'Booking submitted', done: true, action: 'Review event details' },
        { label: 'Menu selection', done: menuDone, action: 'Finalize menu choices' },
        { label: 'Booking approved', done: isApproved, action: 'Awaiting Marketing Executive approval', isPendingGate: !isApproved },
        { label: 'Reservation payment', done: hasReservation, action: 'Complete the reservation fee', locked: !isApproved },
        { label: 'Event details', done: eventDetailsDone, action: 'Add timeline, venue notes, and motif' },
        { label: 'Payment balance', done: paymentsDone, action: booking.nextPaymentDue ? `Pay ${booking.nextPaymentDue.payment_type}` : 'No remaining payment', locked: !isApproved },
    ];
};

const HistoryPanel = ({ bookings, onRemove }) => (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#720101]">History</p>
                <h3 className="mt-1 text-xl font-display font-bold text-[#1a1a1a]">Cancelled and completed events</h3>
                <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-gray-500">Past records stay read-only. Use Rebook to start a new booking with the proper availability, menu, pricing, and payment steps.</p>
            </div>
        </div>
        {bookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <p className="font-bold text-gray-900">No history yet.</p>
            </div>
        ) : (
            <div className="grid gap-4">
                {bookings.map((booking) => (
                    <div key={booking.id} className="group relative rounded-2xl border border-gray-100 bg-[#faf7f2] p-5 transition-all hover:border-gray-200 hover:shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <h4 className="font-display text-lg font-bold text-[#1a1a1a]">{booking.client_full_name || 'Eloquente event'}</h4>
                                    <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${String(booking.status).toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'}`}>
                                        {booking.status}
                                    </span>
                                </div>
                                <p className="text-sm font-semibold text-gray-600">
                                    {new Date(booking.event_date).toLocaleDateString()} · {booking.pax} pax · {peso(booking.total_cost)}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {onRemove && (
                                    <button 
                                        onClick={() => { if (window.confirm('Remove this event from your history?')) onRemove(booking.id); }}
                                        className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-700"
                                    >
                                        Remove
                                    </button>
                                )}
                                <button onClick={() => router.get('/book')} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#5a0101]">
                                    Rebook Event
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const ClientDashboard = () => {
    const { user, logout } = useAuth();
    const dashboardStoragePrefix = `ecs_client_dashboard_${user?.id || 'guest'}`;
    const activeBookingStorageKey = `${dashboardStoragePrefix}_active_booking_id`;
    const activeSectionStorageKey = `${dashboardStoragePrefix}_active_section`;
    const [data, setData] = useState({ bookings: [], historyBookings: [], tastings: [], payments: [] });
    const [loading, setLoading] = useState(true);
    const [activeBookingId, setActiveBookingId] = useState(() => {
        const stored = readStoredDashboardValue(activeBookingStorageKey);
        return stored ? Number(stored) : null;
    });
    const [activeSection, setActiveSection] = useState(() => {
        const stored = readStoredDashboardValue(activeSectionStorageKey, 'details');
        return dashboardSections.includes(stored) ? stored : 'details';
    });
    const [toast, setToast] = useState(null);
    const [detailsForm, setDetailsForm] = useState({});
    const [savingDetails, setSavingDetails] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [menuCatalog, setMenuCatalog] = useState({ starter: [], main: [], side: [], dessert: [], drink: [] });
    const [menuSelections, setMenuSelections] = useState({ starter: [], main: [], side: [], dessert: [], drink: [] });
    const [savingMenu, setSavingMenu] = useState(false);
    const [menuEditMode, setMenuEditMode] = useState(false);
    const [eventPickerOpen, setEventPickerOpen] = useState(false);
    const [activeDetailRow, setActiveDetailRow] = useState(null);
    const [activeMenuCategory, setActiveMenuCategory] = useState('starter');

    const [submittingPayment, setSubmittingPayment] = useState(false);

    // Modal states
    const [editCoreModalOpen, setEditCoreModalOpen] = useState(false);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [receiptModal, setReceiptModal] = useState({ isOpen: false, payment: null, booking: null });

    const isSettledPayment = (payment) => isSettledPaymentStatus(payment.status);

    const calculateMenuTotal = (selections, pax) => {
        let sum = 0;
        Object.values(selections).forEach(catItems => {
            catItems.forEach(item => {
                sum += ((item.costPerHead || 0) + (item.priceAdj || 0)) * pax;
            });
        });
        return sum;
    };

    useEffect(() => {
        const tab = new URLSearchParams(window.location.search).get('tab');
        if (dashboardSections.includes(tab)) {
            setActiveSection(tab);
        }
        fetchData();
        fetchMenuItemsFromAPI().then(setMenuCatalog);
    }, []);

    useEffect(() => {
        if (activeBookingId) {
            writeStoredDashboardValue(activeBookingStorageKey, activeBookingId);
        }
    }, [activeBookingId, activeBookingStorageKey]);

    useEffect(() => {
        writeStoredDashboardValue(activeSectionStorageKey, activeSection);
    }, [activeSection, activeSectionStorageKey]);

    useEffect(() => {
        const booking = data.bookings.find(b => b.id === activeBookingId);
        if (!booking) return;

        setDetailsForm({
            reservation_time: booking.reservation_time || '',
            serving_time: booking.serving_time || '',
            venue_address_line: booking.venue_address_line || '',
            venue_building_details: booking.venue_building_details || '',
            color_motif: booking.color_motif || '',
            event_timeline: booking.event_timeline || '',
            special_instructions: booking.special_instructions || '',
            theme_uploads: booking.theme_uploads || '',
        });

        try {
            const parsed = typeof booking.selected_menu === 'string'
                ? JSON.parse(booking.selected_menu || '{}')
                : (booking.selected_menu || {});
            setMenuSelections({
                starter: parsed.starter || [],
                main: parsed.main || [],
                side: parsed.side || [],
                dessert: parsed.dessert || [],
                drink: parsed.drink || [],
            });
        } catch (e) {
            setMenuSelections({ starter: [], main: [], side: [], dessert: [], drink: [] });
        }
        setMenuEditMode(false);
    }, [activeBookingId, data.bookings]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const fetchData = async () => {
        try {
            const response = await fetch('/api/dashboard/client');
            if (response.ok) {
                const result = await response.json();
                setData({
                    bookings: result.bookings || [],
                    historyBookings: result.historyBookings || [],
                    tastings: result.tastings || [],
                    payments: result.payments || [],
                });
                const activeBookings = result.bookings || [];
                const storedBookingId = Number(readStoredDashboardValue(activeBookingStorageKey));
                const preferredBookingId = activeBookingId || storedBookingId || null;

                if (activeBookings.length > 0 && (!preferredBookingId || !activeBookings.some((booking) => booking.id === preferredBookingId))) {
                    // Default to the event with the closest upcoming date
                    const now = new Date();
                    const sorted = [...activeBookings].sort((a, b) => {
                        const da = Math.abs(new Date(a.event_date) - now);
                        const db = Math.abs(new Date(b.event_date) - now);
                        return da - db;
                    });
                    setActiveBookingId(sorted[0].id);
                } else if (preferredBookingId) {
                    setActiveBookingId(preferredBookingId);
                } else if (activeBookings.length === 0) {
                    setActiveBookingId(null);
                }
            }
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentSubmit = async (e, nextPayment) => {
        e.preventDefault();

        if (!nextPayment?.id || !activeBookingId) {
            setToast({ message: 'No payable milestone is available for this booking.', type: 'error' });
            return;
        }

        setSubmittingPayment(true);
        setToast({ message: 'Opening checkout...', type: 'success' });

        router.post('/checkout/initialize', {
            booking_id: activeBookingId,
            payment_id: nextPayment.id,
        }, {
            preserveScroll: true,
            onError: () => {
                setToast({ message: 'Unable to open PayMongo checkout. Please try again.', type: 'error' });
                setSubmittingPayment(false);
            },
            onCancel: () => {
                setSubmittingPayment(false);
            },
            onFinish: () => {
                setSubmittingPayment(false);
            },
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#faf7f2]">
                <div className="text-center">
                    <div className="animate-spin w-10 h-10 border-4 border-[#720101] border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium tracking-wide">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    const activeBooking = data.bookings.find(b => b.id === activeBookingId);
    const activePayments = activeBooking ? data.payments.filter((payment) => payment.booking_id === activeBooking.id) : [];
    const activePaid = activePayments.filter(isSettledPayment).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const activeTotal = Number(activeBooking?.total_cost || 0);
    const activeBalance = Math.max(activeTotal - activePaid, 0);
    const activeProgress = activeTotal > 0 ? Math.min((activePaid / activeTotal) * 100, 100) : 0;
    const activeJourneySteps = activeBooking ? buildJourneySteps(activeBooking, data.payments) : [];
    const remainingJourneySteps = activeJourneySteps.filter((step) => !step.done);

    // Action handlers
    const handleCancelBooking = async () => {
        try {
            const res = await fetch(`/api/bookings/${activeBooking.id}/cancel`, { method: 'PUT' });
            const result = await res.json().catch(() => ({}));
            if (res.ok) {
                setToast({ message: 'Booking successfully cancelled.', type: 'success' });
                setCancelModalOpen(false);
                fetchData();
            } else {
                setToast({ message: result.error || 'Unable to cancel this booking.', type: 'error' });
            }
        } catch (e) {
            setToast({ message: 'Network error.', type: 'error' });
        }
    };

    const saveEventDetails = async () => {
        setSavingDetails(true);
        try {
            const res = await fetch(`/api/bookings/${activeBooking.id}/event-details`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(detailsForm),
            });
            const result = await res.json().catch(() => ({}));
            if (res.ok) {
                setToast({ message: 'Event details saved.', type: 'success' });
                fetchData();
            } else {
                setToast({ message: result.error || 'Unable to save event details.', type: 'error' });
            }
        } catch (e) {
            setToast({ message: 'Network error while saving details.', type: 'error' });
        } finally {
            setSavingDetails(false);
        }
    };

    const uploadInspirationImage = async (file) => {
        if (!file) return;
        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await res.json();
            if (res.ok) {
                setDetailsForm(prev => ({ ...prev, theme_uploads: result.url }));
                setToast({ message: 'Inspiration image uploaded. Save details to keep it on this booking.', type: 'success' });
            } else {
                setToast({ message: result.message || 'Image upload failed.', type: 'error' });
            }
        } catch (e) {
            setToast({ message: 'Network error while uploading image.', type: 'error' });
        } finally {
            setUploadingImage(false);
        }
    };

    const swapMenuItem = (category, oldIndex, newDishId) => {
        const dish = menuCatalog[category]?.find(item => String(item.id) === String(newDishId));
        if (!dish) return;
        setMenuSelections(prev => ({
            ...prev,
            [category]: prev[category].map((item, index) => index === oldIndex ? dish : item),
        }));
    };

    const addMenuItem = (category, dishId) => {
        const dish = menuCatalog[category]?.find(item => String(item.id) === String(dishId));
        if (!dish) return;
        setMenuSelections(prev => ({
            ...prev,
            [category]: [...(prev[category] || []), dish],
        }));
    };

    const removeMenuItem = (category, indexToRemove) => {
        setMenuSelections(prev => ({
            ...prev,
            [category]: (prev[category] || []).filter((_, index) => index !== indexToRemove),
        }));
    };

    const saveMenuSelection = () => {
        setSavingMenu(true);
        router.put(`/api/bookings/${activeBooking.id}/menu`, {
            selected_menu: menuSelections
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setToast({ message: 'Menu selection updated. Pricing and unpaid balances were recalculated.', type: 'success' });
                setMenuEditMode(false);
                fetchData();
            },
            onError: (errors) => {
                setToast({ message: errors.error || 'Unable to update menu.', type: 'error' });
            },
            onFinish: () => {
                setSavingMenu(false);
            }
        });
    };

    const handleRenegotiate = async () => {
        setToast({ message: 'Renegotiation requested. Your event is back to Pending status.', type: 'success' });
        setEditCoreModalOpen(false);
        // Placeholder call for phase 4 frontend setup. Real logic would POST to a renegotiate endpoint.
    };



    return (
        <div className="min-h-screen bg-[#f7f4ee] font-sans">
            <ClientNavbar user={user} logout={logout} />

            <main className="max-w-7xl mx-auto py-8 px-5 sm:px-8 relative" style={{paddingTop: 100}}>
                {toast && (
                    <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-fadeIn shadow-sm border ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        {toast.type === 'success' ? (
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        ) : (
                            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        )}
                        <p className="text-sm font-bold">{toast.message}</p>
                    </div>
                )}

                <div className="mb-8 rounded-3xl bg-[#1a1a1a] p-6 text-white shadow-xl shadow-black/10 sm:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-[#f0aa0b]">Client Dashboard</p>
                            <h1 className="mt-2 text-3xl font-display font-bold sm:text-4xl">Plan, track, and complete your event.</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Use the tabs below to review booking details, monitor requirements, manage tasting schedules, and complete payments in order.</p>
                        </div>
                        {activeBooking && (
                            <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                                <div className="rounded-2xl bg-white/10 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Paid</p>
                                    <p className="mt-1 text-xl font-bold">{peso(activePaid)}</p>
                                </div>
                                <div className="rounded-2xl bg-white/10 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Balance</p>
                                    <p className="mt-1 text-xl font-bold text-[#f0aa0b]">{peso(activeBalance)}</p>
                                </div>
                                <div className="rounded-2xl bg-white/10 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Remaining Steps</p>
                                    <p className="mt-1 text-xl font-bold">{remainingJourneySteps.length}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {data.bookings.length === 0 && data.historyBookings.length === 0 ? (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-16 text-center">
                        <div className="w-20 h-20 bg-[#f0aa0b]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <h2 className="text-2xl font-display font-bold text-[#1a1a1a] mb-2">No active bookings</h2>
                        <p className="text-[#1a1a1a]/50 mb-8 max-w-md mx-auto">You haven't booked any events with us yet. Let's create something memorable.</p>
                        <button onClick={() => router.get('/book')} className="bg-[#720101] hover:bg-[#5a0101] text-white font-bold py-3 px-8 rounded-full shadow-md transition-all">Book Your Event</button>
                    </div>
                ) : data.bookings.length === 0 ? (
                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 text-center">
                            <h2 className="text-2xl font-display font-bold text-[#1a1a1a] mb-2">No active bookings</h2>
                            <p className="text-[#1a1a1a]/50 mb-6 max-w-md mx-auto">Cancelled or completed events are kept in history. Start a new event or rebook from a past one.</p>
                            <button onClick={() => router.get('/book')} className="bg-[#720101] hover:bg-[#5a0101] text-white font-bold py-3 px-8 rounded-full shadow-md transition-all">Book Your Event</button>
                        </div>
                        <HistoryPanel bookings={data.historyBookings} />
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* LEFT COLUMN: Vertical Side-Nav & Booking Selector */}
                        <div className="w-full lg:w-64 flex-shrink-0 space-y-6">
                            {data.bookings.length > 1 && (
                                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1a1a1a]/50 mb-2">Select Event</label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setEventPickerOpen(!eventPickerOpen)}
                                            className="flex w-full items-center justify-between rounded-2xl border border-[#720101]/25 bg-[#faf7f2] px-4 py-3 text-left shadow-inner transition-colors hover:bg-white"
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-black text-[#1a1a1a]">{activeBooking?.client_full_name || 'Select booking'}</span>
                                                <span className="mt-1 block text-xs font-semibold text-gray-500">{activeBooking ? `${new Date(activeBooking.event_date).toLocaleDateString()} · ${activeBooking.pax} pax` : 'Choose an event'}</span>
                                            </span>
                                            <svg className={`ml-3 h-5 w-5 shrink-0 text-[#720101] transition-transform ${eventPickerOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                        {eventPickerOpen && (
                                            <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl shadow-black/15">
                                                {data.bookings.map((booking) => {
                                                    const active = booking.id === activeBookingId;
                                                    return (
                                                        <button
                                                            key={booking.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setActiveBookingId(booking.id);
                                                                setEventPickerOpen(false);
                                                            }}
                                                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-[#720101] text-white' : 'hover:bg-[#720101]/5'}`}
                                                        >
                                                            <span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${active ? 'bg-white text-[#720101]' : 'bg-[#720101]/10 text-[#720101]'}`}>
                                                                {booking.client_full_name?.charAt(0)?.toUpperCase() || 'E'}
                                                            </span>
                                                            <span className="min-w-0">
                                                                <span className={`block truncate text-sm font-black ${active ? 'text-white' : 'text-gray-950'}`}>{booking.client_full_name || 'Eloquente event'}</span>
                                                                <span className={`mt-1 block text-xs font-semibold ${active ? 'text-white/75' : 'text-gray-500'}`}>{new Date(booking.event_date).toLocaleDateString()} · {booking.pax} pax · {booking.status}</span>
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    {activeBooking && (
                                        <div className="mt-3 rounded-xl bg-[#720101]/5 p-3">
                                            <p className="truncate text-sm font-bold text-[#720101]">{activeBooking.event_type || 'Eloquente event'}</p>
                                            <p className="mt-1 text-xs font-semibold text-gray-500">{new Date(activeBooking.event_date).toLocaleDateString()} · {activeBooking.pax} pax</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                {[
                                    { id: 'details', label: 'Event Details', needsWork: activeJourneySteps.some(s => s.label === 'Event details' && !s.done), icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1 -18 0 a 9 9 0 0 1 18 0z' },
                                    { id: 'menu', label: 'Menu', needsWork: activeJourneySteps.some(s => s.label === 'Menu selection' && !s.done), icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                                    { id: 'tastings', label: 'Food Tastings', needsWork: data.tastings.length === 0, icon: 'M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h4.5M4.5 4.5h15v15h-15z' },
                                    { id: 'payments', label: 'Payments', needsWork: activeBooking.nextPaymentDue, icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 1 1 -4 0 a 2 2 0 0 1 4 0z' },
                                    { id: 'history', label: 'History', needsWork: false, icon: 'M12 8v4l3 3m6-3a9 9 0 1 1 -18 0 a 9 9 0 0 1 18 0z' },
                                ].map(section => (
                                    <button 
                                        key={section.id} 
                                        onClick={() => setActiveSection(section.id)}
                                        className={`relative w-full flex items-center gap-3 px-5 py-4 text-sm font-bold border-l-4 transition-all ${activeSection === section.id ? 'border-[#720101] bg-[#720101]/5 text-[#720101]' : 'border-transparent text-[#1a1a1a]/60 hover:bg-gray-50 hover:text-[#1a1a1a]'}`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={section.icon} /></svg>
                                        {section.label}
                                        {section.needsWork && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-[#f0aa0b] shadow-[0_0_0_3px_rgba(240,170,11,0.16)]" />}
                                    </button>
                                ))}
                            </nav>

                            {/* Global Action Buttons */}
                            <div className="pt-4 border-t border-gray-200">
                                <button 
                                    onClick={() => setEditCoreModalOpen(true)}
                                    disabled={activeBooking.status === 'Cancelled'}
                                    className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl shadow-sm mb-3 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    Update Date / Pax
                                </button>
                                <button 
                                    onClick={() => setCancelModalOpen(true)}
                                    disabled={activeBooking.status === 'Cancelled'}
                                    className="w-full bg-red-50 text-red-700 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                    Cancel Booking
                                </button>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Content */}
                        <div className="flex-1 space-y-6">
                            {activeBooking && (
                                <>
                                    {/* Event Snapshot */}
                                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <h2 className="text-2xl font-display font-bold text-[#1a1a1a]">Event Snapshot</h2>
                                                <span className={`px-3 py-1 text-[11px] font-bold rounded-full uppercase tracking-wider ${activeBooking.status === 'Confirmed' ? 'bg-green-100 text-green-700' : activeBooking.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {activeBooking.status}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[#1a1a1a]/60 text-sm font-medium">
                                                <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> {new Date(activeBooking.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> {activeBooking.event_time}</span>
                                                <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> {activeBooking.pax} Pax</span>
                                            </div>
                                        </div>
                                        <div className="text-left sm:text-right">
                                            <p className="text-[#1a1a1a]/50 text-xs font-bold uppercase tracking-widest mb-1">Total Cost</p>
                                            <p className="text-3xl font-display font-bold text-[#720101]">₱{parseFloat(activeBooking.total_cost || 0).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
                                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-widest text-[#720101]">Journey Tracker</p>
                                                <h3 className="mt-1 text-xl font-display font-bold text-[#1a1a1a]">
                                                    {remainingJourneySteps.length === 0 ? 'Everything needed is complete' : `${remainingJourneySteps.length} step${remainingJourneySteps.length > 1 ? 's' : ''} remaining`}
                                                </h3>
                                            </div>
                                            <div className="min-w-[170px]">
                                                <div className="mb-2 flex justify-between text-xs font-bold text-gray-500">
                                                    <span>Progress</span>
                                                    <span>{Math.round((activeJourneySteps.filter((step) => step.done).length / activeJourneySteps.length) * 100)}%</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-gray-100">
                                                    <div
                                                        className="h-2 rounded-full bg-[#720101] transition-all duration-700"
                                                        style={{ width: `${(activeJourneySteps.filter((step) => step.done).length / activeJourneySteps.length) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                                            {activeJourneySteps.map((step, index) => (
                                                <div key={step.label} className={`rounded-2xl border p-3 relative ${step.done ? 'border-green-200 bg-green-50' : step.isPendingGate ? 'border-[#f0aa0b]/40 bg-[#f0aa0b]/5 ring-1 ring-[#f0aa0b]/20' : step.locked ? 'border-gray-100 bg-gray-50 opacity-50' : 'border-gray-200 bg-gray-50'}`}>
                                                    <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step.done ? 'bg-green-600 text-white' : step.isPendingGate ? 'bg-[#f0aa0b] text-white animate-pulse' : step.locked ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}>
                                                        {step.done ? '✓' : step.locked ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> : index + 1}
                                                    </div>
                                                    <p className={`text-xs font-bold ${step.locked ? 'text-gray-400' : 'text-gray-900'}`}>{step.label}</p>
                                                    {!step.done && <p className={`mt-1 text-[11px] font-medium leading-4 ${step.isPendingGate ? 'text-[#b27a00]' : 'text-gray-500'}`}>{step.action}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Pending Approval Banner */}
                                    {activeBooking.status === 'Pending' && (
                                        <div className="rounded-3xl border-2 border-[#f0aa0b]/30 bg-gradient-to-r from-[#f0aa0b]/5 via-white to-[#f0aa0b]/5 p-6 sm:p-8 shadow-sm">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[#f0aa0b]/15">
                                                    <svg className="w-7 h-7 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-display font-bold text-[#1a1a1a]">Awaiting Approval</h3>
                                                    <p className="mt-1 text-sm font-medium text-gray-600 leading-6">Your booking has been submitted and is under review by our Marketing Executive. Once approved, you'll be able to proceed with the reservation payment and complete the remaining steps. You can still update your event details and food tasting schedule in the meantime.</p>
                                                </div>
                                                <span className="inline-flex items-center gap-2 rounded-full bg-[#f0aa0b]/15 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#b27a00] border border-[#f0aa0b]/25">
                                                    <span className="h-2 w-2 rounded-full bg-[#f0aa0b] animate-pulse" />
                                                    Pending Review
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Content based on Active Section */}
                                    {activeSection === 'details' && (
                                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
                                            <h3 className="text-xl font-bold font-display text-[#1a1a1a] mb-6">Supplementary Event Details</h3>
                                            
                                            {!activeBooking.canEditSupplementary && activeBooking.status !== 'Cancelled' && (
                                                <div className="mb-6 p-4 rounded-xl flex items-start gap-3 bg-red-50 border border-red-100">
                                                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    <div>
                                                        <p className="text-sm font-bold text-red-800">Hard Freeze Active</p>
                                                        <p className="text-xs text-red-700 mt-1">Your event details are currently locked as our team is making final preparations. If you need to make an urgent change, please use the messaging module to contact your Marketing Executive directly.</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-4">
                                                {[
                                                    { id: 'venue', label: 'Venue Address', value: detailsForm.venue_address_line, type: 'text', key: 'venue_address_line', placeholder: 'Complete Venue Address', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
                                                    { id: 'color_motif', label: 'Color Motif', value: detailsForm.color_motif, type: 'text', key: 'color_motif', placeholder: 'e.g., Royal Gold & Deep Navy', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
                                                    { id: 'reservation_time', label: 'Reservation Time', value: detailsForm.reservation_time, type: 'text', key: 'reservation_time', placeholder: 'e.g., 4:00 PM', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                                                    { id: 'serving_time', label: 'Serving Time', value: detailsForm.serving_time, type: 'text', key: 'serving_time', placeholder: 'e.g., 6:30 PM', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
                                                    { id: 'event_timeline', label: 'Event Timeline / Program', value: detailsForm.event_timeline, type: 'textarea', key: 'event_timeline', placeholder: 'Outline your program here...', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
                                                    { id: 'special_instructions', label: 'Special Instructions & Allergies', value: detailsForm.special_instructions, type: 'textarea', key: 'special_instructions', placeholder: 'Dietary restrictions, guest count adjustments, etc.', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                                                ].map(field => {
                                                    const isExpanded = activeDetailRow === field.id;
                                                    return (
                                                        <div 
                                                            key={field.id}
                                                            className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 ${isExpanded ? 'border-[#720101] bg-white shadow-xl shadow-[#720101]/5 p-6' : 'border-gray-100 bg-[#faf7f2]/50 p-5 cursor-pointer hover:border-[#720101]/30 hover:bg-white hover:shadow-md'}`}
                                                            onClick={() => { if (!isExpanded && activeBooking.canEditSupplementary) setActiveDetailRow(field.id); }}
                                                        >
                                                            <div className="flex items-start gap-4">
                                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${isExpanded ? 'bg-[#720101] text-white' : 'bg-white text-[#720101] group-hover:bg-[#720101]/10 shadow-sm border border-gray-100'}`}>
                                                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={field.icon} /></svg>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between gap-4">
                                                                        <h4 className={`text-xs font-black uppercase tracking-[0.15em] transition-colors ${isExpanded ? 'text-[#720101]' : 'text-gray-400 group-hover:text-gray-600'}`}>{field.label}</h4>
                                                                        {!isExpanded && (
                                                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
                                                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {!isExpanded && (
                                                                        <p className="mt-1 text-sm font-bold text-gray-900 truncate pr-4">
                                                                            {field.value ? field.value : <span className="text-gray-300 italic font-medium">Click to specify...</span>}
                                                                        </p>
                                                                    )}
                                                                    {isExpanded && (
                                                                        <div className="mt-4 animate-fadeIn">
                                                                            {field.type === 'textarea' ? (
                                                                                <textarea 
                                                                                    autoFocus
                                                                                    className="w-full bg-gray-50 border-0 border-b-2 border-gray-200 rounded-t-xl px-4 py-3 text-sm font-bold text-gray-900 focus:border-[#720101] focus:ring-0 focus:bg-white transition-all resize-none h-32"
                                                                                    value={detailsForm[field.key] || ''}
                                                                                    onChange={(e) => setDetailsForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                                                    placeholder={field.placeholder}
                                                                                />
                                                                            ) : (
                                                                                <input 
                                                                                    autoFocus
                                                                                    className="w-full bg-gray-50 border-0 border-b-2 border-gray-200 rounded-t-xl px-4 py-3 text-sm font-bold text-gray-900 focus:border-[#720101] focus:ring-0 focus:bg-white transition-all h-12"
                                                                                    value={detailsForm[field.key] || ''}
                                                                                    onChange={(e) => setDetailsForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                                                    placeholder={field.placeholder}
                                                                                />
                                                                            )}
                                                                            <div className="mt-4 flex justify-end gap-3">
                                                                                <button 
                                                                                    type="button" 
                                                                                    onClick={(e) => { e.stopPropagation(); setActiveDetailRow(null); }} 
                                                                                    className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
                                                                                >
                                                                                    Confirm
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                
                                                {/* Image Upload Accordion */}
                                                <div 
                                                    className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 ${activeDetailRow === 'image' ? 'border-[#720101] bg-white shadow-xl shadow-[#720101]/5 p-6' : 'border-gray-100 bg-[#faf7f2]/50 p-5 cursor-pointer hover:border-[#720101]/30 hover:bg-white hover:shadow-md'}`}
                                                    onClick={() => { if (activeDetailRow !== 'image' && activeBooking.canEditSupplementary) setActiveDetailRow('image'); }}
                                                >
                                                    <div className="flex items-start gap-4">
                                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${activeDetailRow === 'image' ? 'bg-[#720101] text-white' : 'bg-white text-[#720101] group-hover:bg-[#720101]/10 shadow-sm border border-gray-100'}`}>
                                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <h4 className={`text-xs font-black uppercase tracking-[0.15em] transition-colors ${activeDetailRow === 'image' ? 'text-[#720101]' : 'text-gray-400 group-hover:text-gray-600'}`}>Inspiration Image</h4>
                                                                {activeDetailRow !== 'image' && (
                                                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
                                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {activeDetailRow !== 'image' && (
                                                                <p className="mt-1 text-sm font-bold text-gray-900 truncate pr-4">
                                                                    {detailsForm.theme_uploads ? <span className="text-green-600 flex items-center gap-1.5"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>Image uploaded</span> : <span className="text-gray-300 italic font-medium">Click to upload reference...</span>}
                                                                </p>
                                                            )}
                                                            {activeDetailRow === 'image' && (
                                                                <div className="mt-4 animate-fadeIn">
                                                                    <div className="flex flex-col gap-6">
                                                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                                            <p className="text-sm font-medium text-gray-500 leading-relaxed max-w-xs">Upload a mood board, theme sample, or layout reference for our team.</p>
                                                                            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#720101] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#720101]/20 hover:bg-[#5a0101] transition-all active:scale-95">
                                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                                                {uploadingImage ? 'Uploading...' : 'Upload Image'}
                                                                                <input type="file" accept="image/*" className="hidden" disabled={uploadingImage} onChange={(e) => uploadInspirationImage(e.target.files?.[0])} />
                                                                            </label>
                                                                        </div>
                                                                        
                                                                        {detailsForm.theme_uploads && (
                                                                            <div className="relative group/img aspect-video sm:aspect-auto sm:h-64 overflow-hidden rounded-2xl border-4 border-white shadow-lg">
                                                                                <img src={detailsForm.theme_uploads} alt="Event inspiration" className="h-full w-full object-cover" />
                                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                                    <span className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-white/30">Current Reference</span>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex justify-end pt-2">
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={(e) => { e.stopPropagation(); setActiveDetailRow(null); }} 
                                                                                className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
                                                                            >
                                                                                Confirm
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {activeBooking.canEditSupplementary && (
                                                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                                                    <button onClick={saveEventDetails} disabled={savingDetails} className="group relative bg-[#1a1a1a] hover:bg-black text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 overflow-hidden">
                                                        <span className="relative z-10 flex items-center gap-2">
                                                            {savingDetails ? (
                                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                            ) : (
                                                                <svg className="w-4 h-4 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                            )}
                                                            {savingDetails ? 'Synchronizing...' : 'Save All Details'}
                                                        </span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeSection === 'history' && (
                                        <HistoryPanel bookings={data.historyBookings} onRemove={(id) => {
                                            fetch(`/api/bookings/${id}/remove-history`, { method: 'DELETE' })
                                                .then(() => fetchData())
                                                .catch(err => setToast({ message: 'Error removing history.', type: 'error' }));
                                        }} />
                                    )}

                                    {activeSection === 'menu' && (
                                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fadeIn">
                                            <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="max-w-2xl">
                                                    <h3 className="text-2xl font-bold font-display text-[#1a1a1a]">Curated Menu</h3>
                                                    <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">Fine-tune your culinary journey. Swapping dishes will automatically adjust your event total based on current seasonal pricing.</p>
                                                </div>
                                                {activeBooking.canEditMenu && !menuEditMode && (
                                                    <button onClick={() => setMenuEditMode(true)} className="group flex items-center gap-2 rounded-2xl bg-[#720101] px-6 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-[#720101]/20 hover:bg-[#5a0101] transition-all active:scale-95">
                                                        <svg className="w-4 h-4 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        Customize Menu
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {!activeBooking.canEditMenu && activeBooking.status !== 'Cancelled' && (
                                                <div className="mb-8 p-5 rounded-2xl flex items-start gap-4 bg-red-50 border border-red-100 shadow-sm">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black uppercase tracking-widest text-red-800">30-Day Menu Freeze</p>
                                                        <p className="text-xs font-medium text-red-700/80 mt-1 leading-relaxed">Your menu is locked for final sourcing. Contact your Marketing Executive for critical adjustments.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Category Tabs */}
                                            <div className="flex overflow-x-auto border-b border-gray-100 mb-8 pb-1 gap-8 no-scrollbar">
                                                {menuCategories.map(cat => (
                                                    <button
                                                        key={cat.id}
                                                        onClick={() => setActiveMenuCategory(cat.id)}
                                                        className={`relative whitespace-nowrap pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all ${activeMenuCategory === cat.id ? 'text-[#720101]' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        {cat.label}
                                                        {activeMenuCategory === cat.id && (
                                                            <div className="absolute bottom-0 left-0 right-0 h-1 rounded-full bg-[#720101] animate-scaleX" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>

                                            {menuEditMode && (
                                                <div className="mb-8 overflow-hidden rounded-3xl bg-[#1a1a1a] p-6 text-white shadow-2xl relative">
                                                    <div className="absolute top-0 right-0 p-8 opacity-10">
                                                        <svg className="w-24 h-24 text-[#f0aa0b]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
                                                    </div>
                                                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f0aa0b]">Live Price Estimate</p>
                                                            <div className="mt-1 flex items-baseline gap-2">
                                                                <h4 className="text-3xl font-display font-bold">{peso(calculateMenuTotal(menuSelections, activeBooking.pax))}</h4>
                                                                <span className="text-xs font-bold text-white/40 italic">Projected New Total</span>
                                                            </div>
                                                        </div>
                                                        <div className="h-px w-full sm:h-10 sm:w-px bg-white/10" />
                                                        <p className="text-xs font-medium text-white/60 max-w-[200px]">Includes seasonal adjustments and pax count of <span className="text-white font-bold">{activeBooking.pax}</span>.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Active Category Content */}
                                            {menuCategories.filter(c => c.id === activeMenuCategory).map((category) => {
                                                const items = menuSelections[category.id] || [];
                                                return (
                                                    <div key={category.id} className="animate-fadeIn">
                                                        <div className="grid gap-4 sm:grid-cols-2">
                                                            {items.map((item, index) => (
                                                                <div key={`${category.id}-${index}`} className="group relative overflow-hidden rounded-3xl border border-gray-100 bg-[#faf7f2]/40 p-4 transition-all hover:bg-white hover:shadow-xl hover:shadow-[#720101]/5">
                                                                    <div className="flex gap-4">
                                                                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl shadow-sm">
                                                                            <img src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300'} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <h5 className="truncate text-base font-bold text-gray-900">{item.name}</h5>
                                                                            <p className="mt-1 text-xs font-bold text-[#720101]">{peso((item.costPerHead || 0) + (item.priceAdj || 0))} <span className="text-gray-400 font-medium">/ head</span></p>
                                                                            {item.priceAdj > 0 && <span className="mt-2 inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase text-orange-700 ring-1 ring-orange-200">Premium Choice</span>}
                                                                        </div>
                                                                    </div>
                                                                    {activeBooking.canEditMenu && menuEditMode && (
                                                                        <div className="mt-4 flex gap-2">
                                                                            <div className="relative flex-1">
                                                                                <select
                                                                                    value={item.id || ''}
                                                                                    onChange={(e) => swapMenuItem(category.id, index, e.target.value)}
                                                                                    className="w-full appearance-none rounded-xl border border-gray-200 bg-white pl-4 pr-10 py-3 text-xs font-bold text-gray-700 outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/5 transition-all cursor-pointer"
                                                                                >
                                                                                    {(menuCatalog[category.id] || []).map((dish) => (
                                                                                        <option key={dish.id} value={dish.id}>{dish.name} (+{peso(dish.priceAdj || 0)})</option>
                                                                                    ))}
                                                                                </select>
                                                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#720101]">
                                                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                                                                </div>
                                                                            </div>
                                                                            <button 
                                                                                onClick={() => removeMenuItem(category.id, index)} 
                                                                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors shadow-sm active:scale-90"
                                                                                title="Remove dish"
                                                                            >
                                                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {activeBooking.canEditMenu && menuEditMode && (
                                                            <div className="mt-6">
                                                                <div className="relative">
                                                                    <select
                                                                        value=""
                                                                        onChange={(e) => addMenuItem(category.id, e.target.value)}
                                                                        className="w-full appearance-none rounded-2xl border-2 border-dashed border-gray-200 bg-white px-6 py-5 text-sm font-bold text-gray-400 outline-none hover:border-[#720101]/30 hover:bg-[#720101]/5 hover:text-[#720101] transition-all cursor-pointer text-center"
                                                                    >
                                                                        <option value="">+ Add {category.label.slice(0, -1)} Selection</option>
                                                                        {(menuCatalog[category.id] || []).map((dish) => (
                                                                            <option key={dish.id} value={dish.id}>{dish.name} - {peso((dish.costPerHead || 0) + (dish.priceAdj || 0))} / head</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {items.length === 0 && !menuEditMode && (
                                                            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-[#faf7f2]/30 p-12 text-center mt-4">
                                                                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                                                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                                                </div>
                                                                <p className="font-bold text-gray-400 tracking-wide">No {category.label.toLowerCase()} in current selection.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {activeBooking.canEditMenu && menuEditMode && (
                                                <div className="mt-10 flex flex-wrap justify-end gap-4 pt-8 border-t border-gray-100">
                                                    <button onClick={() => setMenuEditMode(false)} className="rounded-2xl border border-gray-200 bg-white px-8 py-3.5 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-all shadow-sm active:scale-95">Discard Changes</button>
                                                    <button onClick={saveMenuSelection} disabled={savingMenu} className="flex items-center gap-2 rounded-2xl bg-[#720101] px-10 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-[#720101]/20 hover:bg-[#5a0101] transition-all active:scale-95 disabled:opacity-50">
                                                        {savingMenu ? 'Processing Selection...' : 'Save & Recalculate Total'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeSection === 'tastings' && (
                                        <div className="space-y-6">
                                            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                    <div>
                                                        <p className="text-xs font-bold uppercase tracking-widest text-[#720101]">Food Tastings</p>
                                                        <h3 className="mt-1 text-xl font-display font-bold text-[#1a1a1a]">Scheduled tasting sessions</h3>
                                                        <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-gray-500">Review your tasting date, contact details, notes, and current approval status.</p>
                                                    </div>
                                                    <button onClick={() => router.get('/food-tasting')} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#5a0101]">
                                                        Book Tasting
                                                    </button>
                                                </div>
                                            </div>

                                            {data.tastings.length === 0 ? (
                                                <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
                                                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0aa0b]/10 text-[#720101]">
                                                        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v12m6-6H6" /></svg>
                                                    </div>
                                                    <h4 className="text-lg font-bold text-gray-900">No food tasting sessions yet</h4>
                                                    <p className="mx-auto mt-2 max-w-md text-sm font-medium text-gray-500">Schedule a tasting to align menu preferences before final event preparation.</p>
                                                </div>
                                            ) : (
                                                <div className="grid gap-4">
                                                    {data.tastings.map((tasting) => (
                                                        <div key={tasting.id} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                                                            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                                                                <div>
                                                                    <div className="mb-3 flex flex-wrap items-center gap-2">
                                                                        <h4 className="text-lg font-bold text-gray-900">{tasting.guest_name || user?.username || 'Food tasting guest'}</h4>
                                                                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${tasting.status === 'Approved' || tasting.status === 'Confirmed' ? 'bg-green-100 text-green-700' : tasting.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                            {tasting.status}
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid gap-3 text-sm font-medium text-gray-600 sm:grid-cols-2">
                                                                        <p><span className="block text-xs font-bold uppercase tracking-widest text-gray-400">Date</span>{new Date(tasting.preferred_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                                                        <p><span className="block text-xs font-bold uppercase tracking-widest text-gray-400">Time</span>{tasting.preferred_time}</p>
                                                                        <p><span className="block text-xs font-bold uppercase tracking-widest text-gray-400">Email</span>{tasting.guest_email || user?.email || 'Not provided'}</p>
                                                                        <p><span className="block text-xs font-bold uppercase tracking-widest text-gray-400">Phone</span>{tasting.guest_phone || 'Not provided'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col gap-4 md:items-end">
                                                                    <div className="rounded-2xl bg-gray-50 p-4 md:max-w-xs w-full text-left">
                                                                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Notes</p>
                                                                        <p className="mt-2 text-sm font-medium leading-6 text-gray-600">{tasting.notes || 'No special notes were added for this tasting session.'}</p>
                                                                    </div>
                                                                    {tasting.status !== 'Cancelled' && (
                                                                        <div className="flex gap-2">
                                                                            <button 
                                                                                onClick={() => {
                                                                                    if (window.confirm('Cancel this food tasting session?')) {
                                                                                        fetch(`/api/food-tasting/${tasting.id}`, { method: 'DELETE', headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '' } })
                                                                                            .then(() => { setToast({ message: 'Tasting cancelled.', type: 'success' }); fetchData(); })
                                                                                            .catch(() => setToast({ message: 'Error cancelling tasting.', type: 'error' }));
                                                                                    }
                                                                                }}
                                                                                className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg"
                                                                            >
                                                                                Cancel Session
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeSection === 'payments' && (
                                        <div className="space-y-6">
                                            {/* Financial Summary */}
                                            <div className="bg-[#1a1a1a] rounded-3xl shadow-lg p-6 sm:p-8 text-white relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 relative z-10"><svg className="w-5 h-5 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Financial Summary</h3>
                                                
                                                {(() => {
                                                    const total = parseFloat(activeBooking.total_cost || 0);
                                                    const payments = data.payments.filter(p => p.booking_id === activeBooking.id);
                                                    const paid = payments.filter(isSettledPayment).reduce((s, p) => s + parseFloat(p.amount), 0);
                                                    const balance = total - paid;
                                                    const pct = total > 0 ? (paid / total) * 100 : 0;

                                                    return (
                                                        <div className="relative z-10">
                                                            <div className="grid grid-cols-2 gap-6 mb-6">
                                                                <div>
                                                                    <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Total Paid</p>
                                                                    <p className="text-2xl font-bold">₱{paid.toLocaleString()}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Remaining Balance</p>
                                                                    <p className="text-2xl font-bold text-[#f0aa0b]">₱{balance.toLocaleString()}</p>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="flex justify-between text-xs font-bold text-white/80 mb-2">
                                                                    <span>Payment Progress</span>
                                                                    <span>{Math.round(pct)}%</span>
                                                                </div>
                                                                <div className="w-full bg-black/30 rounded-full h-2">
                                                                    <div className="bg-[#f0aa0b] h-2 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-6 grid gap-3">
                                                                {payments.map((payment) => {
                                                                    const overdue = !isSettledPayment(payment) && payment.due_date && new Date(payment.due_date) < new Date();
                                                                    return (
                                                                        <div key={payment.id} className={`rounded-2xl border p-4 ${isSettledPayment(payment) ? 'border-green-400/20 bg-green-500/10' : overdue ? 'border-red-400/30 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
                                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                                                <div>
                                                                                    <p className="text-sm font-bold text-white">{payment.payment_type}</p>
                                                                                    <p className="mt-1 text-xs font-semibold text-white/55">Due {payment.due_date ? new Date(payment.due_date).toLocaleDateString() : 'on confirmation'}</p>
                                                                                </div>
                                                                                <div className="text-left sm:text-right">
                                                                                    <p className="text-sm font-bold text-white">{peso(payment.amount)}</p>
                                                                                    <div className="flex flex-col sm:items-end mt-1 gap-1.5">
                                                                                        <p className={`text-xs font-bold uppercase tracking-widest ${isSettledPayment(payment) ? 'text-green-300' : overdue ? 'text-red-300' : 'text-[#f0aa0b]'}`}>
                                                                                            {isSettledPayment(payment) ? 'Paid' : overdue ? 'Overdue - slot may be cancelled' : 'Pending'}
                                                                                        </p>
                                                                                        {isSettledPayment(payment) && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => setReceiptModal({ isOpen: true, payment: payment, booking: activeBooking })}
                                                                                                className="text-[10px] font-black uppercase tracking-widest text-green-100 hover:text-white bg-green-900/40 hover:bg-green-800/60 px-3 py-1.5 rounded-full transition-colors inline-flex items-center gap-1.5"
                                                                                            >
                                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                                                View Receipt
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {activeBooking.nextPaymentDue ? (
                                                                <form onSubmit={(e) => handlePaymentSubmit(e, activeBooking.nextPaymentDue)} className={`mt-6 rounded-2xl border border-[#f0aa0b]/25 bg-white/[0.07] p-5 relative overflow-hidden ${activeBooking.status === 'Pending' ? 'opacity-80' : ''}`}>
                                                                    {activeBooking.status === 'Pending' && (
                                                                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm p-6 text-center">
                                                                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f0aa0b] text-[#1a1a1a] shadow-lg">
                                                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                                            </div>
                                                                            <h5 className="text-sm font-black uppercase tracking-widest text-white">Payment Locked</h5>
                                                                            <p className="mt-1 text-xs font-bold text-white/80 leading-relaxed max-w-[240px]">Payments are disabled until your booking is officially approved by our team.</p>
                                                                        </div>
                                                                    )}
                                                                    <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                                                                        <div>
                                                                            <p className="text-[11px] font-black uppercase tracking-widest text-[#f0aa0b]">Next Payment Required</p>
                                                                            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                                                                <h4 className="font-display text-2xl font-bold text-white">{activeBooking.nextPaymentDue.payment_type}</h4>
                                                                                <p className="text-xl font-black text-[#f0aa0b]">{peso(activeBooking.nextPaymentDue.amount)}</p>
                                                                            </div>
                                                                            {activeBooking.nextPaymentDue.description && (
                                                                                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/60">{activeBooking.nextPaymentDue.description}</p>
                                                                            )}
                                                                            <div className="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 p-3">
                                                                                <p className="text-xs font-black uppercase tracking-widest text-red-200">Strict deadline: {new Date(activeBooking.nextPaymentDue.due_date).toLocaleDateString()}</p>
                                                                                <p className="mt-1 text-xs font-medium leading-5 text-red-100/75">Failure to pay the exact amount by this date can result in automatic cancellation and forfeiture of reservation slots.</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-col gap-3 lg:min-w-[220px]">
                                                                            <div className="rounded-xl bg-black/20 p-3 text-xs font-bold text-white/65">
                                                                                Encrypted checkout opens on the next screen.
                                                                            </div>
                                                                            <button
                                                                                type="submit"
                                                                                disabled={submittingPayment || activeBooking.status === 'Pending'}
                                                                                className={`rounded-xl bg-[#f0aa0b] px-6 py-3.5 text-sm font-black text-[#1a1a1a] shadow-lg shadow-black/20 transition-all hover:bg-[#d99a08] ${submittingPayment || activeBooking.status === 'Pending' ? 'cursor-not-allowed opacity-70' : ''}`}
                                                                            >
                                                                                {submittingPayment ? 'Opening Checkout...' : activeBooking.status === 'Pending' ? 'Awaiting Approval' : 'Proceed to Checkout'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </form>
                                                            ) : (
                                                                <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-500/10 p-5 text-center">
                                                                    <p className="font-bold text-green-200">All caught up. You have no pending payments at this time.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Tranche Breakdown */}
                                            {false && (() => {
                                                const tranches = data.payments.filter(p => p.booking_id === activeBooking.id);
                                                if (tranches.length === 0) return null;
                                                return (
                                                    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-6">
                                                        <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-widest">Payment Schedule</h4>
                                                        <div className="space-y-3">
                                                            {tranches.map((tranche, idx) => (
                                                                <div key={idx} className={`flex justify-between items-center p-4 rounded-xl border ${isSettledPayment(tranche) ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSettledPayment(tranche) ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'}`}>
                                                                            {isSettledPayment(tranche) ? (
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                                            ) : (
                                                                                <span className="text-xs font-bold">{idx + 1}</span>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-bold text-gray-900 text-sm">{tranche.payment_type}</p>
                                                                            {!isSettledPayment(tranche) && tranche.due_date && (
                                                                                <p className="text-xs font-medium text-gray-500">Due: {new Date(tranche.due_date).toLocaleDateString()}</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="font-bold text-gray-900">₱{parseFloat(tranche.amount).toLocaleString()}</p>
                                                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${isSettledPayment(tranche) ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                                                                            {isSettledPayment(tranche) ? 'Paid' : tranche.status}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Sequential Payment Action Card */}
                                            {false ? (
                                                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                                                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                                        <div>
                                                            <p className="text-xs font-bold text-[#720101] uppercase tracking-widest mb-1">Next Payment Required</p>
                                                            <h3 className="text-xl font-display font-bold text-[#1a1a1a]">{activeBooking.nextPaymentDue.payment_type}</h3>
                                                            {activeBooking.nextPaymentDue.description && (
                                                                <p className="text-sm font-medium text-gray-500 mt-1 max-w-sm">{activeBooking.nextPaymentDue.description}</p>
                                                            )}
                                                            <div className="mt-3 bg-red-50 border border-red-100 p-3 rounded-xl inline-block">
                                                                <p className="text-xs font-bold text-red-800">
                                                                    Strict Deadline: {new Date(activeBooking.nextPaymentDue.due_date).toLocaleDateString()}
                                                                </p>
                                                                <p className="text-[11px] text-red-600 font-medium mt-0.5 max-w-sm">
                                                                    Failure to pay the exact amount by this date will result in automatic system cancellation and forfeiture of reservation slots.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Amount Due</p>
                                                            <p className="text-2xl font-bold text-[#1a1a1a]">₱{parseFloat(activeBooking.nextPaymentDue.amount).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <form onSubmit={(e) => handlePaymentSubmit(e, activeBooking.nextPaymentDue)} className="p-6 sm:p-8">
                                                        <div className="mb-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                                                            <div className="flex items-start gap-3">
                                                                <svg className="mt-0.5 h-5 w-5 text-[#720101]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                                <div>
                                                                    <p className="text-sm font-bold text-gray-900">Checkout</p>
                                                                    <p className="mt-1 text-sm font-medium text-gray-500">You will choose your payment method on the encrypted checkout screen.</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                                                            <div className="flex items-center gap-2 text-gray-400">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                                <span className="text-xs font-bold uppercase tracking-wider">Encrypted checkout</span>
                                                            </div>
                                                            <button 
                                                                type="submit" 
                                                                disabled={submittingPayment}
                                                                className={`bg-[#1a1a1a] hover:bg-black text-white font-bold py-3.5 px-10 rounded-xl shadow-md transition-all flex items-center gap-2 ${submittingPayment ? 'opacity-75 cursor-not-allowed' : ''}`}
                                                            >
                                                                {submittingPayment ? (
                                                                    <>
                                                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                                        Opening...
                                                                    </>
                                                                ) : 'Proceed to Checkout'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                </div>
                                            ) : (
                                                <div className="hidden">
                                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    </div>
                                                    <h3 className="text-xl font-bold text-green-900 mb-2">All Caught Up!</h3>
                                                    <p className="text-green-700 font-medium">You have no pending payments at this time. Thank you!</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </main>
            
            {/* MODALS */}
            {editCoreModalOpen && activeBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditCoreModalOpen(false)}></div>
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-fadeIn">
                        <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <h3 className="text-2xl font-display font-bold text-center text-[#1a1a1a] mb-2">Renegotiate Details</h3>
                        <p className="text-center text-gray-500 mb-8">Changing core details (Date, Pax) requires a system re-validation to ensure capacity availability. Your booking will be reset to Pending status.</p>
                        <div className="flex gap-4">
                            <button onClick={() => setEditCoreModalOpen(false)} className="flex-1 py-3 px-4 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                            <button onClick={handleRenegotiate} className="flex-1 py-3 px-4 font-bold text-white bg-[#f0aa0b] hover:bg-[#d9970a] rounded-xl shadow-md transition-colors">Proceed</button>
                        </div>
                    </div>
                </div>
            )}

            {cancelModalOpen && activeBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCancelModalOpen(false)}></div>
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-fadeIn">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <h3 className="text-2xl font-display font-bold text-center text-[#1a1a1a] mb-4">Cancel Booking</h3>
                        <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
                            <p className="text-sm font-medium text-red-800 text-center">{activeBooking.cancellationImpact?.message || "Are you sure you want to cancel?"}</p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setCancelModalOpen(false)} className="flex-1 py-3 px-4 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Go Back</button>
                            <button onClick={handleCancelBooking} className="flex-1 py-3 px-4 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-colors">Confirm Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {user && <ChatBubble user={user} />}

            <ReceiptModal
                isOpen={receiptModal.isOpen}
                onClose={() => setReceiptModal({ isOpen: false, payment: null, booking: null })}
                payment={receiptModal.payment}
                booking={receiptModal.booking}
            />
        </div>
    );
};

export default ClientDashboard;
