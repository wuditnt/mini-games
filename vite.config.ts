import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRelay } from './server/relay.mjs';

/** 端口固定为 6174，开发与预览时与 Vite 一同启动 */
const RELAY_PORT = 6174;

/** 让 npm run dev / npm run preview 一条命令同时拉起局域网中继 */
function lanRelay() {
  let relay: ReturnType<typeof createRelay> | null = null;

  const start = () => {
    if (relay) return;
    relay = createRelay({ port: RELAY_PORT });
  };
  const stop = () => {
    relay?.close();
    relay = null;
  };

  return {
    name: 'lan-relay',
    configureServer(server: any) {
      start();
      server.httpServer?.on('close', stop);
    },
    configurePreviewServer(server: any) {
      start();
      server.httpServer?.on('close', stop);
    },
  };
}

export default defineConfig({
  plugins: [react(), lanRelay()],
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
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
        },
      },
    },
  },
});
