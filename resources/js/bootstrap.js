import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.headers.common['X-CSRF-TOKEN'] = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
window.axios.defaults.withCredentials = true;

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
const originalFetch = window.fetch.bind(window);

const updateCsrfToken = (token) => {
    if (!token) {
        return;
    }

    let meta = document.querySelector('meta[name="csrf-token"]');

    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'csrf-token');
        document.head.appendChild(meta);
    }

    meta.setAttribute('content', token);
    window.axios.defaults.headers.common['X-CSRF-TOKEN'] = token;
};

const notifySessionExpired = () => {
    window.dispatchEvent(new CustomEvent('ecs:session-expired', {
        detail: {
            message: 'Your session expired. Refresh the page and try again.',
        },
    }));
};

const refreshCsrfToken = async () => {
    const response = await originalFetch('/api/session/csrf-token', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    if (!response.ok) {
        throw new Error('Could not refresh the session token.');
    }

    const data = await response.json().catch(() => ({}));
    updateCsrfToken(data.token);
    return data.token;
};

const withCsrfHeaders = (input, init = {}) => {
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const token = csrfToken();

    if (token) {
        headers.set('X-CSRF-TOKEN', token);
    }

    if (!headers.has('X-Requested-With')) {
        headers.set('X-Requested-With', 'XMLHttpRequest');
    }

    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
    }

    return {
        ...init,
        headers,
        credentials: init.credentials || 'same-origin',
    };
};

window.fetch = async (input, init = {}) => {
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const unsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const rawUrl = input instanceof Request ? input.url : input;
    const url = new URL(rawUrl, window.location.href);
    const sameOrigin = url.origin === window.location.origin;

    if (!unsafeMethod || !sameOrigin) {
        return originalFetch(input, init);
    }

    const requestOptions = withCsrfHeaders(input, init);
    const response = await originalFetch(input, requestOptions);

    if (response.status !== 419 || init.__csrfRetry) {
        if (response.status === 419) {
            console.warn('Session token expired or mismatched. Refresh the page before retrying this action.');
            notifySessionExpired();
        }

        return response;
    }

    try {
        await refreshCsrfToken();

        const retryResponse = await originalFetch(input, withCsrfHeaders(input, {
            ...init,
            __csrfRetry: true,
        }));

        if (retryResponse.status === 419) {
            console.warn('Session token expired or mismatched. Refresh the page before retrying this action.');
            notifySessionExpired();
        }

        return retryResponse;
    } catch (error) {
        console.warn('Session token expired and could not be refreshed. Refresh the page before retrying this action.', error);
        notifySessionExpired();
        return response;
    }
};

/**
 * Echo exposes an expressive API for subscribing to channels and listening
 * for events that are broadcast by Laravel. Echo and event broadcasting
 * allow your team to easily build robust real-time web applications.
 */

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

if (import.meta.env.VITE_REVERB_APP_KEY) {
    window.Echo = new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost: import.meta.env.VITE_REVERB_HOST,
        wsPort: import.meta.env.VITE_REVERB_PORT ?? 8085,
        wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
        forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
        enabledTransports: ['ws', 'wss'],
    });
}
