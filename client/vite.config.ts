import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 3000,
    strictPort: false,
    open: true,
    host: true, // Expose to network for mobile access
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  define: {
    'process.env': {},
  },
});
