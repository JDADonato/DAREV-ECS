import React, { useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import DefaultLayout from '../../Layouts/DefaultLayout';
import UserDropdown from '../../Components/common/UserDropdown';
import logoImg from '../../../images/ECS_LOGO.png';

const Edit = () => {
    const { auth } = usePage().props;
    const user = auth?.user || {};

    const { data, setData, put, processing, errors } = useForm({
        username: user.username || '',
        email: user.email || '',
        phone: user.phone || '',
        current_password: '',
        new_password: '',
    });

    const submit = (e) => {
        e.preventDefault();
        put('/profile', {
            preserveScroll: true,
            onSuccess: () => {
                setData('current_password', '');
                setData('new_password', '');
            },
        });
    };

    const getDashLink = () => {
        if (!user) return '/';
        return user.role === 'Client' ? '/dashboard/client' : 
               user.role === 'Marketing' ? '/dashboard/ops' : 
               user.role === 'Accounting' ? '/dashboard/finance' : '/dashboard/admin';
    };

    return (
        <DefaultLayout>
            <Head title="My Profile - Eloquente Catering" />
            
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Navbar */}
                <nav className="bg-brand-red shadow-lg py-4 relative z-50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <a href="/">
                            <img src={logoImg} alt="Eloquente Catering" className="h-12 w-auto object-contain" />
                        </a>
                        <div className="flex items-center space-x-4">
                            {user && <UserDropdown user={user} dashLink={getDashLink()} />}
                        </div>
                    </div>
                </nav>

                <div className="flex-1 py-12 px-4 sm:px-6 lg:px-8 flex justify-center">
                    <div className="max-w-2xl w-full">
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 p-8">
                            <h2 className="text-3xl font-display font-bold text-gray-900 mb-6 border-b pb-4">My Profile</h2>
                            
                            <form onSubmit={submit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={data.username}
                                        onChange={e => setData('username', e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-900 focus:border-transparent transition-shadow outline-none"
                                        required
                                    />
                                    {errors.username && <p className="text-sm text-red-600 mt-1">{errors.username}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        value={data.email}
                                        onChange={e => setData('email', e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-900 focus:border-transparent transition-shadow outline-none"
                                        required
                                    />
                                    {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
                                    <p className="text-xs text-gray-500 mt-1">If you change your email, you will need to verify it again.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
                                    <input
                                        type="text"
                                        value={data.phone}
                                        onChange={e => setData('phone', e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-900 focus:border-transparent transition-shadow outline-none"
                                    />
                                    {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone}</p>}
                                </div>

                                <div className="border-t pt-6 mt-6">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Change Password</h3>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                            <input
                                                type="password"
                                                value={data.current_password}
                                                onChange={e => setData('current_password', e.target.value)}
                                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-900 focus:border-transparent transition-shadow outline-none"
                                                placeholder="Leave blank to keep current password"
                                            />
                                            {errors.current_password && <p className="text-sm text-red-600 mt-1">{errors.current_password}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                            <input
                                                type="password"
                                                value={data.new_password}
                                                onChange={e => setData('new_password', e.target.value)}
                                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-900 focus:border-transparent transition-shadow outline-none"
                                                placeholder="Leave blank to keep current password"
                                            />
                                            {errors.new_password && <p className="text-sm text-red-600 mt-1">{errors.new_password}</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="bg-red-900 hover:bg-red-800 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {processing ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </DefaultLayout>
    );
};

export default Edit;
