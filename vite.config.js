import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    // Relative base so the same build works whether it's served at the domain root
    // (full-stack host) or under a subpath like /forge-master/ (GitHub Pages).
    base: './',
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
