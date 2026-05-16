import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';

const AccountingSettings = ({ initialRules }) => {
    const [rules, setRules] = useState(initialRules || {
        reservation_fee_percentage: 10,
        downpayment_percentage: 70,
        final_payment_percentage: 20,
        reservation_validity_hours: 24,
        downpayment_due_days: 30,
        final_payment_due_days: 14,
    });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Calculate total percentage to ensure it equals 100%
    const totalPercentage = parseFloat(rules.reservation_fee_percentage) 
                          + parseFloat(rules.downpayment_percentage) 
                          + parseFloat(rules.final_payment_percentage);
    
    const isValid = Math.abs(totalPercentage - 100) < 0.01;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setRules(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
        setError(null);
        setSuccess(false);
    };

    const handleIntegerChange = (e) => {
        const { name, value } = e.target;
        setRules(prev => ({
            ...prev,
            [name]: parseInt(value) || 0
        }));
        setError(null);
        setSuccess(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!isValid) {
            setError(`Percentages must equal exactly 100%. Currently at ${totalPercentage}%.`);
            return;
        }

        if (rules.final_payment_due_days >= rules.downpayment_due_days) {
            setError("Final payment due date must be closer to the event than the downpayment.");
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(false);

        router.put('/admin/settings/business-rules', rules, {
            preserveScroll: true,
            onSuccess: () => {
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            },
            onError: (errors) => {
                setError(errors.message || 'Failed to update accounting settings.');
            },
            onFinish: () => setSaving(false)
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <div className="mb-6">
                <h2 className="text-xl font-display font-bold text-gray-900">Financial Rules & Tranches</h2>
                <p className="text-sm text-gray-500 mt-1">Adjust global payment scheduling. These rules automatically apply to all newly created bookings.</p>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl text-sm font-bold border border-red-100 flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-xl text-sm font-bold border border-green-100 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Settings successfully updated.
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Payment Tranches */}
                <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest border-b pb-2 mb-4">Payment Tranches</h3>
                    <div className="grid sm:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Reservation Fee (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    name="reservation_fee_percentage"
                                    value={rules.reservation_fee_percentage}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 font-bold focus:ring-2 focus:ring-[#720101] focus:border-transparent outline-none pr-8"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Downpayment (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    name="downpayment_percentage"
                                    value={rules.downpayment_percentage}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 font-bold focus:ring-2 focus:ring-[#720101] focus:border-transparent outline-none pr-8"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Final Payment (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    name="final_payment_percentage"
                                    value={rules.final_payment_percentage}
                                    onChange={handleChange}
                                    className={`w-full bg-gray-50 border rounded-xl px-4 py-2.5 font-bold focus:ring-2 focus:ring-[#720101] outline-none pr-8 ${!isValid ? 'border-red-300 text-red-900' : 'border-gray-200 text-gray-900'}`}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-2 flex justify-between items-center text-xs font-bold">
                        <span className="text-gray-500">Total</span>
                        <span className={isValid ? 'text-green-600' : 'text-red-600'}>{totalPercentage}% / 100%</span>
                    </div>
                </div>

                {/* Due Date Thresholds */}
                <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest border-b pb-2 mb-4">Deadlines & Thresholds</h3>
                    <div className="grid sm:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Reservation Validity (Hrs)</label>
                            <input
                                type="number"
                                name="reservation_validity_hours"
                                value={rules.reservation_validity_hours}
                                onChange={handleIntegerChange}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 font-bold focus:ring-2 focus:ring-[#720101] outline-none"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Hours before unpaid reservation auto-cancels.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Downpayment Due (Days)</label>
                            <input
                                type="number"
                                name="downpayment_due_days"
                                value={rules.downpayment_due_days}
                                onChange={handleIntegerChange}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 font-bold focus:ring-2 focus:ring-[#720101] outline-none"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Days prior to event date.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Final Payment Due (Days)</label>
                            <input
                                type="number"
                                name="final_payment_due_days"
                                value={rules.final_payment_due_days}
                                onChange={handleIntegerChange}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 font-bold focus:ring-2 focus:ring-[#720101] outline-none"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Days prior to event date.</p>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving || !isValid}
                        className="bg-[#1a1a1a] hover:bg-black text-white font-bold py-3 px-8 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving Rules...' : 'Save Financial Rules'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AccountingSettings;
