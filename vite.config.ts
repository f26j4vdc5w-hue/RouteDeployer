import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative base: works on GitHub Pages (project sites) and on any static host.
export default defineConfig({
  base: './',
  plugins: [react()],
});
