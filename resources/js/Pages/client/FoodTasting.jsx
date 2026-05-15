import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, MessageSquareText, Phone, Utensils } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const FoodTasting = () => {
    const { user, logout } = useAuth();
    const [formData, setFormData] = useState({
        guest_name: user ? user.username : '',
        guest_email: user ? user.email || '' : '',
        guest_phone: '',
        preferred_date: '',
        preferred_time: '',
        notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch('/api/food-tasting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();

            if (response.ok) {
                setMessage({ type: 'success', text: 'Food tasting scheduled successfully.' });
                if (user) setTimeout(() => router.get('/dashboard/client?tab=tastings'), 1200);
                else setFormData({ guest_name: '', guest_email: '', guest_phone: '', preferred_date: '', preferred_time: '', notes: '' });
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to schedule tasting.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f7f4ee] font-sans text-[#1a1a1a]">
            <header className="fixed top-0 z-50 w-full border-b border-[#720101]/10 bg-white/95 shadow-sm backdrop-blur">
                <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8">
                    <button onClick={() => window.history.length > 1 ? window.history.back() : router.get('/')} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-[#720101] transition-colors hover:bg-[#720101]/5">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                    <div className="text-center">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#720101]">Food Tasting</p>
                        <p className="hidden text-xs font-semibold text-gray-500 sm:block">Schedule a tasting session before finalizing your menu</p>
                    </div>
                    <button onClick={() => router.get('/dashboard/client?tab=tastings')} className="rounded-full bg-[#720101] px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-[#5a0101]">
                        Tastings
                    </button>
                </div>
            </header>

            <main className="mx-auto grid max-w-7xl gap-8 px-5 pb-12 pt-28 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
                <section className="rounded-3xl bg-[#1a1a1a] p-8 text-white shadow-xl shadow-black/10 lg:sticky lg:top-24 lg:self-start">
                    <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0aa0b] text-[#1a1a1a]">
                        <Utensils className="h-7 w-7" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#f0aa0b]">Food Tasting</p>
                    <h1 className="mt-3 text-4xl font-display font-bold leading-tight">Taste the menu before the event day.</h1>
                    <p className="mt-4 text-sm font-medium leading-7 text-white/65">Schedule a focused tasting session so our team can confirm flavor direction, dietary needs, and final menu notes.</p>

                    <div className="mt-8 grid gap-3">
                        {[
                            [CalendarDays, 'Pick your preferred date'],
                            [Clock, 'Choose a convenient time'],
                            [MessageSquareText, 'Share allergies and menu notes'],
                            [Phone, 'Our team confirms availability'],
                        ].map(([Icon, text]) => (
                            <div key={text} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                                <Icon className="h-5 w-5 text-[#f0aa0b]" />
                                <span className="text-sm font-bold text-white/85">{text}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
                    <div className="mb-6 flex items-start justify-between gap-5">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-[#720101]">Request Session</p>
                            <h2 className="mt-1 text-2xl font-display font-bold">Schedule your tasting</h2>
                        </div>
                        <button onClick={() => router.get('/dashboard/client?tab=tastings')} className="hidden rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 sm:block">My Tastings</button>
                    </div>

                    {message && (
                        <div className={`mb-6 flex items-center gap-3 rounded-2xl p-4 text-sm font-bold ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            <CheckCircle2 className="h-5 w-5" />
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="grid gap-5">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Name</span>
                                <input name="guest_name" required value={formData.guest_name} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#720101] focus:bg-white" />
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Email</span>
                                <input type="email" name="guest_email" required value={formData.guest_email} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#720101] focus:bg-white" />
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Phone</span>
                                <input type="tel" name="guest_phone" required value={formData.guest_phone} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#720101] focus:bg-white" />
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Preferred Date</span>
                                <input type="date" name="preferred_date" required value={formData.preferred_date} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#720101] focus:bg-white" />
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Preferred Time</span>
                                <input type="time" name="preferred_time" required value={formData.preferred_time} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#720101] focus:bg-white" />
                            </label>
                        </div>
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Notes / Dietary Requirements</span>
                            <textarea name="notes" rows="5" value={formData.notes} onChange={handleChange} className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#720101] focus:bg-white" placeholder="Allergies, preferred dishes, event context, or special tasting requests." />
                        </label>
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => router.get('/menu')} className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50">Browse Menu</button>
                            <button type="submit" disabled={loading} className="rounded-xl bg-[#720101] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#720101]/15 hover:bg-[#5a0101] disabled:opacity-60">
                                {loading ? 'Scheduling...' : 'Schedule Tasting'}
                            </button>
                        </div>
                    </form>
                </section>
            </main>
        </div>
    );
};

export default FoodTasting;
