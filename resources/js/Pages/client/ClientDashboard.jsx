import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { router } from '@inertiajs/react';
import ReceiptModal from '../../components/common/ReceiptModal';
import UserDropdown from '../../components/common/UserDropdown';
import NotificationBell from '../../Components/common/NotificationBell';
import ChatBubble from '../../Components/common/ChatBubble';

const PAYMENT_TYPE_LABELS = {
    Reservation: { label: 'Reservation Fee', pct: '10%', color: 'blue' },
    DownPayment: { label: 'Down Payment', pct: '70%', color: 'amber' },
    Final: { label: 'Final Payment', pct: '20%', color: 'green' },
};

const Tooltip = ({ text }) => {
    const [show, setShow] = useState(false);
    return (
        <span className="relative inline-block ml-1.5">
            <span
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold cursor-help hover:bg-primary-100 hover:text-primary-600 transition-colors"
            >?</span>
            {show && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg w-56 text-center z-50 pointer-events-none animate-fadeIn">
                    {text}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></span>
                </span>
            )}
        </span>
    );
};

const ClientDashboard = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('my-events');
    const [data, setData] = useState({ bookings: [], tastings: [], payments: [] });
    const [loading, setLoading] = useState(true);
    // Events are always expanded (full view)
    const [eventDetailsForm, setEventDetailsForm] = useState({});
    const [saving, setSaving] = useState(null);
    const [saveMessage, setSaveMessage] = useState({});
    const [toast, setToast] = useState(null);

    // Edit modal state
    const [editModal, setEditModal] = useState({ open: false, booking: null });
    const [editForm, setEditForm] = useState({});
    const [editSaving, setEditSaving] = useState(false);

    // Cancel modal state
    const [cancelModal, setCancelModal] = useState({ open: false, bookingId: null });
    const [cancelLoading, setCancelLoading] = useState(false);

    // Receipt Modal state
    const [receiptModal, setReceiptModal] = useState({ isOpen: false, payment: null, booking: null });

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const fetchData = async () => {
        try {
            // Session auth - cookies sent automatically
            const response = await fetch('/api/dashboard/client', {
                headers: { }
            });
            if (response.ok) {
                const result = await response.json();
                setData(result);
                const forms = {};
                result.bookings.forEach(function (b) {
                    forms[b.id] = {
                        reservation_time: b.reservation_time || '',
                        serving_time: b.serving_time || '',
                        event_timeline: b.event_timeline || '',
                        color_motif: b.color_motif || ''
                    };
                });
                setEventDetailsForm(forms);
            }
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDetailChange = (bookingId, field, value) => {
        setEventDetailsForm(function (prev) {
            var updated = Object.assign({}, prev);
            updated[bookingId] = Object.assign({}, updated[bookingId], { [field]: value });
            return updated;
        });
    };

    const handleFileUpload = async (bookingId, e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSaveMessage(prev => ({ ...prev, [bookingId]: { type: 'success', text: 'Uploading image...' } }));

        const formData = new FormData();
        formData.append('image', file);

        try {
            // Session auth - no token needed
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                handleDetailChange(bookingId, 'theme_uploads', data.url);
                setSaveMessage(prev => ({
                    ...prev, [bookingId]: {
                        type: 'success', text: 'Image uploaded successfully. Do not forget to save!'
                    }
                }));
            } else {
                setSaveMessage(prev => ({ ...prev, [bookingId]: { type: 'error', text: data.error || 'Upload failed' } }));
            }
        } catch (err) {
            setSaveMessage(prev => ({ ...prev, [bookingId]: { type: 'error', text: 'Error uploading file' } }));
        }
    };

    const saveEventDetails = async (bookingId) => {
        setSaving(bookingId);
        setSaveMessage(function (prev) { return Object.assign({}, prev, { [bookingId]: null }); });
        try {
            // Session auth - no token needed
            const response = await fetch('/api/bookings/' + bookingId + '/event-details', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventDetailsForm[bookingId])
            });
            if (response.ok) {
                setSaveMessage(function (prev) { return Object.assign({}, prev, { [bookingId]: { type: 'success', text: 'Event details saved!' } }); });
                setTimeout(function () { setSaveMessage(function (prev) { return Object.assign({}, prev, { [bookingId]: null }); }); }, 3000);
            } else {
                var errData = await response.json();
                setSaveMessage(function (prev) { return Object.assign({}, prev, { [bookingId]: { type: 'error', text: errData.error || 'Failed to save.' } }); });
            }
        } catch (err) {
            setSaveMessage(function (prev) { return Object.assign({}, prev, { [bookingId]: { type: 'error', text: 'Network error.' } }); });
        } finally {
            setSaving(null);
        }
    };

    // Cancel booking
    const handleCancelBooking = async () => {
        setCancelLoading(true);
        try {
            // Session auth - no token needed
            const res = await fetch('/api/bookings/' + cancelModal.bookingId + '/cancel', {
                method: 'PUT',
                headers: { }
            });
            const result = await res.json();
            if (res.ok) {
                setToast({ message: 'Booking cancelled successfully.', type: 'success' });
                fetchData();
            } else {
                setToast({ message: result.error || 'Failed to cancel.', type: 'error' });
            }
        } catch (err) {
            setToast({ message: 'Network error.', type: 'error' });
        } finally {
            setCancelLoading(false);
            setCancelModal({ open: false, bookingId: null });
        }
    };

    // Edit booking
    const openEditModal = (booking) => {
        setEditForm({
            event_date: booking.event_date || '',
            event_time: booking.event_time || '',
            pax: booking.pax || '',
            client_full_name: booking.client_full_name || '',
            venue_address_line: booking.venue_address_line || '',
            venue_street: booking.venue_street || '',
            venue_city: booking.venue_city || '',
            client_email: booking.client_email || '',
            client_phone: booking.client_phone || ''
        });
        setEditModal({ open: true, booking: booking });
    };

    const handleEditSubmit = async () => {
        setEditSaving(true);
        try {
            // Session auth - no token needed
            const res = await fetch('/api/bookings/' + editModal.booking.id + '/update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });
            const result = await res.json();
            if (res.ok) {
                setToast({ message: 'Booking updated successfully!', type: 'success' });
                setEditModal({ open: false, booking: null });
                fetchData();
            } else {
                setToast({ message: result.error || 'Failed to update.', type: 'error' });
            }
        } catch (err) {
            setToast({ message: 'Network error.', type: 'error' });
        } finally {
            setEditSaving(false);
        }
    };

    const formatAddress = (booking) => {
        var parts = [booking.venue_address_line, booking.venue_street, booking.venue_city].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'Not provided';
    };

    const getPaymentsForBooking = (bookingId) => {
        return data.payments.filter(function (p) { return p.booking_id === bookingId; });
    };

    const getStatusBadge = (status, dueDate) => {
        var isOverdue = dueDate && new Date(dueDate) < new Date() && status === 'Pending';
        if (isOverdue) return { cls: 'bg-red-100 text-red-800 border border-red-200', text: 'Overdue' };
        if (status === 'Verified') return { cls: 'bg-green-100 text-green-800 border border-green-200', text: 'Paid' };
        if (status === 'Pending') return { cls: 'bg-yellow-100 text-yellow-800 border border-yellow-200', text: 'Pending' };
        if (status === 'Rejected') return { cls: 'bg-gray-100 text-gray-600 border border-gray-200', text: 'Rejected' };
        return { cls: 'bg-gray-100 text-gray-600', text: status };
    };

    const canModifyBooking = (booking) => {
        if (booking.status === 'Cancelled') return false;
        var eventDate = new Date(booking.event_date);
        var now = new Date();
        var daysUntil = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
        return daysUntil >= 7;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto py-5 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <div className="flex items-center">
                        <button onClick={() => router.get('/')} className="mr-4 text-gray-400 hover:text-gray-700 transition-colors">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 font-display">My Dashboard</h1>
                            <p className="text-sm text-gray-400">Manage your events and payments</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-primary-50 text-primary-700 text-xs px-3 py-1 rounded-full font-semibold">Client</div>
                        {user && <NotificationBell variant="dark" />}
                        {user && (
                            <UserDropdown 
                                user={user} 
                                dashLink={user.role === 'Client' ? '/dashboard/client' : user.role === 'Marketing' ? '/dashboard/ops' : user.role === 'Accounting' ? '/dashboard/finance' : '/dashboard/admin'} 
                            />
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                    <nav className="flex">
                        {[
                            { key: 'my-events', label: 'My Events', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                            { key: 'tastings', label: 'Tastings', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                            { key: 'payments', label: 'Payments', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' }
                        ].map(function (tab) {
                            return (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                    className={'flex-1 flex items-center justify-center gap-2 py-4 px-4 text-sm font-medium border-b-2 transition-all ' +
                                        (activeTab === tab.key
                                            ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50')}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* ======================== MY EVENTS TAB ======================== */}
                {activeTab === 'my-events' && (
                    <div className="space-y-5">
                        {data.bookings.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <p className="text-lg font-semibold text-gray-700 mb-1">No events yet</p>
                                <p className="text-sm text-gray-400 mb-6">Book your first event to see it here!</p>
                                <button onClick={() => router.get('/book')} className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors text-sm">Book Now</button>
                            </div>
                        ) : (
                            data.bookings.slice().sort(function (a, b) {
                                var now = new Date();
                                var dateA = new Date(a.event_date);
                                var dateB = new Date(b.event_date);
                                var diffA = dateA - now;
                                var diffB = dateB - now;
                                // Upcoming events first (positive diff), then past events
                                if (diffA >= 0 && diffB >= 0) return diffA - diffB;
                                if (diffA >= 0) return -1;
                                if (diffB >= 0) return 1;
                                return diffB - diffA; // past: most recent first
                            }).map(function (booking) {
                                var payments = getPaymentsForBooking(booking.id);
                                var totalCost = parseFloat(booking.total_cost) || parseFloat(booking.budget) || 0;
                                var paidAmount = payments.filter(function (p) { return p.status === 'Verified'; }).reduce(function (s, p) { return s + p.amount; }, 0);
                                var remainingBalance = totalCost - paidAmount;
                                var progressPct = totalCost > 0 ? Math.min((paidAmount / totalCost) * 100, 100) : 0;
                                var canModify = canModifyBooking(booking);

                                return (
                                    <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        {/* Event Header */}
                                        <div>
                                            <div className="p-5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm ' +
                                                            (booking.status === 'Cancelled' ? 'bg-gray-400' : booking.status === 'Confirmed' ? 'bg-green-500' : 'bg-primary-500')}>
                                                            {'#' + booking.id}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h3 className="font-bold text-gray-900">{booking.client_full_name || 'Event #' + booking.id}</h3>
                                                                <span className={'px-2 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wider ' +
                                                                    (booking.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                                                                        booking.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                                                            'bg-yellow-100 text-yellow-700')}>
                                                                    {booking.status}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                                                                <span className="flex items-center gap-1">
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                                    {new Date(booking.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                    {booking.event_time}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                    {booking.pax + ' pax'}
                                                                </span>
                                                                {booking.event_type && (
                                                                    <span className="flex items-center gap-1">
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                                                        {booking.event_type}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        {totalCost > 0 && (
                                                            <div className="text-right hidden sm:block">
                                                                <p className="text-xs text-gray-400 uppercase tracking-wider">Total</p>
                                                                <p className="text-lg font-bold text-gray-900">{'₱' + totalCost.toLocaleString()}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Mini progress bar */}
                                                {totalCost > 0 && payments.length > 0 && (
                                                    <div className="mt-3">
                                                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                            <span>{'Paid: ₱' + paidAmount.toLocaleString()}</span>
                                                            <span>{Math.round(progressPct) + '% complete'}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                            <div className="bg-green-500 h-1.5 rounded-full transition-all duration-500" style={{ width: progressPct + '%' }}></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* ======================== EVENT CONTENT (always visible) ======================== */}

                                        <div className="border-t border-gray-100">

                                            {/* ---- Live Status Tracker ---- */}
                                            {booking.status !== 'Cancelled' && (
                                                <div className="px-5 pt-5 pb-2">
                                                    {(() => {
                                                        const phases = ['Not Started', 'On the Way', 'Preparing', 'Serving', 'Completed'];
                                                        const currentIdx = phases.indexOf(booking.live_status || 'Not Started');
                                                        return (
                                                            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                                                                <div className="flex justify-between items-center mb-6">
                                                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center">
                                                                        <svg className="w-4 h-4 mr-2 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                        Live Event Status
                                                                    </h4>
                                                                    <span className="px-3 py-1 bg-white border border-gray-200 text-primary-600 font-bold text-xs rounded-full shadow-sm">{booking.live_status || 'Not Started'}</span>
                                                                </div>
                                                                <div className="relative flex justify-between px-2 sm:px-4">
                                                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full"></div>
                                                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary-500 rounded-full transition-all duration-700" style={{ width: `${(Math.max(0, currentIdx) / (phases.length - 1)) * 100}%` }}></div>

                                                                    {phases.map((phase, idx) => {
                                                                        const isPast = idx < currentIdx;
                                                                        const isCurrent = idx === currentIdx;
                                                                        return (
                                                                            <div key={phase} className="relative flex flex-col items-center">
                                                                                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 z-10 flex items-center justify-center transition-all duration-500 ${isPast ? 'bg-primary-500 border-primary-500 shadow-md' : isCurrent ? 'bg-white border-primary-500 ring-4 ring-primary-100 scale-110' : 'bg-white border-gray-300'}`}>
                                                                                    {isPast && <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                                                </div>
                                                                                <span className={`absolute top-8 sm:top-10 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${isCurrent ? 'text-primary-700' : isPast ? 'text-gray-600' : 'text-gray-400'}`}>{phase}</span>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}

                                            {/* ---- Action Buttons (Cancel / Edit) ---- */}
                                            <div className="px-5 pt-4 flex gap-3 justify-end">
                                                {canModify && (
                                                    <>
                                                        <button onClick={function (e) { e.stopPropagation(); openEditModal(booking); }}
                                                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                            Edit Event
                                                        </button>
                                                        <button onClick={function (e) { e.stopPropagation(); setCancelModal({ open: true, bookingId: booking.id }); }}
                                                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 border border-red-200 transition-colors">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            Cancel Event
                                                        </button>
                                                    </>
                                                )}
                                                {!canModify && booking.status !== 'Cancelled' && (
                                                    <span className="text-xs text-gray-400 italic py-2">Editing is locked within 7 days of the event</span>
                                                )}
                                            </div>

                                            {/* ---- Payment Section ---- */}
                                            {payments.length > 0 && (
                                                <div className="px-5 pt-5 pb-2">
                                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center">
                                                        <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                        Payment Schedule
                                                    </h4>

                                                    {/* Progress Bar */}
                                                    <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="text-sm font-medium text-gray-700">Payment Progress</span>
                                                            <span className="text-sm font-bold text-gray-900">{Math.round(progressPct) + '%'}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                                            <div className={'h-3 rounded-full transition-all duration-700 ' + (progressPct === 100 ? 'bg-green-500' : progressPct > 50 ? 'bg-blue-500' : 'bg-amber-500')} style={{ width: progressPct + '%' }}></div>
                                                        </div>
                                                        <div className="flex justify-between mt-2 text-xs text-gray-500">
                                                            <span>{'Paid: ₱' + paidAmount.toLocaleString()}</span>
                                                            <span>{'Remaining: ₱' + remainingBalance.toLocaleString()}</span>
                                                        </div>
                                                    </div>

                                                    {/* Payment Tier Cards */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                                        {payments.map(function (payment) {
                                                            var typeInfo = PAYMENT_TYPE_LABELS[payment.payment_type] || { label: payment.payment_type || 'Payment', pct: '', color: 'gray' };
                                                            var badge = getStatusBadge(payment.status, payment.due_date);
                                                            var isPaid = payment.status === 'Verified';

                                                            return (
                                                                <div key={payment.id} className={'rounded-xl border p-4 transition-all ' + (isPaid ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200')}>
                                                                    <div className="flex items-center justify-between mb-3">
                                                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{typeInfo.pct}</span>
                                                                        <span className={'inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ' + badge.cls}>{badge.text}</span>
                                                                    </div>
                                                                    <p className="text-sm font-semibold text-gray-800 mb-1">{typeInfo.label}</p>
                                                                    <p className="text-xl font-bold text-gray-900">{'₱' + (payment.amount ? payment.amount.toLocaleString() : '0')}</p>
                                                                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 flex justify-between items-center">
                                                                        <span>{'Due: ' + (payment.due_date || '-')}</span>
                                                                        {isPaid && (
                                                                            <div className="flex gap-2 items-center">
                                                                                <span className="text-green-600 font-medium">Verified</span>
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); setReceiptModal({ isOpen: true, payment: payment, booking: booking }); }}
                                                                                    className="text-primary-600 hover:text-primary-800 underline font-medium"
                                                                                >
                                                                                    Receipt
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {!isPaid && (
                                                                        <button onClick={function (e) { e.stopPropagation(); router.get('/pay?paymentId=' + payment.id + '&bookingId=' + booking.id + '&amount=' + payment.amount + '&type=' + payment.payment_type); }}
                                                                            className="w-full mt-3 py-2 rounded-lg text-xs font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-sm">
                                                                            Pay Now
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Pay in Full option */}
                                                    {remainingBalance > 0 && (
                                                        <div className="bg-gradient-to-r from-primary-50 to-amber-50 rounded-xl border border-primary-200 p-4 flex items-center justify-between">
                                                            <div>
                                                                <p className="font-semibold text-gray-800 text-sm">Pay in Full</p>
                                                                <p className="text-xs text-gray-500">{'Clear remaining balance of ₱' + remainingBalance.toLocaleString()}</p>
                                                            </div>
                                                            <button onClick={function (e) { e.stopPropagation(); router.get('/pay?bookingId=' + booking.id + '&amount=' + remainingBalance + '&type=Full&payInFull=true'); }}
                                                                className="bg-primary-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors shadow-sm">
                                                                {'Pay ₱' + remainingBalance.toLocaleString()}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* ---- Additional Event Details Form ---- */}
                                            <div className="px-5 py-5">
                                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1 flex items-center">
                                                    <svg className="w-4 h-4 mr-2 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    Additional Event Details
                                                </h4>
                                                <p className="text-xs text-gray-400 mb-4">Fill in the remaining details needed for your event planning.</p>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs text-gray-600 mb-1 font-medium">
                                                            Event Time
                                                            <Tooltip text="The event time from your booking. You can change this via Edit Event." />
                                                        </label>
                                                        <div className="w-full p-3 border border-gray-200 rounded-lg bg-gray-100 text-gray-700 font-medium">
                                                            {booking.event_time || 'Not set'}
                                                        </div>
                                                    </div>
                                                    {booking.event_type && (
                                                        <div>
                                                            <label className="block text-xs text-gray-600 mb-1 font-medium">
                                                                Event Type
                                                            </label>
                                                            <div className="w-full p-3 border border-gray-200 rounded-lg bg-gray-100 text-gray-700 font-medium">
                                                                {booking.event_type}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="md:col-span-2">
                                                        <label className="block text-xs text-gray-600 mb-1 font-medium">
                                                            Event Proper Schedule / Timeline
                                                            <Tooltip text="Outline the flow of your event, e.g. guest arrival, ceremony, dinner, program." />
                                                        </label>
                                                        <textarea rows="3" placeholder={'e.g.\n5:00 PM - Guest Arrival\n6:00 PM - Ceremony\n7:00 PM - Dinner'} value={eventDetailsForm[booking.id]?.event_timeline || ''} onChange={function (e) { handleDetailChange(booking.id, 'event_timeline', e.target.value); }}
                                                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700" />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-xs text-gray-600 mb-1 font-medium">
                                                            Color Motif
                                                            <Tooltip text="Your event's color theme for table settings, decorations, and styling." />
                                                        </label>
                                                        <input type="text" placeholder="e.g. Blush Pink & Gold, Navy Blue & Silver" value={eventDetailsForm[booking.id]?.color_motif || ''} onChange={function (e) { handleDetailChange(booking.id, 'color_motif', e.target.value); }}
                                                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700" />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-xs text-gray-600 mb-1 font-medium">
                                                            Theme Inspiration Upload
                                                            <Tooltip text="Upload an image to show us your envisioned theme or color motif." />
                                                        </label>

                                                        {eventDetailsForm[booking.id]?.theme_uploads && (
                                                            <div className="mb-3 relative group w-fit">
                                                                <img src={`${eventDetailsForm[booking.id]?.theme_uploads}`} alt="Theme Inspo" className="h-32 rounded border border-gray-200 object-cover shadow-sm" />
                                                                <button onClick={() => handleDetailChange(booking.id, 'theme_uploads', '')} className="absolute top-1 right-1 bg-white rounded-full p-1 shadow hover:bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                                </button>
                                                            </div>
                                                        )}

                                                        <input type="file" accept="image/*" onChange={(e) => handleFileUpload(booking.id, e)} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer" />
                                                    </div>

                                                    <div className="md:col-span-2">
                                                        <label className="block text-xs text-gray-600 mb-1 font-medium">
                                                            Special Instructions & Dietary Restrictions
                                                            <Tooltip text="Let us know if you have any special instructions, allergies, dietary constraints, or a note for the chef." />
                                                        </label>
                                                        <textarea rows="3" placeholder="e.g. 2 guests are vegan, please prepare a special plate. Add more flowers to the VIP table." value={eventDetailsForm[booking.id]?.special_instructions || ''} onChange={(e) => handleDetailChange(booking.id, 'special_instructions', e.target.value)}
                                                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700" />
                                                    </div>
                                                </div>

                                                {saveMessage[booking.id] && (
                                                    <div className={'mt-4 p-3 rounded-lg text-sm font-medium ' + (saveMessage[booking.id].type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                                                        {saveMessage[booking.id].text}
                                                    </div>
                                                )}

                                                <div className="mt-5 flex justify-end">
                                                    <button onClick={() => saveEventDetails(booking.id)} disabled={saving === booking.id}
                                                        className={'inline-flex items-center px-6 py-2.5 rounded-lg font-bold text-sm text-white shadow-sm transition-all ' +
                                                            (saving === booking.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700')}>
                                                        {saving === booking.id ? 'Saving...' : 'Save Details'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* ======================== TASTINGS TAB ======================== */}
                {
                    activeTab === 'tastings' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {data.tastings.length === 0 ? (
                                <div className="p-12 text-center">
                                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                    <p className="text-lg font-semibold text-gray-700">No food tastings scheduled</p>
                                    <p className="text-sm text-gray-400 mt-1">Request one when creating your next booking</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {data.tastings.map(function (tasting) {
                                        return (
                                            <li key={tasting.id} className="p-5 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900">{'Tasting #' + tasting.id}</h3>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            {new Date(tasting.preferred_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + tasting.preferred_time}
                                                        </p>
                                                        {tasting.notes && <p className="text-xs text-gray-400 mt-1">{'Notes: ' + tasting.notes}</p>}
                                                    </div>
                                                    <span className={'px-2.5 py-0.5 text-xs font-bold rounded-full ' + (tasting.status === 'Confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
                                                        {tasting.status}
                                                    </span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    )
                }

                {/* ======================== PAYMENTS TAB ======================== */}
                {
                    activeTab === 'payments' && (
                        <div className="space-y-5">
                            {data.payments.length === 0 ? (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    <p className="text-lg font-semibold text-gray-700">No payment history</p>
                                    <p className="text-sm text-gray-400 mt-1">Payments will appear here after booking</p>
                                </div>
                            ) : (
                                (() => {
                                    // Group payments by booking
                                    var grouped = {};
                                    data.payments.forEach(function (p) {
                                        if (!grouped[p.booking_id]) grouped[p.booking_id] = [];
                                        grouped[p.booking_id].push(p);
                                    });

                                    return Object.keys(grouped).map(function (bookingId) {
                                        var bookingPayments = grouped[bookingId];
                                        var booking = data.bookings.find(function (b) { return b.id === parseInt(bookingId); });
                                        var totalCost = parseFloat(bookingPayments[0].total_cost) || 0;
                                        var paidAmount = bookingPayments.filter(function (p) { return p.status === 'Verified'; }).reduce(function (s, p) { return s + p.amount; }, 0);
                                        var progressPct = totalCost > 0 ? Math.min((paidAmount / totalCost) * 100, 100) : 0;

                                        return (
                                            <div key={bookingId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                                <div className="bg-gradient-to-r from-gray-50 to-white px-5 py-4 border-b border-gray-100">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h3 className="font-bold text-gray-900">{'Booking #' + bookingId}</h3>
                                                            <p className="text-xs text-gray-400 mt-0.5">
                                                                {(bookingPayments[0].client_full_name || '') + ' • Event: ' + (bookingPayments[0].event_date || '')}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs text-gray-400">Total</p>
                                                            <p className="font-bold text-gray-900">{'₱' + totalCost.toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                                                        <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: progressPct + '%' }}></div>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                                        <span>{'Paid: ₱' + paidAmount.toLocaleString()}</span>
                                                        <span>{Math.round(progressPct) + '%'}</span>
                                                    </div>
                                                </div>
                                                <div className="divide-y divide-gray-50">
                                                    {bookingPayments.map(function (p) {
                                                        var typeInfo = PAYMENT_TYPE_LABELS[p.payment_type] || { label: p.payment_type || 'Payment', pct: '' };
                                                        var badge = getStatusBadge(p.status, p.due_date);
                                                        return (
                                                            <div key={p.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ' +
                                                                        (p.status === 'Verified' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500')}>
                                                                        {typeInfo.pct || '-'}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-medium text-gray-800">{typeInfo.label}</p>
                                                                        <p className="text-xs text-gray-400">{'Due: ' + (p.due_date || '-')}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <span className="font-bold text-gray-900 text-sm">{'₱' + (p.amount ? p.amount.toLocaleString() : '0')}</span>
                                                                    <span className={'inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ' + badge.cls}>{badge.text}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()
                            )}
                        </div>
                    )
                }
            </main >

            {/* ======================== EDIT MODAL ======================== */}
            {
                editModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditModal({ open: false, booking: null })}></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fadeIn">
                            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Edit Event Details</h3>
                                <button onClick={() => setEditModal({ open: false, booking: null })} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1 font-medium">Event Date</label>
                                        <input type="date" value={editForm.event_date} onChange={function (e) { setEditForm(Object.assign({}, editForm, { event_date: e.target.value })); }}
                                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1 font-medium">Event Time</label>
                                        <input type="text" value={editForm.event_time} onChange={function (e) { setEditForm(Object.assign({}, editForm, { event_time: e.target.value })); }}
                                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                            placeholder="e.g. 2:00 PM - 6:00 PM" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1 font-medium">Number of Guests (Pax)</label>
                                    <input type="number" value={editForm.pax} onChange={function (e) { setEditForm(Object.assign({}, editForm, { pax: e.target.value })); }}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1 font-medium">Client Full Name</label>
                                    <input type="text" value={editForm.client_full_name} onChange={function (e) { setEditForm(Object.assign({}, editForm, { client_full_name: e.target.value })); }}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1 font-medium">Email</label>
                                        <input type="email" value={editForm.client_email} onChange={function (e) { setEditForm(Object.assign({}, editForm, { client_email: e.target.value })); }}
                                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1 font-medium">Phone</label>
                                        <input type="tel" value={editForm.client_phone} onChange={function (e) { setEditForm(Object.assign({}, editForm, { client_phone: e.target.value })); }}
                                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1 font-medium">Address Line</label>
                                    <input type="text" value={editForm.venue_address_line} onChange={function (e) { setEditForm(Object.assign({}, editForm, { venue_address_line: e.target.value })); }}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1 font-medium">Street</label>
                                        <input type="text" value={editForm.venue_street} onChange={function (e) { setEditForm(Object.assign({}, editForm, { venue_street: e.target.value })); }}
                                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1 font-medium">City</label>
                                        <input type="text" value={editForm.venue_city} onChange={function (e) { setEditForm(Object.assign({}, editForm, { venue_city: e.target.value })); }}
                                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700" />
                                    </div>
                                </div>
                            </div>
                            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
                                <button onClick={() => setEditModal({ open: false, booking: null })}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleEditSubmit} disabled={editSaving}
                                    className={'px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors ' + (editSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700')}>
                                    {editSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ======================== CANCEL MODAL ======================== */}
            {
                cancelModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCancelModal({ open: false, bookingId: null })}></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn">
                            <div className="p-6 text-center">
                                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Cancel Booking?</h3>
                                <p className="text-sm text-gray-500 mb-6">This action cannot be undone. Your booking will be permanently cancelled.</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setCancelModal({ open: false, bookingId: null })}
                                        className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                        Keep Booking
                                    </button>
                                    <button onClick={handleCancelBooking} disabled={cancelLoading}
                                        className={'flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors ' + (cancelLoading ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700')}>
                                        {cancelLoading ? 'Cancelling...' : 'Yes, Cancel'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Receipt Modal */}
            <ReceiptModal
                isOpen={receiptModal.isOpen}
                onClose={() => setReceiptModal({ isOpen: false, payment: null, booking: null })}
                payment={receiptModal.payment}
                booking={receiptModal.booking}
            />

            {/* ======================== TOAST ======================== */}
            {
                toast && (
                    <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
                        <div className={'flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white font-medium text-sm ' + (toast.type === 'success' ? 'bg-green-600' : 'bg-red-600')}>
                            {toast.type === 'success' ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            )}
                            <span>{toast.message}</span>
                            <button onClick={() => setToast(null)} className="ml-2 text-white/70 hover:text-white">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                )
            }
            {/* Chat Bubble */}
            {user && <ChatBubble user={user} />}
        </div >
    );
};

export default ClientDashboard;
