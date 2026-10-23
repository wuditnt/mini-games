import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 6173,
    host: true,
    strictPort: true,
  },
  preview: {
    port: 8020,
    host: true,
    strictPort: true,
  },
});
