import { useState } from 'react';
import Modal from '../common/Modal';

const FoodTastingStep = ({ bookingData, updateBooking, onSubmit, onBack, isSubmitting = false }) => {
    const [showTasting, setShowTasting] = useState(bookingData.wantsTasting || false);
    const [sameAsAbove, setSameAsAbove] = useState(false);
    const [tastingData, setTastingData] = useState({
        guest_name: bookingData.tasting_guest_name || '',
        guest_email: bookingData.tasting_guest_email || '',
        guest_phone: bookingData.tasting_guest_phone || '',
        preferred_date: bookingData.tasting_preferred_date || '',
        preferred_time: bookingData.tasting_preferred_time || '',
        notes: bookingData.tasting_notes || ''
    });
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const handleChange = (e) => {
        setTastingData({ ...tastingData, [e.target.name]: e.target.value });
    };

    const handleSameAsAbove = (checked) => {
        setSameAsAbove(checked);
        if (checked) {
            setTastingData(prev => ({
                ...prev,
                guest_name: bookingData.client_full_name || '',
                guest_email: bookingData.client_email || '',
                guest_phone: bookingData.client_phone || '',
            }));
        }
    };

    const handleSubmitWithTasting = () => {
        if (isSubmitting) return;
        if (!tastingData.preferred_date || !tastingData.preferred_time) {
            setModal({
                isOpen: true,
                type: 'error',
                title: 'Missing Details',
                message: 'Please select a preferred date and time for your tasting session.'
            });
            return;
        }

        const finalData = {
            wantsTasting: true,
            tasting_guest_name: tastingData.guest_name,
            tasting_guest_email: tastingData.guest_email,
            tasting_guest_phone: tastingData.guest_phone,
            tasting_preferred_date: tastingData.preferred_date,
            tasting_preferred_time: tastingData.preferred_time,
            tasting_notes: tastingData.notes
        };

        updateBooking(finalData);
        onSubmit(finalData);
    };

    const handleSkipToCheckout = () => {
        if (isSubmitting) return;
        const finalData = { wantsTasting: false };
        updateBooking(finalData);
        onSubmit(finalData);
    };

    const getMinDate = () => {
        const today = new Date();
        today.setDate(today.getDate() + 3);
        return today.toISOString().split('T')[0];
    };

    return (
        <div className="flex flex-col h-full justify-between animate-fadeIn">
            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />

            <div className="space-y-8">
                {isSubmitting && (
                    <div className="rounded-2xl border border-[#f0aa0b]/30 bg-[#f0aa0b]/10 p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#720101] border-t-transparent" />
                            <div>
                                <p className="text-sm font-bold text-[#720101]">Submitting your booking...</p>
                                <p className="text-xs font-medium text-gray-600">Please keep this page open while we save your event and prepare the confirmation.</p>
                            </div>
                        </div>
                    </div>
                )}
                <div className="max-w-2xl mx-auto w-full space-y-6 mt-4">
                    {/* Toggle */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => setShowTasting(true)}
                            disabled={isSubmitting}
                            className={`flex-1 py-5 px-6 rounded-2xl border-2 transition-all duration-300 text-center ${showTasting
                                ? 'border-primary-500 bg-primary-50 shadow-md'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                        >
                            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-2 text-primary-600 mx-auto">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m18-4.5a9 9 0 11-18 0" />
                                </svg>
                            </div>
                            <p className={`font-bold ${showTasting ? 'text-primary-700' : 'text-gray-700'}`}>
                                Yes, Schedule a Tasting
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Try our dishes firsthand</p>
                        </button>
                        <button
                            onClick={handleSkipToCheckout}
                            disabled={isSubmitting}
                            className={`flex-1 py-5 px-6 rounded-2xl border-2 border-gray-200 bg-white transition-all duration-300 text-center ${isSubmitting ? 'cursor-not-allowed opacity-60' : 'hover:border-gray-300'}`}
                        >
                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-2 text-gray-500 mx-auto">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="font-bold text-gray-700">{isSubmitting ? 'Submitting...' : 'Submit Without Tasting'}</p>
                            <p className="text-xs text-gray-400 mt-1">Proceed without tasting</p>
                        </button>
                    </div>

                    {/* Tasting Form */}
                    {showTasting && (
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-5 animate-fadeIn">
                            <h3 className="font-bold text-gray-800 text-lg flex items-center">
                                <svg className="w-5 h-5 mr-2 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Tasting Details
                            </h3>

                            {/* Guest Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">Guest Name</label>
                                    <input
                                        type="text"
                                        name="guest_name"
                                        placeholder="Name for the tasting"
                                        value={tastingData.guest_name}
                                        onChange={handleChange}
                                        disabled={sameAsAbove}
                                        className={`w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700 ${sameAsAbove ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">Email</label>
                                    <input
                                        type="email"
                                        name="guest_email"
                                        placeholder="Email address"
                                        value={tastingData.guest_email}
                                        onChange={handleChange}
                                        disabled={sameAsAbove}
                                        className={`w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700 ${sameAsAbove ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">Phone</label>
                                    <input
                                        type="tel"
                                        name="guest_phone"
                                        placeholder="Phone number"
                                        value={tastingData.guest_phone}
                                        onChange={handleChange}
                                        disabled={sameAsAbove}
                                        className={`w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700 ${sameAsAbove ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                            </div>

                            {/* Same as above checkbox */}
                            <label className="flex items-center gap-3 cursor-pointer group w-fit">
                                <input
                                    type="checkbox"
                                    checked={sameAsAbove}
                                    onChange={(e) => handleSameAsAbove(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                />
                                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors select-none">
                                    Same details as my contact info
                                </span>
                            </label>

                            {/* Date & Time */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">
                                        Preferred Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        name="preferred_date"
                                        min={getMinDate()}
                                        value={tastingData.preferred_date}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">
                                        Preferred Time <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        name="preferred_time"
                                        value={tastingData.preferred_time}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Notes / Dietary Requirements</label>
                                <textarea
                                    name="notes"
                                    rows="3"
                                    placeholder="Any dietary restrictions or special requests..."
                                    value={tastingData.notes}
                                    onChange={handleChange}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700 resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between pt-8 items-center border-t border-gray-100 mt-8">
                <button
                    onClick={onBack}
                    disabled={isSubmitting}
                    className={`text-gray-500 font-medium px-4 py-3 transition-colors flex items-center text-sm ${isSubmitting ? 'cursor-not-allowed opacity-50' : 'hover:text-gray-800'}`}
                >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Go Back
                </button>
                {showTasting && (
                    <button
                        onClick={handleSubmitWithTasting}
                        disabled={isSubmitting}
                        className={`px-10 py-3.5 rounded-xl font-bold shadow-lg transition-all flex items-center text-sm ${isSubmitting ? 'cursor-not-allowed bg-gray-200 text-gray-500' : 'bg-yellow-500 text-red-900 hover:bg-yellow-400 hover:shadow-xl transform hover:-translate-y-0.5'}`}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                Submit Booking
                                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default FoodTastingStep;
