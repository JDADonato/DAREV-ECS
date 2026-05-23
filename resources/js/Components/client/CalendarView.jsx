import { useEffect, useMemo, useState } from 'react';
import Modal from '../common/Modal';

let disabledDateCache = null;
let disabledDatePromise = null;

const QUICK_TIMES = [
    { label: '8:00 AM', value: '08:00' },
    { label: '10:00 AM', value: '10:00' },
    { label: '12:00 PM', value: '12:00' },
    { label: '2:00 PM', value: '14:00' },
    { label: '4:00 PM', value: '16:00' },
    { label: '6:00 PM', value: '18:00' },
];

const formatDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const monthTitle = (date) => date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const parseStartTime = (value) => {
    if (!value) return '';
    if (/^\d{2}:\d{2}$/.test(value)) return value;

    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return '';

    let hour = Number(match[1]);
    const minute = match[2];
    const meridiem = match[3].toUpperCase();
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;

    return `${String(hour).padStart(2, '0')}:${minute}`;
};

const CalendarView = ({ bookingData, updateBooking, onNext, onBack }) => {
    const [selectedDate, setSelectedDate] = useState(bookingData.date || '');
    const [selectedTime, setSelectedTime] = useState(parseStartTime(bookingData.time));
    const [duration, setDuration] = useState(bookingData.duration || 4);
    const [disabledDates, setDisabledDates] = useState(disabledDateCache || []);
    const [visibleMonth, setVisibleMonth] = useState(() => {
        const initial = bookingData.date ? new Date(`${bookingData.date}T00:00:00`) : new Date();
        initial.setDate(1);
        return initial;
    });
    const [loadingDates, setLoadingDates] = useState(!disabledDateCache);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [error, setError] = useState('');
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    useEffect(() => {
        let cancelled = false;

        if (disabledDateCache) {
            setDisabledDates(disabledDateCache);
            setLoadingDates(false);
            return;
        }

        disabledDatePromise ||= fetch('/api/bookings/disabled-dates')
            .then((res) => (res.ok ? res.json() : { disabled_dates: [] }))
            .then((data) => {
                disabledDateCache = data.disabled_dates || [];
                return disabledDateCache;
            })
            .catch(() => []);

        disabledDatePromise.then((dates) => {
            if (!cancelled) {
                setDisabledDates(dates);
                setLoadingDates(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        updateBooking({ duration });
    }, [duration]);

    const minDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return formatDateInput(date);
    }, []);

    const disabledDateSet = useMemo(() => new Set(disabledDates), [disabledDates]);
    const isDateDisabled = (date) => disabledDateSet.has(date);
    const isBeforeMinDate = (date) => date < minDate;

    const calendarDays = useMemo(() => {
        const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
        const start = new Date(firstDay);
        start.setDate(firstDay.getDate() - firstDay.getDay());

        return Array.from({ length: 42 }, (_, index) => {
            const date = new Date(start);
            date.setDate(start.getDate() + index);
            const value = formatDateInput(date);
            const disabled = !sameMonth(date, visibleMonth) || isBeforeMinDate(value) || isDateDisabled(value);
            return {
                date,
                value,
                day: date.getDate(),
                isCurrentMonth: sameMonth(date, visibleMonth),
                isSelected: value === selectedDate,
                disabled,
            };
        });
    }, [visibleMonth, minDate, disabledDateSet, selectedDate]);

    const changeMonth = (direction) => {
        setVisibleMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
    };

    const formatTimeRange = (timeStr, dur = duration) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':').map(Number);
        const formatAMPM = (h, m) => {
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hour = h % 12 || 12;
            return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
        };
        const endHours = (hours + dur) % 24;
        return `${formatAMPM(hours, minutes)} - ${formatAMPM(endHours, minutes)}`;
    };

    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const handleDateSelect = (date) => {
        if (!date || isBeforeMinDate(date) || isDateDisabled(date)) {
            setError('That date is unavailable. Please choose another date.');
            return;
        }
        setSelectedDate(date);
        setError('');
    };

    const checkAvailability = async () => {
        if (isDateDisabled(selectedDate)) return { isFull: true };
        const response = await fetch(`/api/bookings/availability/${selectedDate}`);
        if (!response.ok) throw new Error('Unable to check availability');
        return response.json();
    };

    const handleNext = async () => {
        if (!selectedDate || !selectedTime) {
            setModal({ isOpen: true, title: 'Choose date and time', message: 'Please select your event date and preferred start time.', type: 'error' });
            return;
        }

        if (error || isDateDisabled(selectedDate)) {
            setModal({ isOpen: true, title: 'Date unavailable', message: 'Please choose another event date.', type: 'error' });
            return;
        }

        setCheckingAvailability(true);
        try {
            const availability = await checkAvailability();
            if (availability.isFull) {
                setError('That date is unavailable. Please choose another date.');
                setModal({ isOpen: true, title: 'Date unavailable', message: 'Please choose another event date.', type: 'error' });
                return;
            }

            updateBooking({
                date: selectedDate,
                time: formatTimeRange(selectedTime),
                duration,
                remainingPax: availability.remainingPax,
            });
            onNext(true);
        } catch (err) {
            setModal({ isOpen: true, title: 'Could not check date', message: 'Please try again in a moment.', type: 'error' });
        } finally {
            setCheckingAvailability(false);
        }
    };

    return (
        <div className="booking-step">
            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />

            <div className="booking-step-grid">
                <section className="booking-step-panel">
                    <div className="booking-step-copy">
                        <p className="booking-step-kicker">Schedule</p>
                        <h2>Choose the date and service window.</h2>
                        <p>Dates need at least 7 days of notice. We will confirm availability before moving forward.</p>
                    </div>

                    <div className="booking-calendar">
                        <div className="booking-calendar-header">
                            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">&lt;</button>
                            <strong>{monthTitle(visibleMonth)}</strong>
                            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">&gt;</button>
                        </div>
                        <div className="booking-calendar-weekdays">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}
                        </div>
                        <div className="booking-calendar-grid">
                            {calendarDays.map(day => (
                                <button
                                    key={day.value}
                                    type="button"
                                    onClick={() => handleDateSelect(day.value)}
                                    disabled={day.disabled}
                                    className={`${day.isSelected ? 'booking-calendar-day-selected' : ''} ${!day.isCurrentMonth ? 'booking-calendar-day-muted' : ''}`}
                                    aria-pressed={day.isSelected}
                                >
                                    {day.day}
                                </button>
                            ))}
                        </div>
                    </div>
                    {loadingDates && <p className="mt-2 text-sm font-semibold text-slate-400">Checking calendar...</p>}
                    {error && <p className="booking-inline-error">{error}</p>}
                </section>

                <section className="booking-choice-area booking-schedule-panel">
                    <div className="booking-schedule-group">
                        <p className="booking-field-label">Start time</p>
                        <p className="booking-helper-copy">Choose the closest service start time.</p>
                        <div className="booking-time-list">
                            {QUICK_TIMES.map((time) => (
                                <button
                                    key={time.value}
                                    type="button"
                                    onClick={() => setSelectedTime(time.value)}
                                    className={selectedTime === time.value ? 'active' : ''}
                                >
                                    {time.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="booking-schedule-group">
                        <p className="booking-field-label">Service length</p>
                        <p className="booking-helper-copy">Standard service is 4 hours.</p>
                        <div className="booking-duration-list">
                            {[4, 5, 6, 7, 8].map((hours) => (
                                <button
                                    key={hours}
                                    type="button"
                                    onClick={() => setDuration(hours)}
                                    className={duration === hours ? 'active' : ''}
                                >
                                    {hours}h
                                </button>
                            ))}
                        </div>
                        {duration > 4 && <p className="mt-2 text-sm font-semibold text-slate-500">Extra service hours: ₱{((duration - 4) * 5000).toLocaleString()}</p>}
                    </div>

                    <div className="booking-summary-strip booking-schedule-summary">
                        <span>Selected schedule</span>
                        <strong>
                            {selectedDate ? formatDisplayDate(selectedDate) : 'Choose a date'} · {selectedTime ? formatTimeRange(selectedTime) : 'Choose a time'}
                        </strong>
                    </div>
                </section>
            </div>

            <div className="booking-step-actions">
                <button onClick={onBack} className="booking-secondary-btn">Back</button>
                <button onClick={handleNext} disabled={checkingAvailability} className="booking-primary-btn">
                    {checkingAvailability ? 'Checking...' : 'Continue'}
                </button>
            </div>
        </div>
    );
};

export default CalendarView;

