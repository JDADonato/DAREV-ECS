import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { router } from '@inertiajs/react';
import ChatBubble from '../../Components/common/ChatBubble';
import { fetchMenuItemsFromAPI } from '../../utils/menuUtils';
import ClientNavbar from '../../Components/common/ClientNavbar';

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

const buildJourneySteps = (booking, payments) => {
    const bookingPayments = payments.filter((payment) => payment.booking_id === booking.id);
    const total = Number(booking.total_cost || 0);
    const paid = bookingPayments
        .filter((payment) => isSettledPaymentStatus(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const hasReservation = bookingPayments.some((payment) => payment.payment_type === 'Reservation' && isSettledPaymentStatus(payment.status)) || (total > 0 && paid / total >= 0.1);
    const eventDetailsDone = Boolean(booking.venue_address_line && booking.event_time && (booking.event_timeline || booking.special_instructions || booking.color_motif));
    const menuDone = Boolean(booking.selected_menu);
    const paymentsDone = bookingPayments.length > 0 && bookingPayments.every((payment) => isSettledPaymentStatus(payment.status));

    return [
        { label: 'Booking created', done: true, action: 'Review event details' },
        { label: 'Reservation payment', done: hasReservation, action: 'Complete the reservation fee' },
        { label: 'Event details', done: eventDetailsDone, action: 'Add timeline, venue notes, and motif' },
        { label: 'Menu selection', done: menuDone, action: 'Finalize menu choices' },
        { label: 'Payment balance', done: paymentsDone, action: booking.nextPaymentDue ? `Pay ${booking.nextPaymentDue.payment_type}` : 'No remaining payment' },
    ];
};

const HistoryPanel = ({ bookings }) => (
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
                    <div key={booking.id} className="rounded-2xl border border-gray-100 bg-[#faf7f2] p-5">
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
                            <button onClick={() => router.get('/book')} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#5a0101]">
                                Rebook Event
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const ClientDashboard = () => {
    const { user, logout } = useAuth();
    const [data, setData] = useState({ bookings: [], historyBookings: [], tastings: [], payments: [] });
    const [loading, setLoading] = useState(true);
    const [activeBookingId, setActiveBookingId] = useState(null);
    const [activeSection, setActiveSection] = useState('details'); // details, menu, payments
    const [toast, setToast] = useState(null);
    const [detailsForm, setDetailsForm] = useState({});
    const [savingDetails, setSavingDetails] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [menuCatalog, setMenuCatalog] = useState({ starter: [], main: [], side: [], dessert: [], drink: [] });
    const [menuSelections, setMenuSelections] = useState({ starter: [], main: [], side: [], dessert: [], drink: [] });
    const [savingMenu, setSavingMenu] = useState(false);
    const [menuEditMode, setMenuEditMode] = useState(false);
    const [eventPickerOpen, setEventPickerOpen] = useState(false);

    const [submittingPayment, setSubmittingPayment] = useState(false);

    // Modal states
    const [editCoreModalOpen, setEditCoreModalOpen] = useState(false);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);

    const isSettledPayment = (payment) => isSettledPaymentStatus(payment.status);

    useEffect(() => {
        const tab = new URLSearchParams(window.location.search).get('tab');
        if (['details', 'menu', 'tastings', 'payments', 'history'].includes(tab)) {
            setActiveSection(tab);
        }
        fetchData();
        fetchMenuItemsFromAPI().then(setMenuCatalog);
    }, []);

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
                if (activeBookings.length > 0 && (!activeBookingId || !activeBookings.some((booking) => booking.id === activeBookingId))) {
                    setActiveBookingId(activeBookings[0].id);
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
        setSubmittingPayment(true);
        setToast({ message: 'Opening checkout...', type: 'success' });

        try {
            // TODO: PAYMONGO INTEGRATION
            // This initializes the internal checkout page now. Later this will redirect
            // to the hosted provider checkout URL returned by the backend.
            const res = await fetch('/checkout/initialize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    booking_id: activeBookingId,
                    payment_id: nextPayment.id,
                    amount: nextPayment.amount
                })
            });
            const result = await res.json();
            if (res.ok && result.redirect_url) {
                router.visit(result.redirect_url);
            } else {
                setToast({ message: result.error || 'Unable to open checkout.', type: 'error' });
                setSubmittingPayment(false);
            }
        } catch (err) {
            setToast({ message: 'Unable to connect to checkout.', type: 'error' });
            setSubmittingPayment(false);
        }
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

    const saveMenuSelection = async () => {
        setSavingMenu(true);
        try {
            const res = await fetch(`/api/bookings/${activeBooking.id}/menu`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selected_menu: menuSelections }),
            });
            const result = await res.json().catch(() => ({}));
            if (res.ok) {
                setToast({ message: 'Menu selection updated. Pricing and unpaid balances were recalculated.', type: 'success' });
                setMenuEditMode(false);
                fetchData();
            } else {
                setToast({ message: result.error || 'Unable to update menu.', type: 'error' });
            }
        } catch (e) {
            setToast({ message: 'Network error while updating menu.', type: 'error' });
        } finally {
            setSavingMenu(false);
        }
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
                                    { id: 'details', label: 'Event Details', needsWork: activeJourneySteps.some(s => s.label === 'Event details' && !s.done), icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                                    { id: 'menu', label: 'Menu', needsWork: activeJourneySteps.some(s => s.label === 'Menu selection' && !s.done), icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                                    { id: 'tastings', label: 'Food Tastings', needsWork: data.tastings.length === 0, icon: 'M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h4.5M4.5 4.5h15v15h-15z' },
                                    { id: 'payments', label: 'Payments', needsWork: activeBooking.nextPaymentDue, icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 014 0z' },
                                    { id: 'history', label: 'History', needsWork: false, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
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
                                        <div className="grid gap-3 sm:grid-cols-5">
                                            {activeJourneySteps.map((step, index) => (
                                                <div key={step.label} className={`rounded-2xl border p-3 ${step.done ? 'border-green-100 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                                                    <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step.done ? 'bg-green-600 text-white' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}>
                                                        {step.done ? '✓' : index + 1}
                                                    </div>
                                                    <p className="text-xs font-bold text-gray-900">{step.label}</p>
                                                    {!step.done && <p className="mt-1 text-[11px] font-medium leading-4 text-gray-500">{step.action}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Content based on Active Section */}
                                    {activeSection === 'details' && (
                                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
                                            <h3 className="text-xl font-bold font-display text-[#1a1a1a] mb-6">Supplementary Event Details</h3>
                                            
                                            {!activeBooking.canEditSupplementary && activeBooking.status !== 'Cancelled' && (
                                                <div className="mb-6 p-4 rounded-xl flex items-start gap-3 bg-red-50 border border-red-100">
                                                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    <div>
                                                        <p className="text-sm font-bold text-red-800">14-Day Hard Freeze Active</p>
                                                        <p className="text-xs text-red-700 mt-1">Your event details are currently locked as our team is making final preparations. If you need to make an urgent change, please use the messaging module to contact your Marketing Executive directly.</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Venue</p>
                                                    <input 
                                                        readOnly={!activeBooking.canEditSupplementary}
                                                        disabled={!activeBooking.canEditSupplementary}
                                                        className="w-full bg-transparent border-b border-gray-300 py-1 text-sm font-semibold text-gray-900 focus:outline-none focus:border-[#720101] disabled:opacity-60"
                                                        value={detailsForm.venue_address_line || ''}
                                                        onChange={(e) => setDetailsForm(prev => ({ ...prev, venue_address_line: e.target.value }))}
                                                        placeholder="Venue Address"
                                                    />
                                                </div>
                                                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Color Motif</p>
                                                    <input 
                                                        readOnly={!activeBooking.canEditSupplementary}
                                                        disabled={!activeBooking.canEditSupplementary}
                                                        className="w-full bg-transparent border-b border-gray-300 py-1 text-sm font-semibold text-gray-900 focus:outline-none focus:border-[#720101] disabled:opacity-60"
                                                        value={detailsForm.color_motif || ''}
                                                        onChange={(e) => setDetailsForm(prev => ({ ...prev, color_motif: e.target.value }))}
                                                        placeholder="e.g., Gold & Navy"
                                                    />
                                                </div>
                                                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Reservation Time</p>
                                                    <input
                                                        readOnly={!activeBooking.canEditSupplementary}
                                                        disabled={!activeBooking.canEditSupplementary}
                                                        className="w-full bg-transparent border-b border-gray-300 py-1 text-sm font-semibold text-gray-900 focus:outline-none focus:border-[#720101] disabled:opacity-60"
                                                        value={detailsForm.reservation_time || ''}
                                                        onChange={(e) => setDetailsForm(prev => ({ ...prev, reservation_time: e.target.value }))}
                                                        placeholder="e.g., 4:00 PM"
                                                    />
                                                </div>
                                                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Serving Time</p>
                                                    <input
                                                        readOnly={!activeBooking.canEditSupplementary}
                                                        disabled={!activeBooking.canEditSupplementary}
                                                        className="w-full bg-transparent border-b border-gray-300 py-1 text-sm font-semibold text-gray-900 focus:outline-none focus:border-[#720101] disabled:opacity-60"
                                                        value={detailsForm.serving_time || ''}
                                                        onChange={(e) => setDetailsForm(prev => ({ ...prev, serving_time: e.target.value }))}
                                                        placeholder="e.g., 6:30 PM"
                                                    />
                                                </div>
                                                <div className="sm:col-span-2 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Event Timeline / Program</p>
                                                    <textarea 
                                                        readOnly={!activeBooking.canEditSupplementary}
                                                        disabled={!activeBooking.canEditSupplementary}
                                                        className="w-full bg-transparent border border-gray-300 rounded p-2 text-sm font-semibold text-gray-900 focus:outline-none focus:border-[#720101] disabled:opacity-60 resize-none h-24"
                                                        value={detailsForm.event_timeline || ''}
                                                        onChange={(e) => setDetailsForm(prev => ({ ...prev, event_timeline: e.target.value }))}
                                                        placeholder="e.g., 6PM Cocktails, 7PM Dinner"
                                                    />
                                                </div>
                                                <div className="sm:col-span-2 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Special Instructions & Allergies</p>
                                                    <textarea 
                                                        readOnly={!activeBooking.canEditSupplementary}
                                                        disabled={!activeBooking.canEditSupplementary}
                                                        className="w-full bg-transparent border border-gray-300 rounded p-2 text-sm font-semibold text-gray-900 focus:outline-none focus:border-[#720101] disabled:opacity-60 resize-none h-24"
                                                        value={detailsForm.special_instructions || ''}
                                                        onChange={(e) => setDetailsForm(prev => ({ ...prev, special_instructions: e.target.value }))}
                                                        placeholder="e.g., 2 vegan guests"
                                                    />
                                                </div>
                                                <div className="sm:col-span-2 rounded-2xl border border-dashed border-[#720101]/25 bg-[#720101]/5 p-4">
                                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p className="text-xs font-bold uppercase tracking-widest text-[#720101]">Inspiration Image</p>
                                                            <p className="mt-1 text-sm font-medium text-gray-600">Upload a mood board, theme sample, or layout reference.</p>
                                                            {detailsForm.theme_uploads && <p className="mt-2 text-xs font-bold text-green-700">Image attached</p>}
                                                        </div>
                                                        <label className={`inline-flex cursor-pointer items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#720101] shadow-sm ring-1 ring-[#720101]/15 ${!activeBooking.canEditSupplementary ? 'pointer-events-none opacity-50' : ''}`}>
                                                            {uploadingImage ? 'Uploading...' : 'Upload Image'}
                                                            <input type="file" accept="image/*" className="hidden" disabled={!activeBooking.canEditSupplementary || uploadingImage} onChange={(e) => uploadInspirationImage(e.target.files?.[0])} />
                                                        </label>
                                                    </div>
                                                    {detailsForm.theme_uploads && <img src={detailsForm.theme_uploads} alt="Event inspiration" className="mt-4 h-32 w-full rounded-xl object-cover" />}
                                                </div>
                                            </div>
                                            {activeBooking.canEditSupplementary && (
                                                <div className="mt-6 flex justify-end">
                                                    <button onClick={saveEventDetails} disabled={savingDetails} className="bg-[#1a1a1a] text-white font-bold py-2.5 px-6 rounded-xl shadow-sm hover:bg-black transition-colors disabled:opacity-60">{savingDetails ? 'Saving...' : 'Save Details'}</button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeSection === 'history' && (
                                        <HistoryPanel bookings={data.historyBookings} />
                                    )}

                                    {activeSection === 'menu' && (
                                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
                                            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <h3 className="text-xl font-bold font-display text-[#1a1a1a]">Menu Selection</h3>
                                                    <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-gray-500">Dish edits use current menu prices. When saved, the system recalculates the event total and updates unpaid balances only.</p>
                                                </div>
                                                {activeBooking.canEditMenu && !menuEditMode && (
                                                    <button onClick={() => setMenuEditMode(true)} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#5a0101]">
                                                        Edit Menu
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {!activeBooking.canEditMenu && activeBooking.status !== 'Cancelled' && (
                                                <div className="mb-6 p-4 rounded-xl flex items-start gap-3 bg-red-50 border border-red-100">
                                                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    <div>
                                                        <p className="text-sm font-bold text-red-800">30-Day Menu Freeze Active</p>
                                                        <p className="text-xs text-red-700 mt-1">Your menu is locked for final sourcing and preparation. Dish swapping is no longer available.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {menuCategories.map((category) => {
                                                const items = menuSelections[category.id] || [];
                                                if (!items.length) return null;
                                                return (
                                                    <div key={category.id} className="mb-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                                        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#720101]">{category.label}</p>
                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                            {items.map((item, index) => (
                                                                <div key={`${category.id}-${index}`} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
                                                                    <div className="flex gap-3">
                                                                        <img src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300'} alt={item.name} className="h-14 w-14 rounded-lg object-cover" />
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="truncate text-sm font-bold text-gray-900">{item.name}</p>
                                                                            <p className="mt-1 text-xs font-semibold text-gray-500">{peso((item.costPerHead || 0) + (item.priceAdj || 0))} per head</p>
                                                                        </div>
                                                                    </div>
                                                                    {activeBooking.canEditMenu && menuEditMode && (
                                                                        <div className="mt-3 flex gap-2">
                                                                        <select
                                                                            value={item.id || ''}
                                                                            onChange={(e) => swapMenuItem(category.id, index, e.target.value)}
                                                                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-[#720101]"
                                                                        >
                                                                            {(menuCatalog[category.id] || []).map((dish) => (
                                                                                <option key={dish.id} value={dish.id}>{dish.name}</option>
                                                                            ))}
                                                                        </select>
                                                                        <button onClick={() => removeMenuItem(category.id, index)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100">
                                                                            Remove
                                                                        </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {activeBooking.canEditMenu && menuEditMode && (
                                                            <select
                                                                value=""
                                                                onChange={(e) => addMenuItem(category.id, e.target.value)}
                                                                className="mt-4 w-full rounded-xl border border-dashed border-[#720101]/30 bg-white px-3 py-3 text-xs font-bold text-gray-600 outline-none focus:border-[#720101]"
                                                            >
                                                                <option value="">Add {category.label.slice(0, -1)}</option>
                                                                {(menuCatalog[category.id] || []).map((dish) => (
                                                                    <option key={dish.id} value={dish.id}>{dish.name} - {peso(dish.costPerHead + dish.priceAdj)} per head</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {activeBooking.canEditMenu && menuEditMode && menuCategories.some((category) => (menuSelections[category.id] || []).length === 0) && (
                                                <div className="mb-5 rounded-2xl border border-dashed border-[#720101]/25 bg-[#720101]/5 p-4">
                                                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#720101]">Add dishes to empty categories</p>
                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        {menuCategories.filter((category) => (menuSelections[category.id] || []).length === 0).map((category) => (
                                                            <select
                                                                key={category.id}
                                                                value=""
                                                                onChange={(e) => addMenuItem(category.id, e.target.value)}
                                                                className="rounded-xl border border-white bg-white px-3 py-3 text-xs font-bold text-gray-600 outline-none focus:border-[#720101]"
                                                            >
                                                                <option value="">Add {category.label}</option>
                                                                {(menuCatalog[category.id] || []).map((dish) => (
                                                                    <option key={dish.id} value={dish.id}>{dish.name} - {peso(dish.costPerHead + dish.priceAdj)} per head</option>
                                                                ))}
                                                            </select>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {!Object.values(menuSelections).some(items => items.length > 0) && (
                                                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                                                    <p className="font-bold text-gray-900">No menu has been selected yet.</p>
                                                    <p className="mt-1 text-sm text-gray-500">Choose dishes from the menu gallery to complete this step.</p>
                                                </div>
                                            )}
                                            {activeBooking.canEditMenu && menuEditMode && (
                                                <div className="mt-6 flex flex-wrap justify-end gap-3">
                                                    <button onClick={() => setMenuEditMode(false)} className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
                                                    <button onClick={saveMenuSelection} disabled={savingMenu} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#5a0101] disabled:opacity-60">{savingMenu ? 'Saving...' : 'Save Menu Changes'}</button>
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
                                                                <div className="rounded-2xl bg-gray-50 p-4 md:max-w-xs">
                                                                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Notes</p>
                                                                    <p className="mt-2 text-sm font-medium leading-6 text-gray-600">{tasting.notes || 'No special notes were added for this tasting session.'}</p>
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
                                                                                    <p className={`mt-1 text-xs font-bold uppercase tracking-widest ${isSettledPayment(payment) ? 'text-green-300' : overdue ? 'text-red-300' : 'text-[#f0aa0b]'}`}>
                                                                                        {isSettledPayment(payment) ? 'Paid' : overdue ? 'Overdue - slot may be cancelled' : 'Pending'}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {activeBooking.nextPaymentDue ? (
                                                                <form onSubmit={(e) => handlePaymentSubmit(e, activeBooking.nextPaymentDue)} className="mt-6 rounded-2xl border border-[#f0aa0b]/25 bg-white/[0.07] p-5">
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
                                                                                disabled={submittingPayment}
                                                                                className={`rounded-xl bg-[#f0aa0b] px-6 py-3.5 text-sm font-black text-[#1a1a1a] shadow-lg shadow-black/20 transition-all hover:bg-[#d99a08] ${submittingPayment ? 'cursor-not-allowed opacity-70' : ''}`}
                                                                            >
                                                                                {submittingPayment ? 'Opening Checkout...' : 'Proceed to Checkout'}
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
        </div>
    );
};

export default ClientDashboard;
