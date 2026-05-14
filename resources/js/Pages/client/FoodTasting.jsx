import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { useAuth } from '../../context/AuthContext';

const FoodTasting = () => {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        guest_name: user ? user.username : '',
        guest_email: '',
        guest_phone: '',
        preferred_date: '',
        preferred_time: '',
        notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            // Session auth - no token needed
            const headers = {
                'Content-Type': 'application/json',
            };

            const response = await fetch('/api/food-tasting', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ type: 'success', text: 'Food tasting scheduled successfully!' });
                if (user) {
                    setTimeout(() => router.get('/dashboard/client'), 2000);
                } else {
                    setFormData({
                        guest_name: '',
                        guest_email: '',
                        guest_phone: '',
                        preferred_date: '',
                        preferred_time: '',
                        notes: ''
                    });
                }
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to schedule tasting.' });
            }
        } catch (error) {
            console.error("Error scheduling tasting:", error);
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-md border border-gray-100">
                <h2 className="text-3xl font-extrabold text-gray-900 font-display text-center mb-8">
                    Schedule a Food Tasting
                </h2>

                {message && (
                    <div className={`p-4 mb-6 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {!user && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input
                                    type="text"
                                    name="guest_name"
                                    required
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                                    value={formData.guest_name}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input
                                    type="email"
                                    name="guest_email"
                                    required
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                                    value={formData.guest_email}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Phone</label>
                                <input
                                    type="tel"
                                    name="guest_phone"
                                    required
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                                    value={formData.guest_phone}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Preferred Date</label>
                            <input
                                type="date"
                                name="preferred_date"
                                required
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                                value={formData.preferred_date}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Preferred Time</label>
                            <input
                                type="time"
                                name="preferred_time"
                                required
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                                value={formData.preferred_time}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Notes / Dietary Requirements</label>
                        <textarea
                            name="notes"
                            rows="4"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                            value={formData.notes}
                            onChange={handleChange}
                        ></textarea>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Scheduling...' : 'Schedule Tasting'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FoodTasting;
