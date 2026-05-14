import { useState } from 'react';
import Modal from '../common/Modal';

const Tooltip = ({ text }) => {
    return (
        <div className="relative group inline-block ml-2 cursor-help font-normal">
            <svg className="w-4 h-4 text-gray-400 hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                {text}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
            </div>
        </div>
    );
};

const EventDetailsForm = ({ bookingData, updateBooking, onSubmit, onBack, user }) => {
    const [formData, setFormData] = useState({
        client_full_name: bookingData.client_full_name || '',
        client_email: bookingData.client_email || user?.email || '',
        client_phone: bookingData.client_phone || user?.phone || '',
        venue_address_line: bookingData.venue_address_line || '',
        venue_street: bookingData.venue_street || '',
        venue_city: bookingData.venue_city || '',
        venue_province: bookingData.venue_province || '',
        venue_zip_code: bookingData.venue_zip_code || '',
        venue_building_details: bookingData.venue_building_details || '',
        outsourced_emcee: bookingData.outsourced_services?.includes('Emcee') || false,
        outsourced_photographer: bookingData.outsourced_services?.includes('Photographer') || false,
        outsourced_lights_sound: bookingData.outsourced_services?.includes('Lights & Sound') || false,
    });

    const [showTasting, setShowTasting] = useState(false);
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
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        const updated = { ...formData, [e.target.name]: value };
        setFormData(updated);
        // Keep tasting fields in sync if "same as above" is checked
        if (sameAsAbove) {
            setTastingData(prev => ({
                ...prev,
                guest_name: updated.client_full_name,
                guest_email: updated.client_email,
                guest_phone: updated.client_phone,
            }));
        }
    };

    const handleTastingChange = (e) => {
        setTastingData({ ...tastingData, [e.target.name]: e.target.value });
    };

    const handleSameAsAbove = (checked) => {
        setSameAsAbove(checked);
        if (checked) {
            setTastingData(prev => ({
                ...prev,
                guest_name: formData.client_full_name,
                guest_email: formData.client_email,
                guest_phone: formData.client_phone,
            }));
        }
    };

    const handleConfirm = () => {
        if (!formData.client_full_name.trim()) {
            setModal({ isOpen: true, type: 'error', title: 'Missing Information', message: 'Please enter your full name.' });
            return;
        }
        if (!formData.venue_address_line.trim() || !formData.venue_city.trim() || !formData.venue_province.trim()) {
            setModal({ isOpen: true, type: 'error', title: 'Missing Address', message: 'Please fill in the required address fields (Address Line, City, Province).' });
            return;
        }

        // Collect selected outsourced services
        const selectedServices = [];
        if (formData.outsourced_emcee) selectedServices.push("Emcee");
        if (formData.outsourced_photographer) selectedServices.push("Photographer");
        if (formData.outsourced_lights_sound) selectedServices.push("Lights & Sound");

        // Build final data and pass directly to onSubmit (avoids stale state)
        const finalData = {
            ...formData,
            outsourced_services: selectedServices,
            tasting_guest_name: tastingData.guest_name,
            tasting_guest_email: tastingData.guest_email,
            tasting_guest_phone: tastingData.guest_phone,
            tasting_preferred_date: tastingData.preferred_date,
            tasting_preferred_time: tastingData.preferred_time,
            tasting_notes: tastingData.notes,
            wantsTasting: showTasting && tastingData.preferred_date && tastingData.preferred_time
        };

        updateBooking(finalData);
        onSubmit(finalData);
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
                <div className="text-center">
                    <h2 className="text-3xl font-display font-bold text-gray-900">Event Details</h2>
                    <p className="text-gray-500 mt-2">Tell us about yourself and where the event will take place.</p>
                </div>

                {/* Client Full Name */}
                <div className="max-w-3xl mx-auto w-full">
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Full Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="client_full_name"
                            placeholder="Enter your full name"
                            value={formData.client_full_name}
                            onChange={handleChange}
                            className="w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700 font-medium"
                        />
                    </div>
                </div>

                {/* Email & Phone */}
                <div className="max-w-3xl mx-auto w-full">
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Contact Information <span className="text-red-500">*</span></label>
                        <p className="text-xs text-gray-400 mb-4">Pre-filled from your account. You can edit if needed.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Email Address</label>
                                <input
                                    type="email"
                                    name="client_email"
                                    placeholder="your@email.com"
                                    value={formData.client_email}
                                    onChange={handleChange}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Mobile Number</label>
                                <input
                                    type="tel"
                                    name="client_phone"
                                    placeholder="Mobile number"
                                    value={formData.client_phone}
                                    onChange={handleChange}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Venue Address */}
                <div className="max-w-3xl mx-auto w-full">
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Venue Address <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Address Line</label>
                                <input
                                    type="text"
                                    name="venue_address_line"
                                    placeholder="e.g. Building name, lot/block number"
                                    value={formData.venue_address_line}
                                    onChange={handleChange}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Street</label>
                                <input
                                    type="text"
                                    name="venue_street"
                                    placeholder="Street name"
                                    value={formData.venue_street}
                                    onChange={handleChange}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">City / Municipality</label>
                                <input
                                    type="text"
                                    name="venue_city"
                                    placeholder="City or Municipality"
                                    value={formData.venue_city}
                                    onChange={handleChange}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Province</label>
                                <input
                                    type="text"
                                    name="venue_province"
                                    placeholder="Province"
                                    value={formData.venue_province}
                                    onChange={handleChange}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Zip Code</label>
                                <input
                                    type="text"
                                    name="venue_zip_code"
                                    placeholder="Zip Code"
                                    value={formData.venue_zip_code}
                                    onChange={handleChange}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                />
                            </div>
                            <div className="md:col-span-2 mt-4 space-y-1 block">
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Building / Floor / High-Rise Details (Optional)</label>
                                <input
                                    type="text"
                                    name="venue_building_details"
                                    placeholder="e.g. 15th Floor, Tower 2 (High-rise venues incur 3% surcharge)"
                                    value={formData.venue_building_details}
                                    onChange={handleChange}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Outsourced Services */}
                <div className="max-w-3xl mx-auto w-full">
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide flex items-center">
                            Outsourced Services Recommendations
                            <Tooltip text="We can recommend trusted third-party services. Note: Checking these boxes will NOT add them to your official billing." />
                        </label>
                        <p className="text-xs text-gray-500 mb-4">Check the boxes below if you need recommendations for these services. This is not added to your final bill.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-white hover:border-primary-300 transition-colors">
                                <input
                                    type="checkbox"
                                    name="outsourced_emcee"
                                    checked={formData.outsourced_emcee}
                                    onChange={handleChange}
                                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                />
                                <span className="font-medium text-gray-700 select-none">Emcee</span>
                            </label>

                            <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-white hover:border-primary-300 transition-colors">
                                <input
                                    type="checkbox"
                                    name="outsourced_photographer"
                                    checked={formData.outsourced_photographer}
                                    onChange={handleChange}
                                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                />
                                <span className="font-medium text-gray-700 select-none">Photographer</span>
                            </label>

                            <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-white hover:border-primary-300 transition-colors">
                                <input
                                    type="checkbox"
                                    name="outsourced_lights_sound"
                                    checked={formData.outsourced_lights_sound}
                                    onChange={handleChange}
                                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                />
                                <span className="font-medium text-gray-700 select-none">Lights & Sound</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Optional Food Tasting */}
                <div className="max-w-3xl mx-auto w-full">
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">Food Tasting</label>
                                <p className="text-xs text-gray-400 mt-1">Schedule a tasting session before your event</p>
                            </div>
                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full uppercase tracking-wide">Optional</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowTasting(!showTasting)}
                            className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all border-2 ${showTasting
                                ? 'border-primary-500 bg-primary-50 text-primary-700'
                                : 'border-dashed border-gray-300 text-gray-500 hover:border-primary-300 hover:text-primary-600'
                                }`}
                        >
                            {showTasting ? '✓ Food Tasting Enabled — Fill in details below' : '+ Add Food Tasting Request'}
                        </button>

                        {showTasting && (
                            <div className="mt-6 space-y-4 animate-fadeIn">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1 font-medium">Guest Name</label>
                                        <input
                                            type="text"
                                            name="guest_name"
                                            placeholder="Name for the tasting"
                                            value={tastingData.guest_name}
                                            onChange={handleTastingChange}
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
                                            onChange={handleTastingChange}
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
                                            onChange={handleTastingChange}
                                            disabled={sameAsAbove}
                                            className={`w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700 ${sameAsAbove ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                        />
                                    </div>
                                </div>

                                {/* Same details as above checkbox */}
                                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                                    <input
                                        type="checkbox"
                                        checked={sameAsAbove}
                                        onChange={(e) => handleSameAsAbove(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                    />
                                    <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors select-none">
                                        Same details as above
                                    </span>
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1 font-medium">Preferred Date</label>
                                        <input
                                            type="date"
                                            name="preferred_date"
                                            value={tastingData.preferred_date}
                                            onChange={handleTastingChange}
                                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1 font-medium">Preferred Time</label>
                                        <input
                                            type="time"
                                            name="preferred_time"
                                            value={tastingData.preferred_time}
                                            onChange={handleTastingChange}
                                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">Notes / Dietary Requirements</label>
                                    <textarea
                                        name="notes"
                                        rows="3"
                                        placeholder="Any dietary restrictions or special requests..."
                                        value={tastingData.notes}
                                        onChange={handleTastingChange}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700"
                                    ></textarea>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-between pt-12">
                <button
                    onClick={onBack}
                    className="text-gray-500 hover:text-gray-700 font-medium flex items-center transition-colors"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
                    Back to Menu
                </button>

                <button
                    onClick={handleConfirm}
                    className="bg-primary-600 text-white px-10 py-4 rounded-xl font-bold shadow-lg hover:bg-primary-700 hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center"
                >
                    Confirm Booking
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </button>
            </div>
        </div>
    );
};

export default EventDetailsForm;
