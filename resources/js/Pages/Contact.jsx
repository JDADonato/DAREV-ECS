import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ClientNavbar from '../Components/common/ClientNavbar';
import Footer from '../Components/common/Footer';
import ChatBubble from '../Components/common/ChatBubble';

const Contact = () => {
    const { user, logout } = useAuth();
    const toast = useToast();

    return (
        <div className="min-h-screen bg-[#f7f4ee] font-sans">
            <ClientNavbar user={user} logout={logout} activePath="/contact" />
            <main className="pt-[68px]">
                <section className="bg-[#1a1a1a] text-white">
                    <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.85fr_1.15fr]">
                        <div className="self-end">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f0aa0b]">Contact</p>
                            <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">Start with the details. We will help shape the event.</h1>
                            <p className="mt-5 max-w-xl text-sm font-medium leading-7 text-white/60">Questions, tasting requests, event planning details, and support all start here.</p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            {[
                                ['Office', 'Metro Manila, Philippines'],
                                ['Phone', '+63 912 345 6789'],
                                ['Email', 'bookings@eloquente.com'],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-5">
                                    <p className="text-xs font-black uppercase tracking-widest text-[#f0aa0b]">{label}</p>
                                    <p className="mt-3 text-sm font-bold text-white">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.7fr_1.3fr]">
                    <aside className="rounded-3xl bg-white p-6 shadow-sm">
                        <h2 className="font-display text-2xl font-bold text-[#1a1a1a]">Office Hours</h2>
                        <div className="mt-5 space-y-3 text-sm font-semibold text-gray-600">
                            <p>Monday to Friday: 9:00 AM - 6:00 PM</p>
                            <p>Saturday: 9:00 AM - 1:00 PM</p>
                            <p>Sunday: Closed</p>
                        </div>
                        <div className="mt-8 rounded-2xl bg-[#720101]/5 p-5">
                            <p className="text-xs font-black uppercase tracking-widest text-[#720101]">Fastest path</p>
                            <p className="mt-2 text-sm font-medium leading-6 text-gray-600">For active bookings, use the dashboard chat so your event context stays attached.</p>
                        </div>
                    </aside>

                    <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                        <h2 className="font-display text-2xl font-bold text-[#1a1a1a]">Send a Message</h2>
                        <form className="mt-6 space-y-5" onSubmit={(e) => { e.preventDefault(); toast.success("Message sent successfully. We'll get back to you soon."); }}>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <input required className="rounded-xl border border-transparent px-4 py-3 text-sm font-semibold focus:border-[#720101] focus:ring-[#720101] bg-gray-50 transition-all shadow-sm" placeholder="Full name" />
                                <input required type="email" className="rounded-xl border border-transparent px-4 py-3 text-sm font-semibold focus:border-[#720101] focus:ring-[#720101] bg-gray-50 transition-all shadow-sm" placeholder="Email address" />
                            </div>
                            <input required className="w-full rounded-xl border border-transparent px-4 py-3 text-sm font-semibold focus:border-[#720101] focus:ring-[#720101] bg-gray-50 transition-all shadow-sm" placeholder="Subject" />
                            <textarea required rows="6" className="w-full resize-none rounded-xl border border-transparent px-4 py-3 text-sm font-semibold focus:border-[#720101] focus:ring-[#720101] bg-gray-50 transition-all shadow-sm" placeholder="Tell us about your event, timeline, guest count, or question." />
                            <button type="submit" className="rounded-xl bg-[#720101] px-7 py-3 text-sm font-black uppercase tracking-widest text-white shadow-sm hover:bg-[#5a0101]">
                                Send Message
                            </button>
                        </form>
                    </div>
                </section>
            </main>
            <Footer />
            {user && <ChatBubble user={user} />}
        </div>
    );
};

export default Contact;
