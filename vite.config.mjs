import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function r3StaticDirectoryIndexes() {
  const indexes = new Map([
    ['/library/', resolve(import.meta.dirname, 'resources/library/index.html')],
    ['/player/', resolve(import.meta.dirname, 'resources/player/index.html')],
  ]);
  return {
    name: 'r3-static-directory-indexes',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://r3.local').pathname;
        const sourcePath = indexes.get(pathname);
        if (!sourcePath) return next();
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(readFileSync(sourcePath, 'utf8'));
      });
    },
  };
}

export default defineConfig({
  publicDir: 'resources',
  plugins: [react(), r3StaticDirectoryIndexes()],
  build: {
    rollupOptions: {
      input: {
        product: resolve(import.meta.dirname, 'index.html'),
        designSpec: resolve(import.meta.dirname, 'design-spec.html'),
        developmentControlCenter: resolve(import.meta.dirname, 'development-control-center.html'),
      },
    },
  },
});
