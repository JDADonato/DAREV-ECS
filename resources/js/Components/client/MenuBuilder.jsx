import { useState, useEffect, useMemo } from 'react';
import { fetchMenuItemsFromAPI } from '../../utils/menuUtils';

const CATEGORY_TABS = [
    { key: 'starter', label: 'Starters' },
    { key: 'main', label: 'Main Course' },
    { key: 'side', label: 'Sides' },
    { key: 'dessert', label: 'Dessert' },
    { key: 'drink', label: 'Refreshments' }
];

const MenuBuilder = ({ bookingData, updateBooking, onNext, onBack, mode = 'full' }) => {
    const { pax, selectedDishes: existingDishes } = bookingData;
    const [phase, setPhase] = useState(() => {
        if (mode === 'menu') return 'menu';
        return bookingData.packageChoiceStage === 'curated' ? 'curated' : 'path';
    }); // 'path' | 'curated' | 'menu'
    const [budget, setBudget] = useState(bookingData.budget || '');
    const [activeTab, setActiveTab] = useState('starter');
    const [selections, setSelections] = useState({
        starter: [],
        main: [],
        side: [],
        dessert: [],
        drink: []
    });

    // Pricing overrides from server
    const [pricingOverrides, setPricingOverrides] = useState({});
    const [customItems, setCustomItems] = useState({ starter: [], main: [], side: [], dessert: [], drink: [] });
    const [lightboxDish, setLightboxDish] = useState(null);
    const [curatedPackages, setCuratedPackages] = useState([]);

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

        // Fetch curated packages from API
        fetch('/api/packages?per_page=50')
            .then(res => res.ok ? res.json() : { data: [] })
            .then(data => {
                const pkgs = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
                setCuratedPackages(pkgs);
            })
            .catch(err => console.error('Error fetching packages:', err));
    }, []);

    // Menu items organized by category (already structured from API)
    const mergedDishes = customItems;

    // Restore existing selections if coming back
    useEffect(() => {
        if (existingDishes && Object.keys(existingDishes).some(k => existingDishes[k]?.length > 0)) {
            setSelections({
                starter: existingDishes.starter || existingDishes.starters || [],
                main: existingDishes.main || existingDishes.mains || [],
                side: existingDishes.side || existingDishes.sides || [],
                dessert: existingDishes.dessert || existingDishes.desserts || [],
                drink: existingDishes.drink || existingDishes.drinks || []
            });
            if (mode !== 'packages') {
                setPhase('menu');
            }
        }
    }, []);

    const getSelectionTotal = (nextSelections) => {
        let total = 0;
        Object.keys(nextSelections).forEach(category => {
            nextSelections[category].forEach(id => {
                const dish = mergedDishes[category]?.find(d => d.id === id);
                if (dish) total += getDishCost(dish) * (pax || 0);
            });
        });
        return total;
    };

    const advanceFromPackageChoice = (nextSelections, extra = {}) => {
        updateBooking({
            selectedDishes: nextSelections,
            totalCost: getSelectionTotal(nextSelections),
            ...extra,
        });

        if (mode === 'packages') {
            onNext(true);
            return;
        }

        setPhase('menu');
    };

    // Get effective cost per head for a dish
    const getDishCost = (dish) => {
        const overrideId = `dish_${dish.id}`;
        if (pricingOverrides[overrideId] !== undefined) {
            return pricingOverrides[overrideId];
        }
        return dish.costPerHead;
    };

    // Calculate total from selections
    const menuTotal = useMemo(() => {
        if (bookingData.package_base_price) {
            return bookingData.package_base_price * pax;
        }

        let total = 0;
        Object.keys(selections).forEach(category => {
            selections[category].forEach(id => {
                const dish = mergedDishes[category]?.find(d => d.id === id);
                if (dish) total += getDishCost(dish) * (pax || 0);
            });
        });
        return total;
    }, [selections, pax, pricingOverrides, bookingData.package_base_price]);

    // Update parent whenever selections change
    useEffect(() => {
        if (phase === 'menu') {
            updateBooking({
                selectedDishes: selections,
                totalCost: menuTotal
            });
        }
    }, [selections, menuTotal, phase]);

    // Per-category dish limits
    const CATEGORY_LIMITS = {
        starter: 3,
        main: 4,
        side: 4,
        dessert: 4,
        drink: 3
    };

    // Toggle a dish selection (with category limit enforcement)
    const toggleDish = (category, dishId) => {
        setSelections(prev => {
            const currentList = prev[category];
            if (currentList.includes(dishId)) {
                return { ...prev, [category]: currentList.filter(id => id !== dishId) };
            } else {
                // Check limit
                const limit = CATEGORY_LIMITS[category] || 5;
                if (currentList.length >= limit) {
                    return prev; // Don't add — limit reached
                }
                return { ...prev, [category]: [...currentList, dishId] };
            }
        });
    };

    // Budget Maximizer: round-robin across categories to spread dishes evenly
    const applyBudgetMaximizer = () => {
        if (!budget || !pax) return;
        const totalBudget = parseInt(budget);
        const newSelections = { starter: [], main: [], side: [], dessert: [], drink: [] };
        let runningTotal = 0;

        const categories = ['starter', 'main', 'side', 'dessert', 'drink'];

        // Build sorted dish lists per category, then fit selections within the target budget.
        const categoryQueues = {};
        categories.forEach(cat => {
            categoryQueues[cat] = [...(mergedDishes[cat] || [])]
                .map(dish => ({
                    ...dish,
                    category: cat,
                    totalCost: getDishCost(dish) * pax
                }))
                .sort((a, b) => b.totalCost - a.totalCost); // expensive first
        });

        // Round-robin: cycle through categories, picking one dish at a time from each
        let changed = true;
        while (changed) {
            changed = false;
            for (const cat of categories) {
                const limit = CATEGORY_LIMITS[cat] || 5;
                if (newSelections[cat].length >= limit) continue; // Category full

                // Find the next best dish in this category that fits the budget
                const queue = categoryQueues[cat];
                let picked = false;
                for (let i = 0; i < queue.length; i++) {
                    const dish = queue[i];
                    if (newSelections[cat].includes(dish.id)) continue; // Already selected
                    if (runningTotal + dish.totalCost <= totalBudget) {
                        newSelections[cat].push(dish.id);
                        runningTotal += dish.totalCost;
                        picked = true;
                        changed = true;
                        break;
                    }
                }

                // If most expensive doesn't fit, try cheaper ones
                if (!picked) {
                    const cheapQueue = [...queue].reverse();
                    for (const dish of cheapQueue) {
                        if (newSelections[cat].includes(dish.id)) continue;
                        if (runningTotal + dish.totalCost <= totalBudget) {
                            newSelections[cat].push(dish.id);
                            runningTotal += dish.totalCost;
                            changed = true;
                            break;
                        }
                    }
                }
            }
        }

        // Fallback: if budget is too low for even one per category, pick cheapest from each
        const totalPicked = Object.values(newSelections).reduce((sum, arr) => sum + arr.length, 0);
        if (totalPicked === 0) {
            categories.forEach(cat => {
                const sorted = [...(mergedDishes[cat] || [])].sort((a, b) => getDishCost(a) - getDishCost(b));
                if (sorted.length > 0) {
                    const cheapest = sorted[0];
                    const cost = getDishCost(cheapest) * pax;
                    if (runningTotal + cost <= totalBudget * 1.1) {
                        newSelections[cat].push(cheapest.id);
                        runningTotal += cost;
                    }
                }
            });
        }

        setSelections(newSelections);
        advanceFromPackageChoice(newSelections, {
            budget: parseInt(budget) || 0,
            package_id: 'budget-guided',
            package_base_price: null,
            package_name: null,
            packageChoiceStage: 'path',
        });
    };

    // Apply a curated package — map DB menu_structure (plural keys) to singular keys
    const applyCuratedPackage = (pkg) => {
        // The package doesn't have prefilledDishes, it has menu_structure with counts
        // We auto-select the cheapest dishes up to the count for each category
        const menuStructure = pkg.menu_structure || {};
        const newSelections = { starter: [], main: [], side: [], dessert: [], drink: [] };
        
        // Map plural DB keys to singular frontend keys
        const keyMap = { starters: 'starter', mains: 'main', sides: 'side', desserts: 'dessert', drinks: 'drink' };
        
        Object.entries(menuStructure).forEach(([dbKey, count]) => {
            const frontendKey = keyMap[dbKey] || dbKey;
            const available = mergedDishes[frontendKey] || [];
            // Sort by cost and pick the cheapest ones
            const sorted = [...available].sort((a, b) => getDishCost(a) - getDishCost(b));
            newSelections[frontendKey] = sorted.slice(0, count).map(d => d.id);
        });
        
        setSelections(newSelections);
        advanceFromPackageChoice(newSelections, {
            package_id: pkg.id, 
            package_base_price: pkg.base_price_per_head,
            package_name: pkg.name,
            packageChoiceStage: 'curated',
        });
    };

    // Apply blank canvas
    const applyBlankCanvas = () => {
        setSelections({ starter: [], main: [], side: [], dessert: [], drink: [] });
        advanceFromPackageChoice({ starter: [], main: [], side: [], dessert: [], drink: [] }, { package_id: 'custom', package_base_price: null, package_name: null, packageChoiceStage: 'path' });
    };

    const handleConfirmMenu = () => {
        const totalDishes = Object.values(selections).reduce((sum, arr) => sum + arr.length, 0);
        if (totalDishes === 0) return;

        // Build full menu selection with dish objects for submission, including any pricing overrides
        const fullMenuSelection = {};
        Object.keys(selections).forEach(cat => {
            fullMenuSelection[cat] = selections[cat].map(id => {
                const dish = mergedDishes[cat].find(d => d.id === id);
                return {
                    ...dish,
                    costPerHead: getDishCost(dish),
                    priceAdj: getDishCost(dish)
                };
            });
        });

        updateBooking({
            selectedDishes: selections,
            customMenu: fullMenuSelection,
            totalCost: menuTotal,
            budget: budget ? parseInt(budget) : 0
        });
        onNext(true);
    };

    const totalDishCount = Object.values(selections).reduce((sum, arr) => sum + arr.length, 0);
    const activeCategoryIndex = CATEGORY_TABS.findIndex(tab => tab.key === activeTab);
    const activeCategory = CATEGORY_TABS[activeCategoryIndex] || CATEGORY_TABS[0];
    const isFirstCategory = activeCategoryIndex <= 0;
    const isLastCategory = activeCategoryIndex === CATEGORY_TABS.length - 1;
    const activeCategoryCount = selections[activeTab]?.length || 0;
    const activeCategoryLimit = CATEGORY_LIMITS[activeTab] || 5;
    const isGuidedMenu = bookingData.package_id === 'custom';
    const isCuratedSelection = bookingData.package_id && !['custom', 'budget-guided'].includes(String(bookingData.package_id));
    const canAdvanceMenu = isGuidedMenu ? (!isLastCategory || totalDishCount > 0) : totalDishCount > 0;
    const goToPreviousCategory = () => {
        if (!isGuidedMenu || isFirstCategory) {
            updateBooking({ packageChoiceStage: isCuratedSelection ? 'curated' : 'path' });
            onBack();
            return;
        }
        setActiveTab(CATEGORY_TABS[activeCategoryIndex - 1].key);
    };
    const goToNextCategory = () => {
        if (!isGuidedMenu || isLastCategory) {
            handleConfirmMenu();
            return;
        }
        setActiveTab(CATEGORY_TABS[activeCategoryIndex + 1].key);
    };

    // ==========================================
    // PHASE: BUDGET ENTRY
    // ==========================================
    if (phase === 'budget') {
        return (
            <div className="flex flex-col h-full justify-between animate-fadeIn">
                <div className="space-y-8">
                    <div className="max-w-lg mx-auto space-y-6 mt-4">
                        <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100">
                            <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                                Target Budget (PHP)
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-lg">₱</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={budget}
                                    onChange={(e) => setBudget(e.target.value)}
                                    placeholder="e.g. 50000"
                                    className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-900 font-bold text-xl"
                                />
                            </div>
                            {budget && pax && (
                                <p className="text-sm text-primary-600 mt-3 font-medium text-center">
                                    ≈ ₱{Math.round(parseInt(budget) / pax).toLocaleString()} per head for {pax} guests
                                </p>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleBuildMenu}
                                disabled={!budget || parseInt(budget) <= 0}
                                className={`flex-1 py-4 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 flex items-center justify-center ${budget && parseInt(budget) > 0
                                    ? 'bg-red-900 text-white hover:bg-red-800 hover:shadow-xl'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                Build My Menu
                                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </button>
                            <button
                                onClick={handleSkipBudget}
                                className="px-8 py-4 rounded-xl font-bold text-gray-500 border-2 border-gray-200 hover:border-gray-300 hover:text-gray-700 transition-all"
                            >
                                Skip
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-start pt-12 items-center border-t border-gray-100 mt-8">
                    <button
                        onClick={() => {
                            updateBooking({ selectedDishes: { starter: [], main: [], side: [], dessert: [], drink: [] }, customMenu: {}, totalCost: 0 });
                            onBack();
                        }}
                        className="text-gray-500 font-bold hover:text-gray-800 px-6 py-3 transition-colors flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                </div>
            </div>
        );
    }

    // ==========================================
    // PHASE: PATH SELECTION
    // ==========================================
    if (phase === 'path') {
        return (
            <div className="flex flex-col h-full justify-between animate-fadeIn">
                <div className="space-y-8">
                    <div className="text-center mb-2">
                        <h3 className="text-2xl font-black text-gray-950">How would you like to build your menu?</h3>
                        <p className="mt-2 text-sm font-semibold text-gray-500">Choose a starting point. You can review and adjust dishes before continuing.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto booking-menu-path">
                        {/* Budget Maximizer - only when budget is entered */}
                        <>
                            <div className="booking-choice-card booking-choice-card-budget group text-left p-8 rounded-2xl border-2 border-green-100 bg-white transition-all duration-300 relative overflow-hidden">
                                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-5 text-green-600 group-hover:bg-green-200 transition-colors">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Build Around a Budget</h3>
                                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                    The system will choose dishes that fit within your <strong className="text-green-700">₱{parseInt(budget || 0).toLocaleString()}</strong> target. You can still review and adjust the result.
                                </p>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Target budget</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={budget}
                                    onChange={(e) => setBudget(e.target.value)}
                                    placeholder="Example: 50000"
                                    className="mb-5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-red-900 focus:ring-4 focus:ring-red-900/10"
                                />
                                <ul className="space-y-2 text-xs text-gray-500 mb-5">
                                    <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Auto-selects dishes to fit your budget</li>
                                    <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Evenly spreads across all categories</li>
                                    <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>You can still add, remove, or swap dishes after</li>
                                </ul>
                                <button
                                    type="button"
                                    onClick={applyBudgetMaximizer}
                                    disabled={!budget || parseInt(budget) <= 0}
                                    className="text-green-600 font-bold text-sm flex items-center group-hover:translate-x-1 transition-transform disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Build from budget
                                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                </button>
                            </div>
                        </>

                        {/* Curated Packages */}
                        <button
                            onClick={() => setPhase('curated')}
                            className="booking-choice-card booking-choice-card-package group text-left p-8 rounded-2xl border-2 border-primary-100 bg-white transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-5 text-primary-600 group-hover:bg-primary-100 transition-colors">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Curated Packages</h3>
                            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                Browse pre-designed packages — <strong>Economy</strong>, <strong>Standard</strong>, or <strong>Premium</strong> — each with a balanced set of dishes already picked for you.
                            </p>
                            <ul className="space-y-2 text-xs text-gray-500 mb-5">
                                <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>3 tiers with clear price-per-head ranges</li>
                                <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Chef-curated combinations</li>
                                <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Modify any dish after selecting a package</li>
                            </ul>
                            <div className="text-primary-600 font-bold text-sm flex items-center group-hover:translate-x-1 transition-transform">
                                Browse packages
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </div>
                        </button>

                        {/* Blank Canvas */}
                        <button
                            onClick={applyBlankCanvas}
                            className="booking-choice-card booking-choice-card-custom group text-left p-8 rounded-2xl border-2 border-gray-100 bg-white transition-all duration-300"
                        >
                            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-5 text-gray-500 group-hover:bg-gray-100 transition-colors">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Build My Menu</h3>
                            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                Start from an empty selection and choose each dish yourself, category by category.
                            </p>
                            <ul className="space-y-2 text-xs text-gray-500 mb-5">
                                <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Browse every dish in our catalog</li>
                                <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Full control over every category</li>
                                <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Flexible budget</li>
                            </ul>
                            <div className="text-gray-600 font-bold text-sm flex items-center group-hover:translate-x-1 transition-transform">
                                Start choosing dishes
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="flex justify-start pt-12 items-center border-t border-gray-100 mt-8">
                    <button
                        onClick={onBack}
                        className="text-gray-500 font-bold hover:text-gray-800 px-6 py-3 transition-colors flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                </div>
            </div>
        );
    }

    // ==========================================
    // PHASE: CURATED PACKAGES
    // ==========================================
    if (phase === 'curated') {
        return (
            <div className="flex flex-col h-full justify-between animate-fadeIn">
                <div className="space-y-8">
                    <div className="booking-menu-path booking-curated-grid grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-4">
                        {curatedPackages.length === 0 ? (
                            <div className="col-span-3 text-center py-12">
                                <p className="text-gray-400">Loading packages...</p>
                            </div>
                        ) : curatedPackages.map((pkg, index) => {
                            // Calculate price per head for this package using menu_structure
                            const menuStructure = pkg.menu_structure || {};
                            const keyMap = { starters: 'starter', mains: 'main', sides: 'side', desserts: 'dessert', drinks: 'drink' };
                            let pkgTotal = 0;
                            let totalDishes = 0;
                            
                            Object.entries(menuStructure).forEach(([dbKey, count]) => {
                                const frontendKey = keyMap[dbKey] || dbKey;
                                const available = mergedDishes[frontendKey] || [];
                                const sorted = [...available].sort((a, b) => getDishCost(a) - getDishCost(b));
                                const selected = sorted.slice(0, count);
                                selected.forEach(d => { pkgTotal += getDishCost(d); });
                                totalDishes += count;
                            });

                            // Use base_price_per_head from DB if available
                            const displayPrice = pkg.base_price_per_head || pkgTotal;

                            return (
                                <div
                                    key={pkg.id}
                                    className={`booking-choice-card booking-curated-card booking-tier-card-${index} text-left p-8 rounded-2xl border-2 bg-white transition-all duration-300 relative overflow-hidden`}
                                >
                                    <div className="booking-curated-content flex-1 flex flex-col">
                                        <h3 className="text-2xl font-bold text-gray-900 mb-1">{pkg.name}</h3>
                                        <p className="text-gray-500 text-sm mb-4">{pkg.description}</p>
                                        <p className="text-primary-600 font-bold text-lg mb-1">₱{displayPrice.toLocaleString()}/head</p>
                                        <p className="text-xs text-gray-400 mb-2">{totalDishes} dishes included</p>
                                        {pkg.inclusions && pkg.inclusions.length > 0 && (
                                            <ul className="text-xs text-gray-500 mb-4 space-y-1">
                                                {pkg.inclusions.slice(0, 3).map((inc, i) => (
                                                    <li key={i} className="flex items-center">
                                                        <svg className="w-3.5 h-3.5 mr-1.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        {inc}
                                                    </li>
                                                ))}
                                                {pkg.inclusions.length > 3 && (
                                                    <li className="text-gray-400 italic">+{pkg.inclusions.length - 3} more</li>
                                                )}
                                            </ul>
                                        )}
                                        <div className="mt-auto">
                                            <div className="text-sm text-gray-500 mb-4">
                                                <p className="text-xs">Total: ₱{(displayPrice * pax).toLocaleString()} for {pax} guests</p>
                                            </div>
                                            <button
                                                onClick={() => applyCuratedPackage(pkg)}
                                                className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all transform active:scale-95 bg-gray-900 text-white hover:bg-red-900"
                                            >
                                                Select {pkg.name}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-start pt-12 items-center border-t border-gray-100 mt-8">
                    <button
                        onClick={() => {
                            updateBooking({ packageChoiceStage: 'path' });
                            setPhase('path');
                        }}
                        className="text-gray-500 font-bold hover:text-gray-800 px-6 py-3 transition-colors flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                </div>
            </div>
        );
    }

    // ==========================================
    // PHASE: TABULAR MENU BUILDER
    // ==========================================
    return (
        <div className="flex flex-col h-full animate-fadeIn">
            {/* Image Lightbox */}
            {lightboxDish && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70" onClick={() => setLightboxDish(null)}>
                    <div className="relative max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()} style={{animation:'imgZoomIn .3s cubic-bezier(0.22,1,0.36,1) both'}}>
                        <button
                            onClick={() => setLightboxDish(null)}
                            className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors z-10"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <img
                            src={lightboxDish.image}
                            alt={lightboxDish.name}
                            className="w-full rounded-2xl shadow-2xl object-cover max-h-[70vh]"
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800'; }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent rounded-b-2xl">
                            {lightboxDish.isBestSeller && (
                                <span className="bg-yellow-500 text-red-900 text-xs font-bold px-2 py-1 rounded-full mb-2 inline-block">Best Seller</span>
                            )}
                            <h3 className="text-white font-bold text-2xl">{lightboxDish.name}</h3>
                            <p className="text-gray-200 text-sm mt-1">{lightboxDish.description}</p>
                            <p className="text-yellow-300 text-lg font-bold mt-2">₱{getDishCost(lightboxDish)}/head</p>
                        </div>
                    </div>
                </div>
            )}
            {isGuidedMenu && (
                <div className="booking-menu-guide">
                    <div>
                        <p className="booking-step-kicker">Menu category {activeCategoryIndex + 1} of {CATEGORY_TABS.length}</p>
                        <h3>{activeCategory.label}</h3>
                        <p>Choose up to {activeCategoryLimit}. You can move through each category and still return to adjust anything.</p>
                    </div>
                    <strong>{activeCategoryCount}/{activeCategoryLimit} selected</strong>
                </div>
            )}

            {/* Category Tabs */}
            <div className="booking-category-tabs">
                {CATEGORY_TABS.map(tab => {
                    const count = selections[tab.key]?.length || 0;
                    const limit = CATEGORY_LIMITS[tab.key] || 5;
                    const isActive = activeTab === tab.key;
                    const isFull = count >= limit;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`booking-category-tab ${isActive
                                ? 'active'
                                : ''
                                }`}
                        >
                            <span>{tab.label}</span>
                            <strong className={isFull ? 'complete' : count > 0 ? 'started' : ''}>
                                {count}/{limit}
                            </strong>
                        </button>
                    );
                })}
            </div>

            {/* Dish Grid */}
            <div className="flex-1 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...(mergedDishes[activeTab] || [])]
                        .sort((a, b) => {
                            if (a.isBestSeller !== b.isBestSeller) return b.isBestSeller ? 1 : -1;
                            return getDishCost(a) - getDishCost(b);
                        })
                        .map(dish => {
                            const isSelected = selections[activeTab]?.includes(dish.id);
                            const cost = getDishCost(dish);
                            const categoryCount = selections[activeTab]?.length || 0;
                            const categoryLimit = CATEGORY_LIMITS[activeTab] || 5;
                            const isLimitReached = !isSelected && categoryCount >= categoryLimit;

                            return (
                                <div
                                    key={dish.id}
                                    className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 ${isSelected
                                        ? 'border-primary-500 bg-primary-50 shadow-md'
                                        : isLimitReached
                                            ? 'border-gray-100 bg-gray-50 opacity-50'
                                            : 'border-gray-100 bg-white hover:border-gray-200'
                                        }`}
                                >
                                    <div className="flex items-start gap-4 p-4">
                                        <div 
                                            className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 cursor-pointer group/img"
                                            onClick={() => setLightboxDish(dish)}
                                            title="Click to enlarge"
                                        >
                                            <img
                                                src={dish.image}
                                                alt={dish.name}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110"
                                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400'; }}
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-all duration-300 flex items-center justify-center">
                                                <svg className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                            </div>
                                            {dish.isBestSeller && (
                                                <div className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center">
                                                    <svg className="w-2.5 h-2.5 mr-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h5 className={`font-bold text-sm mb-0.5 ${isSelected ? 'text-primary-900' : 'text-gray-900'}`}>
                                                {dish.name}
                                            </h5>
                                            <p className="text-xs text-gray-400 line-clamp-1 mb-2">{dish.description}</p>
                                            <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-primary-700 font-bold text-sm whitespace-nowrap">
                                                    ₱{cost}/head
                                                </span>
                                                {pax > 0 && (
                                                    <span className="text-gray-400 text-xs whitespace-nowrap">
                                                        = ₱{(cost * pax).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => toggleDish(activeTab, dish.id)}
                                            disabled={isLimitReached}
                                            className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all self-center ${isSelected
                                                ? 'bg-red-100 text-red-900 hover:bg-red-200'
                                                : isLimitReached
                                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                    : 'bg-red-900 text-white hover:bg-red-800'
                                                }`}
                                        >
                                            {isSelected ? 'Remove' : isLimitReached ? 'Full' : 'Add'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="flex justify-between pt-8 items-center border-t border-gray-100 mt-8">
                <button
                    onClick={goToPreviousCategory}
                    className="text-gray-500 font-medium hover:text-gray-800 px-4 py-3 transition-colors flex items-center text-sm"
                >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {isGuidedMenu && !isFirstCategory ? 'Previous category' : 'Back to packages'}
                </button>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Menu Total</p>
                        <p className="text-xl font-bold text-gray-900">₱{menuTotal.toLocaleString()}</p>
                    </div>
                    <button
                        onClick={goToNextCategory}
                        disabled={!canAdvanceMenu}
                        className={`px-8 py-3.5 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 flex items-center text-sm ${canAdvanceMenu
                            ? 'bg-red-900 text-white hover:bg-red-800 hover:shadow-xl'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {isGuidedMenu && !isLastCategory ? 'Next category' : 'Confirm Menu'}
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MenuBuilder;
