import React, { useState, useEffect, useRef } from 'react';
import { usePage } from '@inertiajs/react';
import useSmartRefresh from '../../hooks/useSmartRefresh';

/**
 * NotificationBell — displays a bell icon with an unread badge.
 * Refreshes unread count only while the page is visible and active.
 * Clicking opens a dropdown panel with recent notifications.
 *
 * Props:
 *   - variant: 'light' (for dark backgrounds like navbar) or 'dark' (for light backgrounds)
 */
const NotificationBell = ({ variant = 'light' }) => {
    const { auth } = usePage().props;
    const notificationPreferences = auth?.user?.notification_preferences || {};
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);
    const previousUnreadRef = useRef(0);
    const soundReadyRef = useRef(false);
    const lastSoundAtRef = useRef(0);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        const unlockSound = () => {
            soundReadyRef.current = true;
            window.removeEventListener('pointerdown', unlockSound);
            window.removeEventListener('keydown', unlockSound);
        };
        window.addEventListener('pointerdown', unlockSound, { once: true });
        window.addEventListener('keydown', unlockSound, { once: true });

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('pointerdown', unlockSound);
            window.removeEventListener('keydown', unlockSound);
        };
    }, []);

    const playNotificationSound = () => {
        const soundEnabled = !notificationPreferences.quiet_mode && (
            notificationPreferences.sound_enabled ||
            notificationPreferences.notification_sounds ||
            notificationPreferences.message_sounds ||
            notificationPreferences.booking_update_sounds ||
            notificationPreferences.payment_update_sounds ||
            notificationPreferences.staff_update_sounds
        );
        if (!soundEnabled || !soundReadyRef.current) return;
        if (Date.now() - lastSoundAtRef.current < 8000) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const gain = ctx.createGain();
            gain.gain.value = 0.035;
            gain.connect(ctx.destination);

            [440, 660].forEach((frequency, index) => {
                const oscillator = ctx.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.value = frequency;
                oscillator.connect(gain);
                oscillator.start(ctx.currentTime + index * 0.08);
                oscillator.stop(ctx.currentTime + index * 0.08 + 0.12);
            });

            lastSoundAtRef.current = Date.now();
            window.setTimeout(() => ctx.close(), 500);
        } catch (e) {
            // Browser audio can fail if the user has not interacted yet.
        }
    };

    const fetchUnreadCount = async () => {
        try {
            const res = await fetch('/api/notifications/unread-count');
            if (res.ok) {
                const data = await res.json();
                const nextCount = data.count || 0;
                if (previousUnreadRef.current > 0 && nextCount > previousUnreadRef.current) {
                    playNotificationSound();
                }
                previousUnreadRef.current = nextCount;
                setUnreadCount(data.count);
            }
        } catch (e) {
            // silently fail
        }
    };

    useEffect(() => {
        fetchUnreadCount();
    }, []);

    useSmartRefresh({
        enabled: true,
        interval: 30000,
        idleAfter: 180000,
        refresh: fetchUnreadCount,
    });

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (e) {
            console.error('Failed to fetch notifications');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = () => {
        if (!isOpen) {
            fetchNotifications();
        }
        setIsOpen(!isOpen);
    };

    const markAsRead = async (id) => {
        try {
            await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (e) {
            console.error('Failed to mark as read');
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch('/api/notifications/read-all', { method: 'PUT' });
            setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
            setUnreadCount(0);
        } catch (e) {
            console.error('Failed to mark all as read');
        }
    };

    const removeNotification = async (id) => {
        const target = notifications.find(notification => notification.id === id);

        try {
            const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
            if (!res.ok) return;

            setNotifications(prev => prev.filter(notification => notification.id !== id));
            if (target && !target.read_at) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (e) {
            console.error('Failed to remove notification');
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'booking_confirmed':
                return (
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                );
            case 'booking_cancelled':
                return (
                    <div className="w-9 h-9 rounded-xl bg-red-50 ring-1 ring-red-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                );
            case 'payment_approved':
                return (
                    <div className="w-9 h-9 rounded-xl bg-[#fff7e8] ring-1 ring-[#f0aa0b]/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#9f6500]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" /></svg>
                    </div>
                );
            case 'new_booking':
                return (
                    <div className="w-9 h-9 rounded-xl bg-[#720101]/5 ring-1 ring-[#720101]/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#720101]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                );
            default:
                return (
                    <div className="w-9 h-9 rounded-xl bg-slate-50 ring-1 ring-slate-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                );
        }
    };

    const isLight = variant === 'light';

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell button */}
            <button
                onClick={handleToggle}
                className={`relative rounded-full p-2 transition-colors ${isLight ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-[#720101]/5 hover:text-[#720101]'}`}
                id="notification-bell"
                aria-label="Open notifications"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#f0aa0b] px-1 text-[10px] font-black text-[#1a1a1a] shadow-sm ring-2 ring-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#720101]/10 bg-white shadow-2xl shadow-slate-950/15 ring-1 ring-black/5 z-50" style={{ animation: 'fadeIn .2s ease' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-4 border-b border-[#720101]/10 bg-[#fffaf3] px-4 py-3.5">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#9f6500]">Updates</p>
                            <h3 className="mt-0.5 text-sm font-black text-slate-950">Notifications</h3>
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="rounded-full border border-[#720101]/10 bg-white px-3 py-1.5 text-xs font-black text-[#720101] transition-colors hover:bg-[#720101] hover:text-white"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification list */}
                    <div className="custom-scrollbar max-h-80 overflow-y-auto bg-white p-2">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-[#720101] border-t-transparent"></div>
                                <p className="text-xs font-bold text-slate-400">Loading updates...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff7e8] text-[#9f6500]">
                                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                </div>
                                <p className="text-sm font-black text-slate-700">No notifications yet</p>
                                <p className="mt-1 text-xs font-semibold text-slate-400">New updates will appear here.</p>
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    onClick={() => !notification.read_at && markAsRead(notification.id)}
                                    className={`mb-1 flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 transition-colors ${!notification.read_at ? 'bg-[#fff7e8] hover:bg-[#fff1d3]' : 'hover:bg-slate-50'}`}
                                >
                                    {getIcon(notification.type)}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm leading-5 ${!notification.read_at ? 'font-bold text-slate-950' : 'font-semibold text-slate-600'}`}>
                                            {notification.message}
                                        </p>
                                        <p className="mt-1 text-[11px] font-bold text-slate-400">{notification.time_ago}</p>
                                    </div>
                                    {notification.read_at ? (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                removeNotification(notification.id);
                                            }}
                                            className="mt-0.5 rounded-full p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
                                            aria-label="Remove notification"
                                            title="Remove notification"
                                        >
                                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    ) : (
                                        <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-[#720101]"></div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
