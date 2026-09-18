import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        cookiesClicker: resolve(import.meta.dirname, 'cookies-clicker.html'),
        jontaiEnergy: resolve(import.meta.dirname, 'jontai-energy.html'),
        webDevelopment: resolve(import.meta.dirname, 'career/web-development.html'),
        uiUxDesign: resolve(import.meta.dirname, 'career/ui-ux-design.html'),
        gameDevelopment: resolve(import.meta.dirname, 'career/game-development.html'),
        cybersecurity: resolve(import.meta.dirname, 'career/cybersecurity.html')
      }
    }
  }
});