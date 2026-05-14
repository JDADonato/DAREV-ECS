import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import UserDropdown from './UserDropdown';
import logoImg from '../../images/ECS_LOGO.png';
const ClientNavbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Book', path: '/book' },
        { name: 'Menu', path: '/menu' },
    ];

    return (
        <nav className="bg-brand-red shadow-lg py-4 relative z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center">
                    {/* Logo */}
                    <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => navigate('/')}>
                        <img src={logoImg} alt="Eloquente Catering" className="h-12 w-auto object-contain" />
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                to={link.path}
                                className="text-white hover:text-yellow-400 font-medium text-sm uppercase tracking-wider transition-colors"
                            >
                                {link.name}
                            </Link>
                        ))}

                        <div className="border-l border-white/30 h-6 mx-4"></div>

                        {user ? (
                            <div className="flex items-center space-x-4">
                                <UserDropdown 
                                    user={user} 
                                    dashLink={user.role === 'Client' ? '/dashboard/client' : user.role === 'Marketing' ? '/dashboard/ops' : user.role === 'Accounting' ? '/dashboard/finance' : '/dashboard/admin'} 
                                />
                            </div>
                        ) : (
                            <div className="flex items-center space-x-4">
                                <Link to="/login" className="text-white hover:text-yellow-400 text-sm font-medium uppercase tracking-wider">
                                    Login
                                </Link>
                                <Link
                                    to="/register"
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
                                to={link.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="block text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium"
                            >
                                {link.name}
                            </Link>
                        ))}
                        {user ? (
                            <>
                                <Link to={user.role === 'Client' ? '/dashboard/client' : user.role === 'Marketing' ? '/dashboard/ops' : user.role === 'Accounting' ? '/dashboard/finance' : '/dashboard/admin'} className="block text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                                    Dashboard
                                </Link>
                                <a href="/profile" className="block text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                                    My Profile
                                </a>
                                <button
                                    onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                                    className="w-full text-left text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <div className="mt-4 flex flex-col space-y-2">
                                <Link to="/login" className="block text-center text-white border border-white/30 px-3 py-2 rounded-md" onClick={() => setIsMobileMenuOpen(false)}>Login</Link>
                                <Link to="/register" className="block text-center bg-yellow-500 text-red-900 px-3 py-2 rounded-md font-bold" onClick={() => setIsMobileMenuOpen(false)}>Register</Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default ClientNavbar;
