import React, { useEffect, useMemo, useState } from 'react';

const defaultTermName = (index) => {
    if (index === 0) return 'Reservation';
    if (index === 1) return 'DownPayment';
    if (index === 2) return 'Final';
    return `Payment ${index + 1}`;
};

const formatDateInput = (value) => {
    if (!value) return '';
    return String(value).slice(0, 10);
};

const PaymentTermEditorModal = ({ isOpen, onClose, booking, payment, onSuccess }) => {
    const [terms, setTerms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const bookingTotal = useMemo(() => {
        return Number(booking?.totalCost ?? booking?.total_cost ?? booking?.budget ?? 0);
    }, [booking]);

    useEffect(() => {
        if (!booking) return;

        const payments = Array.isArray(booking.payments) ? booking.payments : (payment ? [payment] : []);
        const nextTerms = payments.map((item, index) => ({
            id: item.id,
            payment_type: item.payment_type || defaultTermName(index),
            percentage: bookingTotal > 0 ? Number(((Number(item.amount || 0) / bookingTotal) * 100).toFixed(2)) : 0,
            due_date: formatDateInput(item.due_date),
            status: item.status || 'Pending',
        }));

        setTerms(nextTerms.length > 0 ? nextTerms : [{
            id: null,
            payment_type: 'Reservation',
            percentage: 100,
            due_date: '',
            status: 'Pending',
        }]);
        setError(null);
    }, [booking, bookingTotal, payment]);

    const totalPercentage = terms.reduce((sum, term) => sum + Number(term.percentage || 0), 0);
    const canSave = Math.abs(totalPercentage - 100) < 0.01 && terms.every(term => term.payment_type && term.due_date);

    if (!isOpen || !booking) return null;

    const updateTerm = (index, updates) => {
        setTerms(prev => prev.map((term, termIndex) => termIndex === index ? { ...term, ...updates } : term));
        setError(null);
    };

    const addTerm = () => {
        setTerms(prev => [
            ...prev,
            {
                id: null,
                payment_type: defaultTermName(prev.length),
                percentage: 0,
                due_date: '',
                status: 'Pending',
            },
        ]);
        setError(null);
    };

    const removeTerm = (index) => {
        if (terms.length === 1) {
            setError('At least one payment term is required.');
            return;
        }
        setTerms(prev => prev.filter((_, termIndex) => termIndex !== index));
        setError(null);
    };

    const calculatedAmount = (percentage, index) => {
        if (index === terms.length - 1) {
            const previous = terms
                .slice(0, -1)
                .reduce((sum, term) => sum + Math.round(bookingTotal * (Number(term.percentage || 0) / 100) * 100) / 100, 0);
            return Math.max(bookingTotal - previous, 0);
        }

        return bookingTotal * (Number(percentage || 0) / 100);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!canSave) {
            setError('Payment percentages must total 100%, and every term needs a name and due date.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/accounting/bookings/${booking.id}/payment-terms`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    terms: terms.map(term => ({
                        id: term.id,
                        payment_type: term.payment_type,
                        percentage: Number(term.percentage || 0),
                        due_date: term.due_date,
                    })),
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                onSuccess(data.booking);
            } else {
                setError(data.error || 'Failed to update payment terms.');
            }
        } catch (err) {
            setError('Network error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col justify-center items-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden transform transition-all">
                <div className="bg-primary-900 px-6 py-4 flex justify-between items-center text-white">
                    <h3 className="font-display font-bold text-lg flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        Edit Payment Terms
                    </h3>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-72px)]">
                    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Booking Total</p>
                            <p className="text-2xl font-black text-gray-900">PHP {bookingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className={`rounded-xl px-4 py-3 text-sm font-black ${Math.abs(totalPercentage - 100) < 0.01 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            Total: {totalPercentage.toFixed(2)}% / 100%
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex items-start gap-2">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            {error}
                        </div>
                    )}

                    <div className="space-y-3">
                        {terms.map((term, index) => {
                            const amount = calculatedAmount(term.percentage, index);
                            const locked = ['Verified', 'Paid', 'Refunded'].includes(term.status);

                            return (
                                <div key={term.id || `new-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
                                        <label className="md:col-span-4">
                                            <span className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1">Term</span>
                                            <input
                                                type="text"
                                                required
                                                disabled={locked}
                                                value={term.payment_type}
                                                onChange={(e) => updateTerm(index, { payment_type: e.target.value })}
                                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white text-gray-900 font-bold disabled:bg-gray-100"
                                            />
                                        </label>
                                        <label className="md:col-span-2">
                                            <span className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1">Percent</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                max="100"
                                                required
                                                disabled={locked}
                                                value={term.percentage}
                                                onChange={(e) => updateTerm(index, { percentage: e.target.value })}
                                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white text-gray-900 font-bold disabled:bg-gray-100"
                                            />
                                        </label>
                                        <div className="md:col-span-2">
                                            <span className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1">Amount</span>
                                            <div className="w-full p-3 border border-gray-200 rounded-xl bg-white text-gray-900 font-bold">
                                                PHP {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                        <label className="md:col-span-3">
                                            <span className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1">Due Date</span>
                                            <input
                                                type="date"
                                                required
                                                disabled={locked}
                                                value={term.due_date}
                                                onChange={(e) => updateTerm(index, { due_date: e.target.value })}
                                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white text-gray-900 disabled:bg-gray-100"
                                            />
                                        </label>
                                        <div className="md:col-span-1 flex justify-end">
                                            <button
                                                type="button"
                                                disabled={locked}
                                                onClick={() => removeTerm(index)}
                                                className="rounded-xl bg-red-50 px-3 py-3 text-sm font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Del
                                            </button>
                                        </div>
                                    </div>
                                    {locked && <p className="mt-2 text-xs font-semibold text-gray-500">This term is locked because it is already {term.status.toLowerCase()}.</p>}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-5">
                        <button
                            type="button"
                            onClick={addTerm}
                            className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-black text-primary-700 hover:bg-primary-100"
                        >
                            Add Split Payment
                        </button>
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !canSave}
                            className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[150px]"
                        >
                            {loading ? 'Saving...' : 'Save Terms'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PaymentTermEditorModal;
