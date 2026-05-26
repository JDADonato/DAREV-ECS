import React, { useEffect, useMemo, useState } from 'react';
import StaffDrawer from '../staff/StaffDrawer';
import StaffPagination from '../staff/StaffPagination';

const readinessLabels = {
    payment: 'Payment',
    menu: 'Menu',
    venue: 'Venue',
    headcount: 'Headcount',
    tasting: 'Tasting',
    customer_messages: 'Messages',
};

const formatDate = (value) => {
    if (!value) return 'Date TBD';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const eventName = (booking) => booking?.event_name || booking?.event_type || `Booking #${booking?.id}`;

const readinessClass = (ready) => ready ? 'staff-status staff-status-good' : 'staff-status staff-status-danger';

const summarizeReadiness = (readiness = {}) => {
    const entries = Object.entries(readiness);
    const blocked = entries.filter(([, ready]) => !ready);
    return {
        total: entries.length,
        ready: entries.length - blocked.length,
        blocked,
    };
};

const PreparationBoard = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingTaskId, setUpdatingTaskId] = useState(null);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [attentionFilter, setAttentionFilter] = useState('all');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [selectedBookingId, setSelectedBookingId] = useState(null);

    const fetchBoard = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const response = await fetch('/api/operations/preparation-board', {
                headers: { Accept: 'application/json' },
            });
            const data = await response.json().catch(() => []);
            if (!response.ok) throw new Error(data.error || 'Could not load preparation board.');
            setRows(Array.isArray(data) ? data : []);
            setError('');
        } catch (err) {
            console.error(err);
            setError(err.message || 'Could not load preparation board.');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchBoard();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [query, attentionFilter, departmentFilter, perPage]);

    const filteredRows = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return rows.filter((row) => {
            const booking = row.booking || {};
            const flags = row.attention_flags || [];
            const tasks = row.tasks || [];
            const haystack = [
                booking.id,
                booking.event_name,
                booking.event_type,
                booking.client_full_name,
                booking.client_email,
                booking.status,
            ].join(' ').toLowerCase();

            if (needle && !haystack.includes(needle)) return false;
            if (attentionFilter === 'needs_attention' && flags.length === 0) return false;
            if (attentionFilter !== 'all' && attentionFilter !== 'needs_attention' && row.readiness?.[attentionFilter] !== false) return false;
            if (departmentFilter !== 'all' && !tasks.some((task) => task.department === departmentFilter)) return false;

            return true;
        });
    }, [rows, query, attentionFilter, departmentFilter]);

    const pagedRows = useMemo(() => {
        const start = (page - 1) * perPage;
        return filteredRows.slice(start, start + perPage);
    }, [filteredRows, page, perPage]);

    const selectedRow = useMemo(() => {
        return rows.find((row) => row.booking?.id === selectedBookingId) || null;
    }, [rows, selectedBookingId]);

    const departments = useMemo(() => {
        return Array.from(new Set(rows.flatMap((row) => (row.tasks || []).map((task) => task.department)).filter(Boolean))).sort();
    }, [rows]);

    const toggleTask = async (task) => {
        const nextStatus = task.status === 'Done' ? 'Pending' : 'Done';
        setUpdatingTaskId(task.id);
        try {
            const response = await fetch(`/api/operations/preparation-tasks/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ status: nextStatus }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Could not update task.');
            await fetchBoard({ silent: true });
        } catch (err) {
            console.error(err);
            setError(err.message || 'Could not update task.');
        } finally {
            setUpdatingTaskId(null);
        }
    };

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
            )}

            <div className="staff-work-surface">
                <div className="staff-filter-bar">
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="staff-control"
                        placeholder="Search customer, event, or booking ID"
                    />
                    <select value={attentionFilter} onChange={(event) => setAttentionFilter(event.target.value)} className="staff-control">
                        <option value="all">All readiness</option>
                        <option value="needs_attention">Needs attention</option>
                        <option value="payment">Payment not clear</option>
                        <option value="menu">Menu missing</option>
                        <option value="headcount">Headcount missing</option>
                        <option value="customer_messages">Open messages</option>
                    </select>
                    <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="staff-control">
                        <option value="all">All departments</option>
                        {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                    </select>
                    <button type="button" onClick={() => fetchBoard()} className="staff-row-action">Refresh</button>
                </div>

                {loading ? (
                    <div className="staff-empty-compact">Loading preparation board...</div>
                ) : filteredRows.length === 0 ? (
                    <div className="staff-empty-compact">No approved event handoffs match the current filters.</div>
                ) : (
                    <>
                        <div className="staff-table-wrap custom-scrollbar">
                            <table className="staff-table">
                                <thead>
                                    <tr>
                                        <th>Event Date</th>
                                        <th>Booking</th>
                                        <th>Readiness</th>
                                        <th>Tasks</th>
                                        <th>Attention</th>
                                        <th className="text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRows.map((row) => {
                                        const readiness = summarizeReadiness(row.readiness);

                                        return (
                                        <tr key={row.booking.id}>
                                            <td className="whitespace-nowrap">
                                                <div className="font-black text-slate-950">{formatDate(row.booking.event_date)}</div>
                                                <div className="mt-0.5 text-xs font-bold text-slate-400">Next 30 days</div>
                                            </td>
                                            <td>
                                                <div className="font-black text-slate-950">{eventName(row.booking)}</div>
                                                <div className="mt-0.5 text-xs font-bold text-slate-500">{row.booking.client_full_name || 'Customer'} / {row.booking.pax || 0} pax</div>
                                            </td>
                                            <td>
                                                <div className="staff-readiness-cell">
                                                    <strong>{readiness.ready}/{readiness.total} clear</strong>
                                                    {readiness.blocked.length > 0 ? (
                                                        <div>
                                                            {readiness.blocked.slice(0, 3).map(([key]) => (
                                                                <span key={key}>{readinessLabels[key] || key}</span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <em>All readiness checks clear</em>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="font-black text-slate-950">{row.task_progress?.completed || 0}/{row.task_progress?.total || 0}</div>
                                                <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-amber-50">
                                                    <div className="h-full rounded-full bg-[#720101]" style={{ width: `${row.task_progress?.percent || 0}%` }} />
                                                </div>
                                            </td>
                                            <td>
                                                {row.attention_flags?.length > 0 ? (
                                                    <span className="staff-status staff-status-danger">{row.attention_flags.length} flag{row.attention_flags.length === 1 ? '' : 's'}</span>
                                                ) : (
                                                    <span className="staff-status staff-status-good">Ready</span>
                                                )}
                                            </td>
                                            <td className="text-right">
                                                <button type="button" onClick={() => setSelectedBookingId(row.booking.id)} className="staff-row-action staff-row-action-primary">
                                                    Review
                                                </button>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <StaffPagination
                            page={page}
                            perPage={perPage}
                            total={filteredRows.length}
                            onPageChange={setPage}
                            onPerPageChange={setPerPage}
                            perPageOptions={[10, 25, 50]}
                        />
                    </>
                )}
            </div>

            <StaffDrawer
                isOpen={Boolean(selectedRow)}
                title={selectedRow ? eventName(selectedRow.booking) : ''}
                eyebrow="Preparation handoff"
                onClose={() => setSelectedBookingId(null)}
            >
                {selectedRow && (
                    <div className="space-y-4">
                        <section className="rounded-xl border border-amber-100 bg-white p-4">
                            <p className="text-sm font-black text-slate-950">{selectedRow.booking.client_full_name || 'Customer'}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-500">{formatDate(selectedRow.booking.event_date)} / {selectedRow.booking.pax || 0} pax / {selectedRow.booking.status}</p>
                        </section>

                        <section className="rounded-xl border border-amber-100 bg-white p-4">
                            <p className="mb-3 text-xs font-black uppercase text-slate-500">Readiness</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {Object.entries(selectedRow.readiness || {}).map(([key, ready]) => (
                                    <div key={key} className="flex items-center justify-between rounded-lg bg-[#fffaf3] px-3 py-2">
                                        <span className="text-sm font-bold text-slate-700">{readinessLabels[key] || key}</span>
                                        <span className={readinessClass(ready)}>{ready ? 'Ready' : 'Needs attention'}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {selectedRow.attention_flags?.length > 0 && (
                            <section className="rounded-xl border border-red-100 bg-red-50 p-4">
                                <p className="text-xs font-black uppercase text-red-700">Needs attention</p>
                                <ul className="mt-2 space-y-1 text-sm font-semibold text-red-700">
                                    {selectedRow.attention_flags.map((flag) => <li key={flag.key}>{flag.label}</li>)}
                                </ul>
                            </section>
                        )}

                        <section className="rounded-xl border border-amber-100 bg-white p-4">
                            <p className="mb-3 text-xs font-black uppercase text-slate-500">Preparation tasks</p>
                            <div className="space-y-2">
                                {(selectedRow.tasks || []).map((task) => {
                                    const done = task.status === 'Done';
                                    return (
                                        <button
                                            key={task.id}
                                            type="button"
                                            onClick={() => toggleTask(task)}
                                            disabled={updatingTaskId === task.id}
                                            className={`w-full rounded-xl border px-3 py-3 text-left transition disabled:opacity-60 ${done ? 'border-emerald-100 bg-emerald-50' : 'border-amber-100 bg-white hover:bg-[#fffaf3]'}`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-black text-slate-950">{task.label}</p>
                                                    <p className="mt-1 text-xs font-bold uppercase text-slate-400">{task.department}</p>
                                                </div>
                                                <span className={done ? 'staff-status staff-status-good' : 'staff-status staff-status-muted'}>{done ? 'Done' : 'Pending'}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                )}
            </StaffDrawer>
        </div>
    );
};

export default PreparationBoard;
