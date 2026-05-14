import { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';

const CalendarView = ({ bookingData, updateBooking, onNext }) => {
    const [selectedDate, setSelectedDate] = useState(bookingData.date || '');
    const [selectedTime, setSelectedTime] = useState(bookingData.time || '');
    const [availability, setAvailability] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const timeContainerRef = useRef(null);

    // Custom Time Picker State
    const [timeH, setTimeH] = useState('');
    const [timeM, setTimeM] = useState('');
    const [timeAmPm, setTimeAmPm] = useState('PM');
    const [duration, setDuration] = useState(bookingData.duration || 4);

    // Update parent immediately when duration changes for live summary
    useEffect(() => {
        updateBooking({ duration });
    }, [duration]);

    // Initialize custom time picker from bookingData
    useEffect(() => {
        if (bookingData.time) {
            const [h24, m] = bookingData.time.split(':').map(Number);
            let h12 = h24 % 12;
            h12 = h12 === 0 ? 12 : h12;
            setTimeH(h12.toString());
            setTimeM(m < 10 ? '0' + m : m.toString());
            setTimeAmPm(h24 >= 12 ? 'PM' : 'AM');
        }
        if (bookingData.duration) {
            setDuration(bookingData.duration);
        }
    }, []);

    // Sync to selectedTime whenever custom picker changes
    useEffect(() => {
        if (timeH !== '' && timeM !== '') {
            let h24 = parseInt(timeH) || 12;
            let mVal = parseInt(timeM) || 0;
            if (timeAmPm === 'PM' && h24 !== 12) h24 += 12;
            if (timeAmPm === 'AM' && h24 === 12) h24 = 0;
            
            const hStr = h24 < 10 ? '0' + h24 : h24;
            const mStrFmt = mVal < 10 ? '0' + mVal : mVal;
            setSelectedTime(`${hStr}:${mStrFmt}`);
        } else {
            setSelectedTime('');
        }
    }, [timeH, timeM, timeAmPm]);

    // Prevent page scroll when using mouse wheel on time inputs
    useEffect(() => {
        const handleWheel = (e) => {
            const target = e.target;
            if (target && target.type === 'number' && target.classList.contains('custom-number-input')) {
                e.preventDefault();
                if (e.deltaY > 0) target.stepDown();
                else target.stepUp();
                
                // Trigger React onChange
                const event = new Event('input', { bubbles: true });
                target.dispatchEvent(event);
            }
        };

        const container = timeContainerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (container) container.removeEventListener('wheel', handleWheel);
        };
    }, []);

    const handleHChange = (e) => {
        let v = e.target.value;
        if (v === '') { setTimeH(''); return; }
        let num = parseInt(v);
        if (num > 12) num = 12;
        if (num < 1) num = 1;
        setTimeH(num.toString());
    };

    const handleMChange = (e) => {
        let v = e.target.value;
        if (v === '') { setTimeM(''); return; }
        let num = parseInt(v);
        if (num > 59) num = 59;
        if (num < 0) num = 0;
        setTimeM(num.toString());
    };

    const handleTimeBlur = () => {
        if (timeH === '') setTimeH('12');
        if (timeM !== '') {
            let num = parseInt(timeM);
            setTimeM(num < 10 ? '0' + num : num.toString());
        } else {
            setTimeM('00');
        }
    };

    const getMinDate = () => {
        const today = new Date();
        today.setDate(today.getDate() + 7);
        return today.toISOString().split('T')[0];
    };

    const formatTimeRange = (timeStr, dur = duration) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':').map(Number);

        const formatAMPM = (h, m) => {
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12;
            h = h ? h : 12;
            const mStr = m < 10 ? '0' + m : m;
            return `${h}:${mStr} ${ampm}`;
        };

        const endHours = (hours + dur) % 24;
        return `${formatAMPM(hours, minutes)} - ${formatAMPM(endHours, minutes)}`;
    };

    const handleDateChange = async (e) => {
        const date = e.target.value;
        setSelectedDate(date);
        setAvailability(null);
        setError('');

        if (date) {
            setLoading(true);
            try {
                const response = await fetch(`/api/bookings/availability/${date}`);
                const data = await response.json();

                if (data.isFull) {
                    setError("Sorry, this date is fully booked.");
                } else {
                    setAvailability(data);
                }
            } catch (err) {
                console.error("Error fetching availability:", err);
                setError("Failed to check availability. Please try again.");
            } finally {
                setLoading(false);
            }
        }
    };

    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const handleNext = () => {
        if (!selectedDate || !selectedTime) {
            setModal({
                isOpen: true,
                title: 'Incomplete Selection',
                message: 'Please select both a date and a time for your event.',
                type: 'error'
            });
            return;
        }
        if (error) {
            setModal({
                isOpen: true,
                title: 'Invalid Date',
                message: 'The selected date is unavailable. Please choose another date.',
                type: 'error'
            });
            return;
        }
        if (availability) {
            updateBooking({
                date: selectedDate,
                time: formatTimeRange(selectedTime),
                duration: duration,
                remainingPax: availability.remainingPax
            });
        } else {
            updateBooking({ 
                date: selectedDate, 
                time: formatTimeRange(selectedTime),
                duration: duration
            });
        }
        onNext(true);
    };

    return (
        <div className="flex flex-col h-full justify-between">
            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />
            <div className="space-y-8 animate-fadeIn">
                <div className="max-w-2xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                    {/* Date Input */}
                    <div className={`bg-gray-50 p-6 rounded-xl border transition-colors ${error ? 'border-red-300 bg-red-50' : 'border-gray-100 hover:border-primary-300'}`}>
                        <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Select Date</label>
                        <p className="text-[11px] text-amber-600 mb-4 font-semibold uppercase tracking-wider">Requires 7 days' notice</p>
                        <input
                            type="date"
                            min={getMinDate()}
                            value={selectedDate}
                            onChange={handleDateChange}
                            className={`w-full p-4 border rounded-lg focus:ring-2 outline-none shadow-sm text-gray-700 font-medium ${error ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:ring-primary-500 focus:border-transparent'}`}
                        />
                        {loading && <p className="mt-2 text-xs text-blue-500">Checking availability...</p>}
                        {error && <p className="mt-2 text-xs text-red-600 font-bold">{error}</p>}
                        {availability && !error && (
                            <div className="mt-3 text-xs text-green-600 space-y-1">
                                <p className="font-bold flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Date Available!
                                </p>
                                <p>Remaining Slots: {availability.remainingEvents}</p>
                                <p>Remaining Capacity: {availability.remainingPax} pax</p>
                            </div>
                        )}
                        {!availability && !loading && !error && (
                            <p className="mt-3 text-xs text-gray-400 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Dates in red would be unavailable.
                            </p>
                        )}
                    </div>

                    {/* Time Input */}
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <label className="block text-sm font-bold text-gray-700 mb-6 uppercase tracking-wide">Select Event Start Time</label>
                        <div className="flex items-center gap-2" ref={timeContainerRef}>
                            <div className="flex-1 relative group">
                                <label className="text-[10px] text-gray-400 font-bold uppercase absolute -top-5 left-2 transition-colors group-focus-within:text-red-900">Hour</label>
                                <input
                                    type="number"
                                    min="1" max="12"
                                    value={timeH}
                                    onChange={handleHChange}
                                    onBlur={handleTimeBlur}
                                    placeholder="12"
                                    className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-900 focus:border-transparent outline-none text-center font-bold text-xl text-gray-800 bg-white custom-number-input"
                                />
                            </div>
                            <span className="text-2xl font-bold text-gray-300 pb-1">:</span>
                            <div className="flex-1 relative group">
                                <label className="text-[10px] text-gray-400 font-bold uppercase absolute -top-5 left-2 transition-colors group-focus-within:text-red-900">Minute</label>
                                <input
                                    type="number"
                                    min="0" max="59" step="15"
                                    value={timeM}
                                    onChange={handleMChange}
                                    onBlur={handleTimeBlur}
                                    placeholder="00"
                                    className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-900 focus:border-transparent outline-none text-center font-bold text-xl text-gray-800 bg-white custom-number-input"
                                />
                            </div>
                            <div className="flex-1 min-w-[90px] relative ml-2">
                                <label className="text-[10px] text-gray-400 font-bold uppercase absolute -top-5 left-1 hidden sm:block">AM/PM</label>
                                <div className="flex bg-gray-100 p-1 rounded-xl gap-1 h-[58px] border border-gray-200">
                                    <button
                                        onClick={() => setTimeAmPm('AM')}
                                        className={`flex-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${timeAmPm === 'AM' ? 'bg-white shadow border border-gray-200 text-red-900' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        AM
                                    </button>
                                    <button
                                        onClick={() => setTimeAmPm('PM')}
                                        className={`flex-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${timeAmPm === 'PM' ? 'bg-white shadow border border-gray-200 text-red-900' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        PM
                                    </button>
                                </div>
                            </div>
                        </div>
                        {selectedTime && (
                            <p className="mt-4 font-medium text-lg text-primary-700 block bg-primary-50 p-3 rounded-lg border border-primary-200 text-center shadow-sm">
                                {formatTimeRange(selectedTime)}
                            </p>
                        )}
                        
                        {/* Event Duration Selector */}
                        <div className="mt-6 pt-5 border-t border-gray-100">
                            <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide flex justify-between items-center">
                                Event Duration
                                <span className="text-[10px] text-gray-400 font-normal normal-case">Max 8 hrs</span>
                            </label>
                            
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setDuration(Math.max(4, duration - 1))}
                                    disabled={duration <= 4}
                                    className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-red-900 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                                </button>
                                
                                <div className="flex-1 bg-white border border-gray-200 rounded-xl p-3 text-center font-bold text-lg text-gray-800 shadow-sm">
                                    {duration} Hours
                                </div>
                                
                                <button 
                                    onClick={() => setDuration(Math.min(8, duration + 1))}
                                    disabled={duration >= 8}
                                    className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-red-900 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                </button>
                            </div>
                            
                            {duration > 4 && (
                                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 animate-fadeIn">
                                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <div>
                                        <p className="text-sm font-bold text-red-800">+₱{((duration - 4) * 5000).toLocaleString()} Overtime Surcharge</p>
                                        <p className="text-xs text-red-600 mt-0.5">{duration - 4} hour(s) extension from the standard 4-hour event duration.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className="text-[11px] text-gray-400 mt-4 text-center">
                            Standard catering duration is <strong>4 hours</strong>. An additional <strong>₱5,000 per hour</strong> applies for extensions.
                        </p>
                    </div>
                </div>


            </div>

            <div className="flex justify-end pt-8">
                <button
                    onClick={handleNext}
                    className="bg-red-900 text-white px-10 py-3.5 rounded-xl font-bold shadow-lg hover:bg-red-800 hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center text-sm"
                >
                    Continue
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
            </div>
        </div>
    );
};

export default CalendarView;
