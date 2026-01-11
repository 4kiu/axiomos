
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// satisfy the compiler for Node globals without requiring @types/node
declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // This allows overriding the hardcoded keys via a local .env file if needed.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    base: './', // Ensures relative paths work on GitHub Pages
    define: {
      // Injects keys into the global scope as process.env variables
      'process.env.API_KEY': JSON.stringify(env.API_KEY || 'AIzaSyD89H4Kv8F_wiP4aqb5cZgSgIKDOUzhz9w'),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID || '156781395704-rqijcnbca23931svbuhc41sdqtoh5ghq.apps.googleusercontent.com'),
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: './index.html',
        },
      },
    },
  };
});
