import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { router } from '@inertiajs/react';
import StaffMessaging from '../Components/common/StaffMessaging';
import NotificationBell from '../Components/common/NotificationBell';

const DashboardOps = () => {
    const { user, logout } = useAuth();
    const toast = useToast();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('calendar');
    const [inquiryViewMode, setInquiryViewMode] = useState('list');
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    // PDF Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportMode, setExportMode] = useState('month'); // 'month' or 'range'
    const [exportMonthStart, setExportMonthStart] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [exportMonthEnd, setExportMonthEnd] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [exportDateStart, setExportDateStart] = useState('');
    const [exportDateEnd, setExportDateEnd] = useState('');

    useEffect(() => {
        fetchBookings();
    }, []);

    const fetchBookings = async () => {
        try {
            // Session auth - no token needed
            const response = await fetch('/api/ops/bookings', {
                headers: {
                    'Accept': 'application/json',
                }
            });
            if (response.ok) {
                const data = await response.json();
                setBookings(data);
            }
        } catch (error) {
            console.error("Error fetching bookings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        router.post('/logout');
    };

    const updateStatus = async (id, newStatus) => {
        try {
            // Session auth - no token needed
            const response = await fetch(`/api/ops/bookings/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                fetchBookings();
            }
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const updateLiveStatus = async (id, newLiveStatus) => {
        try {
            // Session auth - no token needed
            const response = await fetch(`/api/ops/bookings/${id}/livestatus`, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ live_status: newLiveStatus })
            });

            if (response.ok) {
                // Update local state to reflect change immediately without closing modal
                setSelectedBooking({ ...selectedBooking, live_status: newLiveStatus });
                fetchBookings(); // Refresh background data
            }
        } catch (error) {
            console.error("Error updating live status:", error);
        }
    };

    // Calendar Helper Functions
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month, 1).getDay();
    };

    const formatFullAddress = (booking) => {
        const parts = [
            booking.venue_address_line,
            booking.venue_street,
            booking.venue_city,
            booking.venue_province,
            booking.venue_zip_code
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'Not specified';
    };

    const [selectedBooking, setSelectedBooking] = useState(null);

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(selectedMonth);
        const firstDay = getFirstDayOfMonth(selectedMonth);
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-32 bg-gray-50 border border-gray-100"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBookings = bookings.filter(b => b.event_date && b.event_date.substring(0, 10) === dateStr);

            days.push(
                <div key={day} className="h-32 bg-white border border-gray-100 p-2 overflow-y-auto hover:bg-gray-50 transition-colors">
                    <div className="font-bold text-gray-700 mb-1">{day}</div>
                    {dayBookings.map(booking => (
                        <div
                            key={booking.id}
                            className={`text-xs p-1 mb-1 rounded cursor-pointer truncate ${booking.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                                booking.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}
                            onClick={() => setSelectedBooking(booking)}
                        >
                            {booking.event_time && booking.event_time.length > 18
                                ? booking.event_time.substring(0, 18) + '...'
                                : booking.event_time}
                        </div>
                    ))}
                </div>
            );
        }

        return days;
    };

    const renderBookingModal = () => {
        if (!selectedBooking) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setSelectedBooking(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className={`px-6 py-4 ${selectedBooking.status === 'Confirmed' ? 'bg-green-600' : selectedBooking.status === 'Pending' ? 'bg-yellow-500' : 'bg-gray-600'}`}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">Event Details</h3>
                            <button onClick={() => setSelectedBooking(null)} className="text-white hover:text-gray-200 text-2xl leading-none">&times;</button>
                        </div>
                        <p className="text-sm text-white opacity-80">Booking #{selectedBooking.id}</p>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5 space-y-4">
                        {/* Client Full Name */}
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mr-3 flex-shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-medium uppercase">Client Name</p>
                                <p className="text-sm font-bold text-gray-900">{selectedBooking.client_full_name || selectedBooking.username}</p>
                                {selectedBooking.client_full_name && selectedBooking.username && (
                                    <p className="text-xs text-gray-400">Account: {selectedBooking.username}</p>
                                )}
                            </div>
                        </div>

                        {/* Email */}
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mr-3 flex-shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-medium uppercase">Email</p>
                                <p className="text-sm font-bold text-gray-900">{selectedBooking.client_email || 'Not provided'}</p>
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center mr-3 flex-shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-medium uppercase">Mobile Number</p>
                                <p className="text-sm font-bold text-gray-900">{selectedBooking.client_phone || 'Not provided'}</p>
                            </div>
                        </div>

                        {/* Date & Time */}
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-medium uppercase">Date & Time</p>
                                <p className="text-sm font-bold text-gray-900">{selectedBooking.event_date}</p>
                                <p className="text-xs text-gray-600">{selectedBooking.event_time}</p>
                            </div>
                        </div>

                        {/* Pax */}
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mr-3 flex-shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-medium uppercase">Pax</p>
                                <p className="text-sm font-bold text-gray-900">{selectedBooking.pax} guests</p>
                            </div>
                        </div>

                        {/* Venue Address */}
                        <div className="flex items-start">
                            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-medium uppercase">Venue Address</p>
                                <p className="text-sm font-bold text-gray-900">{formatFullAddress(selectedBooking)}</p>
                                {selectedBooking.venue_building_details && (
                                    <p className="text-xs text-gray-600 mt-0.5"><span className="font-semibold text-gray-500">Details: </span>{selectedBooking.venue_building_details}</p>
                                )}
                            </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 flex-shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-medium uppercase">Status</p>
                                <p className={`text-sm font-bold ${selectedBooking.status === 'Confirmed' ? 'text-green-600' : selectedBooking.status === 'Pending' ? 'text-yellow-600' : 'text-gray-600'}`}>
                                    {selectedBooking.status}
                                </p>
                            </div>
                        </div>

                        {/* Additional Details (if filled) */}
                        {(selectedBooking.reservation_time || selectedBooking.serving_time || selectedBooking.event_timeline || selectedBooking.color_motif) && (
                            <div className="border-t pt-4 mt-4">
                                <p className="text-xs text-gray-400 font-medium uppercase mb-3">Additional Event Info</p>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    {selectedBooking.reservation_time && (
                                        <div>
                                            <p className="text-xs text-gray-400">Reservation Time</p>
                                            <p className="font-semibold text-gray-800">{selectedBooking.reservation_time}</p>
                                        </div>
                                    )}
                                    {selectedBooking.serving_time && (
                                        <div>
                                            <p className="text-xs text-gray-400">Serving Time</p>
                                            <p className="font-semibold text-gray-800">{selectedBooking.serving_time}</p>
                                        </div>
                                    )}
                                    {selectedBooking.color_motif && (
                                        <div className="col-span-2">
                                            <p className="text-xs text-gray-400">Color Motif</p>
                                            <p className="font-semibold text-gray-800">{selectedBooking.color_motif}</p>
                                        </div>
                                    )}
                                    {selectedBooking.event_timeline && (
                                        <div className="col-span-2">
                                            <p className="text-xs text-gray-400">Event Timeline</p>
                                            <p className="font-semibold text-gray-800 whitespace-pre-line">{selectedBooking.event_timeline}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Live Status Control */}
                        <div className="border-t pt-4 mt-4">
                            <p className="text-xs text-gray-400 font-medium uppercase mb-3 flex items-center">
                                <svg className="w-4 h-4 mr-1 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Live Status Tracking
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {['Not Started', 'On the Way', 'Preparing', 'Serving', 'Completed'].map(status => {
                                    const isActive = selectedBooking.live_status === status || (!selectedBooking.live_status && status === 'Not Started');
                                    return (
                                        <button
                                            key={status}
                                            onClick={() => updateLiveStatus(selectedBooking.id, status)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${isActive ? 'bg-primary-600 text-white border-primary-600 shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                        >
                                            {status}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 border-t">
                        <button
                            onClick={() => setSelectedBooking(null)}
                            className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ---- PDF Export Functions ----
    const getExportDateRange = () => {
        if (exportMode === 'range') {
            return { start: exportDateStart, end: exportDateEnd };
        } else {
            // Month range
            const [startYear, startMonth] = exportMonthStart.split('-').map(Number);
            const [endYear, endMonth] = exportMonthEnd.split('-').map(Number);
            const start = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
            const lastDay = new Date(endYear, endMonth, 0).getDate();
            const end = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            return { start, end };
        }
    };

    const exportCalendarPDF = () => {
        const { start, end } = getExportDateRange();

        if (!start || !end || start > end) {
            toast.warning('Please select a valid date range.');
            return;
        }

        const filteredBookings = bookings.filter(b => b.event_date >= start && b.event_date <= end);

        // Group bookings by date
        const grouped = {};
        filteredBookings.forEach(b => {
            if (!grouped[b.event_date]) grouped[b.event_date] = [];
            grouped[b.event_date].push(b);
        });

        const sortedDates = Object.keys(grouped).sort();

        // Build month calendars for the range
        const startDate = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T00:00:00');
        let calendarHTML = '';

        let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        while (current <= endMonth) {
            const year = current.getFullYear();
            const month = current.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDay = new Date(year, month, 1).getDay();
            const monthName = current.toLocaleString('default', { month: 'long', year: 'numeric' });

            calendarHTML += `
                <div class="month-block">
                    <h3 class="month-title">${monthName}</h3>
                    <table class="calendar-table">
                        <thead>
                            <tr>
                                <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>
                            </tr>
                        </thead>
                        <tbody>`;

            let dayCount = 1;
            for (let week = 0; week < 6; week++) {
                if (dayCount > daysInMonth) break;
                calendarHTML += '<tr>';
                for (let dow = 0; dow < 7; dow++) {
                    if ((week === 0 && dow < firstDay) || dayCount > daysInMonth) {
                        calendarHTML += '<td class="empty"></td>';
                    } else {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCount).padStart(2, '0')}`;
                        const dayEvents = grouped[dateStr] || [];
                        const eventsHTML = dayEvents.map(ev =>
                            `<div class="event ${ev.status === 'Confirmed' ? 'confirmed' : ev.status === 'Pending' ? 'pending' : 'other'}">${ev.client_full_name || ev.username} (${ev.pax}px)</div>`
                        ).join('');
                        calendarHTML += `<td><div class="day-num">${dayCount}</div>${eventsHTML}</td>`;
                        dayCount++;
                    }
                }
                calendarHTML += '</tr>';
            }

            calendarHTML += `</tbody></table></div>`;
            current = new Date(year, month + 1, 1);
        }

        // Summary table
        let summaryHTML = '';
        if (sortedDates.length > 0) {
            summaryHTML = `
                <div class="summary-section">
                    <h3>Event Schedule Summary</h3>
                    <table class="summary-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Client</th>
                                <th>Pax</th>
                                <th>Venue</th>
                                <th>Contact</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredBookings.sort((a, b) => a.event_date.localeCompare(b.event_date)).map(b => `
                                <tr>
                                    <td>${b.event_date}</td>
                                    <td>${b.event_time || ''}</td>
                                    <td>${b.client_full_name || b.username}</td>
                                    <td>${b.pax}</td>
                                    <td class="small-text">${[b.venue_address_line, b.venue_street, b.venue_city, b.venue_province].filter(Boolean).join(', ') || '-'}</td>
                                    <td class="small-text">${[b.client_email, b.client_phone].filter(Boolean).join(' / ') || '-'}</td>
                                    <td><span class="status-badge ${b.status === 'Confirmed' ? 'confirmed' : b.status === 'Pending' ? 'pending' : 'other'}">${b.status}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <p class="total-line">Total Events: ${filteredBookings.length} | Total Pax: ${filteredBookings.reduce((s, b) => s + (b.pax || 0), 0)}</p>
                </div>
            `;
        } else {
            summaryHTML = '<p style="text-align:center; color:#666; margin-top:20px;">No events found in the selected date range.</p>';
        }

        const content = `
            <html>
                <head>
                    <title>Eloquente Calendar Export</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; font-size: 11px; }
                        .header { text-align: center; margin-bottom: 25px; border-bottom: 3px solid #d4a843; padding-bottom: 15px; }
                        .header h1 { font-size: 22px; color: #333; margin-bottom: 4px; }
                        .header p { color: #666; font-size: 12px; }
                        .month-block { margin-bottom: 30px; page-break-inside: avoid; }
                        .month-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
                        .calendar-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                        .calendar-table th { background: #f5f5f5; padding: 6px; text-align: center; font-size: 10px; font-weight: 600; text-transform: uppercase; border: 1px solid #ddd; }
                        .calendar-table td { border: 1px solid #ddd; padding: 4px; vertical-align: top; height: 70px; }
                        .calendar-table td.empty { background: #fafafa; }
                        .day-num { font-weight: bold; font-size: 12px; margin-bottom: 2px; }
                        .event { font-size: 8px; padding: 2px 4px; margin-bottom: 2px; border-radius: 3px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
                        .event.confirmed { background: #d1fae5; color: #065f46; }
                        .event.pending { background: #fef3c7; color: #92400e; }
                        .event.other { background: #f3f4f6; color: #374151; }
                        .summary-section { margin-top: 30px; page-break-before: always; }
                        .summary-section h3 { font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
                        .summary-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                        .summary-table th { background: #f5f5f5; padding: 8px 6px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; border: 1px solid #ddd; }
                        .summary-table td { padding: 6px; border: 1px solid #ddd; font-size: 10px; }
                        .summary-table .small-text { font-size: 9px; }
                        .status-badge { padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
                        .status-badge.confirmed { background: #d1fae5; color: #065f46; }
                        .status-badge.pending { background: #fef3c7; color: #92400e; }
                        .status-badge.other { background: #f3f4f6; color: #374151; }
                        .total-line { margin-top: 10px; font-weight: 600; font-size: 12px; }
                        .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
                        @media print { body { padding: 15px; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>ELOQUENTE CATERING SERVICES</h1>
                        <p>Event Calendar — ${start} to ${end}</p>
                        <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                    </div>
                    ${calendarHTML}
                    ${summaryHTML}
                    <div class="footer">
                        Generated by Eloquente Marketing Module
                    </div>
                    <script>window.print();</script>
                </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(content);
        win.document.close();
        setShowExportModal(false);
    };

    const renderExportModal = () => {
        if (!showExportModal) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowExportModal(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="px-6 py-4 bg-primary-600">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">Export Calendar as PDF</h3>
                            <button onClick={() => setShowExportModal(false)} className="text-white hover:text-gray-200 text-2xl leading-none">&times;</button>
                        </div>
                        <p className="text-sm text-white opacity-80">Select the range to include</p>
                    </div>

                    <div className="px-6 py-5 space-y-4">
                        {/* Toggle Mode */}
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setExportMode('month')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${exportMode === 'month' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}
                            >
                                Month Range
                            </button>
                            <button
                                onClick={() => setExportMode('range')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${exportMode === 'range' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}
                            >
                                Date Range
                            </button>
                        </div>

                        {exportMode === 'month' ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">From Month</label>
                                    <input
                                        type="month"
                                        value={exportMonthStart}
                                        onChange={e => setExportMonthStart(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">To Month</label>
                                    <input
                                        type="month"
                                        value={exportMonthEnd}
                                        onChange={e => setExportMonthEnd(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">From Date</label>
                                    <input
                                        type="date"
                                        value={exportDateStart}
                                        onChange={e => setExportDateStart(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">To Date</label>
                                    <input
                                        type="date"
                                        value={exportDateEnd}
                                        onChange={e => setExportDateEnd(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 bg-gray-50 border-t flex space-x-3">
                        <button
                            onClick={() => setShowExportModal(false)}
                            className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={exportCalendarPDF}
                            className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center justify-center"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Export PDF
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderInquiries = () => {
        const pendingBookings = bookings.filter(b => b.status === 'Pending');
        return (
            <div className="space-y-4">
                <div className="flex justify-end mb-4">
                    <div className="bg-gray-100 p-1 rounded-lg inline-flex">
                        <button onClick={() => setInquiryViewMode('list')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${inquiryViewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <div className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                List
                            </div>
                        </button>
                        <button onClick={() => setInquiryViewMode('card')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${inquiryViewMode === 'card' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <div className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                Cards
                            </div>
                        </button>
                    </div>
                </div>

                {inquiryViewMode === 'list' ? (
                    <div className="bg-white shadow overflow-hidden rounded-xl border border-gray-200">
                        <ul className="divide-y divide-gray-200">
                            {pendingBookings.length === 0 ? <li className="p-8 text-gray-500 text-center">No pending inquiries.</li> : null}
                            {pendingBookings.map(booking => (
                                <li key={booking.id} onClick={() => setSelectedBooking(booking)} className="block hover:bg-gray-50 transition-colors cursor-pointer">
                                    <div className="px-6 py-5">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-primary-700 truncate">
                                                Booking #{booking.id} - {booking.client_full_name || booking.username}
                                            </p>
                                            <div className="ml-2 flex-shrink-0 flex">
                                                <p className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-yellow-100 text-yellow-800">
                                                    {booking.status}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 sm:flex sm:justify-between items-center">
                                            <div className="sm:flex gap-6">
                                                <p className="flex items-center text-sm text-gray-600">
                                                    <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    {booking.event_date}
                                                </p>
                                                <p className="flex items-center text-sm text-gray-600">
                                                    <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                    {booking.pax} pax
                                                </p>
                                                <p className="flex items-center text-sm text-gray-600">
                                                    <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    ₱{booking.budget?.toLocaleString() || 'N/A'}
                                                </p>
                                            </div>
                                            <div className="mt-4 flex items-center text-sm sm:mt-0 space-x-3">
                                                <button onClick={(e) => { e.stopPropagation(); updateStatus(booking.id, 'Confirmed'); }} className="bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-medium px-4 py-1.5 rounded-lg transition-colors">Approve</button>
                                                <button onClick={(e) => { e.stopPropagation(); updateStatus(booking.id, 'Cancelled'); }} className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-medium px-4 py-1.5 rounded-lg transition-colors">Reject</button>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingBookings.length === 0 ? <div className="col-span-full p-8 text-gray-500 text-center bg-white rounded-xl shadow-sm border border-gray-200">No pending inquiries.</div> : null}
                        {pendingBookings.map(booking => (
                            <div key={booking.id} onClick={() => setSelectedBooking(booking)} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1 pr-4">
                                            <span className="text-xs font-bold text-primary-600 uppercase tracking-wide">Booking #{booking.id}</span>
                                            <h3 className="text-lg font-bold text-gray-900 mt-1 leading-tight">{booking.client_full_name || booking.username}</h3>
                                        </div>
                                        <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">{booking.status}</span>
                                    </div>
                                    <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-lg">
                                        <p className="flex justify-between text-sm"><span className="text-gray-500 font-medium">Event Date</span><span className="font-bold text-gray-900">{booking.event_date}</span></p>
                                        <p className="flex justify-between text-sm"><span className="text-gray-500 font-medium">Guests</span><span className="font-bold text-gray-900">{booking.pax} pax</span></p>
                                        <p className="flex justify-between text-sm"><span className="text-gray-500 font-medium">Budget</span><span className="font-bold text-primary-700">₱{booking.budget?.toLocaleString() || 'N/A'}</span></p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={(e) => { e.stopPropagation(); updateStatus(booking.id, 'Confirmed'); }} className="flex-1 bg-green-50 text-green-700 hover:bg-green-100 font-bold py-2.5 rounded-lg text-sm transition-colors border border-green-200 shadow-sm">Approve</button>
                                        <button onClick={(e) => { e.stopPropagation(); updateStatus(booking.id, 'Cancelled'); }} className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 font-bold py-2.5 rounded-lg text-sm transition-colors border border-red-200 shadow-sm">Reject</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const generatePDF = (booking, type) => {
        let menuHTML = '';
        if (type === 'Kitchen Prep List' && booking.selected_menu) {
            try {
                const menu = JSON.parse(booking.selected_menu);
                const categories = { starters: 'Starters', mains: 'Main Courses', sides: 'Side Dishes', desserts: 'Desserts', drinks: 'Beverages' };
                let dishList = '';
                Object.keys(menu).forEach(cat => {
                    if (menu[cat] && menu[cat].length > 0) {
                        const items = menu[cat].map(item => {
                            if (typeof item === 'object' && item !== null) return item.name;
                            const dish = DISHES[cat]?.find(d => d.id === item);
                            return dish ? dish.name : item;
                        }).join(', ');
                        dishList += `<li><strong>${categories[cat] || cat}:</strong> ${items}</li>`;
                    }
                });
                if (dishList) {
                    menuHTML = `
                        <h4 style="margin-top: 20px; text-decoration: underline;">Selected Menu</h4>
                        <ul style="line-height: 1.6;">${dishList}</ul>
                    `;
                }
            } catch (e) {
                console.error("Error parsing menu for PDF:", e);
            }
        }

        const content = `
            <html>
                <head>
                    <title>${type} - Booking #${booking.id}</title>
                    <style>
                        body { font-family: serif; padding: 40px; }
                        h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
                        .header { margin-bottom: 30px; }
                        .details { margin-bottom: 30px; line-height: 1.6; }
                        .footer { margin-top: 50px; text-align: center; font-size: 0.8em; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>ELOQUENTE CATERING SERVICES</h1>
                        <h2 style="text-align:center">${type.toUpperCase()}</h2>
                    </div>

                    <div class="details">
                        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                        <p><strong>Event Date:</strong> ${booking.event_date}</p>
                        <p><strong>Client:</strong> ${booking.client_full_name || booking.username}</p>
                        <p><strong>Email:</strong> ${booking.client_email || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${booking.client_phone || 'N/A'}</p>
                        <p><strong>Pax:</strong> ${booking.pax}</p>
                        <p><strong>Venue:</strong> ${[booking.venue_address_line, booking.venue_street, booking.venue_city, booking.venue_province, booking.venue_zip_code].filter(Boolean).join(', ') || 'N/A'}</p>
                        ${booking.special_instructions ? `<p><strong>Special Instructions/Restrictions:</strong> ${booking.special_instructions}</p>` : ''}
                        
                        ${type === 'Contract' ? `
                            <p><strong>Total Budget:</strong> ₱${(booking.total_cost || booking.budget || 0).toLocaleString()}</p>
                            <p><strong>Terms:</strong> 50% Downpayment required to secure date.</p>
                            <br><br>
                            <div style="display:flex; justify-content:space-between; margin-top:50px;">
                                <div>_____________________<br>Client Signature</div>
                                <div>_____________________<br>Eloquente Representative</div>
                            </div>
                        ` : `
                            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px dashed #ccc;">
                                <h3>Kitchen Prep Required</h3>
                                <ul>
                                    <li>Prep for ${booking.pax} pax (${booking.package_id || 'custom'} package)</li>
                                    <li>Staff allocation: ${Math.ceil(booking.pax / 20)} servers</li>
                                </ul>
                                ${menuHTML}
                            </div>
                        `}
                    </div>

                    <div class="footer">
                        Generated by Eloquente Ops Module
                    </div>
                    <script>window.print();</script>
                </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(content);
        win.document.close();
    };

    const renderDocuments = () => {
        const confirmedBookings = bookings.filter(b => b.status === 'Confirmed');
        return (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                    {confirmedBookings.length === 0 ? <li className="p-6 text-gray-500 text-center">No confirmed events for documentation.</li> : null}
                    {confirmedBookings.map(booking => (
                        <li key={booking.id} className="block hover:bg-gray-50">
                            <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900">
                                        Booking #{booking.id} - {booking.client_full_name || booking.username}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {booking.event_date} at {booking.event_time}
                                    </p>
                                </div>
                                <div className="space-x-3">
                                    <button
                                        onClick={() => generatePDF(booking, 'Contract')}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                                    >
                                        Generate Contract
                                    </button>
                                    <button
                                        onClick={() => generatePDF(booking, 'Kitchen Prep List')}
                                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm"
                                    >
                                        Generate Prep List
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <h1 className="text-xl font-bold font-display text-primary-600">Eloquente Ops</h1>
                        </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Marketing View</div>
                                <NotificationBell variant="dark" />
                                <span className="text-gray-700">{user?.username}</span>
                                <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900">Logout</button>
                            </div>
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* Tabs */}
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        {['calendar', 'inquiries', 'documents', 'messages'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`${activeTab === tab
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize flex items-center gap-1.5`}
                            >
                                {tab === 'messages' && (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                )}
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>

                {activeTab === 'calendar' && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-gray-900">
                                {selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </h2>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setShowExportModal(true)}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center"
                                >
                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Export PDF
                                </button>
                                <button
                                    onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
                                    className="p-2 hover:bg-gray-100 rounded"
                                >
                                    &lt; Prev
                                </button>
                                <button
                                    onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                                    className="p-2 hover:bg-gray-100 rounded"
                                >
                                    Next &gt;
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="bg-gray-50 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    {day}
                                </div>
                            ))}
                            {renderCalendar()}
                        </div>
                    </div>
                )}

                {activeTab === 'inquiries' && renderInquiries()}
                {activeTab === 'documents' && renderDocuments()}
                {activeTab === 'messages' && <StaffMessaging />}

            </main>
            {renderBookingModal()}
            {renderExportModal()}
        </div>
    );
};

export default DashboardOps;
