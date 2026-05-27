import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.headers.common['X-CSRF-TOKEN'] = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
window.axios.defaults.withCredentials = true;

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
const originalFetch = window.fetch.bind(window);

window.fetch = (input, init = {}) => {
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const unsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const rawUrl = input instanceof Request ? input.url : input;
    const url = new URL(rawUrl, window.location.href);
    const sameOrigin = url.origin === window.location.origin;

    if (!unsafeMethod || !sameOrigin) {
        return originalFetch(input, init);
    }

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const token = csrfToken();

    if (token && !headers.has('X-CSRF-TOKEN')) {
        headers.set('X-CSRF-TOKEN', token);
    }

    if (!headers.has('X-Requested-With')) {
        headers.set('X-Requested-With', 'XMLHttpRequest');
    }

    return originalFetch(input, {
        ...init,
        headers,
        credentials: init.credentials || 'same-origin',
    }).then((response) => {
        if (response.status === 419 && sameOrigin) {
            console.warn('Session token expired or mismatched. Refresh the page before retrying this action.');
        }

        return response;
    });
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
