import React, { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { useToast } from '../../context/ToastContext';

const typeConfig = {
    success: {
        title: 'Done',
        accent: 'bg-emerald-500',
        iconWrap: 'bg-emerald-50 ring-emerald-100',
        icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
        iconClass: 'text-emerald-600',
    },
    error: {
        title: 'Needs Attention',
        accent: 'bg-red-500',
        iconWrap: 'bg-red-50 ring-red-100',
        icon: 'M12 9v3.75m0 3.75h.008v.008H12V16.5Zm9-4.5a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
        iconClass: 'text-red-600',
    },
    warning: {
        title: 'Notice',
        accent: 'bg-amber-500',
        iconWrap: 'bg-amber-50 ring-amber-100',
        icon: 'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 4.5h.008v.008H12v-.008Z',
        iconClass: 'text-amber-600',
    },
    info: {
        title: 'Update',
        accent: 'bg-sky-500',
        iconWrap: 'bg-sky-50 ring-sky-100',
        icon: 'M11.25 11.25h1.5v5.25h-1.5v-5.25Zm0-3h1.5v1.5h-1.5v-1.5ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
        iconClass: 'text-sky-600',
    },
};

const FlashToast = () => {
    const { flash } = usePage().props;
    const { toasts, removeToast } = useToast();
    const [flashVisible, setFlashVisible] = useState(false);
    const [flashMessage, setFlashMessage] = useState('');
    const [flashType, setFlashType] = useState('success');
    const [flashExiting, setFlashExiting] = useState(false);

    useEffect(() => {
        if (flash?.message) {
            setFlashMessage(flash.message);
            setFlashType('success');
            setFlashVisible(true);
            setFlashExiting(false);
        } else if (flash?.error) {
            setFlashMessage(flash.error);
            setFlashType('error');
            setFlashVisible(true);
            setFlashExiting(false);
        }
    }, [flash?.message, flash?.error]);

    useEffect(() => {
        if (!flashVisible) return undefined;

        const timer = setTimeout(() => {
            setFlashExiting(true);
            setTimeout(() => {
                setFlashVisible(false);
                setFlashExiting(false);
            }, 220);
        }, 3500);

        return () => clearTimeout(timer);
    }, [flashVisible, flashMessage]);

    const dismissFlash = () => {
        setFlashExiting(true);
        setTimeout(() => {
            setFlashVisible(false);
            setFlashExiting(false);
        }, 220);
    };

    const renderToast = (message, type, isExiting, onDismiss, key) => {
        const config = typeConfig[type] || typeConfig.info;

        return (
            <div
                key={key}
                className={`pointer-events-auto relative flex w-[min(380px,calc(100vw-2rem))] items-start gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3.5 text-slate-800 shadow-xl shadow-slate-950/10 ring-1 ring-black/5 backdrop-blur-md transition-all duration-200 ${isExiting ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'}`}
            >
                <span className={`absolute inset-y-0 left-0 w-1 ${config.accent}`} />
                <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ring-1 ${config.iconWrap}`}>
                    <svg className={`h-4 w-4 ${config.iconClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
                    </svg>
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{config.title}</p>
                    <p className="mt-0.5 text-sm font-semibold leading-5 text-slate-700">{message}</p>
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="-mr-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Dismiss notification"
                >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        );
    };

    return (
        <div className="pointer-events-none fixed bottom-5 left-5 z-[99999] flex max-w-[calc(100vw-2rem)] flex-col-reverse gap-2">
            {flashVisible && renderToast(flashMessage, flashType, flashExiting, dismissFlash, 'flash-toast')}
            {toasts.map((toast) => (
                renderToast(toast.message, toast.type, toast.exiting, () => removeToast(toast.id), `toast-${toast.id}`)
            ))}
        </div>
    );
};

export default FlashToast;
