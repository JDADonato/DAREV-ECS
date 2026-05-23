import React, { useEffect, useMemo, useState } from 'react';

const emptyForm = {
    title: '',
    summary: '',
    body: '',
    type: 'general',
    visibility: 'all_customers',
    status: 'draft',
    starts_at: '',
    ends_at: '',
    send_email: false,
    email_subject: '',
    email_body: '',
    cta_label: '',
    cta_url: '',
    image_path: '',
};

const typeLabels = {
    general: 'General',
    promo: 'Promo',
    event_reminder: 'Event Reminder',
    holiday_advisory: 'Holiday Advisory',
    menu_update: 'Menu Update',
    service_notice: 'Service Notice',
    urgent: 'Urgent',
};

const statusStyles = {
    draft: 'bg-slate-100 text-slate-700',
    scheduled: 'bg-indigo-100 text-indigo-700',
    published: 'bg-emerald-100 text-emerald-700',
    archived: 'bg-stone-200 text-stone-700',
};

const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Not set';

const AnnouncementManager = ({ variant = 'marketing', user }) => {
    const [announcements, setAnnouncements] = useState([]);
    const [activeStatus, setActiveStatus] = useState('all');
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [previewId, setPreviewId] = useState(null);

    const isAdmin = user?.role === 'Admin';
    const shellClass = variant === 'admin' ? 'admin-card' : 'marketing-panel';
    const primaryClass = variant === 'admin' ? 'rounded-xl bg-[#720101] px-4 py-3 text-sm font-black text-white hover:bg-[#5a0101] disabled:opacity-60' : 'marketing-primary-btn px-4 py-3 text-sm disabled:opacity-60';

    const visibleItems = useMemo(() => {
        if (activeStatus === 'all') return announcements;
        return announcements.filter((item) => item.status === activeStatus);
    }, [activeStatus, announcements]);

    const stats = useMemo(() => {
        return announcements.reduce((acc, item) => {
            acc.total += 1;
            acc[item.status] = (acc[item.status] || 0) + 1;
            acc.sent += Number(item.sent_count || 0);
            acc.read += Number(item.read_count || 0);
            return acc;
        }, { total: 0, draft: 0, scheduled: 0, published: 0, archived: 0, sent: 0, read: 0 });
    }, [announcements]);

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const flash = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 2800);
    };

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/announcements');
            if (response.ok) {
                setAnnouncements(await response.json());
            }
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setForm(emptyForm);
        setEditingId(null);
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setForm({
            title: item.title || '',
            summary: item.summary || '',
            body: item.body || '',
            type: item.type || 'general',
            visibility: item.visibility || 'all_customers',
            status: item.status || 'draft',
            starts_at: item.starts_at ? item.starts_at.slice(0, 16) : '',
            ends_at: item.ends_at ? item.ends_at.slice(0, 16) : '',
            send_email: Boolean(item.send_email),
            email_subject: item.email_subject || '',
            email_body: item.email_body || '',
            cta_label: item.cta_label || '',
            cta_url: item.cta_url || '',
            image_path: item.image_path || '',
        });
        setPreviewId(item.id);
    };

    const submit = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            const url = editingId ? `/api/admin/announcements/${editingId}` : '/api/admin/announcements';
            const response = await fetch(url, {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(form),
            });

            if (response.ok) {
                flash(editingId ? 'Announcement updated.' : 'Announcement drafted.');
                resetForm();
                fetchAnnouncements();
            } else {
                flash('Please check the announcement details.', 'error');
            }
        } finally {
            setSaving(false);
        }
    };

    const action = async (item, actionName) => {
        setSaving(true);
        try {
            const response = await fetch(`/api/admin/announcements/${item.id}/${actionName}`, {
                method: 'POST',
                headers: { Accept: 'application/json' },
            });
            if (response.ok) {
                flash(actionName === 'publish' ? 'Announcement published.' : 'Announcement archived.');
                fetchAnnouncements();
            } else {
                flash('Action failed. Please try again.', 'error');
            }
        } finally {
            setSaving(false);
        }
    };

    const preview = announcements.find((item) => item.id === previewId) || null;

    return (
        <div className="space-y-5">
            {message && (
                <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                    {message.text}
                </div>
            )}

            <section className={`${shellClass} overflow-hidden`}>
                <div className="grid gap-0 lg:grid-cols-[1fr_380px]">
                    <div className="p-5 lg:p-6">
                        <p className="marketing-kicker">Announcement CMS</p>
                        <h2 className="mt-1 text-2xl font-black text-slate-950">Create customer updates that feel intentional.</h2>
                        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">Compose dashboard notices, promos, advisories, and optional email messages from one place.</p>
                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[
                                ['Drafts', stats.draft],
                                ['Published', stats.published],
                                ['Emails Sent', stats.sent],
                                ['Reads', stats.read],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                                    <strong className="mt-1 block text-2xl font-black text-slate-950">{value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="border-t border-slate-100 bg-[#fffaf3] p-5 lg:border-l lg:border-t-0">
                        <p className="text-xs font-black uppercase tracking-widest text-[#720101]">Live Preview</p>
                        <div className="mt-3 rounded-3xl border border-amber-100 bg-white p-5 shadow-sm">
                            <span className="rounded-full bg-[#720101]/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#720101]">
                                {typeLabels[preview?.type] || typeLabels[form.type]}
                            </span>
                            <h3 className="mt-4 text-xl font-black text-slate-950">{preview?.title || form.title || 'Announcement title'}</h3>
                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{preview?.summary || form.summary || 'A short customer-facing summary will appear here.'}</p>
                            {(preview?.cta_label || form.cta_label) && (
                                <span className="mt-4 inline-flex rounded-xl bg-[#f0aa0b] px-4 py-2 text-sm font-black text-[#1a1a1a]">
                                    {preview?.cta_label || form.cta_label}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
                <form onSubmit={submit} className={`${shellClass} p-5 lg:p-6`}>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="marketing-kicker">{editingId ? 'Editing' : 'Composer'}</p>
                            <h3 className="mt-1 text-xl font-black text-slate-950">{editingId ? 'Update announcement' : 'New announcement'}</h3>
                        </div>
                        {editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-50">Clear</button>}
                    </div>

                    <div className="mt-5 space-y-4">
                        <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10" />
                        <textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Short summary for cards and banners" rows={2} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10" />
                        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Full announcement body" rows={5} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10" />

                        <div className="grid grid-cols-2 gap-3">
                            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none">
                                {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                            <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none">
                                <option value="all_customers">All customers</option>
                                <option value="active_clients">Active clients</option>
                                <option value="specific_roles">Specific roles</option>
                            </select>
                        </div>

                        {form.visibility === 'specific_roles' && (
                            <select multiple value={form.visibility_roles || []} onChange={(e) => setForm({ ...form, visibility_roles: Array.from(e.target.selectedOptions).map(option => option.value) })} className="h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none">
                                {['Client', 'Marketing', 'Accounting', 'Admin'].map(role => <option key={role} value={role}>{role}</option>)}
                            </select>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                                Starts
                                <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none" />
                            </label>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                                Ends
                                <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none" />
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} placeholder="CTA label" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none" />
                            <input value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} placeholder="CTA URL" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none" />
                        </div>

                        <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <span className="text-sm font-black text-slate-700">Send as email on publish</span>
                            <input type="checkbox" checked={form.send_email} onChange={(e) => setForm({ ...form, send_email: e.target.checked })} className="h-5 w-5" />
                        </label>

                        {form.send_email && (
                            <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                                <input value={form.email_subject} onChange={(e) => setForm({ ...form, email_subject: e.target.value })} placeholder="Email subject" className="w-full rounded-xl border border-amber-100 px-4 py-3 text-sm font-bold outline-none" />
                                <textarea value={form.email_body} onChange={(e) => setForm({ ...form, email_body: e.target.value })} placeholder="Email body. Leave blank to reuse announcement body." rows={3} className="w-full rounded-xl border border-amber-100 px-4 py-3 text-sm font-semibold outline-none" />
                            </div>
                        )}

                        <button disabled={saving} className={primaryClass}>{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Save Draft'}</button>
                    </div>
                </form>

                <section className={`${shellClass} overflow-hidden`}>
                    <div className="border-b border-slate-100 p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="marketing-kicker">Publishing Desk</p>
                                <h3 className="mt-1 text-xl font-black text-slate-950">Announcements</h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {['all', 'draft', 'published', 'scheduled', 'archived'].map(status => (
                                    <button key={status} onClick={() => setActiveStatus(status)} className={`rounded-full px-3 py-2 text-xs font-black capitalize ${activeStatus === status ? 'bg-[#720101] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{status}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-sm font-bold text-slate-400">Loading announcements...</div>
                    ) : visibleItems.length === 0 ? (
                        <div className="p-8 text-center text-sm font-bold text-slate-400">No announcements in this view.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {visibleItems.map((item) => (
                                <article key={item.id} className="p-5 transition hover:bg-slate-50">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${statusStyles[item.status] || statusStyles.draft}`}>{item.status}</span>
                                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black uppercase text-amber-800">{typeLabels[item.type] || item.type}</span>
                                                <span className="text-xs font-bold text-slate-400">{formatDate(item.starts_at)}</span>
                                            </div>
                                            <h4 className="truncate text-lg font-black text-slate-950">{item.title}</h4>
                                            <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-slate-500">{item.summary || item.body || 'No summary yet.'}</p>
                                            <div className="mt-3 flex flex-wrap gap-3 text-xs font-black uppercase tracking-wider text-slate-400">
                                                <span>{item.sent_count || 0} sent</span>
                                                <span>{item.failed_count || 0} failed</span>
                                                <span>{item.read_count || 0} reads</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 lg:justify-end">
                                            <button onClick={() => setPreviewId(item.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Preview</button>
                                            <button onClick={() => startEdit(item)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Edit</button>
                                            {item.status !== 'published' && <button disabled={saving} onClick={() => action(item, 'publish')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">Publish</button>}
                                            {item.status === 'published' && <button disabled={saving} onClick={() => action(item, 'archive')} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-black text-white hover:bg-slate-900">Archive</button>}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default AnnouncementManager;
