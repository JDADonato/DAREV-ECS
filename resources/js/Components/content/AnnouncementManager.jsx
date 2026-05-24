import React, { useEffect, useMemo, useState } from 'react';
import {
    Archive,
    CalendarDays,
    Eye,
    Filter,
    Image,
    Link as LinkIcon,
    Mail,
    Megaphone,
    Pencil,
    Save,
    Search,
    Send,
    Sparkles,
    Users,
} from 'lucide-react';

const emptyForm = {
    title: '',
    summary: '',
    body: '',
    type: 'general',
    visibility: 'all_customers',
    visibility_roles: ['Client'],
    specific_user_ids: '',
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

const visibilityLabels = {
    all_customers: 'Homepage and all customers',
    active_clients: 'Active clients only',
    specific_roles: 'Selected roles',
    specific_users: 'Selected users',
};

const statusStyles = {
    draft: 'bg-slate-100 text-slate-700',
    scheduled: 'bg-indigo-100 text-indigo-700',
    published: 'bg-emerald-100 text-emerald-700',
    archived: 'bg-stone-200 text-stone-700',
};

const roleOptions = ['Client', 'Marketing', 'Accounting', 'Admin'];
const statusOptions = ['all', 'draft', 'published', 'scheduled', 'archived'];
const typeOptions = ['all', ...Object.keys(typeLabels)];

const formatDate = (value) => (value ? new Date(value).toLocaleString() : 'Not set');
const isFutureDate = (value) => value && new Date(value).getTime() > Date.now();
const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const imageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) return path;
    return `/storage/${path.replace(/^\/+/, '')}`;
};

const firstValidationMessage = (payload) => {
    if (payload?.errors) {
        const first = Object.values(payload.errors).flat()[0];
        if (first) return first;
    }

    return payload?.message || 'Request failed. Please check the announcement details.';
};

const AnnouncementManager = ({ variant = 'marketing', user }) => {
    const [announcements, setAnnouncements] = useState([]);
    const [filters, setFilters] = useState({ status: 'all', type: 'all', search: '' });
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [previewId, setPreviewId] = useState(null);
    const [testEmail, setTestEmail] = useState(user?.email || '');

    const shellClass = variant === 'admin' ? 'admin-card' : 'marketing-panel';
    const primaryClass = variant === 'admin'
        ? 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#720101] px-4 py-3 text-sm font-black text-white transition hover:bg-[#5a0101] disabled:opacity-60'
        : 'marketing-primary-btn inline-flex items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-60';

    const filteredItems = useMemo(() => {
        const search = filters.search.trim().toLowerCase();

        return announcements.filter((item) => {
            const matchesStatus = filters.status === 'all' || item.status === filters.status;
            const matchesType = filters.type === 'all' || item.type === filters.type;
            const matchesSearch = !search || [item.title, item.summary, item.body]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(search));

            return matchesStatus && matchesType && matchesSearch;
        });
    }, [filters, announcements]);

    const stats = useMemo(() => {
        return announcements.reduce((acc, item) => {
            acc.total += 1;
            acc[item.status] = (acc[item.status] || 0) + 1;
            acc.homepage += item.status === 'published' && item.visibility === 'all_customers' ? 1 : 0;
            acc.sent += Number(item.sent_count || 0);
            acc.read += Number(item.read_count || 0);
            return acc;
        }, { total: 0, draft: 0, scheduled: 0, published: 0, archived: 0, homepage: 0, sent: 0, read: 0 });
    }, [announcements]);

    const selectedPreview = announcements.find((item) => item.id === previewId) || null;
    const preview = editingId ? form : (selectedPreview || form);
    const publishLabel = isFutureDate(form.starts_at) ? 'Schedule Publish' : 'Publish Now';

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const requestJson = async (url, options = {}) => {
        const response = await fetch(url, {
            ...options,
            headers: {
                Accept: 'application/json',
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                'X-CSRF-TOKEN': csrfToken(),
                ...(options.headers || {}),
            },
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(firstValidationMessage(payload));
        }

        return payload;
    };

    const flash = (text, type = 'success') => {
        setMessage({ text, type });
        window.setTimeout(() => setMessage(null), 3200);
    };

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            const payload = await requestJson('/api/admin/announcements');
            setAnnouncements(payload);
        } catch (error) {
            flash(error.message || 'Unable to load announcements.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setForm(emptyForm);
        setEditingId(null);
        setPreviewId(null);
    };

    const updateField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setForm({
            title: item.title || '',
            summary: item.summary || '',
            body: item.body || '',
            type: item.type || 'general',
            visibility: item.visibility || 'all_customers',
            visibility_roles: item.visibility_roles?.length ? item.visibility_roles : ['Client'],
            specific_user_ids: Array.isArray(item.specific_user_ids) ? item.specific_user_ids.join(', ') : '',
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

    const payloadFromForm = () => ({
        ...form,
        status: form.status || 'draft',
        summary: form.summary || null,
        body: form.body || null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        email_subject: form.email_subject || null,
        email_body: form.email_body || null,
        cta_label: form.cta_label || null,
        cta_url: form.cta_url || null,
        image_path: form.image_path || null,
        visibility_roles: form.visibility === 'specific_roles' ? form.visibility_roles : [],
        specific_user_ids: form.visibility === 'specific_users'
            ? form.specific_user_ids.split(',').map((value) => Number(value.trim())).filter(Boolean)
            : [],
    });

    const saveAnnouncement = async () => {
        const url = editingId ? `/api/admin/announcements/${editingId}` : '/api/admin/announcements';
        const method = editingId ? 'PATCH' : 'POST';
        return requestJson(url, { method, body: JSON.stringify(payloadFromForm()) });
    };

    const submit = async (event, mode = 'draft') => {
        event.preventDefault();
        setSaving(true);

        try {
            const saved = await saveAnnouncement();

            if (mode === 'publish') {
                await requestJson(`/api/admin/announcements/${saved.id}/publish`, { method: 'POST' });
                flash(isFutureDate(form.starts_at) ? 'Announcement scheduled for the homepage.' : 'Announcement published to customers.');
            } else {
                flash(editingId ? 'Announcement updated.' : 'Announcement saved as draft.');
            }

            resetForm();
            await fetchAnnouncements();
        } catch (error) {
            flash(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const runAction = async (item, actionName) => {
        setSaving(true);
        try {
            await requestJson(`/api/admin/announcements/${item.id}/${actionName}`, { method: 'POST' });
            flash(actionName === 'publish' ? 'Announcement published.' : 'Announcement archived.');
            await fetchAnnouncements();
        } catch (error) {
            flash(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const sendTest = async (item) => {
        if (!testEmail) {
            flash('Enter a test email first.', 'error');
            return;
        }

        setSaving(true);
        try {
            await requestJson(`/api/admin/announcements/${item.id}/send-test`, {
                method: 'POST',
                body: JSON.stringify({ email: testEmail }),
            });
            flash('Test email queued.');
        } catch (error) {
            flash(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            {message && (
                <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                    {message.text}
                </div>
            )}

            <section className={`${shellClass} overflow-hidden`}>
                <div className="grid gap-0 lg:grid-cols-[1fr_400px]">
                    <div className="p-5 lg:p-6">
                        <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#720101]/10 text-[#720101]">
                                <Megaphone size={22} />
                            </span>
                            <div>
                                <p className="marketing-kicker">Announcement CMS</p>
                                <h2 className="mt-1 text-2xl font-black text-slate-950">Customer homepage publishing desk</h2>
                            </div>
                        </div>
                        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                            Create announcements for the public homepage, client dashboard, and optional email delivery. Published announcements with all-customer visibility appear on the website homepage.
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                            {[
                                ['Drafts', stats.draft],
                                ['Published', stats.published],
                                ['Homepage', stats.homepage],
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
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#720101]">
                            <Eye size={15} />
                            Customer Preview
                        </div>
                        <div className="mt-3 overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm">
                            {imageUrl(preview.image_path) && (
                                <img src={imageUrl(preview.image_path)} alt="" className="h-36 w-full object-cover" />
                            )}
                            <div className="p-5">
                                <span className="rounded-full bg-[#720101]/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#720101]">
                                    {typeLabels[preview.type] || 'General'}
                                </span>
                                <h3 className="mt-4 text-xl font-black text-slate-950">{preview.title || 'Announcement title'}</h3>
                                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{preview.summary || preview.body || 'A short customer-facing summary will appear here.'}</p>
                                {preview.cta_label && (
                                    <span className="mt-4 inline-flex rounded-xl bg-[#f0aa0b] px-4 py-2 text-sm font-black text-[#1a1a1a]">
                                        {preview.cta_label}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[460px_1fr]">
                <form onSubmit={(event) => submit(event, 'draft')} className={`${shellClass} p-5 lg:p-6`}>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="marketing-kicker">{editingId ? 'Editing' : 'Composer'}</p>
                            <h3 className="mt-1 text-xl font-black text-slate-950">{editingId ? 'Update announcement' : 'New announcement'}</h3>
                        </div>
                        {editingId && (
                            <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-50">
                                New
                            </button>
                        )}
                    </div>

                    <div className="mt-5 space-y-4">
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400">
                            Title
                            <input required value={form.title} onChange={(event) => updateField('title', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10" />
                        </label>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400">
                            Short summary
                            <textarea value={form.summary} onChange={(event) => updateField('summary', event.target.value)} rows={2} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold normal-case tracking-normal outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10" />
                        </label>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400">
                            Full announcement
                            <textarea value={form.body} onChange={(event) => updateField('body', event.target.value)} rows={5} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold normal-case tracking-normal outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10" />
                        </label>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                                Type
                                <select value={form.type} onChange={(event) => updateField('type', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none">
                                    {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </label>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                                Audience
                                <select value={form.visibility} onChange={(event) => updateField('visibility', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none">
                                    {Object.entries(visibilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </label>
                        </div>

                        {form.visibility === 'specific_roles' && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                                    <Users size={14} />
                                    Roles
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {roleOptions.map((role) => (
                                        <label key={role} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={form.visibility_roles.includes(role)}
                                                onChange={(event) => {
                                                    const next = event.target.checked
                                                        ? [...form.visibility_roles, role]
                                                        : form.visibility_roles.filter((item) => item !== role);
                                                    updateField('visibility_roles', next);
                                                }}
                                            />
                                            {role}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {form.visibility === 'specific_users' && (
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400">
                                User IDs
                                <input value={form.specific_user_ids} onChange={(event) => updateField('specific_user_ids', event.target.value)} placeholder="Example: 12, 18, 27" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none" />
                            </label>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                                Starts
                                <input type="datetime-local" value={form.starts_at} onChange={(event) => updateField('starts_at', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none" />
                            </label>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                                Ends
                                <input type="datetime-local" value={form.ends_at} onChange={(event) => updateField('ends_at', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none" />
                            </label>
                        </div>

                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400">
                            Image URL or storage path
                            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                                <Image size={16} className="text-slate-400" />
                                <input value={form.image_path} onChange={(event) => updateField('image_path', event.target.value)} placeholder="https://... or announcements/banner.jpg" className="w-full text-sm font-bold outline-none" />
                            </div>
                        </label>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                                CTA label
                                <input value={form.cta_label} onChange={(event) => updateField('cta_label', event.target.value)} placeholder="Book now" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none" />
                            </label>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                                CTA link
                                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                                    <LinkIcon size={16} className="text-slate-400" />
                                    <input value={form.cta_url} onChange={(event) => updateField('cta_url', event.target.value)} placeholder="/book" className="w-full text-sm font-bold outline-none" />
                                </div>
                            </label>
                        </div>

                        <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <span className="flex items-center gap-2 text-sm font-black text-slate-700">
                                <Mail size={16} />
                                Send as email on publish
                            </span>
                            <input type="checkbox" checked={form.send_email} onChange={(event) => updateField('send_email', event.target.checked)} className="h-5 w-5" />
                        </label>

                        {form.send_email && (
                            <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                                <input value={form.email_subject} onChange={(event) => updateField('email_subject', event.target.value)} placeholder="Email subject" className="w-full rounded-xl border border-amber-100 px-4 py-3 text-sm font-bold outline-none" />
                                <textarea value={form.email_body} onChange={(event) => updateField('email_body', event.target.value)} placeholder="Email body. Leave blank to reuse announcement body." rows={3} className="w-full rounded-xl border border-amber-100 px-4 py-3 text-sm font-semibold outline-none" />
                            </div>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                                <Save size={17} />
                                {editingId ? 'Save Changes' : 'Save Draft'}
                            </button>
                            <button type="button" disabled={saving} onClick={(event) => submit(event, 'publish')} className={primaryClass}>
                                <Send size={17} />
                                {saving ? 'Saving...' : publishLabel}
                            </button>
                        </div>
                    </div>
                </form>

                <section className={`${shellClass} overflow-hidden`}>
                    <div className="border-b border-slate-100 p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="marketing-kicker">Publishing Desk</p>
                                <h3 className="mt-1 text-xl font-black text-slate-950">Announcements</h3>
                            </div>
                            <button onClick={() => setFiltersOpen((open) => !open)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#720101]/15 bg-[#fffaf3] px-4 py-3 text-xs font-black uppercase tracking-wider text-[#720101] transition hover:border-[#720101]/30">
                                <Filter size={16} />
                                Filters
                            </button>
                        </div>

                        {filtersOpen && (
                            <div className="mt-4 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 lg:grid-cols-[1fr_auto_auto]">
                                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                    <Search size={16} className="text-slate-400" />
                                    <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search title or message" className="w-full text-sm font-bold outline-none" />
                                </label>
                                <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none">
                                    {statusOptions.map((status) => <option key={status} value={status}>{status === 'all' ? 'All statuses' : status}</option>)}
                                </select>
                                <select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none">
                                    {typeOptions.map((type) => <option key={type} value={type}>{type === 'all' ? 'All types' : typeLabels[type]}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-sm font-bold text-slate-400">Loading announcements...</div>
                    ) : filteredItems.length === 0 ? (
                        <div className="p-8 text-center text-sm font-bold text-slate-400">No announcements match these filters.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredItems.map((item) => {
                                const showsOnHomepage = item.status === 'published' && item.visibility === 'all_customers';

                                return (
                                    <article key={item.id} className="p-5 transition hover:bg-slate-50">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${statusStyles[item.status] || statusStyles.draft}`}>{item.status}</span>
                                                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black uppercase text-amber-800">{typeLabels[item.type] || item.type}</span>
                                                    {showsOnHomepage && <span className="rounded-full bg-[#720101]/10 px-2.5 py-1 text-[11px] font-black uppercase text-[#720101]">Homepage</span>}
                                                </div>
                                                <h4 className="truncate text-lg font-black text-slate-950">{item.title}</h4>
                                                <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-slate-500">{item.summary || item.body || 'No summary yet.'}</p>
                                                <div className="mt-3 flex flex-wrap gap-3 text-xs font-black uppercase tracking-wider text-slate-400">
                                                    <span className="inline-flex items-center gap-1"><CalendarDays size={13} /> {formatDate(item.starts_at)}</span>
                                                    <span>{item.sent_count || 0} sent</span>
                                                    <span>{item.failed_count || 0} failed</span>
                                                    <span>{item.read_count || 0} reads</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 lg:justify-end">
                                                <button onClick={() => setPreviewId(item.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
                                                    <Eye size={14} />
                                                    Preview
                                                </button>
                                                <button onClick={() => startEdit(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
                                                    <Pencil size={14} />
                                                    Edit
                                                </button>
                                                {item.send_email && (
                                                    <button disabled={saving} onClick={() => sendTest(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 hover:bg-amber-100">
                                                        <Mail size={14} />
                                                        Test
                                                    </button>
                                                )}
                                                {item.status !== 'published' && (
                                                    <button disabled={saving} onClick={() => runAction(item, 'publish')} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">
                                                        <Send size={14} />
                                                        Publish
                                                    </button>
                                                )}
                                                {item.status === 'published' && (
                                                    <button disabled={saving} onClick={() => runAction(item, 'archive')} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-black text-white hover:bg-slate-900">
                                                        <Archive size={14} />
                                                        Archive
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    <div className="border-t border-slate-100 bg-[#fffaf3] p-5">
                        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                            <div className="flex items-start gap-3">
                                <Sparkles size={18} className="mt-0.5 text-[#720101]" />
                                <p className="text-sm font-semibold leading-6 text-slate-600">
                                    Homepage visibility uses published announcements with the audience set to "Homepage and all customers". Targeted announcements remain available to authenticated customers only.
                                </p>
                            </div>
                            <input value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="Test email address" className="rounded-xl border border-amber-100 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#720101]" />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AnnouncementManager;
