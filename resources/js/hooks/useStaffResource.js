import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const cache = new Map();

const buildUrl = (url, params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
            query.set(key, value);
        }
    });

    const queryString = query.toString();
    return queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url;
};

export default function useStaffResource(url, {
    params = {},
    enabled = true,
    ttl = 45000,
    debounce = 0,
    initialData = null,
} = {}) {
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(Boolean(enabled && !initialData));
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const abortRef = useRef(null);
    const paramsKey = JSON.stringify(params);
    const requestUrl = useMemo(() => buildUrl(url, params), [url, paramsKey]);

    const load = useCallback(async ({ silent = false, bust = false } = {}) => {
        if (!enabled) return null;

        const now = Date.now();
        const cached = cache.get(requestUrl);
        if (!bust && cached && now - cached.time < ttl) {
            setData(cached.data);
            setLoading(false);
            setRefreshing(false);
            setError(null);
            return cached.data;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        if (silent) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            const response = await fetch(requestUrl, {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw payload;
            cache.set(requestUrl, { data: payload, time: Date.now() });
            setData(payload);
            return payload;
        } catch (requestError) {
            if (requestError?.name !== 'AbortError') setError(requestError);
            return null;
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [enabled, requestUrl, ttl]);

    useEffect(() => {
        if (!enabled) return undefined;
        const timer = window.setTimeout(() => load(), debounce);
        return () => {
            window.clearTimeout(timer);
            abortRef.current?.abort();
        };
    }, [enabled, requestUrl, debounce, load]);

    return {
        data,
        loading,
        refreshing,
        error,
        refetch: load,
    };
}

export { buildUrl };
