import React, { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { useToast } from '../../context/ToastContext';

/**
 * FlashToast — Shows flash messages from the Laravel session AND
 * client-side toasts as animated notifications in the Eloquente theme.
 * Positioned at bottom-right. Red/maroon + gold accent colors.
 */
const FlashToast = () => {
    const { flash } = usePage().props;
    const { toasts, removeToast } = useToast();

    // Flash messages from Laravel
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
        if (flashVisible) {
            const timer = setTimeout(() => {
                setFlashExiting(true);
                setTimeout(() => {
                    setFlashVisible(false);
                    setFlashExiting(false);
                }, 400);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [flashVisible, flashMessage]);

    const dismissFlash = () => {
        setFlashExiting(true);
        setTimeout(() => {
            setFlashVisible(false);
            setFlashExiting(false);
        }, 400);
    };

    const getTypeConfig = (type) => {
        switch (type) {
            case 'success':
                return {
                    bg: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #7f1d1d 100%)',
                    border: '1px solid rgba(234, 179, 8, 0.25)',
                    shadow: '0 20px 50px rgba(127, 29, 29, 0.4), 0 8px 20px rgba(0,0,0,0.2), 0 0 0 1px rgba(234, 179, 8, 0.2) inset',
                    iconBg: 'linear-gradient(135deg, #eab308, #f59e0b)',
                    iconColor: '#7f1d1d',
                    icon: '✓',
                    iconShadow: '0 2px 8px rgba(234, 179, 8, 0.4)',
                    textColor: '#fef3c7',
                    closeColor: '#fde68a',
                    progressBg: 'rgba(127, 29, 29, 0.5)',
                    progressFill: 'linear-gradient(90deg, #eab308, #f59e0b, #fbbf24)',
                    shimmer: true,
                };
            case 'error':
                return {
                    bg: 'linear-gradient(135deg, #1e1e1e 0%, #374151 100%)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    shadow: '0 20px 50px rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.15)',
                    iconBg: 'rgba(239, 68, 68, 0.2)',
                    iconColor: '#fca5a5',
                    icon: '✕',
                    iconShadow: 'none',
                    textColor: '#f9fafb',
                    closeColor: '#d1d5db',
                    progressBg: 'rgba(55, 65, 81, 0.5)',
                    progressFill: 'rgba(239, 68, 68, 0.6)',
                    shimmer: false,
                };
            case 'warning':
                return {
                    bg: 'linear-gradient(135deg, #78350f 0%, #92400e 50%, #78350f 100%)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    shadow: '0 20px 50px rgba(120, 53, 15, 0.4), 0 8px 20px rgba(0,0,0,0.2)',
                    iconBg: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                    iconColor: '#78350f',
                    icon: '⚠',
                    iconShadow: '0 2px 8px rgba(251, 191, 36, 0.4)',
                    textColor: '#fef3c7',
                    closeColor: '#fde68a',
                    progressBg: 'rgba(120, 53, 15, 0.5)',
                    progressFill: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                    shimmer: false,
                };
            case 'info':
            default:
                return {
                    bg: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #1e3a5f 100%)',
                    border: '1px solid rgba(96, 165, 250, 0.3)',
                    shadow: '0 20px 50px rgba(30, 58, 95, 0.4), 0 8px 20px rgba(0,0,0,0.2)',
                    iconBg: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
                    iconColor: '#1e3a5f',
                    icon: 'ℹ',
                    iconShadow: '0 2px 8px rgba(96, 165, 250, 0.4)',
                    textColor: '#dbeafe',
                    closeColor: '#bfdbfe',
                    progressBg: 'rgba(30, 58, 95, 0.5)',
                    progressFill: 'linear-gradient(90deg, #60a5fa, #3b82f6)',
                    shimmer: false,
                };
        }
    };

    const renderToast = (message, type, isExiting, onDismiss, key, index = 0) => {
        const cfg = getTypeConfig(type);
        return (
            <div
                key={key}
                style={{
                    animation: isExiting
                        ? 'toast-slide-out-br 0.4s ease-in forwards'
                        : 'toast-slide-in-br 0.5s cubic-bezier(0.21, 1.02, 0.73, 1) forwards',
                    marginBottom: '12px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '14px',
                        padding: '18px 22px',
                        minWidth: '340px',
                        maxWidth: '460px',
                        borderRadius: '14px',
                        background: cfg.bg,
                        color: '#fff',
                        boxShadow: cfg.shadow,
                        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                        border: cfg.border,
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    {/* Shimmer overlay for success */}
                    {cfg.shimmer && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                background: 'linear-gradient(105deg, transparent 40%, rgba(234, 179, 8, 0.06) 50%, transparent 60%)',
                                pointerEvents: 'none',
                            }}
                        />
                    )}

                    {/* Icon */}
                    <div
                        style={{
                            flexShrink: 0,
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: cfg.iconBg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 700,
                            color: cfg.iconColor,
                            boxShadow: cfg.iconShadow,
                            position: 'relative',
                            zIndex: 1,
                        }}
                    >
                        {cfg.icon}
                    </div>

                    {/* Message */}
                    <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                        <div
                            style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                lineHeight: 1.6,
                                wordBreak: 'break-word',
                                color: cfg.textColor,
                                letterSpacing: '0.01em',
                            }}
                        >
                            {message}
                        </div>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={onDismiss}
                        style={{
                            flexShrink: 0,
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '8px',
                            color: cfg.closeColor,
                            cursor: 'pointer',
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            transition: 'all 0.2s',
                            position: 'relative',
                            zIndex: 1,
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(255,255,255,0.2)';
                            e.target.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(255,255,255,0.1)';
                            e.target.style.transform = 'scale(1)';
                        }}
                        aria-label="Dismiss notification"
                    >
                        ✕
                    </button>
                </div>

                {/* Progress bar */}
                <div
                    style={{
                        marginTop: '0',
                        height: '3px',
                        borderRadius: '0 0 14px 14px',
                        overflow: 'hidden',
                        background: cfg.progressBg,
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            background: cfg.progressFill,
                            animation: 'toast-progress 5.4s linear forwards',
                            borderRadius: '0 0 14px 14px',
                        }}
                    />
                </div>
            </div>
        );
    };

    return (
        <>
            <div
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    zIndex: 99999,
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    alignItems: 'flex-end',
                }}
            >
                {/* Laravel Flash Toast */}
                {flashVisible && renderToast(flashMessage, flashType, flashExiting, dismissFlash, 'flash-toast')}

                {/* Client-side Toasts */}
                {toasts.map((t, i) =>
                    renderToast(t.message, t.type, t.exiting, () => removeToast(t.id), `toast-${t.id}`, i)
                )}
            </div>

            {/* Keyframe animations — bottom-right slide */}
            <style>{`
                @keyframes toast-slide-in-br {
                    0% {
                        opacity: 0;
                        transform: translateY(20px) translateX(20px) scale(0.96);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0) translateX(0) scale(1);
                    }
                }
                @keyframes toast-slide-out-br {
                    0% {
                        opacity: 1;
                        transform: translateY(0) translateX(0) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(20px) translateX(20px) scale(0.96);
                    }
                }
                @keyframes toast-progress {
                    0% { width: 100%; }
                    100% { width: 0%; }
                }
            `}</style>
        </>
    );
};

export default FlashToast;
