import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        dashboard: resolve(import.meta.dirname, 'dashboard.html'),
        login: resolve(import.meta.dirname, 'login.html'),
        signup: resolve(import.meta.dirname, 'signup.html'),
        forgotPassword: resolve(import.meta.dirname, 'forgot-password.html'),
        farmSetup: resolve(import.meta.dirname, 'farm-setup.html'),
        terms: resolve(import.meta.dirname, 'terms.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
      },
    },
  },
});
