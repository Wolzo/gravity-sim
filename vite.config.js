import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so `dist/` can be served from any subdirectory
  // (GitHub Pages, a preview folder, the filesystem).
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    // The engine is DOM-free by design, so the physics suite runs in plain Node.
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
