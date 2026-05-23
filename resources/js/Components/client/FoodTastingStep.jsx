import { useEffect, useState } from 'react';
import Modal from '../common/Modal';

const FoodTastingStep = ({ bookingData, updateBooking, onSubmit, onBack, isSubmitting = false }) => {
    const [showTasting, setShowTasting] = useState(true);
    const [sameAsAbove, setSameAsAbove] = useState(false);
    const [tastingData, setTastingData] = useState({
        guest_name: bookingData.tasting_guest_name || '',
        guest_email: bookingData.tasting_guest_email || '',
        guest_phone: bookingData.tasting_guest_phone || '',
        preferred_date: bookingData.tasting_preferred_date || '',
        preferred_time: bookingData.tasting_preferred_time || '',
        notes: bookingData.tasting_notes || '',
    });
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    useEffect(() => {
        updateBooking({ wantsTasting: true });
    }, []);

    const handleChange = (event) => {
        setTastingData({ ...tastingData, [event.target.name]: event.target.value });
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
                message: 'Please select a preferred date and time for your tasting session.',
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
            tasting_notes: tastingData.notes,
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
        <div className="booking-step animate-fadeIn">
            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />

            <div className="booking-step-grid">
                <section className="booking-step-panel">
                    <p className="booking-step-kicker">Final preference</p>
                    <h2>Would you like to schedule a tasting?</h2>
                    <p className="booking-step-copy">
                        You can request a tasting before the event, or submit the booking now and coordinate details with the team later.
                    </p>
                    <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
                        Food tasting lets you sample selected dishes, confirm flavors, and share final notes before the event menu is locked in.
                    </p>

                    {isSubmitting && (
                        <div className="booking-inline-error border-[#f0aa0b]/40 bg-[#f0aa0b]/10 text-[#6f4a05]">
                            Submitting your booking. Please keep this page open.
                        </div>
                    )}
                </section>

                <section className="booking-choice-area">
                    <div className="booking-preset-grid">
                        <button
                            type="button"
                            onClick={() => setShowTasting(true)}
                            disabled={isSubmitting}
                            className={`booking-preset ${showTasting ? 'booking-preset-active' : ''}`}
                        >
                            <strong>Schedule tasting</strong>
                            <span>Pick a preferred date and time.</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleSkipToCheckout}
                            disabled={isSubmitting}
                            className="booking-preset"
                        >
                            <strong>{isSubmitting ? 'Submitting...' : 'Submit without tasting'}</strong>
                            <span>Proceed with the booking request.</span>
                        </button>
                    </div>

                    {showTasting && (
                        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label>
                                <span className="booking-field-label">Guest name</span>
                                <input
                                    type="text"
                                    name="guest_name"
                                    placeholder="Name for the tasting"
                                    value={tastingData.guest_name}
                                    onChange={handleChange}
                                    disabled={sameAsAbove}
                                    className="booking-input disabled:cursor-not-allowed disabled:bg-gray-100"
                                />
                            </label>
                            <label>
                                <span className="booking-field-label">Email address</span>
                                <input
                                    type="email"
                                    name="guest_email"
                                    placeholder="Email address"
                                    value={tastingData.guest_email}
                                    onChange={handleChange}
                                    disabled={sameAsAbove}
                                    className="booking-input disabled:cursor-not-allowed disabled:bg-gray-100"
                                />
                            </label>
                            <label>
                                <span className="booking-field-label">Mobile number</span>
                                <input
                                    type="tel"
                                    name="guest_phone"
                                    placeholder="Phone number"
                                    value={tastingData.guest_phone}
                                    onChange={handleChange}
                                    disabled={sameAsAbove}
                                    className="booking-input disabled:cursor-not-allowed disabled:bg-gray-100"
                                />
                            </label>
                            <label className="flex items-center gap-3 self-end rounded-2xl border border-gray-200 bg-white px-4 py-4">
                                <input
                                    type="checkbox"
                                    checked={sameAsAbove}
                                    onChange={(event) => handleSameAsAbove(event.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-[#720101] focus:ring-[#720101]"
                                />
                                <span className="text-sm font-semibold text-gray-600">Use my booking contact details</span>
                            </label>
                            <label>
                                <span className="booking-field-label">Preferred date</span>
                                <input
                                    type="date"
                                    name="preferred_date"
                                    min={getMinDate()}
                                    value={tastingData.preferred_date}
                                    onChange={handleChange}
                                    className="booking-input"
                                />
                            </label>
                            <label>
                                <span className="booking-field-label">Preferred time</span>
                                <input
                                    type="time"
                                    name="preferred_time"
                                    value={tastingData.preferred_time}
                                    onChange={handleChange}
                                    className="booking-input"
                                />
                            </label>
                            <label className="md:col-span-2">
                                <span className="booking-field-label">Notes</span>
                                <textarea
                                    name="notes"
                                    rows="3"
                                    placeholder="Dietary restrictions or tasting requests"
                                    value={tastingData.notes}
                                    onChange={handleChange}
                                    className="booking-note-field"
                                />
                            </label>
                        </div>
                    )}
                </section>
            </div>

            <div className="booking-step-actions">
                <button onClick={onBack} disabled={isSubmitting} className="booking-secondary-btn disabled:cursor-not-allowed disabled:opacity-50">Back</button>
                {showTasting && (
                    <button onClick={handleSubmitWithTasting} disabled={isSubmitting} className="booking-primary-btn disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">
                        {isSubmitting ? 'Submitting...' : 'Submit Booking'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default FoodTastingStep;
