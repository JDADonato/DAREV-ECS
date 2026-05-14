import { useState } from 'react';
import Modal from '../common/Modal';

const GuestLogistics = ({ bookingData, updateBooking, onNext, onBack }) => {
    const [pax, setPax] = useState(bookingData.pax || 50);
    const [dietaryNotes, setDietaryNotes] = useState(bookingData.dietaryNotes || '');
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const handlePaxChange = (value) => {
        const numValue = parseInt(value) || 0;
        setPax(numValue);
        updateBooking({ pax: numValue });
    };

    const handleDietaryChange = (value) => {
        setDietaryNotes(value);
        updateBooking({ dietaryNotes: value });
    };

    const handleNext = () => {
        if (!pax || pax < 20) {
            setModal({
                isOpen: true,
                type: 'error',
                title: 'Invalid Guest Count',
                message: 'Please enter at least 20 guests to proceed with the booking.'
            });
            return;
        }

        if (bookingData.remainingPax && pax > bookingData.remainingPax) {
            setModal({
                isOpen: true,
                type: 'error',
                title: 'Capacity Exceeded',
                message: `We only have ${bookingData.remainingPax} slots remaining for this date. Please reduce your guest count.`
            });
            return;
        }

        updateBooking({ pax: parseInt(pax), dietaryNotes });
        onNext(true);
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
                <div className="max-w-2xl mx-auto w-full space-y-8 mt-4">
                    {/* Headcount */}
                    <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">
                            <span className="flex items-center">
                                <svg className="w-5 h-5 mr-2 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Number of Guests (Pax)
                                <span className="text-red-500 ml-1">*</span>
                            </span>
                        </label>
                        <input
                            type="number"
                            min="20"
                            max={bookingData.remainingPax || 3500}
                            value={pax}
                            onChange={(e) => handlePaxChange(e.target.value)}
                            placeholder="Enter number of guests (minimum 20)"
                            className="w-full p-4 border border-gray-200 rounded-xl text-gray-900 font-bold text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm"
                        />
                        <p className="text-xs text-gray-400 mt-2">Minimum of 20 guests required{bookingData.remainingPax ? `. Maximum: ${bookingData.remainingPax} for this date.` : '.'}</p>

                        {/* Quick-select presets */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            {[50, 100, 150, 200, 300, 500].map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => handlePaxChange(n)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                        pax === n
                                            ? 'bg-red-900 text-white shadow-md'
                                            : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-900'
                                    }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>

                        {bookingData.remainingPax && parseInt(pax) > bookingData.remainingPax && (
                            <p className="text-red-500 text-xs mt-3 font-bold flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Capacity exceeded! Only {bookingData.remainingPax} seats left for this date.
                            </p>
                        )}

                        {/* Quick summary */}
                        <div className="mt-4 p-4 bg-primary-50 rounded-xl border border-primary-100">
                            <p className="text-sm text-primary-700 font-medium text-center flex items-center justify-center">
                                <svg className="w-4 h-4 mr-1.5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
                                Planning for <span className="font-bold text-primary-900 ml-1">{pax} guests</span>
                            </p>
                        </div>
                    </div>

                    {/* Dietary Notes */}
                    <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide flex items-center">
                            <svg className="w-5 h-5 mr-2 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Dietary Notes
                            <span className="text-xs text-gray-400 ml-2 font-normal normal-case">(Optional)</span>
                        </label>
                        <textarea
                            rows="4"
                            placeholder="e.g., No pork, Vegan options needed, Nut-free, Halal..."
                            value={dietaryNotes}
                            onChange={(e) => handleDietaryChange(e.target.value)}
                            className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700 resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-2">
                            Let us know about any allergies, restrictions, or special dietary requirements.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-8 items-center border-t border-gray-100 mt-8">
                <button
                    onClick={onBack}
                    className="text-gray-500 font-medium hover:text-gray-800 px-4 py-3 transition-colors flex items-center text-sm"
                >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Go Back
                </button>
                <button
                    onClick={handleNext}
                    className="bg-red-900 text-white px-10 py-3.5 rounded-xl font-bold shadow-lg hover:bg-red-800 hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center text-sm"
                >
                    Continue
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default GuestLogistics;
