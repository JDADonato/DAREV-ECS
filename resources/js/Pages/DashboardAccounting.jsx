import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { router } from '@inertiajs/react';
import ReceiptModal from '../Components/common/ReceiptModal';
import PaymentTermEditorModal from '../Components/finance/PaymentTermEditorModal';
import useSmartRefresh from '../hooks/useSmartRefresh';

const PAYMENT_TYPE_LABELS = {
    Reservation: { label: 'Reservation Fee', pct: '10%', icon: 'R' },
    DownPayment: { label: 'Down Payment', pct: '70%', icon: 'D' },
    Final: { label: 'Final Payment', pct: '20%', icon: 'F' },
};

const DashboardAccounting = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('bookings');
    const [paymentViewMode, setPaymentViewMode] = useState('list');
    const [bookings, setBookings] = useState([]);
    const [ledgerPayments, setLedgerPayments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [expandedBooking, setExpandedBooking] = useState(null);
    const [receiptModal, setReceiptModal] = useState({ isOpen: false, payment: null, booking: null });
    const [editPaymentModal, setEditPaymentModal] = useState({ isOpen: false, payment: null, booking: null });
    const [remindingPaymentId, setRemindingPaymentId] = useState(null);

    // Refund Management State
    const [refundQueue, setRefundQueue] = useState([]);

    const [ledgerFilter, setLedgerFilter] = useState({ status: 'All', startDate: '', endDate: '', clientSearch: '', packageFilter: 'All' });
    const [bookingSearchQuery, setBookingSearchQuery] = useState('');
    const [bookingSortOrder, setBookingSortOrder] = useState('eventDateSoonest');
    const [bookingPaymentFilter, setBookingPaymentFilter] = useState('all');
    const [bookingPage, setBookingPage] = useState(1);
    const [bookingPagination, setBookingPagination] = useState(null);

    useEffect(() => {
        if (activeTab === 'bookings') {
            fetchBookings();
        } else if (activeTab === 'ledger') {
            fetchLedger();
        } else if (activeTab === 'refunds') {
            fetchRefundQueue();
        }
    }, [activeTab, ledgerFilter, bookingPage, bookingSearchQuery, bookingSortOrder, bookingPaymentFilter]);

    useEffect(() => {
        setBookingPage(1);
    }, [bookingSearchQuery, bookingSortOrder, bookingPaymentFilter]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    useSmartRefresh({
        enabled: true,
        interval: activeTab === 'ledger' ? 120000 : 90000,
        idleAfter: 180000,
        refresh: ({ silent = false } = {}) => {
            if (activeTab === 'bookings') {
                fetchBookings({ silent });
            } else if (activeTab === 'ledger') {
                fetchLedger({ silent });
            } else if (activeTab === 'refunds') {
                fetchRefundQueue({ silent });
            }
        },
    });

    const fetchBookings = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            // Session auth - no token needed
            const query = new URLSearchParams({
                page: bookingPage,
                per_page: 25,
                search: bookingSearchQuery,
                sort: bookingSortOrder,
                payment_status: bookingPaymentFilter,
            }).toString();
            const res = await fetch('/api/accounting/bookings?' + query, {
                headers: { }
            });
            const data = await res.json();
            setBookings(Array.isArray(data) ? data : (data.data || []));
            setBookingPagination(Array.isArray(data) ? null : {
                currentPage: data.current_page,
                lastPage: data.last_page,
                total: data.total,
                from: data.from,
                to: data.to,
            });
        } catch (error) {
            console.error("Error fetching bookings:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchLedger = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            // Session auth - no token needed
            const query = new URLSearchParams(ledgerFilter).toString();
            const res = await fetch('/api/accounting/ledger?' + query, {
                headers: { }
            });
            const data = await res.json();
            setLedgerPayments(data);
        } catch (error) {
            console.error("Error fetching ledger:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleVerify = async (id, action) => {
        try {
            // Session auth - no token needed
            const res = await fetch('/api/accounting/payments/' + id + '/verify', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: action })
            });
            if (res.ok) {
                fetchBookings();
                fetchLedger({ silent: true });
                fetchRefundQueue({ silent: true });
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
        if (status === 'Paid') return { cls: 'bg-emerald-100 text-emerald-800', text: 'Paid (Online)' };
        if (status === 'Pending') return { cls: 'bg-yellow-100 text-yellow-800', text: 'Pending' };
        if (status === 'Rejected') return { cls: 'bg-slate-100 text-slate-600', text: 'Rejected' };
        return { cls: 'bg-slate-100 text-slate-600', text: status };
    };

    // Count both manually-verified and PayMongo-auto-paid payments as "paid"
    const isPaidStatus = (status) => status === 'Verified' || status === 'Paid';

    const toMoneyNumber = (value) => Number(String(value ?? 0).replace(/,/g, '')) || 0;

    const getBookingProgress = (payments) => {
        const paymentList = payments || [];
        var verified = paymentList.filter(function (p) { return isPaidStatus(p.status); }).length;
        return { verified: verified, total: paymentList.length };
    };

    const handleSendReminder = async (paymentId) => {
        if (remindingPaymentId === paymentId) return; // prevent double-click
        setRemindingPaymentId(paymentId);
        try {
            const res = await fetch(`/api/accounting/remind/${paymentId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                setToast({ message: data.message || 'Reminder sent to client successfully!', type: 'success' });
            } else {
                setToast({ message: data.error || 'Failed to send reminder.', type: 'error' });
            }
        } catch (error) {
            console.error('Error sending reminder:', error);
            setToast({ message: 'Network error while sending reminder.', type: 'error' });
        } finally {
            setRemindingPaymentId(null);
        }
    };

    const fetchRefundQueue = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            // Session auth - no token needed
            const res = await fetch('/api/accounting/refunds/queue', {
                headers: { }
            });
            const data = await res.json();
            setRefundQueue(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching refund queue:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleProcessRefund = async (bookingId) => {
        if (!window.confirm(`Are you sure you want to process the refund for booking #${bookingId}? This will deduct the 10% reservation fee automatically.`)) {
            return;
        }

        try {
            // Session auth - no token needed
            const res = await fetch(`/api/accounting/refund/${bookingId}`, {
                method: 'POST',
                headers: { }
            });

            const data = await res.json().catch(() => null);

            if (res.ok) {
                setToast({ message: data?.message || 'Refund processed successfully!', type: 'success' });
                fetchRefundQueue();
                fetchBookings({ silent: true });
                fetchLedger({ silent: true });
            } else {
                let errorMsg = 'Failed to process refund.';
                if (data && data.details && data.details.length > 0) {
                    errorMsg = data.details[0]; // Show the specific PayMongo error
                } else if (data && data.error) {
                    errorMsg = data.error;
                }
                setToast({ message: errorMsg, type: 'error' });
            }
        } catch (error) {
            console.error("Error processing refund:", error);
            setToast({ message: 'Error processing refund.', type: 'error' });
        }
    };

    const dashboardSummary = useMemo(() => {
        const allBookingPayments = bookings.flatMap((booking) => booking.payments || []);
        const pendingPayments = allBookingPayments.filter((payment) => payment.status === 'Pending');
        const collected = ledgerPayments
            .filter((payment) => isPaidStatus(payment.status))
            .reduce((sum, payment) => sum + toMoneyNumber(payment.amount), 0);
        const overdue = pendingPayments.filter((payment) => payment.due_date && new Date(payment.due_date) < new Date());

        return {
            bookings: bookings.length,
            pending: pendingPayments.length,
            overdue: overdue.length,
            refunds: refundQueue.length,
            collected,
        };
    }, [bookings, ledgerPayments, refundQueue]);

    const tabMeta = {
        bookings: 'Payment Verification',
        ledger: 'Transaction Ledger',
        refunds: 'Refund Management',
    };

    return (
        <div className="marketing-page min-h-screen flex flex-col">
            <nav className="marketing-topbar sticky top-0 z-30">
                <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
                    <div className="flex min-h-16 flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="marketing-kicker">Eloquente</p>
                            <h1 className="text-xl font-bold font-display text-slate-950">Accounting Executive Dashboard</h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">Finance workspace</div>
                            <span className="text-sm font-bold text-slate-700">{user && user.username}</span>
                            <button onClick={handleLogout} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-500 hover:text-slate-900">Logout</button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-grow mx-auto max-w-[1500px] w-full py-6 px-4 sm:px-6 lg:px-8">
                <section className="marketing-command mb-5">
                    <div>
                        <p className="marketing-kicker">Accounting Operations</p>
                        <h2 className="mt-1 text-2xl font-bold text-slate-950">Payment control desk</h2>
                    </div>
                    <div className="marketing-metrics">
                        <div><span>Bookings</span><strong>{dashboardSummary.bookings}</strong></div>
                        <div><span>Pending</span><strong>{dashboardSummary.pending}</strong></div>
                        <div><span>Overdue</span><strong>{dashboardSummary.overdue}</strong></div>
                        <div><span>Refunds</span><strong>{dashboardSummary.refunds}</strong></div>
                    </div>
                </section>

                <div className="marketing-nav-wrap mb-5">
                    <nav className="marketing-nav">
                        {['bookings', 'ledger', 'refunds'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`marketing-tab ${activeTab === tab ? 'marketing-tab-active' : ''}`}
                            >
                                <span>{tabMeta[tab]}</span>
                                {tab === 'bookings' && dashboardSummary.pending > 0 && <em>{dashboardSummary.pending}</em>}
                                {tab === 'refunds' && dashboardSummary.refunds > 0 && <em>{dashboardSummary.refunds}</em>}
                            </button>
                        ))}
                    </nav>
                </div>

                {activeTab === 'bookings' && (
                    <div className="marketing-panel p-5 lg:p-6">
                        {loading ? (
                            <div className="p-6 text-center text-slate-500">Loading bookings...</div>
                        ) : bookings.length === 0 ? (
                            <div className="p-6 text-center text-slate-500">No bookings found.</div>
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
                                                className="w-full pl-10 pr-4 py-2 border border-[#720101]/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#720101]/20 focus:border-[#720101]/30 text-sm text-slate-700"
                                            />
                                            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </div>
                                        <select
                                            value={bookingSortOrder}
                                            onChange={(e) => setBookingSortOrder(e.target.value)}
                                            className="w-full sm:w-auto border border-[#720101]/10 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#720101]/20 focus:border-[#720101]/30 text-sm bg-white text-slate-700"
                                        >
                                            <option value="eventDateSoonest">Event Date (Soonest First)</option>
                                            <option value="eventDateLatest">Event Date (Latest First)</option>
                                            <option value="bookingNewest">Booking Date (Newest First)</option>
                                            <option value="bookingOldest">Booking Date (Oldest First)</option>
                                            <option value="clientAZ">Client Name (A-Z)</option>
                                            <option value="clientZA">Client Name (Z-A)</option>
                                        </select>
                                        <select
                                            value={bookingPaymentFilter}
                                            onChange={(e) => setBookingPaymentFilter(e.target.value)}
                                            className="w-full sm:w-auto border border-[#720101]/10 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#720101]/20 focus:border-[#720101]/30 text-sm bg-white text-slate-700"
                                        >
                                            <option value="all">All Payments</option>
                                            <option value="pending">Pending</option>
                                            <option value="complete">Complete</option>
                                        </select>
                                    </div>
                                    <div className="bg-[#fffaf3] p-1 rounded-xl inline-flex flex-shrink-0 self-start border border-amber-100">
                                        <button onClick={() => setPaymentViewMode('list')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${paymentViewMode === 'list' ? 'bg-white text-[#720101] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                                            <div className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                                List
                                            </div>
                                        </button>
                                        <button onClick={() => setPaymentViewMode('card')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${paymentViewMode === 'card' ? 'bg-white text-[#720101] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                                            <div className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                                Cards
                                            </div>
                                        </button>
                                    </div>
                                </div>
                                {(() => {
                                    const filteredBookings = bookings;

                                    if (filteredBookings.length === 0) {
                                        return <div className="p-12 text-center text-slate-500 bg-[#fffaf3] border border-amber-100 rounded-xl">No bookings match your search.</div>;
                                    }

                                    return (
                                        <div className={paymentViewMode === 'card' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" : "space-y-6"}>
                                            {filteredBookings.map(function (booking) {
                                        var progress = getBookingProgress(booking.payments);
                                        var isExpanded = expandedBooking === booking.id;
                                        var totalCost = toMoneyNumber(booking.totalCost);
                                        var paidAmount = (booking.payments || [])
                                            .filter(function (p) { return isPaidStatus(p.status); })
                                            .reduce(function (sum, p) { return sum + toMoneyNumber(p.amount); }, 0);
                                        var remainingBalance = Math.max(totalCost - paidAmount, 0);

                                        return (
                                            <div key={booking.id} className="bg-white rounded-2xl shadow-sm border border-[#720101]/10 overflow-hidden hover:shadow-md transition-shadow">
                                                <div
                                                    className="px-6 py-4 cursor-pointer hover:bg-[#fffaf3] transition-colors"
                                                    onClick={() => setExpandedBooking(isExpanded ? null : booking.id)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-[#720101] text-white rounded-full flex items-center justify-center font-bold text-sm ring-4 ring-amber-100">
                                                                {'#' + booking.id}
                                                            </div>
                                                            <div>
                                                                <h3 className="font-bold text-slate-950">
                                                                    {booking.client_full_name || booking.username}
                                                                </h3>
                                                                <p className="text-sm text-slate-500">
                                                                    {'Event: ' + booking.event_date + ' | ' + booking.pax + ' pax'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-400 uppercase tracking-wider">Total Cost</p>
                                                                <p className="text-lg font-black text-slate-950">{'P' + totalCost.toLocaleString()}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-400 uppercase tracking-wider">Payments</p>
                                                                <p className="text-sm font-semibold">
                                                                    <span className="text-emerald-700">{progress.verified}</span>
                                                                    <span className="text-slate-400">{'/' + progress.total}</span>
                                                                    <span className="text-slate-400 text-xs ml-1">verified</span>
                                                                </p>
                                                            </div>
                                                            <svg
                                                                className={'w-5 h-5 text-slate-400 transition-transform duration-200' + (isExpanded ? ' rotate-180' : '')}
                                                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 w-full bg-amber-50 rounded-full h-2">
                                                        <div
                                                            className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                                                            style={{ width: (totalCost > 0 ? (paidAmount / totalCost) * 100 : 0) + '%' }}
                                                        ></div>
                                                    </div>
                                                    <div className="flex justify-between mt-1 text-xs text-slate-400">
                                                        <span>{'Paid: P' + paidAmount.toLocaleString()}</span>
                                                        <span>{'Balance: P' + remainingBalance.toLocaleString()}</span>
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="border-t border-[#720101]/10 px-6 py-4 bg-[#fffaf3] animate-fadeIn">
                                                        <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-600">
                                                            {booking.client_email && (
                                                                <span className="flex items-center gap-1">
                                                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                                    {booking.client_email}
                                                                </span>
                                                            )}
                                                            {booking.client_phone && (
                                                                <span className="flex items-center gap-1">
                                                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                                    {booking.client_phone}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm">
                                                                <thead>
                                                                    <tr className="text-xs uppercase text-slate-400 border-b border-amber-100">
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
                                                                            <tr key={payment.id} className="border-b border-amber-100/70 last:border-b-0">
                                                                                <td className="py-3 pr-4">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-lg w-8 h-8 rounded-full bg-[#720101]/10 flex items-center justify-center font-bold text-[#720101]">{typeInfo.icon}</span>
                                                                                        <div>
                                                                                            <p className="font-bold text-slate-950">{typeInfo.label}</p>
                                                                                            <p className="text-xs text-slate-400">{typeInfo.pct + ' of total'}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="text-right py-3 px-4">
                                                                                    <span className="font-bold text-slate-950">{'P' + (payment.amount ? payment.amount.toLocaleString() : '0')}</span>
                                                                                </td>
                                                                                <td className="text-center py-3 px-4">
                                                                                    <span className="text-slate-600">{payment.due_date || '-'}</span>
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
                                                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm transition-colors"
                                                                                            >
                                                                                                Verify
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={function (e) { e.stopPropagation(); handleVerify(payment.id, 'Reject'); }}
                                                                                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm transition-colors"
                                                                                            >
                                                                                                Reject
                                                                                            </button>
                                                                                            {(payment.status === 'Pending' || new Date(payment.due_date) < new Date()) && (
                                                                                                <button
                                                                                                    onClick={function (e) { e.stopPropagation(); handleSendReminder(payment.id); }}
                                                                                                    disabled={remindingPaymentId === payment.id}
                                                                                                    className={"bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1" + (remindingPaymentId === payment.id ? ' opacity-75 cursor-not-allowed' : '')}
                                                                                                >
                                                                                                    {remindingPaymentId === payment.id ? (
                                                                                                        <>
                                                                                                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                                                                                            Sending...
                                                                                                        </>
                                                                                                    ) : (
                                                                                                        <>
                                                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                                                                                            Remind
                                                                                                        </>
                                                                                                    )}
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    ) : isPaidStatus(payment.status) ? (
                                                                                        <div className="flex justify-end items-center gap-3">
                                                                                            <span className="text-emerald-700 text-xs font-bold">{payment.status === 'Paid' ? 'Paid' : 'Verified'}</span>
                                                                                            <button
                                                                                                onClick={function (e) { e.stopPropagation(); setReceiptModal({ isOpen: true, payment: payment, booking: booking }); }}
                                                                                                className="text-[#720101] hover:text-[#4d0101] text-xs font-bold underline flex items-center gap-1"
                                                                                            >
                                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                                                Receipt
                                                                                            </button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <span className="text-slate-400 text-xs">-</span>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        <div className="mt-4 pt-3 border-t border-amber-100 flex justify-between items-center">
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditPaymentModal({ isOpen: true, payment: booking.payments?.[0] || null, booking })}
                                                                    className="bg-[#720101]/10 hover:bg-[#720101]/15 text-[#720101] px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 uppercase tracking-wide"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                    Edit Term
                                                                </button>
                                                                <div className="text-xs text-slate-400">
                                                                    {'Booking #' + booking.id + ' | Status: ' + booking.status}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-6 text-sm">
                                                                <div>
                                                                    <span className="text-slate-400">Paid: </span>
                                                                    <span className="font-semibold text-emerald-700">{'P' + paidAmount.toLocaleString()}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-400">Remaining: </span>
                                                                    <span className={'font-semibold ' + (remainingBalance > 0 ? 'text-red-600' : 'text-emerald-700')}>
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
                                {bookingPagination && bookingPagination.lastPage > 1 && (
                                    <div className="mt-6 flex flex-col gap-3 border-t border-amber-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-sm font-medium text-slate-500">
                                            Showing {bookingPagination.from || 0}-{bookingPagination.to || 0} of {bookingPagination.total || 0} bookings
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={bookingPagination.currentPage <= 1}
                                                onClick={() => setBookingPage((page) => Math.max(page - 1, 1))}
                                                className="rounded-lg border border-[#720101]/10 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:text-[#720101] disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Previous
                                            </button>
                                            <span className="rounded-lg bg-[#fffaf3] px-3 py-2 text-sm font-black text-[#720101]">
                                                {bookingPagination.currentPage} / {bookingPagination.lastPage}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={bookingPagination.currentPage >= bookingPagination.lastPage}
                                                onClick={() => setBookingPage((page) => Math.min(page + 1, bookingPagination.lastPage))}
                                                className="rounded-lg border border-[#720101]/10 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:text-[#720101] disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'ledger' && (
                    <div>
                        <div className="marketing-panel p-5 mb-6 flex flex-wrap gap-4 items-end">
                            <div className="flex flex-col flex-1 min-w-[200px]">
                                <label className="text-xs font-black uppercase text-slate-500 mb-1">Search Client</label>
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={ledgerFilter.clientSearch || ''}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { clientSearch: e.target.value })); }}
                                    className="border border-[#720101]/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#720101]/20 focus:border-[#720101]/30 w-full bg-white text-slate-700"
                                />
                            </div>
                            <div className="flex flex-col min-w-[150px]">
                                <label className="text-xs font-black uppercase text-slate-500 mb-1">Package</label>
                                <select
                                    value={ledgerFilter.packageFilter || 'All'}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { packageFilter: e.target.value })); }}
                                    className="border border-[#720101]/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#720101]/20 focus:border-[#720101]/30 bg-white text-slate-700"
                                >
                                    <option value="All">All Packages</option>
                                    <option value="standard">Standard</option>
                                    <option value="deluxe">Deluxe</option>
                                    <option value="premium">Premium</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-black uppercase text-slate-500 mb-1">Status</label>
                                <select
                                    value={ledgerFilter.status}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { status: e.target.value })); }}
                                    className="border border-[#720101]/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#720101]/20 focus:border-[#720101]/30 bg-white text-slate-700"
                                >
                                    <option value="All">All</option>
                                    <option value="Verified">Verified</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Rejected">Rejected</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-black uppercase text-slate-500 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={ledgerFilter.startDate}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { startDate: e.target.value })); }}
                                    className="border border-[#720101]/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#720101]/20 focus:border-[#720101]/30 bg-white text-slate-700"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-black uppercase text-slate-500 mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={ledgerFilter.endDate}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { endDate: e.target.value })); }}
                                    className="border border-[#720101]/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#720101]/20 focus:border-[#720101]/30 bg-white text-slate-700"
                                />
                            </div>
                        </div>

                        <div className="marketing-panel overflow-hidden p-5">
                            {loading ? (
                                <div className="p-6 text-center text-slate-500">Loading transactions...</div>
                            ) : (() => {
                                const filteredLedgerPayments = ledgerPayments.filter(p => {
                                    if (ledgerFilter.clientSearch && !((p.client_full_name || p.username || '').toLowerCase().includes(ledgerFilter.clientSearch.toLowerCase()))) return false;
                                    if (ledgerFilter.packageFilter && ledgerFilter.packageFilter !== 'All' && p.package_id !== ledgerFilter.packageFilter) return false;
                                    return true;
                                });

                                if (filteredLedgerPayments.length === 0) {
                                    return <div className="p-6 text-center text-slate-500">No records found matching filters.</div>;
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
                                            <div key={booking.id} className="bg-white border border-[#720101]/10 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                <div className="bg-[#fffaf3] px-6 py-4 border-b border-amber-100 flex flex-wrap justify-between items-center gap-4">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-950">{booking.client_full_name}</h3>
                                                        <p className="text-sm text-slate-500 mt-1">
                                                            Booking #{booking.id} <span className="mx-2">•</span> 
                                                            <span className="font-medium">{booking.package_id ? booking.package_id.charAt(0).toUpperCase() + booking.package_id.slice(1) : 'Custom'} Package</span>
                                                        </p>
                                                    </div>
                                                    <div className="text-right bg-white px-4 py-2 rounded-xl border border-amber-100 shadow-sm">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Event Date</p>
                                                        <p className="text-sm font-semibold text-slate-800">
                                                            {booking.event_date ? new Date(booking.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-white border-b border-amber-100">
                                                            <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                                <th className="text-left py-4 px-6">Payment Type</th>
                                                                <th className="text-right py-4 px-6">Amount</th>
                                                                <th className="text-center py-4 px-6">Due Date</th>
                                                                <th className="text-center py-4 px-6">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-amber-50 bg-white">
                                                            {booking.payments.map(p => {
                                                                var badge = getStatusBadge(p.status, p.due_date);
                                                                var typeInfo = PAYMENT_TYPE_LABELS[p.payment_type] || { label: p.payment_type || 'Legacy', icon: '-' };
                                                                return (
                                                                    <tr key={p.id} className="hover:bg-[#fffaf3] transition-colors">
                                                                        <td className="py-4 px-6">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-8 h-8 rounded-full bg-[#720101]/10 text-[#720101] flex items-center justify-center text-xs font-bold ring-1 ring-[#720101]/10">
                                                                                    {typeInfo.icon}
                                                                                </div>
                                                                                <span className="font-bold text-slate-950">{typeInfo.label}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-4 px-6 text-right font-bold text-slate-950">
                                                                            {'P' + (p.amount ? p.amount.toLocaleString() : '0')}
                                                                        </td>
                                                                        <td className="py-4 px-6 text-center text-slate-600 font-medium">
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
                    <div className="marketing-panel overflow-hidden">
                        <div className="px-6 py-5 border-b border-amber-100 bg-[#fffaf3]">
                            <p className="marketing-kicker">Refund Queue</p>
                            <h3 className="mt-1 text-lg font-bold text-slate-950">Refund Management Queue</h3>
                            <p className="text-sm text-slate-500 mt-1">Process manual financial returns for cancelled events outside the 7-day lock-in period. A 10% reservation fee will be deducted.</p>
                        </div>
                        {loading ? (
                            <div className="p-6 text-center text-slate-500">Loading refund queue...</div>
                        ) : refundQueue.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h3 className="text-lg font-bold text-slate-950">Queue is Empty</h3>
                                <p className="text-slate-500 mt-1 max-w-sm">There are currently no cancelled bookings with un-refunded payments.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-white border-b border-amber-100">
                                        <tr>
                                            <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider text-xs w-20">Booking ID</th>
                                            <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Client Name</th>
                                            <th className="px-6 py-4 text-center font-bold text-slate-500 uppercase tracking-wider text-xs">Event Date</th>
                                            <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs hidden md:table-cell">Total Paid</th>
                                            <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Refund Amount (minus 10%)</th>
                                            <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {refundQueue.map((item) => {
                                            // Deduct 10% penalty for late cancellation
                                            const penalty = item.total_paid * 0.10;
                                            const refundAmount = item.total_paid - penalty;

                                            return (
                                                <tr key={item.booking_id} className="border-b border-amber-50 hover:bg-[#fffaf3] transition-colors">
                                                    <td className="px-6 py-4 text-left font-bold text-slate-950">#{item.booking_id}</td>
                                                    <td className="px-6 py-4 text-left">
                                                        <div className="font-bold text-slate-950">{item.client_full_name}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">{item.client_email}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-slate-600 font-medium whitespace-nowrap">{item.event_date}</td>
                                                    <td className="px-6 py-4 text-right hidden md:table-cell text-slate-500 line-through">
                                                        ₱{item.total_paid ? item.total_paid.toLocaleString() : '0'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-[#720101]">
                                                        ₱{refundAmount > 0 ? refundAmount.toLocaleString() : '0'}
                                                        <div className="text-[10px] text-slate-400 font-normal mt-1">(₱{penalty.toLocaleString()} fee deducted)</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleProcessRefund(item.booking_id)}
                                                            className="marketing-primary-btn px-4 py-2 text-sm whitespace-nowrap"
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
                onClose={() => setEditPaymentModal({ isOpen: false, payment: null, booking: null })}
                booking={editPaymentModal.booking}
                payment={editPaymentModal.payment}
                onSuccess={() => {
                    setEditPaymentModal({ isOpen: false, payment: null, booking: null });
                    setToast({ message: 'Payment terms updated successfully!', type: 'success' });
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

export default DashboardAccounting;
