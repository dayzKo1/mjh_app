import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: '../assets',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  },
  server: {
    host: true,
    port: 3000
  }
});