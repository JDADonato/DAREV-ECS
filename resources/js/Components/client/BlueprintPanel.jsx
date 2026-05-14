import { useMemo, useState, useEffect } from 'react';
import { fetchMenuItemsFromAPI } from '../../utils/menuUtils';

const CATEGORY_LABELS = {
    starter: 'Starter',
    main: 'Main Course',
    side: 'Sides',
    dessert: 'Dessert',
    drink: 'Refreshments'
};

const BlueprintPanel = ({ bookingData, currentStep }) => {
    const {
        eventType,
        pax,
        time,
        duration = 4,
        dietaryNotes,
        selectedDishes = {},
        venueDistance,
        isHighRise,
    } = bookingData;

    const [pricingOverrides, setPricingOverrides] = useState({});
    const [customItems, setCustomItems] = useState({ starter: [], main: [], side: [], dessert: [], drink: [] });

    // Accordion states
    const [expandedSections, setExpandedSections] = useState({
        event: true,
        menu: true,
        surcharges: true
    });

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    useEffect(() => {
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
        fetchOverrides();
        fetchMenuItemsFromAPI().then(organizedDishes => setCustomItems(organizedDishes));
    }, []);

    // Menu items organized by category (already structured from API)
    const mergedDishes = customItems;

    // Calculate menu total
    const menuTotal = useMemo(() => {
        if (bookingData.package_base_price) {
            return bookingData.package_base_price * pax;
        }

        let total = 0;
        Object.keys(selectedDishes).forEach(category => {
            const dishIds = selectedDishes[category] || [];
            dishIds.forEach(id => {
                const dish = mergedDishes[category]?.find(d => d.id === id);
                if (dish) {
                    const overrideId = `dish_${dish.id}`;
                    const customCost = pricingOverrides[overrideId] !== undefined ? pricingOverrides[overrideId] : dish.costPerHead;
                    total += customCost * (pax || 0);
                }
            });
        });
        return total;
    }, [selectedDishes, pax, pricingOverrides, mergedDishes, bookingData.package_base_price]);

    // Calculate surcharges
    const transportFee = useMemo(() => {
        if (venueDistance === 'outside-16-30') return 1500;
        if (venueDistance === 'outside-31-50') return 3000;
        return 0;
    }, [venueDistance]);

    const highRiseSurcharge = useMemo(() => {
        if (isHighRise) return Math.round(menuTotal * 0.03);
        return 0;
    }, [isHighRise, menuTotal]);

    const overtimeFee = useMemo(() => {
        return Math.max(0, duration - 4) * 5000;
    }, [duration]);

    const totalEstimate = menuTotal + transportFee + highRiseSurcharge + overtimeFee;

    // Count total dishes selected
    const totalDishCount = Object.values(selectedDishes).reduce(
        (sum, arr) => sum + (arr?.length || 0), 0
    );

    // Get action button text based on step
    const getButtonText = () => {
        switch (currentStep) {
            case 1: return 'Continue';
            case 2: return 'Continue';
            case 3: return 'Continue';
            case 4: return 'Confirm Menu';
            case 5: return 'Continue';
            case 6: return 'Confirm Booking';
            default: return 'Continue';
        }
    };

    return (
        <div className="w-full lg:w-[380px] flex-shrink-0">
            <div className="bg-gray-900 rounded-2xl shadow-2xl sticky top-24 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-900 to-red-950 px-6 py-5 border-b border-gray-700 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[.03]" style={{backgroundImage:'radial-gradient(circle at 80% 20%,#f0aa0b,transparent 40%)'}} />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-white font-display font-bold text-lg tracking-wide">Booking Summary</h3>
                            <p className="text-red-100/60 text-xs mt-0.5">Live event details</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-900/50 max-h-[calc(100vh-320px)]">
                    {/* EVENT DETAILS Section */}
                    <div className="border-b border-gray-800">
                        <button 
                            onClick={() => toggleSection('event')}
                            className="w-full flex justify-between items-center py-4 px-6 hover:bg-gray-800 transition-colors focus:outline-none"
                        >
                            <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center">
                                <svg className="w-3.5 h-3.5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Event Details
                            </h4>
                            <svg className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${expandedSections.event ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.event ? 'max-h-96 opacity-100 pb-5 px-6' : 'max-h-0 opacity-0 px-6'}`}>
                            <div className="space-y-3 pt-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 text-sm">Type</span>
                                    <span className={`text-sm font-medium ${eventType ? 'text-white' : 'text-gray-600 italic'}`}>
                                        {eventType || '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 text-sm">Guests</span>
                                    <span className={`text-sm font-medium ${pax ? 'text-white' : 'text-gray-600 italic'}`}>
                                        {pax ? `${pax} pax` : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 text-sm">Time</span>
                                    <span className={`text-sm font-medium ${time ? 'text-white' : 'text-gray-600 italic'}`}>
                                        {time || '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-500 text-sm">Dietary</span>
                                    <span className={`text-sm font-medium text-right max-w-[180px] ${dietaryNotes ? 'text-white' : 'text-gray-600 italic'}`}>
                                        {dietaryNotes || 'None'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MENU SELECTION Section */}
                    <div className="border-b border-gray-800">
                        <button 
                            onClick={() => toggleSection('menu')}
                            className="w-full flex justify-between items-center py-4 px-6 hover:bg-gray-800 transition-colors focus:outline-none"
                        >
                            <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center">
                                <svg className="w-3.5 h-3.5 mr-2 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                Menu Selection
                                {totalDishCount > 0 && (
                                    <span className="ml-2 bg-yellow-500/20 text-yellow-500 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                        {totalDishCount} items
                                    </span>
                                )}
                            </h4>
                            <svg className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${expandedSections.menu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>

                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.menu ? 'max-h-[800px] opacity-100 pb-5 px-6' : 'max-h-0 opacity-0 px-6'}`}>
                            {totalDishCount === 0 ? (
                                <p className="text-gray-600 text-sm italic pt-1">No dishes selected yet</p>
                            ) : (
                                <div className="space-y-5 pt-1">
                                    {Object.keys(CATEGORY_LABELS).map(category => {
                                        const dishIds = selectedDishes[category] || [];
                                        if (dishIds.length === 0) return null;

                                        return (
                                            <div key={category}>
                                                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest mb-2 border-b border-gray-800 pb-1">
                                                    {CATEGORY_LABELS[category]}
                                                </p>
                                                <div className="space-y-1.5">
                                                    {dishIds.map(id => {
                                                        const dish = mergedDishes[category]?.find(d => d.id === id);
                                                        if (!dish) return null;
                                                        const overrideId = `dish_${dish.id}`;
                                                        const customCost = pricingOverrides[overrideId] !== undefined ? pricingOverrides[overrideId] : dish.costPerHead;
                                                        const cost = customCost * (pax || 0);
                                                        return (
                                                            <div key={id} className="flex justify-between items-center text-sm animate-fadeIn group">
                                                                <span className="text-gray-300 truncate mr-3 group-hover:text-white transition-colors">
                                                                    <span className="text-red-900 mr-1.5 opacity-50">•</span>
                                                                    {dish.name}
                                                                </span>
                                                                <span className="text-white font-medium whitespace-nowrap">
                                                                    ₱{cost.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Surcharges Section */}
                    {(transportFee > 0 || highRiseSurcharge > 0 || overtimeFee > 0) && (
                        <div className="border-b border-gray-800">
                            <button 
                                onClick={() => toggleSection('surcharges')}
                                className="w-full flex justify-between items-center py-4 px-6 hover:bg-gray-800 transition-colors focus:outline-none"
                            >
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center">
                                    <svg className="w-3.5 h-3.5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Surcharges
                                </h4>
                                <svg className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${expandedSections.surcharges ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.surcharges ? 'max-h-56 opacity-100 pb-5 px-6' : 'max-h-0 opacity-0 px-6'}`}>
                                <div className="space-y-3 pt-1">
                                    {transportFee > 0 && (
                                        <div className="flex justify-between items-center text-sm animate-fadeIn">
                                            <span className="text-gray-400">Transport Fee</span>
                                            <span className="text-orange-400 font-medium">+₱{transportFee.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {highRiseSurcharge > 0 && (
                                        <div className="flex justify-between items-center text-sm animate-fadeIn">
                                            <span className="text-gray-400">High-Rise Labor (3%)</span>
                                            <span className="text-orange-400 font-medium">+₱{highRiseSurcharge.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {overtimeFee > 0 && (
                                        <div className="flex justify-between items-center text-sm animate-fadeIn">
                                            <span className="text-gray-400">Overtime ({duration - 4} hrs)</span>
                                            <span className="text-orange-400 font-medium">+₱{overtimeFee.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* TOTAL ESTIMATE Section */}
                <div className="border-t border-gray-700 px-6 py-5 bg-gray-800/50">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">Total Estimate</span>
                    </div>
                    <p className="text-3xl font-display font-bold text-white">
                        ₱{totalEstimate.toLocaleString()}
                    </p>
                    {pax > 0 && totalDishCount > 0 && (
                        <p className="text-gray-500 text-xs mt-1">
                            ~₱{Math.round(totalEstimate / pax).toLocaleString()} per head
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BlueprintPanel;
