import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served from https://printanyway.app/
  base: '/',
  plugins: [react()],
});
