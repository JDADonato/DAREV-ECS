import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import DefaultLayout from '../../Layouts/DefaultLayout';
import ClientNavbar from '../../Components/common/ClientNavbar';

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const FieldError = ({ message }) => message ? <p className="mt-2 text-sm font-bold text-red-700">{message}</p> : null;

const notificationLabels = {
    booking_updates: 'Booking updates',
    payment_reminders: 'Payment reminders',
    message_alerts: 'Message alerts',
    announcements: 'Announcements',
};

const contactLabels = {
    email: 'Email',
    phone: 'Phone',
    dashboard: 'Dashboard messages',
};

const TabButton = ({ active, children, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`whitespace-nowrap border-b-2 px-2 py-4 text-sm font-black transition sm:px-5 ${
            active
                ? 'border-[#720101] text-[#720101]'
                : 'border-transparent text-slate-500 hover:border-[#ead8cc] hover:text-[#720101]'
        }`}
    >
        {children}
    </button>
);

const InfoRow = ({ label, value }) => (
    <div className="border-b border-[#f1e2d8] py-4 last:border-0">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className="mt-1 text-base font-black text-slate-950">{value || 'Not set'}</p>
    </div>
);

const DetailTile = ({ eyebrow, title, text, tone = 'neutral' }) => {
    const styles = {
        neutral: 'border-[#ead8cc] bg-white',
        warm: 'border-[#f5dfad] bg-[#fffaf0]',
        success: 'border-emerald-200 bg-emerald-50',
        danger: 'border-red-200 bg-red-50',
    };

    return (
        <div className={`rounded-2xl border p-5 ${styles[tone] || styles.neutral}`}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
            <p className="mt-2 text-xl font-black text-slate-950">{title || 'Not set'}</p>
            {text && <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{text}</p>}
        </div>
    );
};

const PanelHeader = ({ eyebrow, title, text, action }) => (
    <div className="flex flex-col gap-4 border-b border-[#ead8cc] py-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9f6500]">{eyebrow}</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-950">{title}</h2>
            {text && <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">{text}</p>}
        </div>
        {action}
    </div>
);

const EditActions = ({ onCancel, onSave, processing, saveLabel = 'Save changes' }) => (
    <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">
            Cancel
        </button>
        <button type="button" onClick={onSave} disabled={processing} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-[#5a0101] disabled:opacity-60">
            {processing ? 'Saving...' : saveLabel}
        </button>
    </div>
);

const ProfileEdit = () => {
    const { auth, flash } = usePage().props;
    const user = auth?.user || {};
    const fileInputRef = useRef(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [editing, setEditing] = useState(null);
    const [activity, setActivity] = useState([]);
    const [showPasswords, setShowPasswords] = useState(false);

    const displayName = user.full_name || user.username || 'Profile';
    const initial = displayName.charAt(0).toUpperCase();
    const isClient = user.role === 'Client';
    const verified = Boolean(user.email_verified_at);
    const notificationPrefs = user.notification_preferences || {};
    const profilePrefs = user.profile_preferences || {};

    const { data, setData, post, processing, errors, reset, isDirty } = useForm({
        _method: 'PUT',
        full_name: user.full_name || '',
        username: user.username || '',
        email: user.email || '',
        phone: user.phone || '',
        preferred_contact_method: user.preferred_contact_method || 'email',
        notification_preferences: {
            booking_updates: notificationPrefs.booking_updates ?? true,
            payment_reminders: notificationPrefs.payment_reminders ?? true,
            message_alerts: notificationPrefs.message_alerts ?? true,
            announcements: notificationPrefs.announcements ?? true,
        },
        profile_preferences: {
            default_event_city: profilePrefs.default_event_city || '',
            default_guest_count: profilePrefs.default_guest_count || '',
            planning_notes: profilePrefs.planning_notes || '',
        },
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
        avatar: null,
        remove_avatar: false,
    });

    useEffect(() => {
        fetch('/api/profile/activity', { headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken() } })
            .then((response) => response.ok ? response.json() : { data: [] })
            .then((payload) => setActivity(payload.data || []))
            .catch(() => setActivity([]));
    }, []);

    const dashboardHref = user.role === 'Client'
        ? '/dashboard/client'
        : user.role === 'Marketing'
            ? '/dashboard/marketing'
            : user.role === 'Accounting'
                ? '/dashboard/accounting'
                : '/dashboard/admin';

    const completion = useMemo(() => {
        const required = [
            data.full_name,
            data.username,
            data.email,
            data.phone,
            data.preferred_contact_method,
            isClient ? data.profile_preferences.default_event_city : true,
        ];
        return Math.round((required.filter(Boolean).length / required.length) * 100);
    }, [data, isClient]);

    const avatarPreview = data.avatar ? URL.createObjectURL(data.avatar) : (data.remove_avatar ? null : user.avatar_url);
    const selectedAvatarLabel = data.avatar
        ? data.avatar.name
        : data.remove_avatar
            ? 'Photo will be removed'
            : user.avatar_url
                ? 'Current profile photo'
                : 'No photo uploaded';

    const chooseAvatar = () => fileInputRef.current?.click();

    const clearAvatar = () => {
        setData('avatar', null);
        setData('remove_avatar', Boolean(user.avatar_url));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const submit = () => {
        if (data.profile_preferences.default_guest_count === '') {
            setData('profile_preferences', { ...data.profile_preferences, default_guest_count: null });
        }

        post('/profile', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setEditing(null);
                reset('current_password', 'new_password', 'new_password_confirmation', 'avatar', 'remove_avatar');
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    };

    const cancelEdit = () => {
        setEditing(null);
        reset();
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const tabs = [
        ['overview', 'Overview'],
        ['personal', 'Personal'],
        ['preferences', isClient ? 'Planning' : 'Preferences'],
        ['security', 'Security'],
        ['activity', 'Activity'],
    ];

    const renderOverview = () => (
        <>
            <PanelHeader
                eyebrow="Account overview"
                title="Profile status"
                text="A short view of what is ready and what still needs attention."
                action={<Link href={dashboardHref} className="rounded-xl border border-[#720101]/15 bg-white px-5 py-3 text-sm font-black text-[#720101] hover:bg-[#fff7e8]">Open dashboard</Link>}
            />
            <div className="grid gap-4 py-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-[#ead8cc] bg-[#fffaf3] p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9f6500]">Readiness</p>
                    <p className="mt-2 text-3xl font-black text-[#720101]">{completion}%</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">{completion === 100 ? 'Profile complete' : 'Complete missing details'}</p>
                </div>
                <div className="rounded-2xl border border-[#ead8cc] bg-white p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Email status</p>
                    <p className="mt-2 text-lg font-black text-slate-950">{verified ? 'Verified' : 'Needs verification'}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{verified ? 'Account notices can reach you.' : 'Verify to keep account recovery reliable.'}</p>
                </div>
                <div className="rounded-2xl border border-[#ead8cc] bg-white p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Preferred contact</p>
                    <p className="mt-2 text-lg font-black text-slate-950">{contactLabels[user.preferred_contact_method || 'email']}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{user.role || 'Account'} workspace</p>
                </div>
            </div>
        </>
    );

    const renderPersonal = () => (
        <>
            <PanelHeader
                eyebrow="Identity and contact"
                title="Personal details"
                text="Keep this tidy so bookings, messages, and staff follow-ups use the right information."
                action={editing !== 'personal' && <button type="button" onClick={() => setEditing('personal')} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-black text-white">Edit details</button>}
            />
            <div className="py-6">
                {editing === 'personal' ? (
                    <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
                        <div>
                            <div className="h-32 w-32 overflow-hidden rounded-[2rem] bg-[#720101] text-white shadow-md">
                                {avatarPreview ? <img src={avatarPreview} alt={`${displayName} profile`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-5xl font-black">{initial}</div>}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) => {
                                    setData('avatar', e.target.files?.[0] || null);
                                    setData('remove_avatar', false);
                                }}
                                className="hidden"
                            />
                            <div className="mt-4 rounded-2xl border border-[#ead8cc] bg-white p-4 shadow-sm">
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9f6500]">Profile photo</p>
                                <p className="mt-1 max-w-full truncate text-sm font-bold text-slate-500">{selectedAvatarLabel}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={chooseAvatar}
                                        className="rounded-xl bg-[#720101] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#5a0101]"
                                    >
                                        {data.avatar ? 'Choose another' : user.avatar_url && !data.remove_avatar ? 'Replace photo' : 'Upload photo'}
                                    </button>
                                    {(data.avatar || user.avatar_url) && (
                                        <button
                                            type="button"
                                            onClick={clearAvatar}
                                            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100"
                                        >
                                            {data.avatar ? 'Clear' : 'Remove'}
                                        </button>
                                    )}
                                </div>
                                <p className="mt-3 text-xs font-semibold leading-5 text-slate-400">JPG, PNG, or WEBP up to 2MB.</p>
                            </div>
                            <FieldError message={errors.avatar} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            <label>
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Full name</span>
                                <input value={data.full_name} onChange={(e) => setData('full_name', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
                                <FieldError message={errors.full_name} />
                            </label>
                            <label>
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Username</span>
                                <input value={data.username} onChange={(e) => setData('username', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
                                <FieldError message={errors.username} />
                            </label>
                            <label>
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Email</span>
                                <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
                                <FieldError message={errors.email} />
                            </label>
                            <label>
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Phone</span>
                                <input value={data.phone} onChange={(e) => setData('phone', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
                                <FieldError message={errors.phone} />
                            </label>
                            <label className="sm:col-span-2 xl:col-span-1">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Preferred contact method</span>
                                <select value={data.preferred_contact_method} onChange={(e) => setData('preferred_contact_method', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">
                                    <option value="email">Email</option>
                                    <option value="phone">Phone</option>
                                    <option value="dashboard">Dashboard messages</option>
                                </select>
                            </label>
                            <div className="sm:col-span-2 xl:col-span-3">
                                <EditActions onCancel={cancelEdit} onSave={submit} processing={processing} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-x-8 xl:grid-cols-[220px_1fr]">
                        <div className="mb-6 lg:mb-0">
                            <div className="h-32 w-32 overflow-hidden rounded-[2rem] bg-[#720101] text-white shadow-md">
                                {user.avatar_url ? <img src={user.avatar_url} alt={`${displayName} profile`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-5xl font-black">{initial}</div>}
                            </div>
                        </div>
                        <div className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
                            <InfoRow label="Full name" value={user.full_name} />
                            <InfoRow label="Username" value={user.username} />
                            <InfoRow label="Email" value={user.email} />
                            <InfoRow label="Phone" value={user.phone} />
                            <InfoRow label="Preferred contact" value={contactLabels[user.preferred_contact_method || 'email']} />
                            <InfoRow label="Verification" value={verified ? 'Verified email' : 'Verification needed'} />
                        </div>
                    </div>
                )}
            </div>
        </>
    );

    const renderPreferences = () => (
        <>
            <PanelHeader
                eyebrow={isClient ? 'Planning defaults' : 'Communication'}
                title={isClient ? 'Planning preferences' : 'Notification preferences'}
                text={isClient ? 'These defaults help future inquiries and bookings start with better context.' : 'Choose which staff notifications should actively reach you.'}
                action={editing !== 'preferences' && <button type="button" onClick={() => setEditing('preferences')} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-black text-white">Edit preferences</button>}
            />
            <div className="py-6">
                {editing === 'preferences' ? (
                    <div className="space-y-6">
                        {isClient && (
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                <label>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Default event city</span>
                                    <input value={data.profile_preferences.default_event_city} onChange={(e) => setData('profile_preferences', { ...data.profile_preferences, default_event_city: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
                                </label>
                                <label>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Usual guest count</span>
                                    <input type="number" min="1" value={data.profile_preferences.default_guest_count || ''} onChange={(e) => setData('profile_preferences', { ...data.profile_preferences, default_guest_count: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
                                </label>
                                <label className="sm:col-span-2 xl:col-span-3">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Planning notes</span>
                                    <textarea rows={4} value={data.profile_preferences.planning_notes} onChange={(e) => setData('profile_preferences', { ...data.profile_preferences, planning_notes: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
                                </label>
                            </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {Object.entries(notificationLabels).map(([key, label]) => (
                                <button key={key} type="button" onClick={() => setData('notification_preferences', { ...data.notification_preferences, [key]: !data.notification_preferences[key] })} className={`rounded-2xl border px-4 py-4 text-left text-sm font-black ${data.notification_preferences[key] ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                    {label}
                                    <span className="ml-2 text-xs uppercase">{data.notification_preferences[key] ? 'On' : 'Off'}</span>
                                </button>
                            ))}
                        </div>
                        <EditActions onCancel={cancelEdit} onSave={submit} processing={processing} />
                    </div>
                ) : (
                    <div className="grid gap-8 xl:grid-cols-[1fr_1.25fr]">
                        {isClient && (
                            <div>
                                <InfoRow label="Default city" value={profilePrefs.default_event_city} />
                                <InfoRow label="Usual pax" value={profilePrefs.default_guest_count} />
                                <InfoRow label="Planning notes" value={profilePrefs.planning_notes} />
                            </div>
                        )}
                        <div>
                            {Object.entries(notificationLabels).map(([key, label]) => (
                                <InfoRow key={key} label={label} value={(notificationPrefs[key] ?? true) ? 'On' : 'Off'} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );

    const renderSecurity = () => (
        <>
            <PanelHeader
                eyebrow="Security"
                title="Password and verification"
                text="Password changes are isolated here so you can update security without touching your profile details."
                action={editing !== 'security' && <button type="button" onClick={() => setEditing('security')} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-black text-white">Change password</button>}
            />
            <div className="py-6">
                {editing === 'security' ? (
                    <div className="rounded-2xl border border-[#ead8cc] bg-[#fffaf3] p-5">
                        <div className="grid gap-4 lg:grid-cols-3">
                            <label>
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Current password</span>
                                <input type={showPasswords ? 'text' : 'password'} value={data.current_password} onChange={(e) => setData('current_password', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold" />
                                <FieldError message={errors.current_password} />
                            </label>
                            <label>
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">New password</span>
                                <input type={showPasswords ? 'text' : 'password'} value={data.new_password} onChange={(e) => setData('new_password', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold" />
                                <FieldError message={errors.new_password} />
                            </label>
                            <label>
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Confirm password</span>
                                <input type={showPasswords ? 'text' : 'password'} value={data.new_password_confirmation} onChange={(e) => setData('new_password_confirmation', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold" />
                            </label>
                        </div>
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#ead8cc] pt-4">
                            <button type="button" onClick={() => setShowPasswords((value) => !value)} className="rounded-xl border border-[#720101]/15 bg-white px-4 py-2.5 text-sm font-black text-[#720101] hover:bg-[#fff7e8]">
                                {showPasswords ? 'Hide passwords' : 'Show passwords'}
                            </button>
                            <EditActions onCancel={cancelEdit} onSave={submit} processing={processing} saveLabel="Save password" />
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-3">
                        <DetailTile
                            eyebrow="Email verification"
                            title={verified ? 'Verified' : 'Needs verification'}
                            text={verified ? 'Your account email can receive recovery and booking notices.' : 'Verify your email to keep account recovery and notifications reliable.'}
                            tone={verified ? 'success' : 'warm'}
                        />
                        <DetailTile
                            eyebrow="Password rule"
                            title="8+ characters"
                            text="Password changes require your current password and confirmation."
                            tone="neutral"
                        />
                        <DetailTile
                            eyebrow="Security scope"
                            title="Isolated updates"
                            text="Changing your password here will not alter profile, booking, or contact details."
                            tone="warm"
                        />
                    </div>
                )}
            </div>
        </>
    );

    const renderActivity = () => (
        <>
            <PanelHeader eyebrow="Account history" title="Recent profile activity" text="A short audit trail of profile, contact, and security updates." />
            <div className="py-6">
                {activity.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#ead8cc] bg-[#fffaf3] p-8 text-center">
                        <p className="font-black text-slate-950">No profile changes recorded yet.</p>
                        <p className="mt-2 text-sm font-semibold text-slate-500">Updates you make from this page will appear here.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[#f1e2d8]">
                        {activity.map((item) => (
                            <div key={item.id} className="py-4">
                                <p className="font-black text-slate-950">Profile updated</p>
                                <p className="mt-1 text-sm font-semibold text-slate-500">
                                    {(item.metadata?.changed_fields || []).join(', ') || 'Account details'} / {new Date(item.created_at).toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );

    return (
        <DefaultLayout>
            <Head title="Profile | Eloquente Catering">
                <meta name="description" content="Manage your Eloquente Catering profile, contact details, preferences, password, and account activity." />
            </Head>
            <div className="min-h-screen bg-[#f7f4ee] text-slate-950">
                <ClientNavbar user={user} activePath="/profile" />
                <main className="mx-auto max-w-[1500px] px-4 pb-12 pt-24 sm:px-6 lg:px-8">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9f6500]">Eloquente account</p>
                            <h1 className="mt-2 font-display text-3xl font-bold text-slate-950 sm:text-4xl">Profile</h1>
                        </div>
                        <Link href={dashboardHref} className="w-fit rounded-xl border border-[#720101]/15 bg-white px-4 py-2.5 text-sm font-black text-[#720101] hover:bg-[#fff7e8]">
                            Back to dashboard
                        </Link>
                    </div>

                    {flash?.message && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">{flash.message}</div>}

                    <section className="overflow-hidden rounded-[1.5rem] border border-[#ead8cc] bg-white shadow-sm">
                        <div className="grid gap-5 bg-[#171412] p-5 text-white lg:grid-cols-[1.4fr_1fr_1fr] lg:items-center">
                            <div className="flex min-w-0 items-center gap-4">
                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#720101] ring-4 ring-white/10">
                                    {user.avatar_url ? <img src={user.avatar_url} alt={`${displayName} profile`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl font-black">{initial}</div>}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="truncate text-2xl font-black">{displayName}</h2>
                                    <p className="mt-1 truncate text-sm font-bold text-white/60">@{user.username} / {user.role || 'Account'}</p>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-white/55">
                                    <span>Readiness</span>
                                    <span>{completion}%</span>
                                </div>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full rounded-full bg-[#f0aa0b]" style={{ width: `${completion}%` }} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-xl bg-white/10 px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/45">Email</p>
                                    <p className="mt-1 font-black">{verified ? 'Verified' : 'Needs review'}</p>
                                </div>
                                <div className="rounded-xl bg-white/10 px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/45">Contact</p>
                                    <p className="mt-1 font-black">{contactLabels[user.preferred_contact_method || 'email']}</p>
                                </div>
                            </div>
                        </div>
                        {!verified && (
                            <div className="border-b border-[#ead8cc] bg-[#fff7d6] px-5 py-3">
                                <p className="text-sm font-bold text-[#9f6500]">Email verification is needed for account recovery and booking notices.</p>
                            </div>
                        )}
                    </section>

                    <nav className="mt-5 flex gap-5 overflow-x-auto border-b border-[#ead8cc]">
                        {tabs.map(([id, label]) => <TabButton key={id} active={activeTab === id} onClick={() => { setActiveTab(id); setEditing(null); }}>{label}</TabButton>)}
                    </nav>

                    <section className="mt-6 overflow-hidden rounded-[1.5rem] border border-[#ead8cc] bg-white px-5 shadow-sm sm:px-6">
                        {activeTab === 'overview' && renderOverview()}
                        {activeTab === 'personal' && renderPersonal()}
                        {activeTab === 'preferences' && renderPreferences()}
                        {activeTab === 'security' && renderSecurity()}
                        {activeTab === 'activity' && renderActivity()}
                    </section>

                    {isDirty && editing && (
                        <div className="fixed bottom-5 left-1/2 z-30 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-[#ead8cc] bg-white/95 px-5 py-4 shadow-2xl backdrop-blur">
                            <p className="text-center text-sm font-black text-slate-700">You have unsaved profile changes.</p>
                        </div>
                    )}
                </main>
            </div>
        </DefaultLayout>
    );
};

export default ProfileEdit;
