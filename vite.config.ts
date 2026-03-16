import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'glsl-loader',
      transform(code, id) {
        if (id.endsWith('.vert') || id.endsWith('.frag')) {
          return { code: `export default ${JSON.stringify(code)};`, map: null };
        }
      },
    },
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
