import { useState, useEffect, useMemo } from 'react';
import { fetchMenuItemsFromAPI } from '../../utils/menuUtils';

const MenuCustomizer = ({ bookingData, updateBooking, onNext, onBack }) => {
    const { selectedPackage, customMenu, pax, budget } = bookingData;

    // Convert existing customMenu (arrays of nulls/objects) to a cleaner ID list structure if needed, 
    // or just initialize fresh for the new checklist style. 
    // Let's use a Set or Array of IDs for each category to allow unlimited selection.
    const [selections, setSelections] = useState({
        starter: [],
        main: [],
        side: [],
        dessert: [],
        drink: []
    });

    const [totalPrice, setTotalPrice] = useState(0);
    const [isOverBudget, setIsOverBudget] = useState(false);
    const [upgradeBreakdown, setUpgradeBreakdown] = useState([]);
    const [showBreakdown, setShowBreakdown] = useState(false);

    // ==========================================
    // PRICING CONTROL STATE
    // ==========================================
    const [pricingOverrides, setPricingOverrides] = useState({});
    const [customItems, setCustomItems] = useState({ starter: [], main: [], side: [], dessert: [], drink: [] });

    // Initial load: Try to map previous selections if existing, else empty
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

    // Price Calculation Logic
    useEffect(() => {
        let adjustments = 0;
        const extraItemBasePrice = 150; // Cost added per head for EXTRA dishes beyond package limit
        const breakdown = [];

        const categoryLabels = {
            starter: 'Starters',
            main: 'Main Courses',
            side: 'Side Dishes',
            dessert: 'Desserts',
            drink: 'Beverages'
        };

        Object.keys(selections).forEach(category => {
            const selectedIds = selections[category];
            const limit = selectedPackage.menuStructure[category];

            selectedIds.forEach((id, index) => {
                const dish = mergedDishes[category]?.find(d => d.id === id);
                if (dish) {
                    const customPrice = dish.priceAdj || 0;

                    // 1. Always add the dish's specific price adjustment (e.g., Roast Beef +150)
                    if (customPrice > 0) {
                        adjustments += customPrice;
                        breakdown.push({
                            name: dish.name,
                            category: categoryLabels[category],
                            type: 'Premium Upgrade',
                            perHead: customPrice,
                            total: customPrice * pax
                        });
                    }

                    // 2. If we selected more than the package allows, add extra dish fee
                    if (index >= limit) {
                        adjustments += extraItemBasePrice;
                        breakdown.push({
                            name: dish.name,
                            category: categoryLabels[category],
                            type: 'Extra Slot Fee',
                            perHead: extraItemBasePrice,
                            total: extraItemBasePrice * pax
                        });
                    }
                }
            });
        });

        const totalPerHead = selectedPackage.basePrice + adjustments;
        const total = totalPerHead * pax;
        setTotalPrice(total);
        setIsOverBudget(total > budget);
        setUpgradeBreakdown(breakdown);

    }, [selections, pax, selectedPackage, budget]);


    const toggleSelection = (category, dishId) => {
        setSelections(prev => {
            const currentList = prev[category];
            if (currentList.includes(dishId)) {
                return { ...prev, [category]: currentList.filter(id => id !== dishId) };
            } else {
                return { ...prev, [category]: [...currentList, dishId] };
            }
        });
    };

    const renderCategory = (category, label) => {
        const selectedIds = selections[category];
        const limit = selectedPackage.menuStructure[category];
        const count = selectedIds.length;

        return (
            <div className="mb-10 animate-fadeIn" key={category}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <h4 className="font-bold text-gray-800 text-xl">{label}</h4>
                        <span className={`ml-3 text-xs font-bold px-2 py-1 rounded-full ${count > limit ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                            {count} / {limit} Included
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...(mergedDishes[category] || [])]
                        .sort((a, b) => {
                            const customPriceA = a.priceAdj || 0;
                            const customPriceB = b.priceAdj || 0;

                            // Best sellers first, then base price (0) before premium, then by price ascending
                            if (a.isBestSeller !== b.isBestSeller) return b.isBestSeller ? 1 : -1;
                            return customPriceA - customPriceB;
                        })
                        .map(dish => {
                            const isSelected = selectedIds.includes(dish.id);
                            const isExtra = isSelected && selectedIds.indexOf(dish.id) >= limit;

                            return (
                                <div
                                    key={dish.id}
                                    onClick={() => toggleSelection(category, dish.id)}
                                    className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 group ${isSelected
                                        ? 'border-primary-500 shadow-md ring-1 ring-primary-500 bg-primary-50'
                                        : 'border-gray-100 hover:border-primary-200 bg-white'
                                        }`}
                                >
                                    <div className="aspect-w-16 aspect-h-9 bg-gray-200 relative">
                                        <img
                                            src={dish.image}
                                            alt={dish.name}
                                            className="w-full h-32 object-cover"
                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400'; }}
                                        />
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 bg-primary-500 text-white p-1 rounded-full shadow-sm z-10">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                        )}
                                        {dish.isBestSeller && (
                                            <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center shadow-sm z-10">
                                                <span className="mr-0.5">⭐</span> Best Seller
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4">
                                        <h5 className={`font-bold text-sm mb-1 ${isSelected ? 'text-primary-900' : 'text-gray-900'}`}>{dish.name}</h5>
                                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{dish.description}</p>

                                        <div className="flex items-center justify-between text-xs">
                                            {(() => {
                                                const overrideId = `dish_${dish.id}`;
                                                const customPrice = pricingOverrides[overrideId] !== undefined ? pricingOverrides[overrideId] : dish.priceAdj;
                                                return customPrice > 0 ? (
                                                    <span className="font-semibold text-red-600">+₱{customPrice}/head</span>
                                                ) : (
                                                    <span className="font-semibold text-green-600">✓ Base</span>
                                                );
                                            })()}
                                            {isExtra && (
                                                <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-[10px] font-bold">EXTRA +₱150</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 h-full relative">
            {/* Over Budget Alert Toast */}
            {isOverBudget && (
                <div className="absolute top-0 left-0 right-0 z-10 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-between animate-bounce-in mx-4 lg:mx-0">
                    <div className="flex items-center">
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span className="font-bold">Budget Exceeded!</span>
                        <span className="hidden md:inline ml-2 text-red-100">Try removing some extra dishes or premium items.</span>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className={`flex-1 lg:pr-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar pt-4 ${isOverBudget ? 'mt-12' : ''}`}>
                <div className="mb-8">
                    <h2 className="text-3xl font-display font-bold text-gray-900">Customize Menu</h2>
                    <p className="text-gray-500 mt-1">Select your dishes. <span className="text-primary-600 font-medium">Click to select/deselect.</span></p>
                </div>

                {renderCategory('starter', 'Starters')}
                {renderCategory('main', 'Main Courses')}
                {renderCategory('side', 'Side Dishes')}
                {renderCategory('dessert', 'Desserts')}
                {renderCategory('drink', 'Beverages')}
            </div>

            {/* Sticky Summary Sidebar */}
            <div className="w-full lg:w-96 flex-shrink-0">
                <div className={`bg-gray-900 text-white p-8 rounded-2xl shadow-2xl sticky top-4 transition-colors duration-300 ${isOverBudget ? 'ring-4 ring-red-500' : ''}`}>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 border-b border-gray-700 pb-2">Booking Summary</h3>

                    {/* Price Breakdown Section */}
                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between items-baseline">
                            <span className="text-gray-300 text-sm">
                                {selectedPackage.name}
                                <span className="block text-xs text-gray-500">(@ ₱{selectedPackage.basePrice.toLocaleString()} x {pax} pax)</span>
                            </span>
                            <span className="font-medium">₱{(selectedPackage.basePrice * pax).toLocaleString()}</span>
                        </div>

                        {upgradeBreakdown.length > 0 && (
                            <div>
                                {/* Clickable header row */}
                                <div
                                    className="flex justify-between items-center text-yellow-400 cursor-pointer hover:text-yellow-300 transition-colors select-none"
                                    onClick={() => setShowBreakdown(prev => !prev)}
                                >
                                    <span className="text-sm flex items-center">
                                        <svg
                                            className={`w-3.5 h-3.5 mr-1.5 transition-transform duration-200 ${showBreakdown ? 'rotate-90' : ''}`}
                                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                        Extra Items / Upgrades
                                        <span className="ml-1.5 bg-yellow-400/20 text-yellow-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{upgradeBreakdown.length}</span>
                                    </span>
                                    <span className="font-medium">+₱{(totalPrice - (selectedPackage.basePrice * pax)).toLocaleString()}</span>
                                </div>

                                {/* Expandable breakdown list */}
                                {showBreakdown && (
                                    <div className="mt-2 ml-5 space-y-1.5 border-l-2 border-yellow-400/30 pl-3 animate-fadeIn">
                                        {upgradeBreakdown.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start text-xs">
                                                <div className="pr-2">
                                                    <span className="text-gray-200 font-medium">{item.name}</span>
                                                    <span className="block text-gray-500 text-[10px]">
                                                        {item.category} · {item.type}
                                                        {' '}(+₱{item.perHead}/head)
                                                    </span>
                                                </div>
                                                <span className="text-yellow-300 font-medium whitespace-nowrap">+₱{item.total.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="h-px bg-gray-700 my-2"></div>

                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Target Budget</span>
                            <span className="text-gray-400">₱{budget.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="mb-8 p-4 bg-gray-800 rounded-lg">
                        <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Estimated Cost</p>
                        <div className="flex items-end justify-between">
                            <p className={`text-3xl font-display font-bold ${isOverBudget ? 'text-red-400' : 'text-white'}`}>
                                ₱{totalPrice.toLocaleString()}
                            </p>
                        </div>
                        {isOverBudget && (
                            <p className="text-red-400 text-xs font-bold mt-2 flex items-center">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                {((totalPrice - budget) / budget * 100).toFixed(0)}% over budget
                            </p>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            const fullMenuSelection = {};
                            Object.keys(selections).forEach(cat => {
                                fullMenuSelection[cat] = selections[cat].map(id => {
                                    const dish = mergedDishes[cat]?.find(d => d.id === id);
                                    if (!dish) return null;
                                    const overrideId = `dish_${dish.id}`;
                                    const customCost = pricingOverrides[overrideId] !== undefined ? pricingOverrides[overrideId] : dish.costPerHead;
                                    return {
                                        ...dish,
                                        priceAdj: dish.priceAdj || 0,
                                        costPerHead: customCost
                                    };
                                });
                            });

                            updateBooking({ customMenu: fullMenuSelection, totalCost: totalPrice });
                            onNext();
                        }}
                        className={`w-full py-4 rounded-xl font-bold uppercase tracking-wide shadow-lg transition-all transform active:scale-95 ${isOverBudget
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-primary-600 hover:bg-primary-500 text-white hover:shadow-primary-600/50'
                            }`}
                    >
                        {isOverBudget ? 'Continue Anyway →' : 'Next Step →'}
                    </button>

                    <button
                        onClick={onBack}
                        className="w-full mt-4 text-gray-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        ← Back to Packages
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MenuCustomizer;
