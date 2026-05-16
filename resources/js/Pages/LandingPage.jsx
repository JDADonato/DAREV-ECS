import React, { useEffect, useRef, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import { useAuth } from '../context/AuthContext';
import ChatBubble from '../Components/common/ChatBubble';
import ClientNavbar from '../Components/common/ClientNavbar';
import logoImg from '../../images/ECS_LOGO.png';

/* ── SVG Icons ── */
const settledStatuses = ['Paid', 'Verified'];
const isSettled = (status) => settledStatuses.includes(status);
const IcoBudget = ({c='currentColor'}) => <svg className="w-6 h-6" fill="none" stroke={c} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IcoMenu = ({c='currentColor'}) => <svg className="w-6 h-6" fill="none" stroke={c} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
const IcoChart = ({c='currentColor'}) => <svg className="w-6 h-6" fill="none" stroke={c} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const IcoFilter = ({c='currentColor'}) => <svg className="w-6 h-6" fill="none" stroke={c} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>;

const useRv = () => {
    const r = useRef(null);
    useEffect(() => {
        const el = r.current; if (!el) return;
        const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('vis'); io.unobserve(el); } }, { threshold: 0.1 });
        io.observe(el); return () => io.disconnect();
    }, []); return r;
};
const Rv = ({ children, cls = '', d = '' }) => { const r = useRv(); return <div ref={r} className={`rv ${d} ${cls}`}>{children}</div>; };

const Counter = ({ end, suffix = '' }) => {
    const [val, setVal] = useState(0);
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current; if (!el) return;
        const io = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) {
                let s = 0; const dur = 1800; const step = 16; const inc = end / (dur / step);
                const t = setInterval(() => { s += inc; if (s >= end) { setVal(end); clearInterval(t); } else setVal(Math.floor(s)); }, step);
                io.unobserve(el);
            }
        }, { threshold: 0.3 });
        io.observe(el); return () => io.disconnect();
    }, [end]);
    return <span ref={ref}>{val}{suffix}</span>;
};

const EventJourneyTracker = ({ booking, payments }) => {
    if (!booking) return null;
    const steps = buildFloatingJourneySteps(booking, payments);
    const activeStepIndex = steps.findIndex(s => !s.done);
    const activeStep = activeStepIndex === -1 ? steps.length : activeStepIndex;

    return (
        <div className="bg-white border-b border-gray-100 shadow-sm pt-28 pb-8 px-5">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <p className="text-[#f0aa0b] text-xs font-bold uppercase tracking-widest mb-1">Your Event Journey</p>
                        <h2 className="text-[#1a1a1a] text-2xl font-display font-bold">Event on {new Date(booking.event_date).toLocaleDateString()}</h2>
                    </div>
                    <button 
                        onClick={() => router.get('/dashboard/client')}
                        className="bg-[#720101] hover:bg-[#5a0101] text-white text-xs font-black uppercase tracking-widest py-3 px-8 rounded-2xl shadow-xl shadow-[#720101]/20 transition-all active:scale-95"
                    >
                        View Dashboard
                    </button>
                </div>
                
                <div className="relative pt-4 pb-12">
                    <div className="absolute top-[2.1rem] left-0 w-full h-1 bg-gray-100 rounded-full"></div>
                    <div className="absolute top-[2.1rem] left-0 h-1 bg-[#720101] rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(114,1,1,0.3)]" style={{ width: `${(steps.filter(s => s.done).length / (steps.length - 1)) * 100}%` }}></div>
                    
                    <div className="relative flex justify-between">
                        {steps.map((step, idx) => {
                            const isCompleted = step.done;
                            const isActive = idx === activeStep;
                            const isLocked = step.locked;
                            
                            return (
                                <div key={idx} className="flex flex-col items-center group">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-500 z-10 
                                        ${isCompleted ? 'bg-[#720101] border-[#720101] text-white' : 
                                          isActive ? 'bg-white border-[#720101] text-[#720101] shadow-xl' : 
                                          'bg-white border-gray-100 text-gray-300'}`}>
                                        {isCompleted ? '✓' : isLocked ? (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        ) : idx + 1}
                                    </div>
                                    <p className={`mt-4 text-[10px] font-black uppercase tracking-[0.15em] text-center max-w-[80px] transition-colors
                                        ${isActive ? 'text-[#720101]' : isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                                        {step.label}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};


const buildFloatingJourneySteps = (booking, payments) => {
    const bookingPayments = (payments || []).filter((payment) => payment.booking_id === booking.id);
    const total = Number(booking.total_cost || 0);
    const paid = bookingPayments
        .filter((payment) => isSettled(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    
    const isApproved = booking.status === 'Confirmed';
    const hasReservation = bookingPayments.some((payment) => payment.payment_type === 'Reservation' && isSettled(payment.status)) || (total > 0 && paid / total >= 0.1);
    const eventDetailsDone = Boolean(booking.venue_address_line && booking.event_time && (booking.event_timeline || booking.special_instructions || booking.color_motif));
    const menuDone = Boolean(booking.selected_menu);
    const paymentsDone = bookingPayments.length > 0 && bookingPayments.every((payment) => isSettled(payment.status));

    return [
        { label: 'Booking submitted', done: true, action: 'Review event details', tab: 'details' },
        { label: 'Menu selection', done: menuDone, action: 'Finalize menu choices', tab: 'menu' },
        { label: 'Booking approved', done: isApproved, action: 'Awaiting approval', tab: 'details', isPendingGate: !isApproved },
        { label: 'Reservation payment', done: hasReservation, action: 'Complete payment', tab: 'payments', locked: !isApproved },
        { label: 'Event details', done: eventDetailsDone, action: 'Add timeline/motif', tab: 'details' },
        { label: 'Payment balance', done: paymentsDone, action: 'Review final balance', tab: 'payments', locked: !isApproved },
    ];
};

const FloatingJourneyTracker = ({ bookings, payments }) => {
    const activeBookings = bookings.filter((booking) => !['Cancelled', 'cancelled', 'Completed'].includes(booking.status));
    const [selectedId, setSelectedId] = useState(null);
    const [open, setOpen] = useState(false);
    const booking = activeBookings.find((item) => item.id === selectedId) || activeBookings[0];

    useEffect(() => {
        if (!selectedId && activeBookings[0]) {
            setSelectedId(activeBookings[0].id);
        }
    }, [activeBookings, selectedId]);

    if (!booking) return null;

    const steps = buildFloatingJourneySteps(booking, payments);
    const completed = steps.filter((step) => step.done).length;
    const progress = Math.round((completed / steps.length) * 100);
    const remaining = steps.filter((step) => !step.done);

    if (!open) {
        return (
            <button onClick={() => setOpen(true)} className="fixed bottom-5 left-5 z-40 rounded-full border border-white/70 bg-white/95 px-4 py-3 text-left shadow-2xl shadow-black/20 backdrop-blur-md transition-transform hover:-translate-y-0.5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#720101]">Journey</p>
                <div className="mt-1 flex items-center gap-3">
                    <div className="h-2 w-24 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-[#720101]" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-800">{remaining.length} left</span>
                </div>
            </button>
        );
    }

    return (
        <div className="fixed bottom-5 left-5 z-40 w-[calc(100%-2.5rem)] max-w-md rounded-2xl border border-white/70 bg-white/95 p-4 shadow-2xl shadow-black/20 backdrop-blur-md">
            <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#720101]">Journey Tracker</p>
                    <h2 className="mt-1 text-base font-display font-bold text-[#1a1a1a]">
                        {remaining.length === 0 ? 'All steps complete' : `${remaining.length} step${remaining.length > 1 ? 's' : ''} remaining`}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-gray-500">Event on {new Date(booking.event_date).toLocaleDateString()}</p>
                </div>
                <button onClick={() => router.get('/dashboard/client')} className="shrink-0 rounded-full bg-[#720101] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#5a0101]">
                    Open Dashboard
                </button>
                <button onClick={() => setOpen(false)} className="rounded-full bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-200">Hide</button>
            </div>

            {activeBookings.length > 1 && (
                <select value={booking.id} onChange={(event) => setSelectedId(Number(event.target.value))} className="mb-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 outline-none focus:border-[#720101]">
                    {activeBookings.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.client_full_name || 'Eloquente event'} - {new Date(item.event_date).toLocaleDateString()}
                        </option>
                    ))}
                </select>
            )}

            <div className="mb-4">
                <div className="mb-2 flex justify-between text-[11px] font-bold uppercase tracking-widest text-gray-500">
                    <span>Progress</span>
                    <span>{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-[#720101] transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="grid gap-2.5">
                {steps.map((step, index) => (
                    <button 
                        key={step.label} 
                        onClick={() => router.get(`/dashboard/client?tab=${step.tab}`)} 
                        className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all ${step.locked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-gray-50/50 hover:bg-[#720101]/5 active:scale-[0.98]'}`}
                        disabled={step.locked}
                    >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                            step.done ? 'bg-green-600 text-white shadow-lg shadow-green-200' : 
                            step.locked ? 'bg-gray-200 text-gray-400' :
                            step.isPendingGate ? 'bg-[#720101] text-white animate-pulse shadow-lg shadow-red-200' :
                            'bg-white text-[#720101] ring-2 ring-[#720101]/10 shadow-sm'
                        }`}>
                            {step.done ? '✓' : step.locked ? (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            ) : index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className={`truncate text-xs font-black uppercase tracking-wider ${step.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{step.label}</p>
                                {step.isPendingGate && <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#720101] animate-ping" />}
                            </div>
                            {!step.done && <p className="truncate text-[10px] font-bold text-[#720101]/60 uppercase tracking-widest mt-0.5">{step.locked ? 'Step Locked' : step.action}</p>}
                        </div>
                        {!step.done && !step.locked && (
                            <svg className="w-4 h-4 text-[#720101]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

const LandingPage = () => {
    const { user, logout } = useAuth();
    const [journeyData, setJourneyData] = useState({ bookings: [], payments: [] });

    useEffect(() => {
        if (user && user.role === 'Client') {
            fetch('/api/dashboard/client')
                .then(r => r.json())
                .then(data => {
                    setJourneyData({
                        bookings: data.bookings || [],
                        payments: data.payments || [],
                    });
                })
                .catch(err => console.error(err));
        }
    }, [user]);

    return (
        <div className="min-h-screen flex flex-col bg-white" style={{fontFamily:"'Inter',sans-serif"}}>

            <ClientNavbar user={user} logout={logout} />

            <FloatingJourneyTracker bookings={journeyData.bookings} payments={journeyData.payments} />

            {/* HERO */}
            <section className="relative flex items-center overflow-hidden" style={{minHeight:'100vh',paddingTop: 68}}>
                <img src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=85&w=1800" alt="Elegant catered reception service" className="absolute inset-0 w-full h-full object-cover scale-105" style={{animation:'slowZoom 20s ease-in-out infinite alternate'}}/>
                <div className="absolute inset-0" style={{background:'linear-gradient(90deg, rgba(12,10,8,.88) 0%, rgba(55,11,9,.62) 48%, rgba(12,10,8,.32) 100%)'}}/>
                <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 py-20 flex flex-col lg:flex-row items-center gap-12">
                    <div className="flex-1 text-center lg:text-left">
                        <div className="shimmer-line mb-6 mx-auto lg:mx-0" style={{opacity:0,animation:'fadeUp .6s .3s forwards'}}/>
                        <h1 className="font-display text-white leading-[1.1] mb-5" style={{fontSize:'clamp(2.4rem,5.5vw,4rem)',opacity:0,animation:'fadeUp .7s .4s forwards'}}>
                            Eloquente Catering<br/><span style={{color:'#f0aa0b'}}>for events with taste.</span>
                        </h1>
                        <p className="text-white/85 text-base md:text-lg leading-relaxed max-w-lg mb-8 mx-auto lg:mx-0" style={{opacity:0,animation:'fadeUp .7s .55s forwards'}}>
                            Premium catering for weddings, corporate events, and private celebrations — crafted with precision, served with heart.
                        </p>
                        <div className="flex flex-col items-center gap-3 sm:flex-row lg:items-start" style={{opacity:0,animation:'fadeUp .7s .7s forwards'}}>
                            <button onClick={()=>router.get('/book')} className="glow-gold bg-[#f0aa0b] hover:bg-[#d4950a] text-[#1a1a1a] font-bold py-4 px-10 rounded-full text-sm uppercase tracking-wider transition-all shadow-lg hover:shadow-xl">
                                Book Eloquente Now →
                            </button>
                            <button onClick={()=>router.get('/food-tasting')} className="rounded-full border border-white/25 bg-white/10 px-8 py-4 text-sm font-bold uppercase tracking-wider text-white backdrop-blur transition-all hover:bg-white hover:text-[#720101]">
                                Book Tasting
                            </button>
                        </div>
                    </div>
                    <div className="hidden lg:block flex-1 max-w-md" style={{opacity:0,animation:'fadeUp .8s .6s forwards'}}>
                        <div className="relative float-anim">
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10">
                                <p className="text-[#f0aa0b] text-xs font-bold uppercase tracking-widest mb-4">Service Proof</p>
                                <div className="space-y-5">
                                    {[{n:'Events Catered',v:500,s:'+'},{n:'Happy Clients',v:420,s:'+'},{n:'Years of Excellence',v:15,s:''}].map((s,i)=>(
                                        <div key={i} className="flex items-center justify-between border-b border-white/10 pb-3">
                                            <span className="text-white text-sm">{s.n}</span>
                                            <span className="text-white font-display text-2xl font-bold"><Counter end={s.v} suffix={s.s}/></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <style>{`
                    @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
                    @keyframes slowZoom { from{transform:scale(1.05)} to{transform:scale(1.12)} }
                `}</style>
            </section>

            {/* TRUST BAR (marquee) */}
            <div className="overflow-hidden border-y border-[#f0aa0b]/15" style={{background:'linear-gradient(90deg, #720101, #5a0101, #720101)'}}>
                <div className="marquee-track flex items-center whitespace-nowrap py-3.5" style={{width:'max-content'}}>
                    {[...Array(2)].map((_,r)=>(
                        <React.Fragment key={r}>
                            {['500+ Events Catered','Weddings & Corporate','Custom Menus','Transparent Pricing','Online Booking','Budget Optimization','15 Years Experience','Metro Manila & Provinces'].map((t,i)=>(
                                <React.Fragment key={i}>
                                    <span className="text-white/70 text-[11px] font-semibold uppercase tracking-[.2em] mx-5">{t}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#f0aa0b]/40 mx-1 inline-block" />
                                </React.Fragment>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* USP - Alternating layout */}
            <section className="py-24 bg-white overflow-hidden">
                <div className="max-w-6xl mx-auto px-5 sm:px-8">
                    <Rv><div className="text-center mb-20">
                        <p className="text-[#f0aa0b] text-xs font-bold uppercase tracking-[.2em] mb-3">Why Eloquente</p>
                        <h2 className="font-display text-[#1a1a1a] text-3xl md:text-4xl">Built Around Smarter Catering</h2>
                    </div></Rv>

                    <div className="space-y-20">
                        {[
                            {icon:<IcoBudget c="#f0aa0b"/>,title:'Smart Budget Maximizer',text:'Our system stretches every peso — matching the best dishes to your budget without cutting corners. You set the limit, we maximize the feast.',img:'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=500'},
                            {icon:<IcoMenu c="#f0aa0b"/>,title:'Dynamic Menu Generation',text:'Menus automatically adapt to your event type, headcount, and dietary needs. Every plate feels curated, never cookie-cutter.',img:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=500'},
                            {icon:<IcoChart c="#f0aa0b"/>,title:'Decision Support',text:'Live availability, transparent pricing, and instant cost estimates — so you book with total confidence, not guesswork.',img:'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&q=80&w=500'},
                            {icon:<IcoFilter c="#f0aa0b"/>,title:'Rule-Based Filtering',text:'Dietary restrictions, venue constraints, and seasonal availability are handled automatically. Nothing slips through the cracks.',img:'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&q=80&w=500'},
                        ].map((item,i)=>(
                            <div key={i} className={`flex flex-col ${i%2===0?'md:flex-row':'md:flex-row-reverse'} items-center gap-10 md:gap-16`}>
                                <Rv cls={i%2===0?'rv-left':'rv-right'} d="flex-1">
                                    <div className="relative">
                                        <img src={item.img} alt={item.title} className="w-full h-64 md:h-72 object-cover rounded-2xl shadow-lg"/>
                                        <div className="absolute -bottom-3 -right-3 w-24 h-24 rounded-xl bg-[#f0aa0b]/10 -z-10"/>
                                        <div className="absolute -top-3 -left-3 w-16 h-16 rounded-xl bg-[#720101]/10 -z-10"/>
                                    </div>
                                </Rv>
                                <Rv cls={i%2===0?'rv-right':'rv-left'} d="flex-1">
                                    <div>
                                        <div className="w-11 h-11 rounded-xl bg-[#720101]/[0.08] flex items-center justify-center mb-4">{item.icon}</div>
                                        <h3 className="font-display text-[#1a1a1a] text-xl md:text-2xl mb-3">{item.title}</h3>
                                        <p className="text-[#1a1a1a]/50 leading-relaxed">{item.text}</p>
                                    </div>
                                </Rv>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SERVICES - angled section */}
            <section className="clip-slant-top clip-slant-bot bg-[#faf7f2] py-32 -mt-8">
                <div className="max-w-6xl mx-auto px-5 sm:px-8">
                    <Rv><div className="text-center mb-14">
                        <p className="text-[#f0aa0b] text-xs font-bold uppercase tracking-[.2em] mb-3">Our Services</p>
                        <h2 className="font-display text-[#1a1a1a] text-3xl md:text-4xl">Events We Bring to Life</h2>
                    </div></Rv>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {[
                            {t:'Weddings',img:'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=500',d:'Elegant packages for your dream day'},
                            {t:'Corporate',img:'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=500',d:'Professional business catering'},
                            {t:'Private Parties',img:'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&q=80&w=500',d:'Celebrate milestones in style'},
                            {t:'Debut & Baptismal',img:'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&q=80&w=500',d:'Handled with care & warmth'},
                        ].map((s,i)=>(
                            <Rv key={i} d={`rv-d${i+1}`}>
                                <div className="group rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-500 cursor-pointer">
                                    <div className="relative h-52 overflow-hidden">
                                        <img src={s.img} alt={s.t} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"/>
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#720101]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
                                        <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                                            <p className="text-white/80 text-sm">{s.d}</p>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-display text-[#1a1a1a] font-bold">{s.t}</h3>
                                    </div>
                                </div>
                            </Rv>
                        ))}
                    </div>
                    <Rv><div className="text-center mt-10">
                        <Link href="/menu" className="inline-flex items-center gap-1.5 text-[#720101] hover:text-[#f0aa0b] font-semibold text-sm transition-colors group">
                            Browse Full Menu <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                        </Link>
                    </div></Rv>
                </div>
            </section>

            {/* TASTING SECTION */}
            <section className="py-24 bg-white relative overflow-hidden">
                <div className="max-w-6xl mx-auto px-5 sm:px-8">
                    <Rv>
                        <div className="flex flex-col md:flex-row items-center gap-12 bg-[#faf7f2] rounded-3xl p-8 md:p-12 border border-[#f0aa0b]/20 relative overflow-hidden shadow-sm">
                            <div className="absolute inset-x-0 top-0 h-1 bg-[#f0aa0b]"></div>
                            
                            <div className="flex-1 z-10">
                                <p className="text-[#720101] text-xs font-bold uppercase tracking-[.2em] mb-3">Try Before You Buy</p>
                                <h2 className="font-display text-[#1a1a1a] text-3xl md:text-4xl mb-4">Schedule a Private Food Tasting</h2>
                                <p className="text-[#1a1a1a]/60 leading-relaxed mb-8 max-w-md">
                                    Not ready to book yet? Come experience our culinary excellence firsthand. Meet our chefs, taste our bestsellers, and discuss your vision—no strings attached.
                                </p>
                                <button onClick={()=>router.get('/food-tasting')} className="bg-[#720101] hover:bg-[#5a0101] text-white font-bold py-3.5 px-8 rounded-full text-sm uppercase tracking-wider transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2">
                                    Book Tasting
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                                </button>
                            </div>
                            <div className="flex-1 w-full relative z-10">
                                <img src="https://images.unsplash.com/photo-1528712306091-ed0763094c98?auto=format&fit=crop&q=80&w=760" alt="Tasting plates prepared for review" className="w-full h-72 md:h-80 object-cover rounded-2xl shadow-lg border-4 border-white"/>
                                <div className="absolute -bottom-5 -left-5 bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#f0aa0b]/20 flex items-center justify-center text-[#f0aa0b]">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                    <div>
                                        <p className="text-[#1a1a1a] font-bold text-sm">Free for 2 Guests</p>
                                        <p className="text-[#1a1a1a]/50 text-xs">When you book an event</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Rv>
                </div>
            </section>

            {/* PRICING RULES */}
            <section className="relative overflow-hidden bg-[#15110f] py-24 text-white">
                <div className="absolute inset-x-0 top-0 h-1 bg-[#f0aa0b]"/>
                <div className="mx-auto max-w-6xl px-5 sm:px-8">
                    <Rv>
                        <div className="mb-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[.22em] text-[#f0aa0b]">Transparent Pricing</p>
                                <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-5xl">Payment rules that adjust to your booking timeline.</h2>
                            </div>
                            <p className="max-w-2xl text-sm font-medium leading-7 text-white/55">
                                Your schedule is calculated from the event date. Standard bookings use the 10 / 70 / 20 plan, while closer event dates combine payments so sourcing, staffing, and final preparation stay realistic.
                            </p>
                        </div>
                    </Rv>

                    <div className="hidden">
                        {/* Timeline line */}
                        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2"/>
                        <div className="space-y-12 md:space-y-0 md:grid md:grid-cols-1 md:gap-0">
                            {[
                                {pct:'10%',label:'Reservation Fee',text:'Secure your date with a non-refundable fee. We start planning your event right away.',color:'#f0aa0b',side:'left'},
                                {pct:'70%',label:'Down Payment',text:'Due 1 month before. Funds sourcing, staffing, and full logistics preparation.',color:'#720101',side:'right'},
                                {pct:'20%',label:'Final Balance',text:'Due 10 days before. After this, relax — we handle everything on the big day.',color:'#ffffff',side:'left'},
                            ].map((s,i)=>(
                                <Rv key={i} d={`rv-d${i+1}`}>
                                    <div className={`md:flex items-center gap-8 ${s.side==='right'?'md:flex-row-reverse':''} mb-8`}>
                                        <div className="flex-1 md:text-right">
                                            {s.side==='left'&&<StepCard s={s}/>}
                                        </div>
                                        <div className="hidden md:flex flex-col items-center">
                                            <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center" style={{borderColor:s.color}}>
                                                <span className="font-display font-bold text-sm" style={{color:s.color}}>{s.pct}</span>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            {s.side==='right'&&<StepCard s={s}/>}
                                            {s.side==='left'&&<div className="md:block hidden"/>}
                                        </div>
                                        {/* Mobile only */}
                                        <div className="md:hidden"><StepCard s={s} mobile/></div>
                                    </div>
                                </Rv>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-5 lg:grid-cols-3">
                        {[
                            { tag: 'Standard', title: 'More than 30 days before event', amount: '10% / 70% / 20%', points: ['10% reservation fee due within 24 hours', '70% down payment due 1 month before', '20% final balance due 10 days before'], accent: 'bg-[#f0aa0b] text-[#1a1a1a]' },
                            { tag: 'Rush 1', title: '11 to 30 days before event', amount: '80% / 20%', points: ['80% combines reservation and down payment', 'Due within 24 hours to secure the date', '20% final balance due 10 days before'], accent: 'bg-white text-[#720101]' },
                            { tag: 'Rush 2', title: '10 days or less before event', amount: '100%', points: ['Full payment is required immediately', 'Due within 24 hours after booking', 'Used for urgent sourcing and final staffing'], accent: 'bg-[#720101] text-white' },
                        ].map((rule, index) => (
                            <Rv key={rule.tag} d={`rv-d${index + 1}`}>
                                <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/10 backdrop-blur transition-transform hover:-translate-y-1">
                                    <div className="mb-6 flex items-start justify-between gap-4">
                                        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${rule.accent}`}>{rule.tag}</span>
                                        <p className="font-display text-3xl font-bold text-[#f0aa0b]">{rule.amount}</p>
                                    </div>
                                    <h3 className="font-display text-xl font-bold text-white">{rule.title}</h3>
                                    <div className="mt-6 grid gap-3">
                                        {rule.points.map((point) => (
                                            <div key={point} className="flex gap-3 rounded-xl bg-black/20 p-3">
                                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#f0aa0b]"/>
                                                <p className="text-sm font-medium leading-6 text-white/65">{point}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Rv>
                        ))}
                    </div>
                    <Rv>
                        <div className="mt-6 rounded-2xl border border-[#f0aa0b]/25 bg-[#f0aa0b]/10 p-5">
                            <p className="text-sm font-semibold leading-6 text-white/75">
                                All unpaid balances are shown in the dashboard. If dishes are changed while editing is still allowed, the system recalculates the total using current menu prices and updates only unpaid balances.
                            </p>
                        </div>
                    </Rv>
                </div>
            </section>

            {/* TESTIMONIALS */}
            <section className="py-24 bg-white">
                <div className="max-w-5xl mx-auto px-5 sm:px-8">
                    <Rv><div className="text-center mb-14">
                        <p className="text-[#f0aa0b] text-xs font-bold uppercase tracking-[.2em] mb-3">Social Proof</p>
                        <h2 className="font-display text-[#1a1a1a] text-3xl md:text-4xl">Trusted by Hundreds</h2>
                    </div></Rv>
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {name:'Maria Santos',role:'Bride · Dec 2025',text:'Eloquente made our wedding reception flawless. 350 guests served on time, every dish was incredible. Our families still talk about the lechon.'},
                            {name:'James Reyes',role:'HR Director · Accenture PH',text:"We've used them for three annual company dinners. Consistent quality, transparent pricing, and the booking system is genuinely useful."},
                            {name:'Angela Cruz',role:'Event Planner',text:"As a planner, I need reliable caterers. Eloquente's budget tool helped my client get premium food within a tight budget. Highly recommended."},
                        ].map((t,i)=>(
                            <Rv key={i} d={`rv-d${i+1}`}>
                                <div className="group relative rounded-2xl border border-gray-100 p-7 h-full flex flex-col hover:border-[#f0aa0b]/30 transition-colors duration-500">
                                    <div className="absolute top-6 right-6 text-5xl text-[#f0aa0b]/10 font-serif leading-none">"</div>
                                    <div className="flex gap-0.5 mb-4">{[1,2,3,4,5].map(j=><svg key={j} className="w-4 h-4 text-[#f0aa0b]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}</div>
                                    <p className="text-[#1a1a1a]/55 text-sm leading-relaxed flex-1 relative z-10">"{t.text}"</p>
                                    <div className="mt-6 pt-4 border-t border-gray-50 flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-[#720101]/10 flex items-center justify-center text-[#720101] font-bold text-sm">{t.name[0]}</div>
                                        <div><p className="text-[#1a1a1a] text-sm font-semibold">{t.name}</p><p className="text-[#1a1a1a]/35 text-xs">{t.role}</p></div>
                                    </div>
                                </div>
                            </Rv>
                        ))}
                    </div>
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="relative py-28 overflow-hidden" style={{background:'linear-gradient(135deg,#720101 0%,#4a0000 50%,#1a1a1a 100%)'}}>
                <div className="absolute inset-x-0 top-0 h-1 bg-[#f0aa0b]/70"/>
                <div className="relative z-10 max-w-xl mx-auto px-5 text-center">
                    <Rv>
                        <div className="shimmer-line mx-auto mb-8"/>
                        <h2 className="font-display text-white text-3xl md:text-4xl lg:text-5xl leading-tight mb-5">Let's make your next event unforgettable.</h2>
                        <p className="text-white/40 mb-10 max-w-sm mx-auto">From planning to cleanup — we handle every detail so you enjoy the moment.</p>
                        <button onClick={()=>router.get('/book')} className="glow-gold bg-[#f0aa0b] hover:bg-[#d4950a] text-[#1a1a1a] font-bold py-4 px-12 rounded-full text-sm uppercase tracking-wider transition-all shadow-lg hover:shadow-xl">
                            Book Eloquente Now →
                        </button>
                    </Rv>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-[#15110f] text-white py-12">
                <div className="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
                    <img src={logoImg} alt="Eloquente" className="h-10 w-auto opacity-80"/>
                    <div className="flex flex-wrap gap-6 text-sm font-semibold text-white/45">
                        <Link href="/about" className="hover:text-white/60 transition-colors">About</Link>
                        <Link href="/menu" className="hover:text-white/60 transition-colors">Menu</Link>
                        <Link href="/contact" className="hover:text-white/60 transition-colors">Contact</Link>
                    </div>
                    <p className="text-white/20 text-xs">© 2026 Eloquente Catering Services</p>
                </div>
            </footer>

            {/* Chat Bubble */}
            {user && <ChatBubble user={user} />}
        </div>
    );
};

const StepCard = ({s, mobile}) => (
    <div className={mobile ? 'block md:hidden' : 'hidden md:block'}>
        <div className="bg-white/[.04] rounded-xl p-6 border border-white/[.06] hover:bg-white/[.07] transition-colors duration-300">
            {mobile && <span className="font-display font-bold text-lg mb-2 block" style={{color:s.color}}>{s.pct}</span>}
            <h3 className="text-white font-display font-bold text-lg mb-2">{s.label}</h3>
            <p className="text-white/40 text-sm leading-relaxed">{s.text}</p>
        </div>
    </div>
);

export default LandingPage;
