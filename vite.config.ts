import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // Detect whether we are running in the remote Google AI Studio Preview environment
    // where HMR is disabled (DISABLE_HMR=true) or on a cloud platform (K_SERVICE is set).
    const isCloudPreview = process.env.DISABLE_HMR === 'true' || !!process.env.K_SERVICE;

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: isCloudPreview ? false : {
          path: '/@vite',
          clientPort: 443,
        },
      },
      optimizeDeps: {
        entries: ['index.html'],
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
