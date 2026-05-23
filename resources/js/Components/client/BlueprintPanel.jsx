import { useMemo, useState, useEffect } from 'react';
import { fetchMenuItemsFromAPI } from '../../utils/menuUtils';

const CATEGORY_LABELS = {
    starter: 'Starter',
    main: 'Main',
    side: 'Sides',
    dessert: 'Dessert',
    drink: 'Drinks'
};

const money = (value) => `₱${Number(value || 0).toLocaleString()}`;

const BlueprintPanel = ({ bookingData, collapsed = false, onToggle }) => {
    const {
        eventType,
        eventName,
        date,
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

    const menuTotal = useMemo(() => {
        if (bookingData.package_base_price) {
            return bookingData.package_base_price * pax;
        }

        let total = 0;
        Object.keys(selectedDishes).forEach(category => {
            const dishIds = selectedDishes[category] || [];
            dishIds.forEach(id => {
                const dish = customItems[category]?.find(d => d.id === id);
                if (dish) {
                    const overrideId = `dish_${dish.id}`;
                    const customCost = pricingOverrides[overrideId] !== undefined ? pricingOverrides[overrideId] : dish.costPerHead;
                    total += customCost * (pax || 0);
                }
            });
        });
        return total;
    }, [selectedDishes, pax, pricingOverrides, customItems, bookingData.package_base_price]);

    const transportFee = useMemo(() => {
        if (venueDistance === 'outside-16-30') return 1500;
        if (venueDistance === 'outside-31-50') return 3000;
        return 0;
    }, [venueDistance]);

    const highRiseSurcharge = useMemo(() => isHighRise ? Math.round(menuTotal * 0.03) : 0, [isHighRise, menuTotal]);
    const overtimeFee = useMemo(() => Math.max(0, duration - 4) * 5000, [duration]);
    const totalEstimate = menuTotal + transportFee + highRiseSurcharge + overtimeFee;
    const totalDishCount = Object.values(selectedDishes).reduce((sum, arr) => sum + (arr?.length || 0), 0);

    const selectedMenuRows = Object.keys(CATEGORY_LABELS).flatMap(category => {
        const dishIds = selectedDishes[category] || [];
        return dishIds.map(id => {
            const dish = customItems[category]?.find(d => d.id === id);
            if (!dish) return null;
            const overrideId = `dish_${dish.id}`;
            const customCost = pricingOverrides[overrideId] !== undefined ? pricingOverrides[overrideId] : dish.costPerHead;
            return {
                id: `${category}-${id}`,
                category: CATEGORY_LABELS[category],
                name: dish.name,
                cost: customCost * (pax || 0),
            };
        }).filter(Boolean);
    });

    if (collapsed) {
        return (
            <aside className="hidden border-l border-[#720101]/10 bg-[#fffaf3] lg:sticky lg:top-[68px] lg:flex lg:h-[calc(100vh-68px)] lg:w-[4.25rem] lg:flex-col lg:items-center lg:justify-between lg:px-3 lg:py-5">
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[#720101]/15 bg-white text-[#720101] shadow-sm transition hover:bg-[#720101] hover:text-white"
                    aria-label="Show booking summary"
                    title="Show summary"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex min-h-0 flex-1 items-center justify-center py-4">
                    <div className="flex rotate-180 items-center gap-2 [writing-mode:vertical-rl]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#9f6500]">Summary</span>
                        <strong className="font-display text-lg text-[#720101]">{money(totalEstimate)}</strong>
                    </div>
                </div>
                <div className="h-10 w-10" aria-hidden="true" />
            </aside>
        );
    }

    return (
        <aside className="border-t border-[#720101]/10 bg-[#fffaf3] lg:sticky lg:top-[68px] lg:h-[calc(100vh-68px)] lg:w-[22rem] lg:flex-shrink-0 lg:border-l lg:border-t-0">
            <div className="flex h-full flex-col">
                <div className="border-b border-[#720101]/10 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#9f6500]">Booking Summary</p>
                            <h3 className="mt-1 font-display text-xl font-bold text-[#720101]">Your Event Plan</h3>
                        </div>
                        <button
                            type="button"
                            onClick={onToggle}
                            className="hidden h-9 w-9 items-center justify-center rounded-full border border-[#720101]/15 bg-white text-[#720101] transition hover:bg-[#720101] hover:text-white lg:flex"
                            aria-label="Collapse booking summary"
                            title="Collapse summary"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-5 py-5">
                    <section>
                        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Details</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                            <span className="text-slate-500">Type</span>
                            <strong className="text-right text-slate-900">{eventType || '-'}</strong>
                            {eventName && (
                                <>
                                    <span className="text-slate-500">Name</span>
                                    <strong className="text-right text-slate-900">{eventName}</strong>
                                </>
                            )}
                            <span className="text-slate-500">Date</span>
                            <strong className="text-right text-slate-900">{date || '-'}</strong>
                            <span className="text-slate-500">Time</span>
                            <strong className="text-right text-slate-900">{time || '-'}</strong>
                            <span className="text-slate-500">Guests</span>
                            <strong className="text-right text-slate-900">{pax ? `${pax} pax` : '-'}</strong>
                            <span className="text-slate-500">Dietary</span>
                            <strong className="text-right text-slate-900">{dietaryNotes || 'None'}</strong>
                        </div>
                    </section>

                    <section className="border-t border-[#720101]/10 pt-5">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Menu</p>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#720101] ring-1 ring-[#720101]/10">{totalDishCount} selected</span>
                        </div>
                        {selectedMenuRows.length === 0 ? (
                            <p className="text-sm font-semibold text-slate-400">No dishes selected yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {selectedMenuRows.slice(0, 8).map(row => (
                                    <div key={row.id} className="grid grid-cols-[1fr_auto] gap-3 text-sm">
                                        <span className="min-w-0 truncate font-semibold text-slate-700">{row.name}</span>
                                        <span className="font-bold text-slate-900">{money(row.cost)}</span>
                                    </div>
                                ))}
                                {selectedMenuRows.length > 8 && (
                                    <p className="text-xs font-bold text-slate-400">+{selectedMenuRows.length - 8} more dishes</p>
                                )}
                            </div>
                        )}
                    </section>

                    {(transportFee > 0 || highRiseSurcharge > 0 || overtimeFee > 0) && (
                        <section className="border-t border-[#720101]/10 pt-5">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Additional Fees</p>
                            <div className="space-y-2 text-sm">
                                {transportFee > 0 && <div className="flex justify-between"><span className="text-slate-500">Travel fee</span><strong>{money(transportFee)}</strong></div>}
                                {highRiseSurcharge > 0 && <div className="flex justify-between"><span className="text-slate-500">High-rise service</span><strong>{money(highRiseSurcharge)}</strong></div>}
                                {overtimeFee > 0 && <div className="flex justify-between"><span className="text-slate-500">Extra service hours</span><strong>{money(overtimeFee)}</strong></div>}
                            </div>
                        </section>
                    )}
                </div>

                <div className="border-t border-[#720101]/10 bg-white px-5 py-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimated Total</p>
                    <p className="mt-1 font-display text-3xl font-bold text-[#720101]">{money(totalEstimate)}</p>
                    {pax > 0 && totalDishCount > 0 && (
                        <p className="mt-1 text-xs font-bold text-slate-400">About {money(Math.round(totalEstimate / pax))} per guest</p>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default BlueprintPanel;
