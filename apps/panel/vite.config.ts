import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Geliştirmede Uygulama görünümü: /uygulama/home gibi adresler önizleme derlemesinin sayfasını açar (yayında firebase.json yapar).
const previewApp: Plugin = {
  name: 'uygulama-onizleme',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url ?? '').split('?')[0];
      if (path.startsWith('/uygulama/') && !/\.[a-z0-9]+$/i.test(path)) req.url = '/uygulama/index.html' + (req.url!.includes('?') ? req.url!.slice(req.url!.indexOf('?')) : '');
      next();
    });
  },
};

// Panel (index.html) ve herkese açık yasal sayfalar (mağaza kayıtlarında istenen adresler):
// /gizlilik.html, /kullanim-sartlari.html, /hesap-silme.html
export default defineConfig({
  plugins: [react(), previewApp],
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
