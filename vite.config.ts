import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './': funziona a qualsiasi indirizzo (es. https://<utente>.github.io/<repository>/), con routing a hash.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  server: { port: 5174 },
});
