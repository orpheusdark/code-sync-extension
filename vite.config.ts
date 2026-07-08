import { defineConfig } from 'vite';

export default defineConfig(() => {
  const apiBaseUrl = process.env.CODESYNC_API_BASE_URL || 'http://localhost:3000';

  return {
    define: {
      __CODESYNC_API_BASE_URL__: JSON.stringify(apiBaseUrl)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'es2020',
      rollupOptions: {
        input: {
          popup: 'popup.html',
          options: 'options.html',
          background: 'src/background/index.ts',
          content: 'src/content/index.ts'
        },
        output: {
          format: 'es',
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'background') return 'background/index.js';
            if (chunkInfo.name === 'content') return 'content/index.js';
            return 'assets/[name]-[hash].js';
          }
        }
      }
    },
    publicDir: 'public'
  };
});
