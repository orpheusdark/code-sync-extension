import { defineConfig, type Plugin } from 'vite';

function isolateContentScript(): Plugin {
  return {
    name: 'isolate-content-script',
    generateBundle(_options, bundle) {
      const content = bundle['content/index.js'];
      if (content?.type === 'chunk' && /\bimport\s/.test(content.code)) {
        throw new Error('content/index.js must be self-contained and cannot import external chunks.');
      }
    }
  };
}

export default defineConfig(() => {
  const apiBaseUrl = process.env.CODESYNC_API_BASE_URL || 'http://localhost:3000';

  return {
    define: {
      __CODESYNC_API_BASE_URL__: JSON.stringify(apiBaseUrl)
    },
    plugins: [isolateContentScript()],
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
          },
          manualChunks(id) {
            if (
              id.includes('src/content/') ||
              id.includes('src/platforms/') ||
              id.includes('src/background/')
            ) {
              return undefined;
            }

            if (id.includes('node_modules')) {
              return 'vendor';
            }

            return undefined;
          },
          inlineDynamicImports: false
        }
      }
    },
    publicDir: 'public'
  };
});
