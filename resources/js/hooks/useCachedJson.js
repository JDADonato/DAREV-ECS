import { useCallback, useRef } from 'react';

export default function useCachedJson(defaultBustUrls = []) {
    const requestCache = useRef(new Map());

    const fetchCachedJson = useCallback(async (url, ttl = 45000) => {
        const cached = requestCache.current.get(url);
        const now = Date.now();
        if (cached && now - cached.time < ttl) {
            return cached.data;
        }

        const res = await fetch(url, { headers: {} });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw data;
        }

        requestCache.current.set(url, { data, time: now });
        return data;
    }, []);

    const bustCache = useCallback((...urls) => {
        [...urls, ...defaultBustUrls].forEach(url => requestCache.current.delete(url));
    }, [defaultBustUrls]);

    return { bustCache, fetchCachedJson };
}
