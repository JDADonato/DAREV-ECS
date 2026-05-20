import React from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import DefaultLayout from '../../Layouts/DefaultLayout';
import ClientNavbar from '../../Components/common/ClientNavbar';

const FieldError = ({ message }) => {
    if (!message) return null;
    return <p className="mt-2 text-sm font-medium text-red-700">{message}</p>;
};

const InfoPill = ({ tone = 'neutral', children }) => {
    const styles = {
        neutral: 'border-gray-200 bg-white text-gray-700',
        gold: 'border-brand-gold/30 bg-brand-gold/10 text-brand-red',
        green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        red: 'border-red-200 bg-red-50 text-red-700',
    };

    return (
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${styles[tone]}`}>
            {children}
        </span>
    );
};

const Edit = () => {
    const { auth } = usePage().props;
    const user = auth?.user || {};
    const initial = (user.username || 'U').charAt(0).toUpperCase();
    const isEmailVerified = Boolean(user.email_verified_at);

    const { data, setData, put, processing, errors, isDirty } = useForm({
        username: user.username || '',
        email: user.email || '',
        phone: user.phone || '',
        current_password: '',
        new_password: '',
    });

    const submit = (e) => {
        e.preventDefault();
        put('/profile', {
            preserveScroll: true,
            onSuccess: () => {
                setData('current_password', '');
                setData('new_password', '');
            },
        });
    };

    const getDashLink = () => {
        if (!user) return '/';
        return user.role === 'Client' ? '/dashboard/client' :
            user.role === 'Marketing' ? '/dashboard/marketing' :
                user.role === 'Accounting' ? '/dashboard/accounting' : '/dashboard/admin';
    };

    return (
        <DefaultLayout>
            <Head title="My Profile - Eloquente Catering" />

            <div className="min-h-screen bg-[#f8f6f4] text-gray-900">
                <ClientNavbar user={user} activePath="/profile" />

                <main className="mx-auto max-w-7xl px-4 pb-8 pt-28 sm:px-6 lg:px-8 lg:pb-10">
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <Link href={getDashLink()} className="inline-flex items-center gap-2 text-sm font-bold text-brand-red hover:text-brand-red-dark">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                Back to dashboard
                            </Link>
                            <h1 className="mt-4 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">My Profile</h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                                Manage your account details, contact information, and password for Eloquente Catering.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <InfoPill tone={user.role === 'Client' ? 'gold' : 'neutral'}>{user.role || 'Account'}</InfoPill>
                            <InfoPill tone={isEmailVerified ? 'green' : 'red'}>{isEmailVerified ? 'Verified Email' : 'Email Review Needed'}</InfoPill>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                        <aside className="space-y-6">
                            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                                <div className="bg-brand-red px-6 py-7 text-white">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-gold text-3xl font-black text-brand-red shadow-lg shadow-black/10 ring-4 ring-white/15">
                                            {initial}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-xl font-black">{user.username || 'Profile'}</p>
                                            <p className="mt-1 truncate text-sm font-medium text-white/75">{user.email || 'No email set'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="divide-y divide-gray-100 px-6">
                                    <div className="flex items-center justify-between py-4">
                                        <span className="text-sm font-semibold text-gray-500">Account Type</span>
                                        <span className="text-sm font-black text-gray-900">{user.role || 'User'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-4">
                                        <span className="text-sm font-semibold text-gray-500">Phone</span>
                                        <span className="text-sm font-black text-gray-900">{user.phone || 'Not provided'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-4">
                                        <span className="text-sm font-semibold text-gray-500">Email Status</span>
                                        <span className={`text-sm font-black ${isEmailVerified ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {isEmailVerified ? 'Verified' : 'Pending'}
                                        </span>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-brand-gold/30 bg-brand-gold/10 p-6 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-gold text-brand-red">
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-2-.895-2-2zm0 0H8m8 0h2m-2 6H8a4 4 0 01-4-4V7a4 4 0 014-4h8a4 4 0 014 4v6a4 4 0 01-4 4z" /></svg>
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-black uppercase tracking-wide text-brand-red">Account Security</h2>
                                        <p className="mt-2 text-sm leading-6 text-gray-700">
                                            Use a current password only when changing to a new one. Leaving password fields blank keeps your existing password.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </aside>

                        <form onSubmit={submit} className="space-y-6">
                            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                                <div className="flex flex-col gap-2 border-b border-gray-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h2 className="text-xl font-black text-gray-950">Personal Details</h2>
                                        <p className="mt-1 text-sm text-gray-500">Keep your contact information accurate for booking updates and verification.</p>
                                    </div>
                                    {isDirty && <InfoPill tone="gold">Unsaved Changes</InfoPill>}
                                </div>

                                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700">Username</label>
                                        <input
                                            type="text"
                                            value={data.username}
                                            onChange={e => setData('username', e.target.value)}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-brand-red focus:ring-4 focus:ring-brand-red/10"
                                            required
                                        />
                                        <FieldError message={errors.username} />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700">Phone Number</label>
                                        <input
                                            type="text"
                                            value={data.phone}
                                            onChange={e => setData('phone', e.target.value)}
                                            placeholder="Optional"
                                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-brand-red focus:ring-4 focus:ring-brand-red/10"
                                        />
                                        <FieldError message={errors.phone} />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="mb-2 block text-sm font-bold text-gray-700">Email Address</label>
                                        <div className="flex flex-col gap-3 sm:flex-row">
                                            <input
                                                type="email"
                                                value={data.email}
                                                onChange={e => setData('email', e.target.value)}
                                                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-brand-red focus:ring-4 focus:ring-brand-red/10"
                                                required
                                            />
                                            <div className={`flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-black ${isEmailVerified ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                                                {isEmailVerified ? 'Verified' : 'Needs Verification'}
                                            </div>
                                        </div>
                                        <FieldError message={errors.email} />
                                        <p className="mt-2 text-xs font-medium text-gray-500">Changing your email sends a new verification code.</p>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                                <div className="border-b border-gray-100 pb-6">
                                    <h2 className="text-xl font-black text-gray-950">Password</h2>
                                    <p className="mt-1 text-sm text-gray-500">Update your password only when needed.</p>
                                </div>

                                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700">Current Password</label>
                                        <input
                                            type="password"
                                            value={data.current_password}
                                            onChange={e => setData('current_password', e.target.value)}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-brand-red focus:ring-4 focus:ring-brand-red/10"
                                            placeholder="Required for password changes"
                                        />
                                        <FieldError message={errors.current_password} />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700">New Password</label>
                                        <input
                                            type="password"
                                            value={data.new_password}
                                            onChange={e => setData('new_password', e.target.value)}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-brand-red focus:ring-4 focus:ring-brand-red/10"
                                            placeholder="Minimum 6 characters"
                                        />
                                        <FieldError message={errors.new_password} />
                                    </div>
                                </div>
                            </section>

                            <div className="sticky bottom-4 z-10 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl shadow-gray-900/10 backdrop-blur">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm font-medium text-gray-500">
                                        {isDirty ? 'Review your changes before saving.' : 'Your profile is up to date.'}
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-red px-6 py-3 text-sm font-black text-white shadow-lg shadow-brand-red/20 transition hover:bg-brand-red-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {processing && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                                        {processing ? 'Saving Changes' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </main>
            </div>
        </DefaultLayout>
    );
};

export default Edit;
