import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    // Absolute base: the app is served from the domain root by the full-stack host
    // (Railway). Absolute asset URLs (/assets/…) load correctly no matter the current
    // route — including deep SPA paths like /auth/google/callback that the server
    // rewrites to index.html. A relative base ('./') would resolve assets against the
    // callback path (/auth/google/assets/…) and 404, leaving an unstyled, dead page.
    base: '/',
    root: '.',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                admin: resolve(__dirname, 'admin.html'),
            },
        },
    },
    server: {
        open: true,
        proxy: {
            '/api': 'http://localhost:3000',
            '/socket.io': {
                target: 'http://localhost:3000',
                ws: true,
            },
        },
    },
});
