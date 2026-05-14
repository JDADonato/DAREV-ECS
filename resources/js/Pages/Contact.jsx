import React, { useState } from 'react';
import { Link, router } from '@inertiajs/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import logoImg from '../../images/ECS_LOGO.png';

const Contact = () => {
    const { user } = useAuth();
    const toast = useToast();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Menu', path: '/menu' },
        { name: 'Book Now', path: '/book' },
        { name: 'About', path: '/about' },
        { name: 'Contact', path: '/contact' },
    ];

    return (
        <div className="min-h-screen flex flex-col font-sans bg-gray-50">
            {/* Navbar */}
            <nav className="bg-brand-red shadow-lg py-4 relative z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <div className="flex-shrink-0 flex items-center">
                            <Link href="/">
                                <img src={logoImg} alt="Eloquente Catering" className="h-12 w-auto object-contain" />
                            </Link>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center space-x-8">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.path}
                                    className="text-white hover:text-yellow-400 font-medium text-sm uppercase tracking-wider transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}

                            <div className="border-l border-white/30 h-6 mx-4"></div>

                            {user ? (
                                <div className="flex items-center space-x-4">
                                    <span className="text-white text-sm mr-2">Hello, {user.username}</span>
                                    <Link
                                        href={
                                            user.role === 'Client' ? '/dashboard/client' :
                                                user.role === 'Marketing' ? '/dashboard/ops' :
                                                    user.role === 'Accounting' ? '/dashboard/finance' :
                                                        (user.role === 'Admin') ? '/dashboard/admin' : '/'
                                        }
                                        className="text-white hover:text-yellow-400 text-sm font-medium uppercase tracking-wider"
                                    >
                                        Dashboard
                                    </Link>
                                    <button
                                        onClick={() => router.post('/logout')}
                                        className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-full text-xs uppercase tracking-wider transition-all border border-white/30"
                                    >
                                        Logout
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-4">
                                    <Link href="/login" className="text-white hover:text-yellow-400 text-sm font-medium uppercase tracking-wider">
                                        Login
                                    </Link>
                                    <Link
                                        href="/register"
                                        className="bg-yellow-500 hover:bg-yellow-400 text-red-900 font-bold py-2 px-6 rounded-full text-xs uppercase tracking-wider transition-transform transform hover:scale-105 shadow-lg"
                                    >
                                        Register
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden flex items-center">
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="text-white hover:text-gray-200 focus:outline-none"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {isMobileMenuOpen ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                    )}
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-red-800 absolute top-full left-0 w-full shadow-xl">
                        <div className="px-4 pt-2 pb-4 space-y-2">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="block text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium"
                                >
                                    {link.name}
                                </Link>
                            ))}
                            {user ? (
                                <>
                                    <Link href="/dashboard/client" className="block text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                                        Dashboard
                                    </Link>
                                    <button
                                        onClick={() => { router.post('/logout'); setIsMobileMenuOpen(false); }}
                                        className="w-full text-left text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium"
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <div className="mt-4 flex flex-col space-y-2">
                                    <Link href="/login" className="block text-center text-white border border-white/30 px-3 py-2 rounded-md" onClick={() => setIsMobileMenuOpen(false)}>Login</Link>
                                    <Link href="/register" className="block text-center bg-yellow-500 text-red-900 px-3 py-2 rounded-md font-bold" onClick={() => setIsMobileMenuOpen(false)}>Register</Link>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            {/* Header */}
            <div className="bg-red-900 py-16 px-4 text-center">
                <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
                    Contact Us
                </h1>
                <p className="text-red-100 max-w-2xl mx-auto text-lg font-light">
                    Have a question or ready to start planning your event? We'd love to hear from you.
                </p>
            </div>

            {/* Main Content */}
            <div className="flex-grow py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row gap-16">
                        {/* Contact Info */}
                        <div className="w-full lg:w-1/3 space-y-8">
                            <div>
                                <h3 className="text-2xl font-bold font-display text-red-900 mb-6">Get In Touch</h3>
                                <div className="space-y-4 text-gray-600">
                                    <div className="flex items-start">
                                        <svg className="w-6 h-6 text-yellow-500 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        <div>
                                            <h4 className="font-bold text-gray-900">Head Office</h4>
                                            <p>123 Culinary Ave, Food District</p>
                                            <p>Metro Manila, Philippines 1000</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start">
                                        <svg className="w-6 h-6 text-yellow-500 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                        <div>
                                            <h4 className="font-bold text-gray-900">Phone</h4>
                                            <p>+63 912 345 6789</p>
                                            <p>+63 2 8123 4567</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start">
                                        <svg className="w-6 h-6 text-yellow-500 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                        <div>
                                            <h4 className="font-bold text-gray-900">Email</h4>
                                            <p>hello@eloquente.com</p>
                                            <p>bookings@eloquente.com</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-orange-50 p-6 rounded-xl border border-orange-100">
                                <h4 className="font-bold text-red-900 mb-2">Office Hours</h4>
                                <p className="text-gray-600 text-sm">Monday - Friday: 9:00 AM - 6:00 PM</p>
                                <p className="text-gray-600 text-sm">Saturday: 9:00 AM - 1:00 PM</p>
                                <p className="text-gray-600 text-sm">Sunday: Closed</p>
                            </div>
                        </div>

                        {/* Contact Form */}
                        <div className="w-full lg:w-2/3">
                            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                                <h3 className="text-2xl font-bold font-display text-gray-900 mb-6">Send us a Message</h3>
                                <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); toast.success('Message sent successfully! We\'ll get back to you soon.'); }}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                                            <input type="text" className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-yellow-500 focus:border-yellow-500" placeholder="Juan Dela Cruz" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                                            <input type="email" className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-yellow-500 focus:border-yellow-500" placeholder="juan@example.com" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Subject</label>
                                        <input type="text" className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-yellow-500 focus:border-yellow-500" placeholder="Event Inquiry" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Message</label>
                                        <textarea rows="5" className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-yellow-500 focus:border-yellow-500" placeholder="Tell us about your event..."></textarea>
                                    </div>
                                    <div>
                                        <button type="submit" className="w-full bg-red-900 hover:bg-red-800 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-colors uppercase tracking-wider">
                                            Send Message
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-8 mt-auto">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="font-display font-bold text-lg mb-2">Eloquente Catering</p>
                    <p className="text-gray-400 text-sm">© 2026 All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default Contact;
