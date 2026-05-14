import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { router } from '@inertiajs/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, ScatterChart, Scatter, ZAxis } from 'recharts';

const DashboardAdmin = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');

    // ==========================================
    // EMPLOYEE MANAGEMENT STATE
    // ==========================================
    const [employees, setEmployees] = useState([]);
    const [empLoading, setEmpLoading] = useState(false);
    const [empModal, setEmpModal] = useState({ open: false, mode: 'add', data: null });
    const [empForm, setEmpForm] = useState({ username: '', password: '', role: 'Marketing', email: '', phone: '' });
    const [empFormLoading, setEmpFormLoading] = useState(false);

    // ==========================================
    // PRICING CONTROL STATE
    // ==========================================
    const [pricingOverrides, setPricingOverrides] = useState({});
    const [pricingLoading, setPricingLoading] = useState(false);
    const [activeMenuCategory, setActiveMenuCategory] = useState('starter');

    // ==========================================
    // CUSTOM MENU ITEMS STATE
    // ==========================================
    const [customMenuItems, setCustomMenuItems] = useState([]);
    const [menuItemModal, setMenuItemModal] = useState({ open: false, mode: 'add', data: null });
    const [menuItemForm, setMenuItemForm] = useState({
        name: '', category: 'starter', cost_per_head: '', price_adj: '0',
        image: '', description: '', is_best_seller: false
    });
    const [menuItemFormLoading, setMenuItemFormLoading] = useState(false);

    // ==========================================
    // DISCOUNTS STATE
    // ==========================================
    const [bookings, setBookings] = useState([]);
    const [bookingsLoading, setBookingsLoading] = useState(false);
    const [discountModal, setDiscountModal] = useState({ open: false, data: null });
    const [discountForm, setDiscountForm] = useState({ discount_type: 'fixed', discount_value: 0 });
    const [discountLoading, setDiscountLoading] = useState(false);

    const [eventDetailsModal, setEventDetailsModal] = useState({ open: false, data: null });

    // ==========================================
    // ANALYTICS STATE
    // ==========================================
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [activeAnalyticsCategory, setActiveAnalyticsCategory] = useState('All');

    // Mock data for analytics
    const salesFrequencyData = {
        'All': [
            { name: 'Grand Wedding', sales: 45 },
            { name: 'Corporate Gala', sales: 38 },
            { name: 'Classic Debut', sales: 25 },
            { name: 'Premium Add-ons', sales: 60 }
        ],
        'starters': [
            { name: 'Beef Salpicao', sales: 50 },
            { name: 'Mushroom Soup', sales: 30 }
        ],
        'mains': [
            { name: 'Roast Beef', sales: 85 },
            { name: 'Shrimp Aglio Olio', sales: 40 }
        ],
        'desserts': [
            { name: 'Creamy Buko Lychee', sales: 60 },
            { name: 'Chocolate Mousse', sales: 45 }
        ]
    };

    const revenueForecastData = [
        { month: 'Jul', actual: 400000, forecast: 420000 },
        { month: 'Aug', actual: 450000, forecast: 460000 },
        { month: 'Sep', actual: 300000, forecast: 350000 },
        { month: 'Oct', actual: null, forecast: 500000 },
        { month: 'Nov', actual: null, forecast: 650000 },
        { month: 'Dec', actual: null, forecast: 850000 }
    ];

    const projectedPaxDemand = [
        { date: 'Oct 1', pax: 150 },
        { date: 'Oct 8', pax: 300 },
        { date: 'Oct 15', pax: 100 },
        { date: 'Oct 22', pax: 500 },
        { date: 'Nov 5', pax: 250 },
        { date: 'Nov 12', pax: 800 }
    ];

    // Toast notification
    const [toast, setToast] = useState(null);

    const handleLogout = () => {
        router.post('/logout');
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        if (activeTab === 'users') {
            fetchEmployees();
        } else if (activeTab === 'configuration') {
            fetchPricingOverrides();
            fetchCustomMenuItems();
        } else if (activeTab === 'dashboard' || activeTab === 'analytics') {
            fetchAnalytics();
        } else if (activeTab === 'bookings') {
            fetchBookings();
        }
    }, [activeTab]);

    const fetchEmployees = async () => {
        setEmpLoading(true);
        try {
            // Session auth - no token needed
            const res = await fetch('/api/admin/employees', {
                headers: { }
            });
            if (res.ok) {
                const data = await res.json();
                setEmployees(data);
            }
        } catch (error) {
            console.error(error);
            showToast("Failed to fetch employees", 'error');
        } finally {
            setEmpLoading(false);
        }
    };

    const fetchPricingOverrides = async () => {
        setPricingLoading(true);
        try {
            // Session auth - no token needed
            const res = await fetch('/api/pricing', {
                headers: { }
            });
            if (res.ok) {
                const data = await res.json();
                setPricingOverrides(data.overrides || {});
            }
        } catch (error) {
            console.error(error);
            showToast("Failed to fetch pricing", 'error');
        } finally {
            setPricingLoading(false);
        }
    };

    const handlePricingUpdate = async (item_type, item_id, new_price) => {
        if (!new_price || isNaN(new_price) || new_price < 0) {
            return showToast("Invalid price amount", 'error');
        }
        try {
            // Session auth - no token needed
            const res = await fetch('/api/admin/pricing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: `${item_type}_${item_id}`,
                    item_type,
                    item_id,
                    new_price: parseFloat(new_price)
                })
            });

            if (res.ok) {
                showToast("Price updated successfully");
                fetchPricingOverrides();
            } else {
                showToast("Failed to update price", 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Network error", 'error');
        }
    };

    // ==========================================
    // CUSTOM MENU ITEMS HANDLERS
    // ==========================================

    const fetchCustomMenuItems = async () => {
        try {
            const res = await fetch('/api/menu-items');
            if (res.ok) {
                const data = await res.json();
                setCustomMenuItems(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const openMenuItemModal = () => {
        setMenuItemForm({
            name: '', category: activeMenuCategory, cost_per_head: '', price_adj: '0',
            image: '', description: '', is_best_seller: false
        });
        setMenuItemModal({ open: true, mode: 'add', data: null });
    };

    const handleMenuItemSubmit = async (e) => {
        e.preventDefault();
        setMenuItemFormLoading(true);
        try {
            const res = await fetch('/api/admin/menu-items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...menuItemForm,
                    cost_per_head: parseFloat(menuItemForm.cost_per_head) || 0,
                    price_adj: parseFloat(menuItemForm.price_adj) || 0,
                })
            });

            if (res.ok) {
                showToast('Menu item added successfully');
                setMenuItemModal({ open: false, mode: 'add', data: null });
                fetchCustomMenuItems();
            } else {
                const err = await res.json();
                showToast(err.message || 'Failed to add menu item', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Network error', 'error');
        } finally {
            setMenuItemFormLoading(false);
        }
    };

    const handleDeleteMenuItem = async (id) => {
        if (!confirm('Are you sure you want to delete this menu item?')) return;
        try {
            const res = await fetch(`/api/admin/menu-items/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Menu item deleted');
                fetchCustomMenuItems();
            } else {
                showToast('Failed to delete menu item', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Network error', 'error');
        }
    };

    // All menu items now come from the database
    const MENU_CATEGORIES = ['starter', 'main', 'side', 'dessert', 'drink'];

    const getMergedDishes = (category) => {
        return customMenuItems
            .filter(item => item.category === category)
            .map(item => ({
                id: item.dish_id,
                _dbId: item.id,
                name: item.name,
                costPerHead: parseFloat(item.cost_per_head),
                priceAdj: parseFloat(item.price_adj),
                image: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
                isBestSeller: item.is_best_seller,
                description: item.description || '',
                _isCustom: true,
            }));
    };

    const fetchAnalytics = async () => {
        setAnalyticsLoading(true);
        try {
            // Session auth - no token needed
            const res = await fetch('/api/admin/analytics', {
                headers: { }
            });
            if (res.ok) {
                const data = await res.json();
                setAnalytics(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const fetchBookings = async () => {
        setBookingsLoading(true);
        try {
            // Session auth - no token needed
            const res = await fetch('/api/finance/bookings', { // Fetching from finance to get full booking data + total costs easily
                headers: { }
            });
            if (res.ok) {
                const data = await res.json();
                setBookings(Array.isArray(data) ? data : (data.bookings || []));
            }
        } catch (error) {
            console.error(error);
            showToast("Failed to fetch bookings", 'error');
        } finally {
            setBookingsLoading(false);
        }
    };

    const handleDiscountSubmit = async (e) => {
        e.preventDefault();
        setDiscountLoading(true);
        try {
            // Session auth - no token needed
            const res = await fetch(`/api/admin/bookings/${discountModal.data.id}/discount`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(discountForm)
            });

            if (res.ok) {
                showToast("Discount applied successfully");
                setDiscountModal({ open: false, data: null });
                fetchBookings();
            } else {
                showToast("Failed to apply discount", 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Network error", 'error');
        } finally {
            setDiscountLoading(false);
        }
    };

    const handleEmpSubmit = async (e) => {
        e.preventDefault();
        setEmpFormLoading(true);
        try {
            // Session auth - no token needed
            const url = empModal.mode === 'add'
                ? '/api/admin/employees'
                : `/api/admin/employees/${empModal.data.id}`;
            const method = empModal.mode === 'add' ? 'POST' : 'PUT';

            // Only send password if provided (for edits)
            const payload = { ...empForm };
            if (empModal.mode === 'edit' && !payload.password) {
                delete payload.password;
            }

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast(`Employee ${empModal.mode === 'add' ? 'created' : 'updated'} successfully`);
                setEmpModal({ open: false, mode: 'add', data: null });
                fetchEmployees();
            } else {
                const err = await res.json();
                showToast(err.error || "Failed to save employee", 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Network error", 'error');
        } finally {
            setEmpFormLoading(false);
        }
    };

    const handleDeleteEmployee = async (id) => {
        if (!window.confirm("Are you sure you want to delete this employee?")) return;
        try {
            // Session auth - no token needed
            const res = await fetch(`/api/admin/employees/${id}`, {
                method: 'DELETE',
                headers: { }
            });
            if (res.ok) {
                showToast("Employee deleted successfully");
                fetchEmployees();
            } else {
                showToast("Failed to delete employee", 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Network error", 'error');
        }
    };

    const openEmpModal = (mode, employee = null) => {
        if (mode === 'add') {
            setEmpForm({ username: '', password: '', role: 'Marketing', email: '', phone: '' });
        } else {
            setEmpForm({
                username: employee.username,
                password: '', // blank password for editing implies no change
                role: employee.role,
                email: employee.email || '',
                phone: employee.phone || ''
            });
        }
        setEmpModal({ open: true, mode, data: employee });
    };


    return (
        <div className="min-h-screen bg-gray-50 flex overflow-hidden">
            {/* Sidebar Navigation */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                        </div>
                        <h1 className="text-xl font-bold font-display tracking-wide">Eloquente Admin</h1>
                    </div>

                    <nav className="space-y-2 flex-grow">
                        {[
                            { id: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Dashboard' },
                            { id: 'analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'Analytics' },
                            { id: 'configuration', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM12 15a3 3 0 100-6 3 3 0 000 6z', label: 'Configuration' },
                            { id: 'settings', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4', label: 'Settings' },
                            { id: 'reports', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Reports' },
                            { id: 'users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', label: 'Users' },
                            { id: 'bookings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Bookings' },
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                                </svg>
                                <span className="font-medium text-sm">{item.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6 mt-auto border-t border-slate-800">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold">
                            {user?.username?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user?.username}</p>
                            <p className="text-xs text-slate-400 truncate">Top Admin</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 relative">
                <header className="bg-white shadow-sm border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-20">
                    <h2 className="text-2xl font-bold text-gray-800 capitalize">{activeTab === 'dashboard' ? 'Overview Dashboard' : activeTab}</h2>
                </header>

                <div className="p-8">
                    {activeTab === 'dashboard' && (
                        <div className="animate-fadeIn">

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="bg-white overflow-hidden shadow rounded-xl border border-gray-100">
                                    <div className="px-5 py-6">
                                        <dt className="text-sm font-medium text-gray-500 truncate flex items-center gap-2">
                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Total Revenue
                                        </dt>
                                        <dd className="mt-2 text-3xl font-extrabold text-gray-900">₱450k</dd>
                                    </div>
                                </div>
                                <div className="bg-white overflow-hidden shadow rounded-xl border border-gray-100">
                                    <div className="px-5 py-6">
                                        <dt className="text-sm font-medium text-gray-500 truncate flex items-center gap-2">
                                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                            Active Inquiries
                                        </dt>
                                        <dd className="mt-2 text-3xl font-extrabold text-gray-900">8</dd>
                                    </div>
                                </div>
                                <div className="bg-white overflow-hidden shadow rounded-xl border border-gray-100">
                                    <div className="px-5 py-6">
                                        <dt className="text-sm font-medium text-gray-500 truncate flex items-center gap-2">
                                            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            Confirmed Bookings
                                        </dt>
                                        <dd className="mt-2 text-3xl font-extrabold text-gray-900">12</dd>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Revenue Trends */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                        Revenue Trends (Last 6 Months)
                                    </h3>
                                    <div className="h-64 flex items-end justify-between gap-2 overflow-hidden">
                                        {[35, 45, 30, 65, 85, 55].map((val, i) => (
                                            <div key={i} className="w-full h-full flex flex-col items-center justify-end gap-2 group">
                                                <div className="w-full bg-indigo-100 rounded-t-md relative flex items-end justify-center group-hover:bg-indigo-200 transition-colors" style={{ height: `${val}%` }}>
                                                    <div className="absolute -top-8 bg-gray-900 text-white text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                        ₱{val}0k
                                                    </div>
                                                    <div className="w-full bg-indigo-500 rounded-t-md opacity-70" style={{ height: `${val > 50 ? val - 20 : val}%` }}></div>
                                                </div>
                                                <span className="text-xs font-medium text-gray-500">Month {i + 1}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Market Intelligence: Top Sellers */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                        Market Intelligence (Top Sellers)
                                    </h3>
                                    <div className="space-y-6">
                                        {[
                                            { name: 'Grand Wedding Package', count: 12, percent: 85, color: 'bg-green-500' },
                                            { name: 'Corporate Gala Standard', count: 8, percent: 60, color: 'bg-blue-500' },
                                            { name: 'Roasted Beef Carving (Add-on)', count: 15, percent: 95, color: 'bg-orange-500' },
                                            { name: 'Truffle Mushroom Pasta (Add-on)', count: 10, percent: 70, color: 'bg-purple-500' }
                                        ].map((item, i) => (
                                            <div key={i}>
                                                <div className="flex justify-between text-sm mb-2">
                                                    <span className="font-bold text-gray-700">{item.name}</span>
                                                    <span className="text-gray-500 font-bold">{item.count} Bookings</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                                    <div className={`${item.color} h-3 rounded-full`} style={{ width: `${item.percent}%` }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Peak Season Heatmap Placeholder */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
                                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        Peak Season Heatmap (Demand Intensity)
                                    </h3>
                                    <div className="grid grid-cols-6 md:grid-cols-12 gap-3 text-center text-xs">
                                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => {
                                            // Mock heatmap logic
                                            const intensityMap = [2, 3, 5, 4, 8, 9, 6, 7, 5, 8, 10, 10];
                                            const val = intensityMap[i];
                                            const bgColor = val <= 3 ? 'bg-green-100 text-green-800' : val <= 6 ? 'bg-yellow-200 text-yellow-800' : val <= 8 ? 'bg-orange-300 text-orange-900' : 'bg-red-500 text-white font-bold shadow-sm';

                                            return (
                                                <div key={i} className={`flex flex-col items-center justify-center p-4 rounded-xl ${bgColor} transition-transform hover:scale-105 cursor-default`}>
                                                    <span className="font-bold text-sm mb-1">{month}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-6 flex items-center justify-end gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 rounded"></div> Low</span>
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-200 rounded"></div> Med</span>
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-300 rounded"></div> High</span>
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded"></div> Peak</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                    {activeTab === 'analytics' && (
                        <div className="animate-fadeIn space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900">Business Intelligence & Analytics</h2>
                                <button className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors">
                                    Download Full Report
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Revenue Forecast */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                                        Revenue Forecast (H2 2026)
                                    </h3>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={revenueForecastData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `₱${value / 1000}k`} dx={-10} />
                                                <RechartsTooltip formatter={(value) => `₱${value.toLocaleString()}`} cursor={{ fill: '#F3F4F6' }} />
                                                <Line type="monotone" dataKey="actual" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} name="Actual Revenue" />
                                                <Line type="monotone" dataKey="forecast" stroke="#9CA3AF" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Projected Revenue" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Projected Pax Demand - Area Chart */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        Projected Pax Demand (Upcoming Events)
                                    </h3>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={projectedPaxDemand}>
                                                <defs>
                                                    <linearGradient id="colorPax" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dx={-10} />
                                                <RechartsTooltip cursor={{ fill: '#F3F4F6' }} />
                                                <Area type="monotone" dataKey="pax" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorPax)" name="Total Guests" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Interactive Sales Frequency Distribution */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        Sales Frequency Distribution (Best Sellers)
                                    </h3>
                                    <select
                                        value={activeAnalyticsCategory}
                                        onChange={(e) => setActiveAnalyticsCategory(e.target.value)}
                                        className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 transition-colors font-medium outline-none"
                                    >
                                        <option value="All">All Categories</option>
                                        <option value="starters">Starters</option>
                                        <option value="mains">Mains</option>
                                        <option value="desserts">Desserts</option>
                                    </select>
                                </div>
                                <div className="h-72 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={salesFrequencyData[activeAnalyticsCategory] || []} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} dx={-10} width={120} />
                                            <RechartsTooltip cursor={{ fill: '#F3F4F6' }} />
                                            <Bar dataKey="sales" fill="#10B981" radius={[0, 4, 4, 0]} barSize={24} name="Total Orders" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Peak Season Heatmap Simulation */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    Peak Season Demand Heatmap (Intensity)
                                </h3>
                                <div className="grid grid-cols-6 md:grid-cols-12 gap-3 text-center text-xs">
                                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => {
                                        const val = [2, 3, 5, 4, 8, 9, 6, 7, 5, 8, 10, 10][i];
                                        const bgColor = val <= 3 ? 'bg-green-100 text-green-800' : val <= 6 ? 'bg-yellow-200 text-yellow-800' : val <= 8 ? 'bg-orange-300 text-orange-900' : 'bg-red-500 text-white font-bold shadow-sm';

                                        return (
                                            <div key={i} className={`flex flex-col items-center justify-center p-4 rounded-xl ${bgColor} transition-transform hover:scale-105 cursor-default`}>
                                                <span className="font-bold text-sm mb-1">{month}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-6 flex items-center justify-end gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    <span className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 rounded"></div> Low</span>
                                    <span className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-200 rounded"></div> Med</span>
                                    <span className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-300 rounded"></div> High</span>
                                    <span className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded"></div> Peak</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'configuration' && (
                        <div className="animate-fadeIn">
                            <div className="flex justify-end mb-6">
                                <button
                                    onClick={openMenuItemModal}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Add New Menu Option
                                </button>
                            </div>
                            <div className="animate-fadeIn">
                                <div className="mb-6">
                                    <h2 className="text-xl font-bold text-gray-900">Global Pricing Configuration</h2>
                                    <p className="text-sm text-gray-500 mt-1">Set permanent price overrides for packages and menu items. This overrides the default catalog prices.</p>
                                </div>

                                {pricingLoading ? (
                                    <div className="p-8 text-center text-gray-500">Loading pricing configuration...</div>
                                ) : (
                                    <div className="space-y-8">
                                        {/* Menu Pricing (Custom Pricing) */}
                                        <div className="bg-white shadow overflow-hidden rounded-xl border border-gray-100">
                                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Menu Items (Premium Add-ons)</h3>
                                            </div>
                                            <div className="border-b border-gray-100 px-6 pt-2">
                                                <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                                                    {MENU_CATEGORIES.map(category => (
                                                        <button
                                                            key={category}
                                                            onClick={() => setActiveMenuCategory(category)}
                                                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm capitalize transition-colors ${activeMenuCategory === category ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                                        >
                                                            {category}
                                                        </button>
                                                    ))}
                                                </nav>
                                            </div>
                                            <div className="p-6 bg-gray-50">
                                                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm animate-fadeIn">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                            {getMergedDishes(activeMenuCategory).map(item => {
                                                                const overrideId = `dish_${item.id}`;
                                                                const currentPrice = pricingOverrides[overrideId] !== undefined ? pricingOverrides[overrideId] : item.costPerHead;

                                                                return (
                                                                    <div key={item.id} className="overflow-hidden border border-gray-200 rounded-2xl bg-white flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-md relative group">
                                                                        {/* Delete button for custom items */}
                                                                        {item._isCustom && (
                                                                            <button
                                                                                onClick={() => handleDeleteMenuItem(item._dbId)}
                                                                                className="absolute top-3 left-3 z-20 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                                                title="Delete this menu item"
                                                                            >
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                            </button>
                                                                        )}
                                                                        <div className="h-48 w-full relative">
                                                                            <img src={item.image} alt={item.name} className="object-cover w-full h-full" />
                                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                                                            {item._isCustom && (
                                                                                <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded shadow-lg uppercase tracking-wider border border-emerald-400">
                                                                                    Custom Item
                                                                                </div>
                                                                            )}
                                                                            {!item._isCustom && pricingOverrides[overrideId] !== undefined && (
                                                                                <div className="absolute top-3 right-3 bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded shadow-lg uppercase tracking-wider border border-indigo-400">
                                                                                    Custom Price
                                                                                </div>
                                                                            )}
                                                                            <h5 className="absolute bottom-3 left-4 right-4 font-bold text-white text-lg leading-tight text-shadow-sm">{item.name}</h5>
                                                                        </div>
                                                                        <div className="p-5 flex flex-col flex-grow bg-white">
                                                                            <p className="text-sm text-gray-500 mb-4 flex-grow line-clamp-2">{item.description}</p>
                                                                            
                                                                            <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
                                                                                <div className="flex-1 flex items-center bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 focus-within:bg-white transition-all shadow-inner">
                                                                                    <span className="text-gray-400 font-bold text-base mr-1">+₱</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        id={`price_input_${item.id}`}
                                                                                        defaultValue={currentPrice}
                                                                                        className="w-full text-base font-bold text-gray-900 bg-transparent outline-none"
                                                                                    />
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const el = document.getElementById(`price_input_${item.id}`);
                                                                                        handlePricingUpdate('dish', item.id, el.value);
                                                                                    }}
                                                                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shadow-md hover:shadow-lg active:transform active:scale-95"
                                                                                >
                                                                                    Save
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {getMergedDishes(activeMenuCategory).length === 0 && (
                                                                <div className="text-sm text-gray-400 italic">No items in this category.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'settings' && (
                        <div className="animate-fadeIn">
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-800 mb-6">User Preferences</h3>
                                <div className="space-y-6 max-w-lg">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-gray-800">Email Notifications</h4>
                                            <p className="text-sm text-gray-500">Receive alerts for new bookings and cancellations</p>
                                        </div>
                                        <div className="w-12 h-6 bg-indigo-600 rounded-full relative cursor-pointer">
                                            <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-gray-800">Compact View</h4>
                                            <p className="text-sm text-gray-500">Reduce spacing in tables and lists</p>
                                        </div>
                                        <div className="w-12 h-6 bg-gray-200 rounded-full relative cursor-pointer">
                                            <div className="w-4 h-4 bg-white rounded-full absolute left-1 top-1 shadow-sm"></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-gray-800">Dark Mode</h4>
                                            <p className="text-sm text-gray-500">Toggle dark aesthetic for the dashboard layout</p>
                                        </div>
                                        <div className="w-12 h-6 bg-gray-200 rounded-full relative cursor-pointer transition-colors hover:bg-gray-300">
                                            <div className="w-4 h-4 bg-white rounded-full absolute left-1 top-1 shadow-sm transition-transform"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                    }
                    {
                        activeTab === 'reports' && (
                            <div className="animate-fadeIn">
                                <div className="bg-[#1A1B36] rounded-2xl p-8 border border-[#2b2d4f] shadow-2xl text-white relative overflow-hidden">
                                    {/* Subtle background glow */}
                                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl rounded-none pointer-events-none mix-blend-screen"></div>

                                    <div className="flex justify-between items-center mb-8 relative z-10">
                                        <h2 className="text-2xl font-bold tracking-wide">Reports Center</h2>
                                        <button className="bg-indigo-400/20 hover:bg-indigo-400/30 text-indigo-300 border border-indigo-400/30 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-all backdrop-blur-md">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            Generate Snapshot
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 relative z-10">
                                        <div className="bg-[#24254A] border border-[#2b2d4f] rounded-xl p-5 shadow-inner">
                                            <p className="text-xs text-indigo-200 font-semibold mb-2">Masterfiles</p>
                                            <p className="text-3xl font-bold">10</p>
                                        </div>
                                        <div className="bg-[#24254A] border border-[#2b2d4f] rounded-xl p-5 shadow-inner">
                                            <p className="text-xs text-indigo-200 font-semibold mb-2">Users</p>
                                            <p className="text-3xl font-bold">6</p>
                                        </div>
                                        <div className="bg-[#24254A] border border-[#2b2d4f] rounded-xl p-5 shadow-inner">
                                            <p className="text-xs text-indigo-200 font-semibold mb-2">Active Projects</p>
                                            <p className="text-3xl font-bold">6</p>
                                        </div>
                                        <div className="bg-[#24254A] border border-[#2b2d4f] rounded-xl p-5 shadow-inner">
                                            <p className="text-xs text-indigo-200 font-semibold mb-2">Generated Reports</p>
                                            <p className="text-3xl font-bold">0</p>
                                        </div>
                                    </div>

                                    <div className="relative z-10 border-t border-[#2b2d4f] pt-6 flex flex-col items-start">
                                        <div className="flex gap-3 mb-10">
                                            <button className="bg-[#24254A] hover:bg-[#2a2b53] border border-[#2b2d4f] text-indigo-200 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                Export Masterfiles CSV
                                            </button>
                                            <button className="bg-[#24254A] hover:bg-[#2a2b53] border border-[#2b2d4f] text-indigo-200 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                Export Users CSV
                                            </button>
                                        </div>

                                        <div className="w-full text-center text-indigo-300 text-sm font-medium opacity-70 mb-12">
                                            No reports yet. Click Generate Snapshot.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                    {
                        activeTab === 'users' && (
                            <div className="animate-fadeIn">
                                <div className="animate-fadeIn">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">Personnel Roster</h2>
                                            <p className="text-sm text-gray-500 mt-1">Manage Marketing and Accounting staff accounts and sub-role accesses.</p>
                                        </div>
                                        <button onClick={() => openEmpModal('add')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            Add Employee
                                        </button>
                                    </div>

                                    <div className="bg-white shadow overflow-hidden sm:rounded-xl border border-gray-100">
                                        {empLoading ? (
                                            <div className="p-8 text-center text-gray-500">Loading accounts...</div>
                                        ) : employees.length === 0 ? (
                                            <div className="p-12 text-center text-gray-500">No employee accounts found.</div>
                                        ) : (
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Last Active</th>
                                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-100">
                                                    {employees.map(emp => (
                                                        <tr key={emp.id} className="hover:bg-gray-50/80 transition-colors">
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center">
                                                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center text-indigo-700 font-bold">
                                                                        {emp.username.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="ml-4">
                                                                        <div className="text-sm font-bold text-gray-900">{emp.username}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="text-sm text-gray-700">{emp.email || <span className="text-gray-400 italic">No email</span>}</div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${emp.role === 'Marketing' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
                                                                    {emp.role}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                                    Active
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="text-sm text-gray-500">Just now</div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                <button onClick={() => openEmpModal('edit', emp)} className="text-indigo-600 hover:text-indigo-900 mr-4 font-semibold">Edit</button>
                                                                <button onClick={() => handleDeleteEmployee(emp.id)} className="text-red-500 hover:text-red-700 font-semibold">Delete</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    }
                    {
                        activeTab === 'bookings' && (
                            <div className="animate-fadeIn">
                                <div className="mb-6">
                                    <h2 className="text-xl font-bold text-gray-900">Custom On-The-Fly Discounts</h2>
                                    <p className="text-sm text-gray-500 mt-1">Apply exclusive percentage or fixed-amount discounts to specific client bookings.</p>
                                </div>

                                <div className="bg-white shadow overflow-hidden sm:rounded-xl border border-gray-100">
                                    {bookingsLoading ? (
                                        <div className="p-8 text-center text-gray-500">Loading bookings...</div>
                                    ) : bookings.length === 0 ? (
                                        <div className="p-12 text-center text-gray-500">No active bookings found.</div>
                                    ) : (
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Booking Ref.</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Client & Pax</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Total Cost</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Additional Fees</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-100">
                                                {bookings.filter(b => b.status === 'Pending' || b.status === 'Confirmed').map(booking => (
                                                    <tr key={booking.id} className="hover:bg-gray-50/80 transition-colors cursor-pointer" onClick={() => setEventDetailsModal({ open: true, data: booking })}>
                                                        <td className="px-6 py-4">
                                                            <div className="text-sm font-bold text-gray-900">#BK-{booking.id.toString().padStart(4, '0')}</div>
                                                            <div className="text-xs text-gray-500">{booking.event_date}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-sm font-bold text-gray-900">{booking.client_full_name || booking.client_name || booking.username}</div>
                                                            <div className="text-xs text-gray-500">{booking.pax} Pax</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-sm font-bold text-gray-900">₱{booking.total_cost?.toLocaleString()}</div>
                                                            {(booking.discount_value > 0 || booking.discount_type) && (
                                                                <div className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full inline-block mt-1">
                                                                    Discounted
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${booking.status === 'Confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                                }`}>
                                                                {booking.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-sm text-gray-900">
                                                                {booking.transport_fee > 0 || booking.labor_surcharge > 0 ? (
                                                                    <>
                                                                        {booking.transport_fee > 0 && <span className="block text-xs text-gray-500">Out-of-town: ₱{booking.transport_fee.toLocaleString()}</span>}
                                                                        {booking.labor_surcharge > 0 && <span className="block text-xs text-gray-500">High-rise: ₱{booking.labor_surcharge.toLocaleString()}</span>}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-xs text-gray-400">None</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDiscountForm({ discount_type: booking.discount_type || 'fixed', discount_value: booking.discount_value || 0 });
                                                                    setDiscountModal({ open: true, data: booking });
                                                                }}
                                                                className="text-indigo-600 hover:text-indigo-900 font-bold text-sm bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors inline-block"
                                                            >
                                                                Apply Discount
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )
                    }
                </div >
            </main >

            {/* Employee Add/Edit Modal */}
            {
                empModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEmpModal({ open: false, mode: 'add', data: null })}></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="text-lg font-bold text-gray-900">{empModal.mode === 'add' ? 'Provision New Account' : 'Modify Credentials'}</h3>
                            </div>
                            <form onSubmit={handleEmpSubmit} className="p-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Username</label>
                                        <input type="text" required value={empForm.username} onChange={e => setEmpForm({ ...empForm, username: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Email (Optional)</label>
                                            <input type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Phone (Optional)</label>
                                            <input type="text" value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Password</label>
                                        <input type="text" required={empModal.mode === 'add'} minLength="6" value={empForm.password} onChange={e => setEmpForm({ ...empForm, password: e.target.value })} placeholder={empModal.mode === 'edit' ? "Leave blank to keep current" : ""} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Privilege Level</label>
                                        <select value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium">
                                            <option value="Marketing">Marketing / Ops</option>
                                            <option value="Accounting">Accounting / Finance</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-8 flex justify-end gap-3">
                                    <button type="button" onClick={() => setEmpModal({ open: false, mode: 'add', data: null })} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                                    <button type="submit" disabled={empFormLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50">
                                        {empFormLoading ? 'Configuring...' : empModal.mode === 'add' ? 'Create Account' : 'Update Credentials'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Discount Modal */}
            {
                discountModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setDiscountModal({ open: false, data: null })}></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="text-lg font-bold text-gray-900">Apply Booking Discount</h3>
                                <p className="text-xs text-gray-500 mt-1">{discountModal.data?.client_full_name || discountModal.data?.client_name || discountModal.data?.username}'s Event (#BK-{discountModal.data?.id.toString().padStart(4, '0')})</p>
                            </div>
                            <form onSubmit={handleDiscountSubmit} className="p-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Discount Type</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className={`border rounded-lg p-3 flex cursor-pointer transition-colors ${discountForm.discount_type === 'fixed' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                                <input type="radio" name="discount_type" value="fixed" checked={discountForm.discount_type === 'fixed'} onChange={() => setDiscountForm({ ...discountForm, discount_type: 'fixed' })} className="hidden" />
                                                <div className="font-bold text-sm text-center w-full">Fixed Amount (₱)</div>
                                            </label>
                                            <label className={`border rounded-lg p-3 flex cursor-pointer transition-colors ${discountForm.discount_type === 'percentage' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                                <input type="radio" name="discount_type" value="percentage" checked={discountForm.discount_type === 'percentage'} onChange={() => setDiscountForm({ ...discountForm, discount_type: 'percentage' })} className="hidden" />
                                                <div className="font-bold text-sm text-center w-full">Percentage (%)</div>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Discount Value</label>
                                        <div className="relative">
                                            {discountForm.discount_type === 'fixed' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₱</span>}
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                value={discountForm.discount_value}
                                                onChange={e => setDiscountForm({ ...discountForm, discount_value: parseFloat(e.target.value) || 0 })}
                                                className={`w-full ${discountForm.discount_type === 'fixed' ? 'pl-8' : 'px-4'} py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-lg font-bold`}
                                            />
                                            {discountForm.discount_type === 'percentage' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 flex justify-end gap-3">
                                    <button type="button" onClick={() => setDiscountModal({ open: false, data: null })} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                                    <button type="submit" disabled={discountLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50">
                                        {discountLoading ? 'Applying...' : 'Apply Discount'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Event Details Modal */}
            {
                eventDetailsModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEventDetailsModal({ open: false, data: null })}></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-fadeIn overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Event Intelligence Dashboard</h3>
                                    <p className="text-xs text-gray-500 mt-1">Reference: #BK-{eventDetailsModal.data?.id.toString().padStart(4, '0')}</p>
                                </div>
                                <button onClick={() => setEventDetailsModal({ open: false, data: null })} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8 bg-white">
                                {/* Core Client Logic */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                                        <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            Client Logic
                                        </h4>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Primary Entity</p>
                                                <p className="text-sm font-semibold text-gray-900">{eventDetailsModal.data?.client_full_name || eventDetailsModal.data?.username || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Comm Link (Email)</p>
                                                <p className="text-sm text-gray-700">{eventDetailsModal.data?.client_email || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Comm Link (Phone)</p>
                                                <p className="text-sm text-gray-700">{eventDetailsModal.data?.client_phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Temporal Constraints */}
                                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            Temporal Constraints
                                        </h4>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Execution Date</p>
                                                <p className="text-sm font-semibold text-gray-900">{eventDetailsModal.data?.event_date}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Start Time</p>
                                                    <p className="text-sm text-gray-700">{eventDetailsModal.data?.event_time || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Status Payload</p>
                                                <span className={`inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${eventDetailsModal.data?.status === 'Confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {eventDetailsModal.data?.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Financial Matrix */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Financial Matrix</h4>
                                    <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Headcount (Pax)</p>
                                            <p className="text-lg font-bold text-gray-900">{eventDetailsModal.data?.pax}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Base Contract (₱)</p>
                                            <p className="text-lg font-bold text-gray-900">{eventDetailsModal.data?.total_cost?.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Logistics Toll (₱)</p>
                                            <p className="text-lg font-bold text-orange-600">{eventDetailsModal.data?.transport_fee?.toLocaleString() || '0'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Labor Index (₱)</p>
                                            <p className="text-lg font-bold text-orange-600">{eventDetailsModal.data?.labor_surcharge?.toLocaleString() || '0'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                                <button onClick={() => setEventDetailsModal({ open: false, data: null })} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
                                    Acknowledge
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add New Menu Item Modal */}
            {menuItemModal.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fadeIn">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Add New Menu Item
                            </h3>
                            <button onClick={() => setMenuItemModal({ open: false, mode: 'add', data: null })} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleMenuItemSubmit} className="p-6 space-y-5">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Dish Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={menuItemForm.name}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, name: e.target.value })}
                                    placeholder="e.g. Garlic Butter Shrimp"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all text-sm"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
                                <select
                                    value={menuItemForm.category}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, category: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all text-sm bg-white capitalize"
                                >
                                    <option value="starter">Starter</option>
                                    <option value="main">Main</option>
                                    <option value="side">Side</option>
                                    <option value="dessert">Dessert</option>
                                    <option value="drink">Drink</option>
                                </select>
                            </div>

                            {/* Cost & Price Adj */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Cost Per Head (₱) <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={menuItemForm.cost_per_head}
                                        onChange={e => setMenuItemForm({ ...menuItemForm, cost_per_head: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Price Adjustment (₱)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={menuItemForm.price_adj}
                                        onChange={e => setMenuItemForm({ ...menuItemForm, price_adj: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all text-sm"
                                    />
                                </div>
                            </div>

                            {/* Image URL */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Image URL</label>
                                <input
                                    type="url"
                                    value={menuItemForm.image}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, image: e.target.value })}
                                    placeholder="https://images.unsplash.com/..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all text-sm"
                                />
                                <p className="text-xs text-gray-400 mt-1">Leave blank for a default placeholder image.</p>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
                                <textarea
                                    rows="3"
                                    value={menuItemForm.description}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, description: e.target.value })}
                                    placeholder="A brief description of the dish..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all text-sm resize-none"
                                />
                            </div>

                            {/* Best Seller Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={menuItemForm.is_best_seller}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, is_best_seller: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Mark as Best Seller</span>
                            </label>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setMenuItemModal({ open: false, mode: 'add', data: null })}
                                    className="px-6 py-2.5 text-sm font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={menuItemFormLoading}
                                    className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50"
                                >
                                    {menuItemFormLoading ? 'Adding...' : 'Add Menu Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast */}
            {
                toast && (
                    <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
                        <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white font-medium text-sm ${toast.type === 'success' ? 'bg-gray-900 border border-gray-700' : 'bg-red-600'}`}>
                            {toast.type === 'success' ? (
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            )}
                            <span>{toast.message}</span>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default DashboardAdmin;
