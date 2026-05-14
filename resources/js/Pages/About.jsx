import React, { useState } from 'react';
import { Link, router } from '@inertiajs/react';
import { useAuth } from '../context/AuthContext';
import logoImg from '../../images/ECS_LOGO.png';

const About = () => {
    const { user } = useAuth();
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
                    About Eloquente
                </h1>
                <p className="text-red-100 max-w-2xl mx-auto text-lg font-light">
                    Crafting unforgettable culinary experiences since 2010.
                </p>
            </div>

            {/* Main Content */}
            <div className="flex-grow py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row gap-16 items-center">
                        <div className="w-full lg:w-1/2">
                            <img 
                                src="https://images.unsplash.com/photo-1555244162-803834f70033?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80" 
                                alt="Chef cooking" 
                                className="rounded-2xl shadow-2xl object-cover h-[500px] w-full"
                            />
                        </div>
                        <div className="w-full lg:w-1/2 space-y-6">
                            <h2 className="text-3xl font-display font-bold text-red-900 mb-4">Our Story</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                At Eloquente Catering, we believe that food is not just nourishment, but an art form that brings people together. What started as a small family kitchen has blossomed into one of the city's premier catering services.
                            </p>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                Our philosophy is simple: source the freshest local ingredients, prepare them with passion and creativity, and serve them with impeccable hospitality. Whether it's an intimate corporate luncheon or a grand wedding celebration, our team is dedicated to making every event truly spectacular.
                            </p>
                            
                            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-200 mt-8">
                                <div>
                                    <h4 className="text-4xl font-bold text-yellow-500 mb-2">500+</h4>
                                    <p className="text-gray-500 font-medium uppercase tracking-wider text-sm">Events Catered</p>
                                </div>
                                <div>
                                    <h4 className="text-4xl font-bold text-yellow-500 mb-2">15</h4>
                                    <p className="text-gray-500 font-medium uppercase tracking-wider text-sm">Years Experience</p>
                                </div>
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

export default About;
