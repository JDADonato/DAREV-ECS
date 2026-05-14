import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { router } from '@inertiajs/react';
import ReceiptModal from '../components/common/ReceiptModal';
import PaymentTermEditorModal from '../components/finance/PaymentTermEditorModal';

const PAYMENT_TYPE_LABELS = {
    Reservation: { label: 'Reservation Fee', pct: '10%', icon: 'R' },
    DownPayment: { label: 'Down Payment', pct: '70%', icon: 'D' },
    Final: { label: 'Final Payment', pct: '20%', icon: 'F' },
};

const DashboardFinance = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('bookings');
    const [paymentViewMode, setPaymentViewMode] = useState('list');
    const [bookings, setBookings] = useState([]);
    const [ledgerPayments, setLedgerPayments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [expandedBooking, setExpandedBooking] = useState(null);
    const [receiptModal, setReceiptModal] = useState({ isOpen: false, payment: null, booking: null });
    const [editPaymentModal, setEditPaymentModal] = useState({ isOpen: false, payment: null });

    // Refund Management State
    const [refundQueue, setRefundQueue] = useState([]);

    const [ledgerFilter, setLedgerFilter] = useState({ status: 'All', startDate: '', endDate: '', clientSearch: '', packageFilter: 'All' });
    const [bookingSearchQuery, setBookingSearchQuery] = useState('');
    const [bookingSortOrder, setBookingSortOrder] = useState('eventDateSoonest');

    useEffect(() => {
        if (activeTab === 'bookings') {
            fetchBookings();
        } else if (activeTab === 'ledger') {
            fetchLedger();
        } else if (activeTab === 'refunds') {
            fetchRefundQueue();
        }
    }, [activeTab, ledgerFilter]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const fetchBookings = async () => {
        setLoading(true);
        try {
            // Session auth - no token needed
            const res = await fetch('/api/finance/bookings', {
                headers: { }
            });
            const data = await res.json();
            setBookings(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching bookings:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLedger = async () => {
        setLoading(true);
        try {
            // Session auth - no token needed
            const query = new URLSearchParams(ledgerFilter).toString();
            const res = await fetch('/api/finance/ledger?' + query, {
                headers: { }
            });
            const data = await res.json();
            setLedgerPayments(data);
        } catch (error) {
            console.error("Error fetching ledger:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (id, action) => {
        try {
            // Session auth - no token needed
            const res = await fetch('/api/finance/payments/' + id + '/verify', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: action })
            });
            if (res.ok) {
                fetchBookings();
                setToast({
                    message: 'Payment ' + (action === 'Verify' ? 'Verified' : 'Rejected') + ' successfully!',
                    type: action === 'Verify' ? 'success' : 'error'
                });
            }
        } catch (error) {
            console.error("Error verifying payment:", error);
            setToast({ message: 'Failed to process payment. Please try again.', type: 'error' });
        }
    };

    const handleLogout = () => {
        router.post('/logout');
    };

    const getStatusBadge = (status, dueDate) => {
        var isOverdue = dueDate && new Date(dueDate) < new Date() && status === 'Pending';
        if (isOverdue) return { cls: 'bg-red-100 text-red-800', text: 'Overdue' };
        if (status === 'Verified') return { cls: 'bg-green-100 text-green-800', text: 'Paid' };
        if (status === 'Pending') return { cls: 'bg-yellow-100 text-yellow-800', text: 'Pending' };
        if (status === 'Rejected') return { cls: 'bg-gray-100 text-gray-600', text: 'Rejected' };
        return { cls: 'bg-gray-100 text-gray-600', text: status };
    };

    const getBookingProgress = (payments) => {
        var verified = payments.filter(function (p) { return p.status === 'Verified'; }).length;
        return { verified: verified, total: payments.length };
    };

    const handleSendReminder = async (paymentId) => {
        try {
            // Session auth - no token needed
            const res = await fetch(`/api/finance/remind/${paymentId}`, {
                method: 'POST',
                headers: { }
            });
            if (res.ok) {
                setToast({ message: 'Reminder sent to client successfully!', type: 'success' });
            } else {
                setToast({ message: 'Failed to send reminder.', type: 'error' });
            }
        } catch (error) {
            console.error("Error sending reminder:", error);
            setToast({ message: 'Error sending reminder.', type: 'error' });
        }
    };

    const fetchRefundQueue = async () => {
        setLoading(true);
        try {
            // Session auth - no token needed
            const res = await fetch('/api/finance/refunds/queue', {
                headers: { }
            });
            const data = await res.json();
            setRefundQueue(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching refund queue:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleProcessRefund = async (bookingId) => {
        if (!window.confirm(`Are you sure you want to process the refund for booking #${bookingId}? This will deduct the 10% reservation fee automatically.`)) {
            return;
        }

        try {
            // Session auth - no token needed
            const res = await fetch(`/api/finance/refund/${bookingId}`, {
                method: 'POST',
                headers: { }
            });

            if (res.ok) {
                setToast({ message: 'Refund processed successfully!', type: 'success' });
                fetchRefundQueue();
            } else {
                setToast({ message: 'Failed to process refund.', type: 'error' });
            }
        } catch (error) {
            console.error("Error processing refund:", error);
            setToast({ message: 'Error processing refund.', type: 'error' });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <nav className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <h1 className="text-xl font-bold font-display text-primary-600">Eloquente Accounting</h1>
                        </div>
                        <div className="flex items-center">
                            <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-4">Accounting View</div>
                            <span className="text-gray-700 mr-4">{user && user.username}</span>
                            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900">Logout</button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-grow max-w-7xl mx-auto w-full py-6 px-4 sm:px-6 lg:px-8">
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('bookings')}
                            className={activeTab === 'bookings' ? 'border-blue-500 text-blue-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm' : 'border-transparent text-gray-500 hover:text-gray-700 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'}
                        >
                            Payment Verification
                        </button>
                        <button
                            onClick={() => setActiveTab('ledger')}
                            className={activeTab === 'ledger' ? 'border-blue-500 text-blue-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm' : 'border-transparent text-gray-500 hover:text-gray-700 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'}
                        >
                            Transaction Ledger
                        </button>
                        <button
                            onClick={() => setActiveTab('refunds')}
                            className={activeTab === 'refunds' ? 'border-blue-500 text-blue-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm' : 'border-transparent text-gray-500 hover:text-gray-700 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'}
                        >
                            Refund Management
                        </button>
                    </nav>
                </div>

                {activeTab === 'bookings' && (
                    <div>
                        {loading ? (
                            <div className="p-6 text-center text-gray-500">Loading bookings...</div>
                        ) : bookings.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">No bookings found.</div>
                        ) : (
                            <div>
                                <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
                                    <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                        <div className="relative w-full max-w-md">
                                            <input 
                                                type="text" 
                                                placeholder="Search by client name or ID..." 
                                                value={bookingSearchQuery}
                                                onChange={(e) => setBookingSearchQuery(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                            />
                                            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </div>
                                        <select
                                            value={bookingSortOrder}
                                            onChange={(e) => setBookingSortOrder(e.target.value)}
                                            className="w-full sm:w-auto border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                                        >
                                            <option value="eventDateSoonest">Event Date (Soonest First)</option>
                                            <option value="eventDateLatest">Event Date (Latest First)</option>
                                            <option value="bookingNewest">Booking Date (Newest First)</option>
                                            <option value="bookingOldest">Booking Date (Oldest First)</option>
                                            <option value="clientAZ">Client Name (A-Z)</option>
                                            <option value="clientZA">Client Name (Z-A)</option>
                                        </select>
                                    </div>
                                    <div className="bg-gray-100 p-1 rounded-lg inline-flex flex-shrink-0 self-start">
                                        <button onClick={() => setPaymentViewMode('list')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${paymentViewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                            <div className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                                List
                                            </div>
                                        </button>
                                        <button onClick={() => setPaymentViewMode('card')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${paymentViewMode === 'card' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                            <div className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                                Cards
                                            </div>
                                        </button>
                                    </div>
                                </div>
                                {(() => {
                                    const filteredBookings = bookings
                                        .filter(b => {
                                            if (!bookingSearchQuery) return true;
                                            const searchLower = bookingSearchQuery.toLowerCase();
                                            return (b.client_full_name && b.client_full_name.toLowerCase().includes(searchLower)) ||
                                                (b.username && b.username.toLowerCase().includes(searchLower)) ||
                                                (b.id && b.id.toString().includes(searchLower));
                                        })
                                        .sort((a, b) => {
                                            if (bookingSortOrder === 'eventDateSoonest') {
                                                return new Date(a.event_date) - new Date(b.event_date);
                                            } else if (bookingSortOrder === 'eventDateLatest') {
                                                return new Date(b.event_date) - new Date(a.event_date);
                                            } else if (bookingSortOrder === 'bookingNewest') {
                                                return new Date(b.created_at) - new Date(a.created_at);
                                            } else if (bookingSortOrder === 'bookingOldest') {
                                                return new Date(a.created_at) - new Date(b.created_at);
                                            } else if (bookingSortOrder === 'clientAZ') {
                                                const nameA = a.client_full_name || a.username || '';
                                                const nameB = b.client_full_name || b.username || '';
                                                return nameA.localeCompare(nameB);
                                            } else if (bookingSortOrder === 'clientZA') {
                                                const nameA = a.client_full_name || a.username || '';
                                                const nameB = b.client_full_name || b.username || '';
                                                return nameB.localeCompare(nameA);
                                            }
                                            return 0;
                                        });

                                    if (filteredBookings.length === 0) {
                                        return <div className="p-12 text-center text-gray-500 bg-white border border-gray-200 rounded-xl">No bookings match your search.</div>;
                                    }

                                    return (
                                        <div className={paymentViewMode === 'card' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" : "space-y-6"}>
                                            {filteredBookings.map(function (booking) {
                                        var progress = getBookingProgress(booking.payments);
                                        var isExpanded = expandedBooking === booking.id;
                                        var totalCost = booking.totalCost || 0;
                                        var paidAmount = booking.payments
                                            .filter(function (p) { return p.status === 'Verified'; })
                                            .reduce(function (sum, p) { return sum + p.amount; }, 0);
                                        var remainingBalance = totalCost - paidAmount;

                                        return (
                                            <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                                <div
                                                    className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                                    onClick={() => setExpandedBooking(isExpanded ? null : booking.id)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                                                                {'#' + booking.id}
                                                            </div>
                                                            <div>
                                                                <h3 className="font-semibold text-gray-900">
                                                                    {booking.client_full_name || booking.username}
                                                                </h3>
                                                                <p className="text-sm text-gray-500">
                                                                    {'Event: ' + booking.event_date + ' | ' + booking.pax + ' pax'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <p className="text-xs text-gray-400 uppercase tracking-wider">Total Cost</p>
                                                                <p className="text-lg font-bold text-gray-900">{'P' + totalCost.toLocaleString()}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs text-gray-400 uppercase tracking-wider">Payments</p>
                                                                <p className="text-sm font-semibold">
                                                                    <span className="text-green-600">{progress.verified}</span>
                                                                    <span className="text-gray-400">{'/' + progress.total}</span>
                                                                    <span className="text-gray-400 text-xs ml-1">verified</span>
                                                                </p>
                                                            </div>
                                                            <svg
                                                                className={'w-5 h-5 text-gray-400 transition-transform duration-200' + (isExpanded ? ' rotate-180' : '')}
                                                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 w-full bg-gray-100 rounded-full h-2">
                                                        <div
                                                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                                            style={{ width: (totalCost > 0 ? (paidAmount / totalCost) * 100 : 0) + '%' }}
                                                        ></div>
                                                    </div>
                                                    <div className="flex justify-between mt-1 text-xs text-gray-400">
                                                        <span>{'Paid: P' + paidAmount.toLocaleString()}</span>
                                                        <span>{'Balance: P' + remainingBalance.toLocaleString()}</span>
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 animate-fadeIn">
                                                        <div className="mb-4 flex flex-wrap gap-4 text-sm text-gray-600">
                                                            {booking.client_email && (
                                                                <span className="flex items-center gap-1">
                                                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                                    {booking.client_email}
                                                                </span>
                                                            )}
                                                            {booking.client_phone && (
                                                                <span className="flex items-center gap-1">
                                                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                                    {booking.client_phone}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm">
                                                                <thead>
                                                                    <tr className="text-xs uppercase text-gray-400 border-b border-gray-200">
                                                                        <th className="text-left py-2 pr-4">Payment Tier</th>
                                                                        <th className="text-right py-2 px-4">Amount</th>
                                                                        <th className="text-center py-2 px-4">Due Date</th>
                                                                        <th className="text-center py-2 px-4">Status</th>
                                                                        <th className="text-right py-2 pl-4">Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {booking.payments.map(function (payment) {
                                                                        var typeInfo = PAYMENT_TYPE_LABELS[payment.payment_type] || { label: payment.payment_type, pct: '', icon: '-' };
                                                                        var badge = getStatusBadge(payment.status, payment.due_date);

                                                                        return (
                                                                            <tr key={payment.id} className="border-b border-gray-100 last:border-b-0">
                                                                                <td className="py-3 pr-4">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-lg w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center font-bold text-blue-600">{typeInfo.icon}</span>
                                                                                        <div>
                                                                                            <p className="font-medium text-gray-900">{typeInfo.label}</p>
                                                                                            <p className="text-xs text-gray-400">{typeInfo.pct + ' of total'}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="text-right py-3 px-4">
                                                                                    <span className="font-semibold text-gray-900">{'P' + (payment.amount ? payment.amount.toLocaleString() : '0')}</span>
                                                                                </td>
                                                                                <td className="text-center py-3 px-4">
                                                                                    <span className="text-gray-600">{payment.due_date || '-'}</span>
                                                                                </td>
                                                                                <td className="text-center py-3 px-4">
                                                                                    <span className={'inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ' + badge.cls}>
                                                                                        {badge.text}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="text-right py-3 pl-4">
                                                                                    {payment.status === 'Pending' ? (
                                                                                        <div className="flex justify-end gap-2">
                                                                                            <button
                                                                                                onClick={function (e) { e.stopPropagation(); handleVerify(payment.id, 'Verify'); }}
                                                                                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-xs font-medium shadow-sm transition-colors"
                                                                                            >
                                                                                                Verify
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={function (e) { e.stopPropagation(); handleVerify(payment.id, 'Reject'); }}
                                                                                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs font-medium shadow-sm transition-colors"
                                                                                            >
                                                                                                Reject
                                                                                            </button>
                                                                                            {(payment.status === 'Pending' || new Date(payment.due_date) < new Date()) && (
                                                                                                <>
                                                                                                    <button
                                                                                                        onClick={(e) => { e.stopPropagation(); setEditPaymentModal({ isOpen: true, payment }); }}
                                                                                                        className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-lg text-xs font-medium shadow-sm transition-colors flex items-center gap-1"
                                                                                                    >
                                                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                                                        Edit
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={function (e) { e.stopPropagation(); handleSendReminder(payment.id); }}
                                                                                                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg text-xs font-medium shadow-sm transition-colors flex items-center gap-1"
                                                                                                    >
                                                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                                                                                        Remind
                                                                                                    </button>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    ) : payment.status === 'Verified' ? (
                                                                                        <div className="flex justify-end items-center gap-3">
                                                                                            <span className="text-green-600 text-xs font-medium">Verified</span>
                                                                                            <button
                                                                                                onClick={function (e) { e.stopPropagation(); setReceiptModal({ isOpen: true, payment: payment, booking: booking }); }}
                                                                                                className="text-primary-600 hover:text-primary-800 text-xs font-medium underline flex items-center gap-1"
                                                                                            >
                                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                                                Receipt
                                                                                            </button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <span className="text-gray-400 text-xs">-</span>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                                                            <div className="text-xs text-gray-400">
                                                                {'Booking #' + booking.id + ' | Status: ' + booking.status}
                                                            </div>
                                                            <div className="flex gap-6 text-sm">
                                                                <div>
                                                                    <span className="text-gray-400">Paid: </span>
                                                                    <span className="font-semibold text-green-600">{'P' + paidAmount.toLocaleString()}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-400">Remaining: </span>
                                                                    <span className={'font-semibold ' + (remainingBalance > 0 ? 'text-red-600' : 'text-green-600')}>
                                                                        {'P' + remainingBalance.toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'ledger' && (
                    <div>
                        <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-wrap gap-4 items-end">
                            <div className="flex flex-col flex-1 min-w-[200px]">
                                <label className="text-xs font-medium text-gray-500 mb-1">Search Client</label>
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={ledgerFilter.clientSearch || ''}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { clientSearch: e.target.value })); }}
                                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                                />
                            </div>
                            <div className="flex flex-col min-w-[150px]">
                                <label className="text-xs font-medium text-gray-500 mb-1">Package</label>
                                <select
                                    value={ledgerFilter.packageFilter || 'All'}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { packageFilter: e.target.value })); }}
                                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="All">All Packages</option>
                                    <option value="standard">Standard</option>
                                    <option value="deluxe">Deluxe</option>
                                    <option value="premium">Premium</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-medium text-gray-500 mb-1">Status</label>
                                <select
                                    value={ledgerFilter.status}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { status: e.target.value })); }}
                                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="All">All</option>
                                    <option value="Verified">Verified</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Rejected">Rejected</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-medium text-gray-500 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={ledgerFilter.startDate}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { startDate: e.target.value })); }}
                                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-medium text-gray-500 mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={ledgerFilter.endDate}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { endDate: e.target.value })); }}
                                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="bg-white shadow overflow-hidden rounded-xl">
                            {loading ? (
                                <div className="p-6 text-center text-gray-500">Loading transactions...</div>
                            ) : (() => {
                                const filteredLedgerPayments = ledgerPayments.filter(p => {
                                    if (ledgerFilter.clientSearch && !((p.client_full_name || p.username || '').toLowerCase().includes(ledgerFilter.clientSearch.toLowerCase()))) return false;
                                    if (ledgerFilter.packageFilter && ledgerFilter.packageFilter !== 'All' && p.package_id !== ledgerFilter.packageFilter) return false;
                                    return true;
                                });

                                if (filteredLedgerPayments.length === 0) {
                                    return <div className="p-6 text-center text-gray-500">No records found matching filters.</div>;
                                }

                                const grouped = {};
                                filteredLedgerPayments.forEach(p => {
                                    if (!grouped[p.booking_id]) {
                                        grouped[p.booking_id] = {
                                            id: p.booking_id,
                                            client_full_name: p.client_full_name || p.username,
                                            package_id: p.package_id,
                                            event_date: p.event_date,
                                            payments: []
                                        };
                                    }
                                    grouped[p.booking_id].payments.push(p);
                                });
                                const groupedArray = Object.values(grouped);

                                return (
                                    <div className="space-y-6">
                                        {groupedArray.map(booking => (
                                            <div key={booking.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-4">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-900">{booking.client_full_name}</h3>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            Booking #{booking.id} <span className="mx-2">•</span> 
                                                            <span className="font-medium">{booking.package_id ? booking.package_id.charAt(0).toUpperCase() + booking.package_id.slice(1) : 'Custom'} Package</span>
                                                        </p>
                                                    </div>
                                                    <div className="text-right bg-white px-4 py-2 rounded-lg border border-gray-100 shadow-sm">
                                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Event Date</p>
                                                        <p className="text-sm font-semibold text-gray-800">
                                                            {booking.event_date ? new Date(booking.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-white border-b border-gray-100">
                                                            <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                                <th className="text-left py-4 px-6">Payment Type</th>
                                                                <th className="text-right py-4 px-6">Amount</th>
                                                                <th className="text-center py-4 px-6">Due Date</th>
                                                                <th className="text-center py-4 px-6">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50 bg-white">
                                                            {booking.payments.map(p => {
                                                                var badge = getStatusBadge(p.status, p.due_date);
                                                                var typeInfo = PAYMENT_TYPE_LABELS[p.payment_type] || { label: p.payment_type || 'Legacy', icon: '-' };
                                                                return (
                                                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                                                        <td className="py-4 px-6">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold ring-1 ring-blue-100">
                                                                                    {typeInfo.icon}
                                                                                </div>
                                                                                <span className="font-medium text-gray-900">{typeInfo.label}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-4 px-6 text-right font-bold text-gray-900">
                                                                            {'P' + (p.amount ? p.amount.toLocaleString() : '0')}
                                                                        </td>
                                                                        <td className="py-4 px-6 text-center text-gray-600 font-medium">
                                                                            {p.due_date ? new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                                                                        </td>
                                                                        <td className="py-4 px-6 text-center">
                                                                            <span className={'inline-flex px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-sm ' + badge.cls}>
                                                                                {badge.text}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {activeTab === 'refunds' && (
                    <div className="bg-white shadow overflow-hidden rounded-xl">
                        <div className="px-6 py-5 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900">Refund Management Queue</h3>
                            <p className="text-sm text-gray-500 mt-1">Process manual financial returns for cancelled events outside the 7-day lock-in period. A 10% reservation fee will be deducted.</p>
                        </div>
                        {loading ? (
                            <div className="p-6 text-center text-gray-500">Loading refund queue...</div>
                        ) : refundQueue.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-4">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">Queue is Empty</h3>
                                <p className="text-gray-500 mt-1 max-w-sm">There are currently no cancelled bookings with un-refunded payments.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left font-bold text-gray-700 uppercase tracking-wider text-xs w-20">Booking ID</th>
                                            <th className="px-6 py-4 text-left font-bold text-gray-700 uppercase tracking-wider text-xs">Client Name</th>
                                            <th className="px-6 py-4 text-center font-bold text-gray-700 uppercase tracking-wider text-xs">Event Date</th>
                                            <th className="px-6 py-4 text-right font-bold text-gray-700 uppercase tracking-wider text-xs hidden md:table-cell">Total Paid</th>
                                            <th className="px-6 py-4 text-right font-bold text-gray-700 uppercase tracking-wider text-xs">Refund Amount (minus 10%)</th>
                                            <th className="px-6 py-4 text-right font-bold text-gray-700 uppercase tracking-wider text-xs">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {refundQueue.map((item) => {
                                            // Deduct 10% penalty for late cancellation
                                            const penalty = item.total_paid * 0.10;
                                            const refundAmount = item.total_paid - penalty;

                                            return (
                                                <tr key={item.booking_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 text-left font-semibold text-gray-900">#{item.booking_id}</td>
                                                    <td className="px-6 py-4 text-left">
                                                        <div className="font-semibold text-gray-900">{item.client_full_name}</div>
                                                        <div className="text-xs text-gray-500 mt-0.5">{item.client_email}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-gray-600 font-medium whitespace-nowrap">{item.event_date}</td>
                                                    <td className="px-6 py-4 text-right hidden md:table-cell text-gray-500 line-through">
                                                        ₱{item.total_paid ? item.total_paid.toLocaleString() : '0'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-primary-700">
                                                        ₱{refundAmount > 0 ? refundAmount.toLocaleString() : '0'}
                                                        <div className="text-[10px] text-gray-400 font-normal mt-1">(₱{penalty.toLocaleString()} fee deducted)</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleProcessRefund(item.booking_id)}
                                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 whitespace-nowrap"
                                                        >
                                                            Process Refund
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
                )}
            </main>

            {/* Receipt Modal */}
            <ReceiptModal
                isOpen={receiptModal.isOpen}
                onClose={() => setReceiptModal({ isOpen: false, payment: null, booking: null })}
                payment={receiptModal.payment}
                booking={receiptModal.booking}
            />

            {/* Payment Term Editor Modal */}
            <PaymentTermEditorModal
                isOpen={editPaymentModal.isOpen}
                onClose={() => setEditPaymentModal({ isOpen: false, payment: null })}
                payment={editPaymentModal.payment}
                onSuccess={() => {
                    setEditPaymentModal({ isOpen: false, payment: null });
                    setToast({ message: 'Payment term updated successfully!', type: 'success' });
                    fetchBookings(); // Refresh data
                }}
            />

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
                    <div className={'flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white font-medium text-sm ' + (toast.type === 'success' ? 'bg-green-600' : 'bg-red-600')}>
                        {toast.type === 'success' ? (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ) : (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                        <span>{toast.message}</span>
                        <button onClick={function () { setToast(null); }} className="ml-2 text-white/70 hover:text-white">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardFinance;
