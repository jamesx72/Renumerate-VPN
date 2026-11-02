import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function disableHmrWebSocketPlugin(): Plugin {
  return {
    name: 'disable-vite-hmr-ws',
    enforce: 'post',
    transform(code, id) {
      if (id.includes('vite/dist/client/client.mjs')) {
        return {
          code: code.replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR WebSocket disabled in preview environment */'
          ),
          map: null,
        };
      }
      return null;
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: false,
  },
  plugins: [react(), tailwindcss(), disableHmrWebSocketPlugin()],
});