import React, { useState, useEffect } from 'react';

const PackageSelector = ({ bookingData, updateBooking, onNext, onBack }) => {
    const [pricingOverrides, setPricingOverrides] = useState({});
    const [packages, setPackages] = useState([]);

    useEffect(() => {
        fetchOverrides();
        // Fetch packages from API
        fetch('/api/packages?per_page=50')
            .then(res => res.json())
            .then(data => {
                const pkgs = Array.isArray(data.data) ? data.data : [];
                setPackages(pkgs);
            })
            .catch(err => console.error('Error fetching packages:', err));
    }, []);

    const fetchOverrides = async () => {
        try {
            const res = await fetch('/api/pricing');
            if (res.ok) {
                const data = await res.json();
                setPricingOverrides(data.overrides || {});
            }
        } catch (error) {
            console.error("Error fetching pricing overrides:", error);
        }
    };

    const handleSelect = (pkg) => {
        updateBooking({
            selectedPackage: pkg,
            customMenu: {
                starters: Array(pkg.menuStructure.starters).fill(null),
                mains: Array(pkg.menuStructure.mains).fill(null),
                sides: Array(pkg.menuStructure.sides).fill(null),
                desserts: Array(pkg.menuStructure.desserts).fill(null),
                drinks: Array(pkg.menuStructure.drinks).fill(null),
            }
        });
        onNext();
    };

    return (
        <div className="flex flex-col h-full justify-between animate-fadeIn">
            <div className="space-y-8">
                <div className="text-center">
                    <h2 className="text-3xl font-display font-bold text-gray-900">Select Your Package</h2>
                    <p className="text-gray-500 mt-2">Curated experiences for your <span className="font-semibold text-primary-600">{bookingData.pax} guests</span>.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                    {packages.map(pkg => {
                        // Map API fields to expected field names
                        const package_ = {
                            ...pkg,
                            minPax: pkg.minimum_pax,
                            basePricePerHead: pkg.base_price_per_head,
                        };
                        return (
                        <div
                            key={pkg.id}
                            className="group relative bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-2xl hover:border-primary-200 transition-all duration-300 flex flex-col"
                        >
                            {/* Color Bar */}
                            <div className={`h-3 w-full ${pkg.type === 'wedding' ? 'bg-gradient-to-r from-pink-500 to-rose-400' : pkg.type === 'corporate' ? 'bg-gradient-to-r from-blue-600 to-blue-400' : 'bg-gradient-to-r from-orange-500 to-yellow-400'}`}></div>

                            <div className="p-8 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${pkg.type === 'wedding' ? 'bg-pink-50 text-pink-600' : pkg.type === 'corporate' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                        {pkg.type}
                                    </span>
                                    {bookingData.pax >= pkg.minPax ? (
                                        <span className="text-green-500 text-xs font-bold flex items-center">
                                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            Fits Count
                                        </span>
                                    ) : (
                                        <span className="text-red-400 text-xs font-bold">Min {pkg.minPax} Pax</span>
                                    )}
                                </div>

                                <h3 className="text-2xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                                <p className="text-gray-500 text-sm mb-6 flex-1">{pkg.description}</p>

                                <div className="space-y-3 mb-8">
                                    {((package_.inclusions && typeof package_.inclusions === 'string') ? JSON.parse(package_.inclusions) : package_.inclusions || []).slice(0, 3).map((inc, i) => (
                                        <div key={i} className="flex items-start text-sm text-gray-600">
                                            <svg className="w-5 h-5 text-primary-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            {typeof inc === 'string' ? inc : inc.name}
                                        </div>
                                    ))}
                                    {(((package_.inclusions && typeof package_.inclusions === 'string') ? JSON.parse(package_.inclusions) : package_.inclusions || []).length > 3) && (
                                        <div className="text-xs text-center text-gray-400 italic pt-2">+ {((package_.inclusions && typeof package_.inclusions === 'string') ? JSON.parse(package_.inclusions) : package_.inclusions || []).length - 3} more inclusions</div>
                                    )}
                                </div>

                                <div className="mt-auto pt-6 border-t border-gray-50">
                                    <div className="flex items-end justify-between mb-6">
                                        <span className="text-sm font-medium text-gray-400">Base Price</span>
                                        <div className="text-right">
                                            <span className="text-3xl font-bold text-gray-900">₱{pricingOverrides[`package_${pkg.id}`] !== undefined ? pricingOverrides[`package_${pkg.id}`] : package_.basePricePerHead}</span>
                                            <span className="text-xs text-gray-500 block">per head</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleSelect({ ...pkg, basePrice: pricingOverrides[`package_${pkg.id}`] !== undefined ? pricingOverrides[`package_${pkg.id}`] : package_.basePricePerHead })}
                                        className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wide transition-all transform active:scale-95 bg-gray-900 text-white hover:bg-primary-600 hover:shadow-lg shadow-md"
                                    >
                                        Select Package
                                    </button>
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-start pt-12 border-t border-gray-100 mt-8">
                <button
                    onClick={onBack}
                    className="text-gray-500 font-bold hover:text-gray-800 px-6 py-3 transition-colors flex items-center"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Back
                </button>
            </div>
        </div>
    );
};

export default PackageSelector;
