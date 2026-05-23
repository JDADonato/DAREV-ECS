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
        setSelectedDate(date);
        if (isDateDisabled(date)) {
            setError('That date is unavailable. Please choose another date.');
            return;
        }
        setError('');
    };

    const checkAvailability = async () => {
        if (isDateDisabled(selectedDate)) {
            return { isFull: true };
        }

        const response = await fetch(`/api/bookings/availability/${selectedDate}`);
        if (!response.ok) {
            throw new Error('Unable to check availability');
        }
        return response.json();
    };

    const handleNext = async () => {
        if (!selectedDate || !selectedTime) {
            setModal({
                isOpen: true,
                title: 'Choose date and time',
                message: 'Please select your event date and preferred start time.',
                type: 'error',
            });
            return;
        }

        if (error || isDateDisabled(selectedDate)) {
            setModal({
                isOpen: true,
                title: 'Date unavailable',
                message: 'Please choose another event date.',
                type: 'error',
            });
            return;
        }

        setCheckingAvailability(true);
        try {
            const availability = await checkAvailability();

            if (availability.isFull) {
                setError('That date is unavailable. Please choose another date.');
                setModal({
                    isOpen: true,
                    title: 'Date unavailable',
                    message: 'Please choose another event date.',
                    type: 'error',
                });
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
            setModal({
                isOpen: true,
                title: 'Could not check date',
                message: 'Please try again in a moment.',
                type: 'error',
            });
        } finally {
            setCheckingAvailability(false);
        }
    };

    return (
        <div className="flex h-full flex-col justify-between">
            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />

            <div className="mx-auto w-full max-w-3xl animate-fadeIn">
                <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                    <div className="border-b border-gray-100 bg-gray-50 px-6 py-5">
                        <h3 className="text-lg font-black text-gray-950">Choose your schedule</h3>
                        <p className="mt-1 text-sm font-medium text-gray-500">Pick a date, start time, and service length.</p>
                    </div>

                    <div className="space-y-6 p-6">
                        <div>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <label htmlFor="event-date" className="text-xs font-black uppercase tracking-widest text-gray-500">
                                    Event date
                                </label>
                                {loadingDates && <span className="text-xs font-bold text-gray-400">Loading calendar...</span>}
                            </div>
                            <input
                                id="event-date"
                                type="date"
                                min={minDate}
                                value={selectedDate}
                                onChange={(event) => handleDateSelect(event.target.value)}
                                className={`w-full rounded-2xl border bg-gray-50 px-4 py-4 text-base font-bold text-gray-900 outline-none transition focus:bg-white focus:ring-4 ${
                                    error
                                        ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                                        : 'border-gray-200 focus:border-red-900 focus:ring-red-900/10'
                                }`}
                            />
                            {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
                        </div>

                        <div>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-xs font-black uppercase tracking-widest text-gray-500">Start time</p>
                                <label className="text-xs font-bold text-red-900">
                                    Custom
                                    <input
                                        type="time"
                                        step="900"
                                        value={selectedTime}
                                        onChange={(event) => setSelectedTime(event.target.value)}
                                        className="ml-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900 outline-none transition focus:border-red-900 focus:bg-white focus:ring-4 focus:ring-red-900/10"
                                    />
                                </label>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {QUICK_TIMES.map((time) => (
                                    <button
                                        key={time.value}
                                        type="button"
                                        onClick={() => setSelectedTime(time.value)}
                                        className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                                            selectedTime === time.value
                                                ? 'border-red-900 bg-red-900 text-white shadow-lg'
                                                : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-900'
                                        }`}
                                    >
                                        {time.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="mb-3 text-xs font-black uppercase tracking-widest text-gray-500">Service length</p>
                            <div className="grid grid-cols-5 gap-2">
                                {[4, 5, 6, 7, 8].map((hours) => (
                                    <button
                                        key={hours}
                                        type="button"
                                        onClick={() => setDuration(hours)}
                                        className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                                            duration === hours
                                                ? 'border-yellow-400 bg-yellow-400 text-red-950 shadow-lg'
                                                : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-yellow-200 hover:bg-yellow-50'
                                        }`}
                                    >
                                        {hours}h
                                    </button>
                                ))}
                            </div>
                            {duration > 4 && (
                                <p className="mt-3 text-sm font-bold text-gray-600">
                                    Extension fee: PHP {((duration - 4) * 5000).toLocaleString()}
                                </p>
                            )}
                        </div>

                        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4">
                            <p className="text-xs font-black uppercase tracking-widest text-red-900">Selected schedule</p>
                            <p className="mt-2 text-xl font-black text-gray-950">
                                {selectedDate ? formatDisplayDate(selectedDate) : 'Choose a date'}
                                <span className="mx-2 text-gray-300">/</span>
                                {selectedTime ? formatTimeRange(selectedTime) : 'Choose a time'}
                            </p>
                        </div>
                    </div>
                </section>
            </div>

            <div className="flex justify-between pt-8">
                <button
                    onClick={onBack}
                    className="flex items-center px-4 py-3 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
                >
                    <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to event
                </button>
                <button
                    onClick={handleNext}
                    disabled={checkingAvailability}
                    className="flex items-center rounded-xl bg-red-900 px-10 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-red-800 hover:shadow-xl disabled:cursor-wait disabled:opacity-70"
                >
                    {checkingAvailability ? 'Checking...' : 'Continue'}
                    <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default CalendarView;
