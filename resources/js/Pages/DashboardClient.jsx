import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import logoImg from '../../images/ECS_LOGO.png';

const DashboardClient = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);

    // Handle scroll effect for navbar
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const navLinks = [
        { name: 'Home', path: '/dashboard/client' },
        { name: 'Book', path: '/dashboard/client/booking' },
        { name: 'Menu', path: '/dashboard/client/menu' },
        { name: 'About', path: '/about' },
        { name: 'Contact', path: '/contact' },
    ];

    return (
        <div className="min-h-screen flex flex-col font-sans">
            {/* Top Navigation Bar */}
            {/* Added black gradient overlay when at top for readability, solid red when scrolled */}
            <nav className="fixed w-full z-50 bg-brand-red shadow-lg py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        {/* Logo */}
                        <div className="flex-shrink-0 flex items-center">
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

                            <div className="flex items-center space-x-4">
                                <span className="text-white/80 text-sm">Hello, {user?.username}</span>
                                <button
                                    onClick={handleLogout}
                                    className="text-white hover:text-red-200 text-sm font-medium"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>

                        {/* Mobile Menu Button (Placeholder) */}
                        <div className="md:hidden flex items-center">
                            <button className="text-white hover:text-gray-200">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 bg-white">
                <Outlet />
            </main>

            {/* Simple Footer */}
            <footer className="bg-gray-900 text-white py-8">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="font-display font-bold text-lg mb-2">Eloquente Catering</p>
                    <p className="text-gray-400 text-sm">© 2026 All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default DashboardClient;
