import { useEffect, useRef } from 'react';

const getNow = () => Date.now();

export default function useSmartRefresh({
    enabled = true,
    interval = 30000,
    idleAfter = 180000,
    refresh,
    refreshOnFocus = true,
}) {
    const refreshRef = useRef(refresh);
    const lastInteractionRef = useRef(getNow());
    const lastRefreshRef = useRef(0);

    useEffect(() => {
        refreshRef.current = refresh;
    }, [refresh]);

    useEffect(() => {
        if (!enabled || typeof refreshRef.current !== 'function') return undefined;

        const markInteraction = () => {
            lastInteractionRef.current = getNow();
        };

        const canRefresh = () => {
            if (document.visibilityState !== 'visible') return false;
            return getNow() - lastInteractionRef.current <= idleAfter;
        };

        const runRefresh = (reason) => {
            if (!canRefresh()) return;
            lastRefreshRef.current = getNow();
            refreshRef.current({ silent: true, reason });
        };

        const handleFocus = () => {
            markInteraction();
            if (refreshOnFocus && getNow() - lastRefreshRef.current > 2500) {
                runRefresh('focus');
            }
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                markInteraction();
                runRefresh('visible');
            }
        };

        const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
        events.forEach((eventName) => window.addEventListener(eventName, markInteraction, { passive: true }));
        window.addEventListener('focus', handleFocus);
        window.addEventListener('online', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        const timer = window.setInterval(() => {
            runRefresh('interval');
        }, interval);

        return () => {
            window.clearInterval(timer);
            events.forEach((eventName) => window.removeEventListener(eventName, markInteraction));
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('online', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [enabled, interval, idleAfter, refreshOnFocus]);
}
