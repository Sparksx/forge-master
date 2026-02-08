import { defineConfig } from 'vite';

export default defineConfig({
    base: '/forge-master/',
    root: '.',
    build: {
        outDir: 'dist',
    },
    server: {
        open: true,
    },
});
