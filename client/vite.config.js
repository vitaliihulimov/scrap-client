import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],

    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api/, '/api')
            }
        }
    },

    // ========================
    // Для продакшн збірки на Render
    // ========================
    build: {
        outDir: 'dist', // Vite буде збирати у client/dist
        emptyOutDir: true,
    },
    base: './', // важливо для правильних шляхів до CSS/JS у Render
});
