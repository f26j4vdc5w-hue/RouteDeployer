import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Pfade wie /s27/after-work/ sind echte Unterordner auf dem statischen Host:
// index.html wird dorthin kopiert, damit Direktaufrufe und Reloads funktionieren.
const COLLECTION_PATHS = ['s26/camp', 's26/after-work', 's27/after-work'];

function collectionPages(): Plugin {
  let outDir = 'dist';
  return {
    name: 'collection-pages',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const index = join(outDir, 'index.html');
      copyFileSync(index, join(outDir, '404.html'));
      for (const path of COLLECTION_PATHS) {
        mkdirSync(join(outDir, path), { recursive: true });
        copyFileSync(index, join(outDir, path, 'index.html'));
      }
    },
  };
}

// BASE_PATH wird im Deployment gesetzt (z. B. /RouteDeployer/ bei GitHub Pages).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), collectionPages()],
});
