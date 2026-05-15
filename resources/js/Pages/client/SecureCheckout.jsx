import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { Head, router, usePage } from '@inertiajs/react';
import {
    BadgeCheck,
    CheckCircle2,
    ChevronLeft,
    CreditCard,
    Landmark,
    Lock,
    ShieldCheck,
    Smartphone,
} from 'lucide-react';
import logoImg from '../../../images/ECS_LOGO.png';

const methodGroups = [
    {
        title: 'E-Wallets',
        methods: [
            { id: 'gcash', name: 'GCash', icon: Smartphone },
            { id: 'maya', name: 'Maya', icon: Smartphone },
        ],
    },
    {
        title: 'Cards',
        methods: [
            { id: 'visa', name: 'Visa', icon: CreditCard },
            { id: 'mastercard', name: 'Mastercard', icon: CreditCard },
        ],
    },
];

const paymentLabels = {
    Reservation: '10% Reservation Fee',
    DownPayment: '70% Down Payment',
    Final: 'Final Payment',
};

const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
});

const SecureCheckout = () => {
    const { checkout } = usePage().props;
    const [selectedMethod, setSelectedMethod] = useState('gcash');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const selectedMethodName = useMemo(() => {
        return methodGroups
            .flatMap((group) => group.methods)
            .find((method) => method.id === selectedMethod)?.name || 'GCash';
    }, [selectedMethod]);

    const amount = Number(checkout?.amount || 0);
    const itemLabel = paymentLabels[checkout?.payment_type] || checkout?.payment_type || 'Payment';

    const authorizePayment = async () => {
        if (isProcessing) return;

        setError('');
        setIsProcessing(true);

        try {
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // TODO: PAYMONGO INTEGRATION
            // When the hosted checkout flow is connected, this page will receive the provider result
            // and the backend will validate it through the webhook listener before redirecting.
            const response = await axios.post('/checkout/process', {
                booking_id: checkout.booking_id,
                payment_id: checkout.payment_id,
                amount: amount,
                payment_method: selectedMethodName,
                authorization_token: `secure_checkout_${Date.now()}`,
            }, {
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            if (response.data?.redirect_url) {
                router.visit(response.data.redirect_url);
                return;
            }

            router.visit('/dashboard/client');
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || 'The payment could not be authorized. Please try again.');
            setIsProcessing(false);
        }
    };

    return (
        <>
            <Head title="Checkout" />
            <main className="min-h-screen bg-white text-slate-950">
                <div className="border-b border-slate-200 bg-white">
                    <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
                        <div className="flex items-center gap-4">
                            <img src={logoImg} alt="ECS" className="h-12 w-auto" />
                            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
                            <div className="hidden sm:block">
                                <p className="text-sm font-bold text-slate-950">Checkout</p>
                                <p className="text-xs font-medium text-slate-500">Encrypted payment authorization</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                            <Lock className="h-4 w-4" />
                            <span>Protected Session</span>
                        </div>
                    </div>
                </div>

                <section className="mx-auto grid max-w-6xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_420px] lg:py-14">
                    <div>
                        <button
                            type="button"
                            onClick={() => router.visit('/dashboard/client')}
                            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-[#720101]"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Return to dashboard
                        </button>

                        <div className="mb-8">
                            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#720101]">
                                <ShieldCheck className="h-5 w-5" />
                                <span>Checkout</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">Authorize your payment</h1>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                                Choose your preferred payment method to complete the authorization for your booking.
                            </p>
                        </div>

                        <div className="space-y-8">
                            {methodGroups.map((group) => (
                                <div key={group.title}>
                                    <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">{group.title}</h2>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {group.methods.map((method) => {
                                            const Icon = method.icon;
                                            const active = selectedMethod === method.id;

                                            return (
                                                <button
                                                    key={method.id}
                                                    type="button"
                                                    onClick={() => setSelectedMethod(method.id)}
                                                    disabled={isProcessing}
                                                    className={`flex min-h-20 items-center justify-between rounded-lg border px-5 text-left transition-all ${
                                                        active
                                                            ? 'border-[#720101] bg-[#720101]/5 shadow-[0_0_0_1px_rgba(114,1,1,0.16)]'
                                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                                    } ${isProcessing ? 'cursor-not-allowed opacity-70' : ''}`}
                                                >
                                                    <span className="flex items-center gap-3">
                                                        <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${active ? 'bg-[#720101] text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                            <Icon className="h-5 w-5" />
                                                        </span>
                                                        <span>
                                                            <span className="block text-base font-black text-slate-950">{method.name}</span>
                                                            <span className="block text-xs font-semibold text-slate-500">Instant authorization</span>
                                                        </span>
                                                    </span>
                                                    {active && <CheckCircle2 className="h-5 w-5 text-[#720101]" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {error && (
                            <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                {error}
                            </div>
                        )}
                    </div>

                    <aside className="lg:pt-16">
                        <div className="sticky top-8 rounded-lg border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                            <div className="border-b border-slate-200 px-6 py-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#720101] text-white">
                                        <Landmark className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-slate-950">Order Summary</h2>
                                        <p className="text-xs font-semibold text-slate-500">Booking #{checkout?.booking_id}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-5 px-6 py-6">
                                <div className="flex items-start justify-between gap-5">
                                    <div>
                                        <p className="text-sm font-black text-slate-950">{itemLabel}</p>
                                        <p className="mt-1 text-xs font-semibold text-slate-500">
                                            {checkout?.client_full_name || 'Eloquente Catering booking'}
                                        </p>
                                    </div>
                                    <p className="text-sm font-black text-slate-950">{peso.format(amount)}</p>
                                </div>

                                <div className="h-px bg-slate-200" />

                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-semibold text-slate-500">Subtotal</span>
                                        <span className="font-bold text-slate-950">{peso.format(amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="font-semibold text-slate-500">Processing fee</span>
                                        <span className="font-bold text-slate-950">{peso.format(0)}</span>
                                    </div>
                                </div>

                                <div className="h-px bg-slate-200" />

                                <div className="flex items-end justify-between">
                                    <span className="text-sm font-black text-slate-950">Total</span>
                                    <span className="text-2xl font-black text-slate-950">{peso.format(amount)}</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={authorizePayment}
                                    disabled={isProcessing}
                                    className="flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-[#720101] px-5 text-sm font-black text-white shadow-lg shadow-[#720101]/20 transition-colors hover:bg-[#5c0101] disabled:cursor-not-allowed disabled:bg-[#720101]/80"
                                >
                                    {isProcessing ? (
                                        <>
                                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                            <span>Processing via bank network...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="h-5 w-5" />
                                            <span>Authorize Payment</span>
                                        </>
                                    )}
                                </button>

                                <div className="grid gap-3 rounded-lg bg-slate-50 p-4">
                                    <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                        <span>256-bit encrypted authorization</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                                        <BadgeCheck className="h-4 w-4 text-emerald-600" />
                                        <span>No card details are stored by ECS</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </section>
            </main>
        </>
    );
};

SecureCheckout.layout = (page) => page;

export default SecureCheckout;
