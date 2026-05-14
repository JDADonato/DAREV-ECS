import React, { useEffect, useRef, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import { useAuth } from '../context/AuthContext';
import UserDropdown from '../Components/common/UserDropdown';
import NotificationBell from '../Components/common/NotificationBell';
import ChatBubble from '../Components/common/ChatBubble';
import logoImg from '../../images/ECS_LOGO.png';

/* ── SVG Icons ── */
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

const LandingPage = () => {
    const { user, logout } = useAuth();
    const [mob, setMob] = useState(false);
    const links = [{ n:'Home',p:'/' },{ n:'Menu',p:'/menu' },{ n:'Book Now',p:'/book' },{ n:'About',p:'/about' },{ n:'Contact',p:'/contact' }];
    const dash = () => !user ? '/' : ({Client:'/dashboard/client',Marketing:'/dashboard/ops',Accounting:'/dashboard/finance',Admin:'/dashboard/admin'}[user.role]||'/');

    return (
        <div className="min-h-screen flex flex-col bg-white" style={{fontFamily:"'Inter',sans-serif"}}>

            {/* NAV */}
            <nav className="fixed w-full z-50 bg-[#720101]" style={{boxShadow:'0 2px 20px rgba(0,0,0,.3)'}}>
                <div className="max-w-7xl mx-auto px-5 sm:px-8">
                    <div className="flex items-center justify-between" style={{height:68}}>
                        <Link href="/"><img src={logoImg} alt="ECS" className="h-12 w-auto" /></Link>
                        <div className="hidden md:flex items-center gap-7">
                            {links.map(l=>{
                                const isActive = window.location.pathname === l.p || (l.p === '/' && window.location.pathname === '/');
                                return (
                                    <Link key={l.n} href={l.p} className="relative py-1 group">
                                        <span className={`text-[13px] font-medium uppercase tracking-widest transition-colors duration-200 ${isActive ? 'text-[#f0aa0b]' : 'text-white/80 group-hover:text-[#f0aa0b]'}`}>{l.n}</span>
                                        <span className={`absolute left-0 -bottom-1 h-[2px] bg-[#f0aa0b] rounded-full transition-all duration-300 ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                                    </Link>
                                );
                            })}
                            <span className="w-px h-5 bg-white/15"/>
                            {user ? (
                                <div className="flex items-center gap-2">
                                    <NotificationBell variant="light" />
                                    <UserDropdown user={user} dashLink={dash()} />
                                </div>
                            ) : (<>
                                <Link href="/login" className="text-white/80 hover:text-[#f0aa0b] text-[13px] font-medium uppercase tracking-widest transition-colors">Login</Link>
                                <Link href="/register" className="bg-[#f0aa0b] hover:bg-[#d4950a] text-[#1a1a1a] text-xs font-bold py-2.5 px-6 rounded-full transition-colors shadow-sm">Register</Link>
                            </>)}
                        </div>
                        <button onClick={()=>setMob(!mob)} className="md:hidden text-white p-1">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{mob?<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>:<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>}</svg>
                        </button>
                    </div>
                </div>
                {mob&&<div className="md:hidden border-t border-white/10" style={{background:'#5a0101'}}>
                    <div className="px-5 py-3 space-y-1">
                        {links.map(l=><Link key={l.n} href={l.p} onClick={()=>setMob(false)} className="block text-white text-sm py-2.5 px-3 rounded-lg hover:bg-white/10">{l.n}</Link>)}
                        {user?(<>
                            <Link href={dash()} onClick={()=>setMob(false)} className="block text-white text-sm py-2.5 px-3 rounded-lg hover:bg-white/10">Dashboard</Link>
                            <button onClick={()=>{logout();setMob(false)}} className="w-full text-left text-white text-sm py-2.5 px-3 rounded-lg hover:bg-white/10">Logout</button>
                        </>):(<div className="pt-2 space-y-2">
                            <Link href="/login" onClick={()=>setMob(false)} className="block text-center text-white border border-white/20 py-2.5 rounded-lg text-sm">Login</Link>
                            <Link href="/register" onClick={()=>setMob(false)} className="block text-center bg-[#f0aa0b] text-[#1a1a1a] py-2.5 rounded-lg text-sm font-bold">Register</Link>
                        </div>)}
                    </div>
                </div>}
            </nav>

            {/* HERO */}
            <section className="relative flex items-center overflow-hidden" style={{minHeight:'100vh',paddingTop:68}}>
                <img src="/images/hero-catering.png" alt="" className="absolute inset-0 w-full h-full object-cover scale-105" style={{animation:'slowZoom 20s ease-in-out infinite alternate'}}/>
                <div className="absolute inset-0" style={{background:'linear-gradient(to bottom, rgba(0,0,0,.7) 0%, rgba(114,1,1,.4) 50%, rgba(0,0,0,.75) 100%)'}}/>
                <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 py-20 flex flex-col lg:flex-row items-center gap-12">
                    <div className="flex-1 text-center lg:text-left">
                        <div className="shimmer-line mb-6 mx-auto lg:mx-0" style={{opacity:0,animation:'fadeUp .6s .3s forwards'}}/>
                        <h1 className="font-display text-white leading-[1.1] mb-5" style={{fontSize:'clamp(2.4rem,5.5vw,4rem)',opacity:0,animation:'fadeUp .7s .4s forwards'}}>
                            Where great food<br/><span style={{color:'#f0aa0b'}}>speaks for itself.</span>
                        </h1>
                        <p className="text-white/85 text-base md:text-lg leading-relaxed max-w-lg mb-8 mx-auto lg:mx-0" style={{opacity:0,animation:'fadeUp .7s .55s forwards'}}>
                            Premium catering for weddings, corporate events, and private celebrations — crafted with precision, served with heart.
                        </p>
                        <div style={{opacity:0,animation:'fadeUp .7s .7s forwards'}}>
                            <button onClick={()=>router.get('/book')} className="glow-gold bg-[#f0aa0b] hover:bg-[#d4950a] text-[#1a1a1a] font-bold py-4 px-10 rounded-full text-sm uppercase tracking-wider transition-all shadow-lg hover:shadow-xl">
                                Book Eloquente Now →
                            </button>
                        </div>
                    </div>
                    <div className="hidden lg:block flex-1 max-w-md" style={{opacity:0,animation:'fadeUp .8s .6s forwards'}}>
                        <div className="relative float-anim">
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10">
                                <p className="text-[#f0aa0b] text-xs font-bold uppercase tracking-widest mb-4">Quick Stats</p>
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

            {/* PROCESS - visual timeline */}
            <section className="py-24 relative overflow-hidden" style={{background:'linear-gradient(160deg,#0f0f0f 0%,#1a1a1a 50%,#0f0f0f 100%)'}}>
                <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[.03]" style={{background:'radial-gradient(circle,#f0aa0b,transparent 70%)'}}/>
                <div className="max-w-4xl mx-auto px-5 sm:px-8 relative z-10">
                    <Rv><div className="text-center mb-16">
                        <p className="text-[#f0aa0b] text-xs font-bold uppercase tracking-[.2em] mb-3">Transparent Pricing</p>
                        <h2 className="font-display text-white text-3xl md:text-4xl">The 10 / 70 / 20 Plan</h2>
                        <p className="text-white/35 mt-3 max-w-md mx-auto">No hidden fees. A clear, structured payment flow from booking to event day.</p>
                    </div></Rv>

                    <div className="relative">
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
                <div className="absolute inset-0 opacity-[.04]" style={{backgroundImage:'radial-gradient(circle at 30% 40%,#f0aa0b,transparent 60%),radial-gradient(circle at 70% 60%,#f0aa0b,transparent 60%)'}}/>
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
            <footer className="bg-[#0f0f0f] text-white py-10">
                <div className="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-5">
                    <img src={logoImg} alt="Eloquente" className="h-9 w-auto opacity-60"/>
                    <div className="flex gap-6 text-xs text-white/30">
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
