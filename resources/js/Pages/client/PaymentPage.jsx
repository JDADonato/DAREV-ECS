import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';

const PAYMENT_METHODS = [
    {
        id: 'gcash',
        name: 'GCash',
        type: 'e-wallet',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
        color: 'from-blue-500 to-blue-600',
        accentColor: 'blue',
        number: '0917 ***  1234',
        instructions: 'You will be redirected to GCash to complete payment.'
    },
    {
        id: 'maya',
        name: 'Maya',
        type: 'e-wallet',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
        color: 'from-green-500 to-green-600',
        accentColor: 'green',
        number: '0918 ***  5678',
        instructions: 'You will be redirected to Maya to complete payment.'
    },
    {
        id: 'bpi',
        name: 'BPI Bank Transfer',
        type: 'bank',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>,
        color: 'from-red-600 to-red-700',
        accentColor: 'red',
        number: 'Account: ****-****-7890',
        instructions: 'Transfer to the given account and upload your receipt.'
    },
    {
        id: 'bdo',
        name: 'BDO Bank Transfer',
        type: 'bank',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>,
        color: 'from-yellow-500 to-yellow-600',
        accentColor: 'amber',
        number: 'Account: ****-****-4321',
        instructions: 'Transfer to the given account and upload your receipt.'
    }
];

const PAYMENT_TYPE_LABELS = {
    Reservation: { label: 'Reservation Payment', pct: '10%' },
    DownPayment: { label: 'Down Payment', pct: '70%' },
    Final: { label: 'Final Payment', pct: '20%' },
};

const PaymentPage = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const paymentId = searchParams.get('paymentId');
    const bookingId = searchParams.get('bookingId');
    const amount = parseFloat(searchParams.get('amount')) || 0;
    const paymentType = searchParams.get('type') || '';
    const payInFull = searchParams.get('payInFull') === 'true';

    const [step, setStep] = useState(1); // 1=select method, 2=confirm, 3=processing, 4=done
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [referenceNumber, setReferenceNumber] = useState('');
    const [proofFile, setProofFile] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');

    var typeInfo = PAYMENT_TYPE_LABELS[paymentType] || { label: payInFull ? 'Pay in Full' : 'Payment', pct: '' };

    const handleConfirmPayment = async () => {
        if (!selectedMethod) {
            setError('Please select a payment method.');
            return;
        }
        if (!referenceNumber.trim()) {
            setError('Please enter a reference or transaction number.');
            return;
        }
        setError('');
        setStep(3);
        setProcessing(true);

        // Simulate processing delay
        await new Promise(function (resolve) { setTimeout(resolve, 2500); });

        try {
            // Session auth - no token needed
            var body = {
                payment_id: paymentId,
                booking_id: bookingId,
                amount: amount,
                payment_method: selectedMethod.name,
                reference_number: referenceNumber,
                pay_in_full: payInFull
            };

            var res = await fetch('/api/bookings/pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setStep(4);
            } else {
                var data = await res.json();
                setError(data.error || 'Payment failed. Please try again.');
                setStep(2);
            }
        } catch (err) {
            setError('Network error. Please try again.');
            setStep(2);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={function () { router.get('/dashboard/client'); }} className="text-gray-400 hover:text-gray-700 transition-colors p-1">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">Make a Payment</h1>
                            <p className="text-xs text-gray-400">{'Booking #' + bookingId}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {[1, 2, 3, 4].map(function (s) {
                            return (
                                <div key={s} className={'w-2.5 h-2.5 rounded-full transition-all ' + (s === step ? 'bg-primary-500 scale-110' : s < step ? 'bg-green-500' : 'bg-gray-200')}></div>
                            );
                        })}
                    </div>
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-4 py-8">
                {/* Payment Summary Card */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 mb-8 text-white shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-gray-400 text-xs uppercase tracking-wider">Payment For</p>
                            <p className="text-lg font-bold mt-1">{typeInfo.label}</p>
                        </div>
                        {typeInfo.pct && <span className="bg-white/10 text-white/90 px-3 py-1 rounded-full text-xs font-bold">{typeInfo.pct}</span>}
                    </div>
                    <div className="border-t border-white/10 pt-4">
                        <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Amount Due</p>
                        <p className="text-4xl font-bold">{'₱' + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>

                {/* ===== Step 1: Select Payment Method ===== */}
                {step === 1 && (
                    <div className="animate-fadeIn">
                        <h2 className="text-lg font-bold text-gray-900 mb-1">Choose Payment Method</h2>
                        <p className="text-sm text-gray-400 mb-6">Select how you'd like to pay</p>

                        {/* E-Wallets */}
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">E-Wallets</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                            {PAYMENT_METHODS.filter(function (m) { return m.type === 'e-wallet'; }).map(function (method) {
                                var isSelected = selectedMethod && selectedMethod.id === method.id;
                                return (
                                    <button key={method.id} onClick={function () { setSelectedMethod(method); }}
                                        className={'relative p-4 rounded-xl border-2 text-left transition-all group hover:shadow-md ' +
                                            (isSelected ? 'border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-200' : 'border-gray-200 bg-white hover:border-gray-300')}>
                                        <div className="flex items-center gap-3">
                                            <div className={'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm ' + method.color}>{method.icon}</div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm">{method.name}</p>
                                                <p className="text-xs text-gray-400">{method.number}</p>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute top-3 right-3 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Bank Transfers */}
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Bank Transfer</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                            {PAYMENT_METHODS.filter(function (m) { return m.type === 'bank'; }).map(function (method) {
                                var isSelected = selectedMethod && selectedMethod.id === method.id;
                                return (
                                    <button key={method.id} onClick={function () { setSelectedMethod(method); }}
                                        className={'relative p-4 rounded-xl border-2 text-left transition-all group hover:shadow-md ' +
                                            (isSelected ? 'border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-200' : 'border-gray-200 bg-white hover:border-gray-300')}>
                                        <div className="flex items-center gap-3">
                                            <div className={'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm ' + method.color}>{method.icon}</div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm">{method.name}</p>
                                                <p className="text-xs text-gray-400">{method.number}</p>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute top-3 right-3 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <button onClick={function () { if (selectedMethod) setStep(2); else setError('Please select a payment method.'); }}
                            disabled={!selectedMethod}
                            className={'w-full py-3.5 rounded-xl font-bold text-sm transition-all ' +
                                (selectedMethod ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed')}>
                            Continue
                        </button>
                        {error && <p className="text-red-600 text-sm text-center mt-3 font-medium">{error}</p>}
                    </div>
                )}

                {/* ===== Step 2: Confirm Details ===== */}
                {step === 2 && (
                    <div className="animate-fadeIn">
                        <h2 className="text-lg font-bold text-gray-900 mb-1">Confirm Payment</h2>
                        <p className="text-sm text-gray-400 mb-6">Review and provide your payment details</p>

                        {/* Selected method display */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={'w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white ' + selectedMethod.color}>{selectedMethod.icon}</div>
                                <div>
                                    <p className="font-bold text-gray-900 text-sm">{selectedMethod.name}</p>
                                    <p className="text-xs text-gray-400">{selectedMethod.number}</p>
                                </div>
                            </div>
                            <button onClick={function () { setStep(1); }} className="text-primary-600 text-xs font-bold hover:underline">Change</button>
                        </div>

                        {selectedMethod && (
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
                                <p className="text-sm text-blue-800 font-medium">{selectedMethod.instructions}</p>
                            </div>
                        )}

                        {/* Reference Number */}
                        <div className="mb-5">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Reference / Transaction Number <span className="text-red-500">*</span></label>
                            <input type="text" value={referenceNumber} onChange={function (e) { setReferenceNumber(e.target.value); }} placeholder="e.g. 1234567890"
                                className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700 font-medium text-lg tracking-wider" />
                            <p className="text-xs text-gray-400 mt-1">Enter the reference number from your payment app or bank</p>
                        </div>

                        {/* Proof of Payment (optional) */}
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Proof of Payment <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-primary-300 transition-colors cursor-pointer bg-gray-50"
                                onClick={function () { document.getElementById('proof-upload').click(); }}>
                                {proofFile ? (
                                    <div>
                                        <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <p className="text-sm font-medium text-gray-700">{proofFile.name}</p>
                                        <p className="text-xs text-gray-400 mt-1">Click to change</p>
                                    </div>
                                ) : (
                                    <div>
                                        <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <p className="text-sm text-gray-500">Upload screenshot or receipt</p>
                                        <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                                    </div>
                                )}
                            </div>
                            <input id="proof-upload" type="file" accept="image/*" className="hidden"
                                onChange={function (e) { if (e.target.files[0]) setProofFile(e.target.files[0]); }} />
                        </div>

                        {/* Summary */}
                        <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Payment Summary</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">{typeInfo.label}</span>
                                    <span className="font-medium text-gray-900">{'₱' + amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Method</span>
                                    <span className="font-medium text-gray-900">{selectedMethod ? selectedMethod.name : '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
                                    <span className="font-bold text-gray-700">Total</span>
                                    <span className="font-bold text-gray-900 text-lg">{'₱' + amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {error && <p className="text-red-600 text-sm text-center mb-3 font-medium">{error}</p>}

                        <div className="flex gap-3">
                            <button onClick={function () { setStep(1); setError(''); }} className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Back</button>
                            <button onClick={handleConfirmPayment} className="flex-[2] py-3.5 rounded-xl font-bold text-sm bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all">
                                {'Pay ₱' + amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </button>
                        </div>
                    </div>
                )}

                {/* ===== Step 3: Processing ===== */}
                {step === 3 && (
                    <div className="animate-fadeIn text-center py-16">
                        <div className="relative mx-auto w-20 h-20 mb-6">
                            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Processing Payment...</h2>
                        <p className="text-sm text-gray-400">Please wait while we verify your transaction</p>
                    </div>
                )}

                {/* ===== Step 4: Success ===== */}
                {step === 4 && (
                    <div className="animate-fadeIn text-center py-12">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-slideUp">
                            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Submitted!</h2>
                        <p className="text-sm text-gray-500 mb-2">Your payment has been recorded and is pending verification.</p>
                        <p className="text-xs text-gray-400 mb-8">You'll receive a notification once your payment is verified by our finance team.</p>

                        <div className="bg-gray-50 rounded-xl p-5 mb-8 border border-gray-100 max-w-sm mx-auto">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-bold text-gray-900">{'₱' + amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="font-medium text-gray-700">{selectedMethod ? selectedMethod.name : '-'}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Reference</span><span className="font-mono text-gray-700">{referenceNumber}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="text-amber-600 font-bold">Pending Verification</span></div>
                            </div>
                        </div>

                        <button onClick={function () { router.get('/dashboard/client'); }}
                            className="bg-primary-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all">
                            Back to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentPage;
