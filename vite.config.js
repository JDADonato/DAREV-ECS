import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.jsx'],
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: {
            // Map react-router-dom to our Inertia-compatible shim
            // so ALL original components work without changing imports
            'react-router-dom': path.resolve(__dirname, 'resources/js/lib/router-compat.jsx'),
        },
    },
    build: {
        // Phase 3: Vite Chunk Splitting
        rollupOptions: {
            output: {
                manualChunks: {
                    // Split vendor libraries into their own heavily-cached chunks
                    vendor: ['react', 'react-dom'],
                    inertia: ['@inertiajs/react'],
                    ui: ['@headlessui/react', 'lucide-react', 'recharts']
                }
            }
        }
    }
});
