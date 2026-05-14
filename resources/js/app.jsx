import './bootstrap';
import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import DefaultLayout from './Layouts/DefaultLayout';

createInertiaApp({
    title: (title) => title ? `${title} - Eloquente Catering` : 'Eloquente Catering System',
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.jsx', { eager: true });
        const page = pages[`./Pages/${name}.jsx`];
        // Assign DefaultLayout (which includes FlashToast) to every page
        // unless the page already defines its own layout
        page.default.layout = page.default.layout || ((p) => <DefaultLayout>{p}</DefaultLayout>);
        return page;
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
});
