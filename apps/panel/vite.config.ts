import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Panel (index.html) ve herkese açık yasal sayfalar (mağaza kayıtlarında istenen adresler):
// /gizlilik.html, /kullanim-sartlari.html, /hesap-silme.html
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        gizlilik: resolve(__dirname, 'gizlilik.html'),
        sartlar: resolve(__dirname, 'kullanim-sartlari.html'),
        silme: resolve(__dirname, 'hesap-silme.html'),
      },
    },
  },
});
