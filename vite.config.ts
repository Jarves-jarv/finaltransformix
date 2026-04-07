import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: ['.ngrok-free.app', 'ee22-149-34-244-173.ngrok-free.app', '.loca.lt', 'all'],
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    // Minify with esbuild (default) — fast and effective
    minify: 'esbuild',
    // Warn when a chunk exceeds 1MB
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Code splitting: separate heavy dependencies into their own chunks
        // Users only download what they actually need
        manualChunks: {
          // Core React runtime — cached separately across deploys
          vendor: ['react', 'react-dom'],
          // Charts library — only loaded when chart components render
          charts: ['recharts'],
          // Icon library — tree-shaken by Vite, but split for caching
          icons: ['lucide-react'],
          // AI SDK — only needed for AI-enabled features
          ai: ['@google/genai'],
          // Database clients — Supabase + Dexie
          db: ['@supabase/supabase-js', 'dexie'],
        },
      },
    },
  },
  css: {
    // PostCSS is auto-detected via postcss.config.js
    devSourcemap: true,
  },
});
