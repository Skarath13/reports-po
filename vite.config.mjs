import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'REACT_APP_');

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    // Preserve the existing public API override without exposing other environment values.
    define: { 'process.env.REACT_APP_API_URL': JSON.stringify(env.REACT_APP_API_URL || '') },
    build: {
      outDir: 'build',
      assetsDir: 'static',
      emptyOutDir: true,
      license: { fileName: 'dependency-licenses.txt' },
      rolldownOptions: {
        output: {
          postBanner: '/*! Licenses: /dependency-licenses.txt and /shadcn-ui-license.txt */',
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/setupTests.js'],
      include: ['src/**/*.test.{js,jsx}'],
      css: false,
    },
  };
});
