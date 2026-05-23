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

const daysUntilEvent = (date) => {
    if (!date) return null;
    const eventDate = new Date(`${date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((eventDate - today) / 86400000);
};

const paymentScheduleForDate = (date, total) => {
    const days = daysUntilEvent(date);
    if (days !== null && days <= 10) {
        return {
            rows: [{ label: 'Full payment', amount: total }],
            note: '100% payment is required immediately for events 10 days or less before the event.',
        };
    }

    if (days !== null && days <= 30) {
        const upfront = Math.round(total * 0.80);
        return {
            rows: [
                { label: 'Reservation + down payment', amount: upfront },
                { label: 'Balance', amount: Math.max(0, total - upfront) },
            ],
            note: '80% combines reservation and down payment. The 20% final balance is due 10 days before the event.',
        };
    }

    const reservation = Math.round(total * 0.10);
    const downPayment = Math.round(total * 0.70);
    return {
        rows: [
            { label: 'Reservation', amount: reservation },
            { label: 'Down payment', amount: downPayment },
            { label: 'Balance', amount: Math.max(0, total - reservation - downPayment) },
        ],
        note: 'Standard bookings use the 10% / 70% / 20% payment schedule.',
    };
};

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
        package_name,
        package_base_price,
        package_flat_price,
        package_pricing_type,
        package_guest_count,
        package_allowances = {},
        package_category_label,
        package_security_label,
        package_security_description,
        package_security_type,
        package_security_rate = 0,
        package_cash_bond = 0,
        package_service_charge_rate = 0,
        package_vat_rate = 0,
        package_december_surcharge = 0,
        package_location_surcharge_rate = 0.20,
        package_floor_surcharge_rate = 0.03,
        menuExtraFee = 0,
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
        if (package_pricing_type === 'flat') {
            return (package_flat_price || 0) + (menuExtraFee || 0);
        }

        if (package_base_price) {
            return (package_base_price * (pax || 0)) + (menuExtraFee || 0);
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
    }, [selectedDishes, pax, pricingOverrides, customItems, package_base_price, package_flat_price, package_pricing_type, menuExtraFee]);

    const locationSurcharge = useMemo(() => {
        if (venueDistance === 'outside-16-30' || venueDistance === 'outside-31-50') {
            return Math.round(menuTotal * package_location_surcharge_rate);
        }
        return 0;
    }, [venueDistance, menuTotal, package_location_surcharge_rate]);

    const floorSurcharge = useMemo(() => isHighRise ? Math.round(menuTotal * package_floor_surcharge_rate) : 0, [isHighRise, menuTotal, package_floor_surcharge_rate]);
    const packageServiceCharge = useMemo(() => Math.round(menuTotal * package_service_charge_rate), [menuTotal, package_service_charge_rate]);
    const packageVat = useMemo(() => Math.round(menuTotal * package_vat_rate), [menuTotal, package_vat_rate]);
    const decemberSurcharge = useMemo(() => {
        if (!date || !package_december_surcharge) return 0;
        return new Date(date).getMonth() === 11 ? package_december_surcharge : 0;
    }, [date, package_december_surcharge]);
    const contingencyFee = useMemo(() => {
        if (package_security_type !== 'contingency') return 0;
        return Math.round((menuTotal + packageServiceCharge + packageVat + locationSurcharge + floorSurcharge + decemberSurcharge) * package_security_rate);
    }, [package_security_type, package_security_rate, menuTotal, packageServiceCharge, packageVat, locationSurcharge, floorSurcharge, decemberSurcharge]);
    const cashBond = package_security_type === 'cash_bond' ? package_cash_bond : 0;
    const overtimeFee = useMemo(() => Math.max(0, duration - 4) * 5000, [duration]);
    const totalEstimate = menuTotal + packageServiceCharge + packageVat + locationSurcharge + floorSurcharge + decemberSurcharge + contingencyFee + cashBond + overtimeFee;
    const paymentSchedule = useMemo(() => paymentScheduleForDate(date, totalEstimate), [date, totalEstimate]);
    const totalDishCount = Object.values(selectedDishes).reduce((sum, arr) => sum + (arr?.length || 0), 0);

    const selectedMenuRows = Object.keys(CATEGORY_LABELS).flatMap(category => {
        const dishIds = selectedDishes[category] || [];
        const includedLimit = package_allowances?.[category] ?? null;
        return dishIds.map((id, index) => {
            const dish = customItems[category]?.find(d => d.id === id);
            if (!dish) return null;
            const overrideId = `dish_${dish.id}`;
            const customCost = pricingOverrides[overrideId] !== undefined ? pricingOverrides[overrideId] : dish.costPerHead;
            const included = Boolean((package_base_price || package_flat_price) && includedLimit !== null && index < includedLimit);
            return {
                id: `${category}-${id}`,
                category: CATEGORY_LABELS[category],
                name: dish.name,
                cost: included ? 0 : customCost * (pax || 0),
                included,
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
                            {package_category_label && (
                                <>
                                    <span className="text-slate-500">Package tier</span>
                                    <strong className="text-right text-slate-900">{package_category_label}</strong>
                                </>
                            )}
                        </div>
                    </section>

                    {package_security_label && (
                        <section className="border-t border-[#720101]/10 pt-5">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Terms</p>
                            <div className="space-y-2 rounded-lg bg-white p-3 text-xs font-bold text-slate-500 ring-1 ring-[#720101]/10">
                                {paymentSchedule.rows.map(row => (
                                    <div key={row.label} className="flex justify-between gap-3">
                                        <span>{row.label}</span>
                                        <strong className="text-slate-900">{money(row.amount)}</strong>
                                    </div>
                                ))}
                                <p className="pt-2 leading-relaxed text-slate-400">{paymentSchedule.note}</p>
                                <p className="pt-1 leading-relaxed text-slate-400">{package_security_label}: {package_security_description}</p>
                            </div>
                        </section>
                    )}

                    <section className="border-t border-[#720101]/10 pt-5">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Menu</p>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#720101] ring-1 ring-[#720101]/10">{totalDishCount} selected</span>
                        </div>
                        {selectedMenuRows.length === 0 ? (
                            <p className="text-sm font-semibold text-slate-400">No dishes selected yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {(package_base_price || package_flat_price) && (
                                    <div className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-[#720101]/10">
                                        <span className="min-w-0 truncate font-bold text-[#720101]">{package_name || 'Package base'}</span>
                                        <span className="font-black text-[#720101]">{money(package_pricing_type === 'flat' ? package_flat_price : package_base_price * (pax || 0))}</span>
                                    </div>
                                )}
                                {selectedMenuRows.slice(0, 8).map(row => (
                                    <div key={row.id} className="grid grid-cols-[1fr_auto] gap-3 text-sm">
                                        <span className="min-w-0 truncate font-semibold text-slate-700">{row.name}</span>
                                        <span className={`font-bold ${row.included ? 'text-slate-400' : 'text-slate-900'}`}>
                                            {row.included ? 'Included' : money(row.cost)}
                                        </span>
                                    </div>
                                ))}
                                {selectedMenuRows.length > 8 && (
                                    <p className="text-xs font-bold text-slate-400">+{selectedMenuRows.length - 8} more dishes</p>
                                )}
                            </div>
                        )}
                    </section>

                    {(menuExtraFee > 0 || packageServiceCharge > 0 || packageVat > 0 || locationSurcharge > 0 || floorSurcharge > 0 || decemberSurcharge > 0 || contingencyFee > 0 || cashBond > 0 || overtimeFee > 0) && (
                        <section className="border-t border-[#720101]/10 pt-5">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Additional Fees</p>
                            <div className="space-y-2 text-sm">
                                {menuExtraFee > 0 && <div className="flex justify-between"><span className="text-slate-500">Extra menu selections</span><strong>{money(menuExtraFee)}</strong></div>}
                                {packageServiceCharge > 0 && <div className="flex justify-between"><span className="text-slate-500">Service charge</span><strong>{money(packageServiceCharge)}</strong></div>}
                                {packageVat > 0 && <div className="flex justify-between"><span className="text-slate-500">VAT</span><strong>{money(packageVat)}</strong></div>}
                                {locationSurcharge > 0 && <div className="flex justify-between"><span className="text-slate-500">Outside Metro Manila</span><strong>{money(locationSurcharge)}</strong></div>}
                                {floorSurcharge > 0 && <div className="flex justify-between"><span className="text-slate-500">Floor service charge</span><strong>{money(floorSurcharge)}</strong></div>}
                                {decemberSurcharge > 0 && <div className="flex justify-between"><span className="text-slate-500">December surcharge</span><strong>{money(decemberSurcharge)}</strong></div>}
                                {contingencyFee > 0 && <div className="flex justify-between"><span className="text-slate-500">{package_security_label || 'Contingency'}</span><strong>{money(contingencyFee)}</strong></div>}
                                {cashBond > 0 && <div className="flex justify-between"><span className="text-slate-500">{package_security_label || 'Cash bond'}</span><strong>{money(cashBond)}</strong></div>}
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
