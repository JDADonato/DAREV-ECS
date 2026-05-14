import { useState, useEffect } from 'react';
import Modal from '../common/Modal';

const BudgetEstimator = ({ bookingData, updateBooking, onNext, onBack }) => {
    const [pax, setPax] = useState(bookingData.pax);
    const [budget, setBudget] = useState(bookingData.budget);
    const [estimatedCost, setEstimatedCost] = useState({ low: 0, high: 0 });

    useEffect(() => {
        const lowEst = pax * 550;
        const highEst = pax * 1000;
        setEstimatedCost({ low: lowEst, high: highEst });
    }, [pax]);

    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const handleNext = () => {
        const minBudget = estimatedCost.low;
        const remainingPax = bookingData.remainingPax; // Define remainingPax from bookingData

        if (parseInt(budget) < minBudget) { // Use the local state `budget` for validation
            setModal({
                isOpen: true,
                type: 'error',
                title: 'Budget Too Low',
                message: `Your budget is below the minimum estimated cost (₱${minBudget.toLocaleString()}) for ${pax} guests. Please adjust your budget or pax count.`
            });
            return;
        }

        if (remainingPax && parseInt(pax) > remainingPax) { // Use the local state `pax` for validation
            setModal({
                isOpen: true,
                type: 'error',
                title: 'Capacity Exceeded',
                message: `We only have ${remainingPax} slots remaining for this date. Please reduce your guest count.`
            });
            return;
        }

        updateBooking({ pax: parseInt(pax), budget: parseInt(budget) }); // Update with local state `pax` and `budget`
        onNext();
    };

    return (
        <>
            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 mt-8 items-center">
                {/* Inputs */}
                <div className="space-y-8">
                    <div>
                        <label className="flex justify-between text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                            Number of Guests (Pax)
                            <input
                                type="number"
                                min="20"
                                max={bookingData.remainingPax || 3500}
                                value={pax}
                                onChange={(e) => setPax(e.target.value)}
                                className="w-24 p-2 border border-gray-200 rounded text-right text-primary-600 font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </label>
                        <input
                            type="range"
                            min="20"
                            max="3500"
                            step="10"
                            value={pax}
                            onChange={(e) => setPax(e.target.value)}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                            <span>20</span>
                            <span>1750</span>
                            <span>{bookingData.remainingPax ? `Max: ${bookingData.remainingPax}` : '3500+'}</span>
                        </div>
                        {bookingData.remainingPax && parseInt(pax) > bookingData.remainingPax && (
                            <p className="text-red-500 text-xs mt-2 font-bold">
                                Capacity exceeded! Only {bookingData.remainingPax} seats left for this date.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Target Budget (PHP)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₱</span>
                            <input
                                type="number"
                                min="0"
                                step="1000"
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                                className="w-full pl-8 pr-4 py-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-900 font-bold text-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Estimate Card */}
                <div className="bg-gradient-to-br from-primary-50 to-white p-8 rounded-2xl border border-primary-100 shadow-xl text-center transform transition-transform hover:scale-105">
                    <h3 className="text-primary-800 font-bold uppercase tracking-widest text-sm mb-4">Estimated Cost Range</h3>
                    <div className="space-y-2">
                        <p className="text-4xl font-display font-bold text-gray-900">
                            <span className="text-2xl text-gray-400 align-top">₱</span>{estimatedCost.low.toLocaleString()}
                        </p>
                        <p className="text-gray-400 font-medium">to</p>
                        <p className="text-4xl font-display font-bold text-primary-600">
                            <span className="text-2xl text-primary-300 align-top">₱</span>{estimatedCost.high.toLocaleString()}
                        </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-6 bg-white/50 py-2 px-4 rounded-full inline-block">
                        *Based on {pax} guests. Varies by package choice.
                    </p>
                </div>
            </div>

            <div className="flex justify-between pt-12 items-center border-t border-gray-100 mt-8">
                <button
                    onClick={onBack}
                    className="text-gray-500 font-bold hover:text-gray-800 px-6 py-3 transition-colors flex items-center"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Back
                </button>
                <button
                    onClick={handleNext}
                    className="bg-primary-600 text-white px-10 py-4 rounded-xl font-bold shadow-lg hover:bg-primary-700 hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center"
                >
                    View Packages
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
            </div>
        </>
    );
};

export default BudgetEstimator;
