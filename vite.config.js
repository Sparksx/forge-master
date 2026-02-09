import { defineConfig } from 'vite';

export default defineConfig({
    base: '/',
    root: '.',
    build: {
        outDir: 'dist',
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
