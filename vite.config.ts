import { defineConfig, loadEnv, Plugin } from 'vite';
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiKey =
    env.GEMINI_API_KEY ||
    env.API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    '';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: false,
    },
    plugins: [react(), tailwindcss(), disableHmrWebSocketPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
    },
  };
});