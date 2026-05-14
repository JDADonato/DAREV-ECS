import { useState, useEffect } from 'react';
import Modal from '../common/Modal';

const CITY_OPTIONS = [
    // Metro Manila (Free)
    { value: 'caloocan', label: 'Caloocan', zone: 'metro-manila', fee: 0 },
    { value: 'las-pinas', label: 'Las Piñas', zone: 'metro-manila', fee: 0 },
    { value: 'makati', label: 'Makati', zone: 'metro-manila', fee: 0 },
    { value: 'malabon', label: 'Malabon', zone: 'metro-manila', fee: 0 },
    { value: 'mandaluyong', label: 'Mandaluyong', zone: 'metro-manila', fee: 0 },
    { value: 'manila', label: 'Manila', zone: 'metro-manila', fee: 0 },
    { value: 'marikina', label: 'Marikina', zone: 'metro-manila', fee: 0 },
    { value: 'muntinlupa', label: 'Muntinlupa', zone: 'metro-manila', fee: 0 },
    { value: 'navotas', label: 'Navotas', zone: 'metro-manila', fee: 0 },
    { value: 'paranaque', label: 'Parañaque', zone: 'metro-manila', fee: 0 },
    { value: 'pasay', label: 'Pasay', zone: 'metro-manila', fee: 0 },
    { value: 'pasig', label: 'Pasig', zone: 'metro-manila', fee: 0 },
    { value: 'pateros', label: 'Pateros', zone: 'metro-manila', fee: 0 },
    { value: 'quezon-city', label: 'Quezon City', zone: 'metro-manila', fee: 0 },
    { value: 'san-juan', label: 'San Juan', zone: 'metro-manila', fee: 0 },
    { value: 'taguig', label: 'Taguig', zone: 'metro-manila', fee: 0 },
    { value: 'valenzuela', label: 'Valenzuela', zone: 'metro-manila', fee: 0 },
    // 16–30km outside Metro Manila (+₱1,500)
    { value: 'antipolo', label: 'Antipolo', zone: 'outside-16-30', fee: 1500 },
    { value: 'bacoor', label: 'Bacoor', zone: 'outside-16-30', fee: 1500 },
    { value: 'binan', label: 'Biñan', zone: 'outside-16-30', fee: 1500 },
    { value: 'cainta', label: 'Cainta', zone: 'outside-16-30', fee: 1500 },
    { value: 'dasmariñas', label: 'Dasmariñas', zone: 'outside-16-30', fee: 1500 },
    { value: 'imus', label: 'Imus', zone: 'outside-16-30', fee: 1500 },
    { value: 'meycauayan', label: 'Meycauayan', zone: 'outside-16-30', fee: 1500 },
    { value: 'san-pedro', label: 'San Pedro', zone: 'outside-16-30', fee: 1500 },
    { value: 'taytay', label: 'Taytay', zone: 'outside-16-30', fee: 1500 },
    { value: 'rodriguez', label: 'Rodriguez (Montalban)', zone: 'outside-16-30', fee: 1500 },
    // 31–50km outside Metro Manila (+₱3,000)
    { value: 'angono', label: 'Angono', zone: 'outside-31-50', fee: 3000 },
    { value: 'binangonan', label: 'Binangonan', zone: 'outside-31-50', fee: 3000 },
    { value: 'cabuyao', label: 'Cabuyao', zone: 'outside-31-50', fee: 3000 },
    { value: 'carmona', label: 'Carmona', zone: 'outside-31-50', fee: 3000 },
    { value: 'general-trias', label: 'General Trias', zone: 'outside-31-50', fee: 3000 },
    { value: 'santa-rosa', label: 'Santa Rosa', zone: 'outside-31-50', fee: 3000 },
    { value: 'silang', label: 'Silang', zone: 'outside-31-50', fee: 3000 },
    { value: 'san-mateo', label: 'San Mateo', zone: 'outside-31-50', fee: 3000 },
    { value: 'norzagaray', label: 'Norzagaray', zone: 'outside-31-50', fee: 3000 },
    { value: 'teresa', label: 'Teresa', zone: 'outside-31-50', fee: 3000 }
];

const EventSurcharges = ({ bookingData, updateBooking, onNext, onBack, user }) => {
    const [formData, setFormData] = useState({
        client_full_name: bookingData.client_full_name || '',
        client_email: bookingData.client_email || user?.email || '',
        client_phone: bookingData.client_phone || user?.phone || '',
        venue_address_line: bookingData.venue_address_line || '',
        venue_street: bookingData.venue_street || '',
        venue_city: bookingData.venue_city || '',
    });

    const [isHighRise, setIsHighRise] = useState(bookingData.isHighRise || false);
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    // Auto-fill contact info from user account when available
    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                client_email: prev.client_email || user.email || '',
                client_phone: prev.client_phone || user.phone || '',
            }));
        }
    }, [user]);

    const [citySearch, setCitySearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const selectedCity = CITY_OPTIONS.find(c => c.value === formData.venue_city);
    const transportFee = selectedCity?.fee || 0;
    const venueDistance = selectedCity?.zone || 'metro-manila';

    const handleChange = (e) => {
        const updated = { ...formData, [e.target.name]: e.target.value };
        setFormData(updated);

        // If city changed, also update venueDistance based on zone
        if (e.target.name === 'venue_city') {
            const city = CITY_OPTIONS.find(c => c.value === e.target.value);
            updateBooking({
                ...updated,
                venueDistance: city?.zone || 'metro-manila'
            });
        } else {
            updateBooking(updated);
        }
    };

    const handleHighRiseChange = (checked) => {
        setIsHighRise(checked);
        updateBooking({ isHighRise: checked });
    };

    const handleConfirm = () => {
        if (!formData.client_full_name.trim()) {
            setModal({ isOpen: true, type: 'error', title: 'Missing Information', message: 'Please enter your full name.' });
            return;
        }
        if (!formData.venue_address_line.trim() || !formData.venue_city) {
            setModal({ isOpen: true, type: 'error', title: 'Missing Address', message: 'Please fill in the address and select a city.' });
            return;
        }

        updateBooking({
            ...formData,
            venueDistance,
            isHighRise
        });
        onNext(true);
    };

    // Group cities for the dropdown (filtered by search)
    const filteredCities = CITY_OPTIONS.filter(c => c.label.toLowerCase().includes(citySearch.toLowerCase()));
    const metroCities = filteredCities.filter(c => c.zone === 'metro-manila');
    const nearCities = filteredCities.filter(c => c.zone === 'outside-16-30');
    const farCities = filteredCities.filter(c => c.zone === 'outside-31-50');

    const handleSelectCity = (city) => {
        handleChange({ target: { name: 'venue_city', value: city.value } });
        setIsDropdownOpen(false);
        setCitySearch('');
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

            <div className="space-y-6">
                <div className="max-w-3xl mx-auto w-full space-y-6 mt-4">
                    {/* Client Info */}
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                            Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="client_full_name"
                            placeholder="Enter your full name"
                            value={formData.client_full_name}
                            onChange={handleChange}
                            className="w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700 font-medium"
                        />
                    </div>

                    {/* Contact */}
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                            Contact Information
                        </label>
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

                    {/* Venue Address */}
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">
                            Venue Address <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Address Line</label>
                                <input type="text" name="venue_address_line" placeholder="e.g. Building name, lot/block number" value={formData.venue_address_line} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Street</label>
                                <input type="text" name="venue_street" placeholder="Street name" value={formData.venue_street} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-700" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">
                                    City / Municipality <span className="text-red-500">*</span>
                                </label>

                                {/* Custom Searchable Dropdown */}
                                <div className="relative">
                                    <div
                                        className="w-full p-3 border border-gray-200 rounded-lg flex items-center justify-between cursor-pointer bg-white shadow-sm focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent"
                                        onClick={() => setIsDropdownOpen(true)}
                                    >
                                        <div className={`w-full ${formData.venue_city ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                                            {selectedCity ? (
                                                <div className="flex justify-between items-center w-full pr-4">
                                                    <span>{selectedCity.label}</span>
                                                    {selectedCity.fee > 0 && (
                                                        <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold border border-red-200">
                                                            +₱{selectedCity.fee.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : 'Search or select a city...'}
                                        </div>
                                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>

                                    {isDropdownOpen && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                                            <div className="p-2 border-b border-gray-100 bg-gray-50">
                                                <div className="relative">
                                                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                    <input
                                                        type="text"
                                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                        placeholder="Search city..."
                                                        value={citySearch}
                                                        onChange={(e) => setCitySearch(e.target.value)}
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>

                                            <div className="max-h-60 overflow-y-auto w-full" onClick={(e) => e.stopPropagation()}>
                                                {filteredCities.length === 0 ? (
                                                    <div className="p-4 text-center text-sm text-gray-500">No cities found.</div>
                                                ) : (
                                                    <>
                                                        {metroCities.length > 0 && (
                                                            <div className="mb-2">
                                                                <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase bg-gray-50 tracking-wider">Metro Manila — Free</div>
                                                                {metroCities.map(c => (
                                                                    <div key={c.value} className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-red-50 transition-colors flex justify-between items-center border-b border-gray-50 last:border-0 ${formData.venue_city === c.value ? 'bg-red-50 text-red-900 font-bold' : 'text-gray-700'}`} onClick={() => handleSelectCity(c)}>
                                                                        <span>{c.label}</span>
                                                                        {formData.venue_city === c.value && <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {nearCities.length > 0 && (
                                                            <div className="mb-2">
                                                                <div className="px-3 py-2 text-[10px] font-bold text-red-800 uppercase bg-red-50 tracking-wider">16–30km Outside Metro Manila</div>
                                                                {nearCities.map(c => (
                                                                    <div key={c.value} className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-red-50 transition-colors flex justify-between items-center border-b border-gray-50 last:border-0 ${formData.venue_city === c.value ? 'bg-red-50 text-red-900 font-bold' : 'text-gray-700'}`} onClick={() => handleSelectCity(c)}>
                                                                        <span>{c.label}</span>
                                                                        <span className="text-[10px] font-bold text-red-600 bg-red-100/50 px-1.5 py-0.5 rounded border border-red-100">+₱1,500</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {farCities.length > 0 && (
                                                            <div className="mb-2">
                                                                <div className="px-3 py-2 text-[10px] font-bold text-red-800 uppercase bg-red-50 tracking-wider">31–50km Outside Metro Manila</div>
                                                                {farCities.map(c => (
                                                                    <div key={c.value} className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-red-50 transition-colors flex justify-between items-center border-b border-gray-50 last:border-0 ${formData.venue_city === c.value ? 'bg-red-50 text-red-900 font-bold' : 'text-gray-700'}`} onClick={() => handleSelectCity(c)}>
                                                                        <span>{c.label}</span>
                                                                        <span className="text-[10px] font-bold text-red-600 bg-red-100/50 px-1.5 py-0.5 rounded border border-red-100">+₱3,000</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Backdrop to close dropdown */}
                                {isDropdownOpen && (
                                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                                )}

                                {/* Fee indicator */}
                                {formData.venue_city && (
                                    <div className={`mt-2 p-2.5 rounded-lg text-xs font-medium flex items-center ${transportFee > 0
                                        ? 'bg-yellow-50 border border-yellow-100 text-yellow-700'
                                        : 'bg-green-50 border border-green-100 text-green-700'
                                        }`}>
                                        {transportFee > 0 ? (
                                            <>
                                                <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                                                +₱{transportFee.toLocaleString()} transport fee will be added
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                No transport fee — within Metro Manila
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* High-Rise Venue Checkbox */}
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <label className="flex items-start gap-4 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isHighRise}
                                onChange={(e) => handleHighRiseChange(e.target.checked)}
                                className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                            />
                            <div>
                                <span className="font-bold text-gray-700 block">High-Rise Venue</span>
                                <span className="text-xs text-gray-500 block mt-1">
                                    Check this if your venue is in a high-rise building (5+ floors). A <span className="font-semibold text-yellow-600">3% labor surcharge</span> will be added to cover additional logistics.
                                </span>
                            </div>
                        </label>

                        {isHighRise && (
                            <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100 animate-fadeIn">
                                <p className="text-xs text-yellow-700 font-medium flex items-center">
                                    <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                                    A 3% labor surcharge will be applied to your menu total.
                                </p>
                            </div>
                        )}
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
                    onClick={handleConfirm}
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

export default EventSurcharges;
