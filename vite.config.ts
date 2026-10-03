import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served from https://courier6.github.io/PrintAnywayApp/
  base: '/PrintAnywayApp/',
  plugins: [react()],
});
