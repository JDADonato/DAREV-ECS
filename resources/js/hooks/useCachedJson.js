import { useCallback, useRef } from 'react';

export default function useCachedJson(defaultBustUrls = []) {
    const requestCache = useRef(new Map());
    const inFlight = useRef(new Map());

    const fetchCachedJson = useCallback(async (url, ttl = 45000) => {
        const cached = requestCache.current.get(url);
        const now = Date.now();
        if (cached && now - cached.time < ttl) {
            return cached.data;
        }

        if (inFlight.current.has(url)) {
            return inFlight.current.get(url);
        }

        const request = fetch(url, { headers: { Accept: 'application/json' } })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw data;
                requestCache.current.set(url, { data, time: Date.now() });
                return data;
            })
            .finally(() => {
                inFlight.current.delete(url);
            });

        inFlight.current.set(url, request);
        return request;
    }, []);

    const bustCache = useCallback((...urls) => {
        [...urls, ...defaultBustUrls].forEach(url => {
            requestCache.current.delete(url);
            inFlight.current.delete(url);
        });
    }, [defaultBustUrls]);

    return { bustCache, fetchCachedJson };
}
