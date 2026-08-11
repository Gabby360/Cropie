import { defineConfig } from 'vite';
import { resolve } from 'path';
import khayaHandler from './api/khaya.js';

export default defineConfig({
  plugins: [
    {
      name: 'khaya-api-proxy',
      configureServer(server) {
        server.middlewares.use('/api/khaya', async (req, res) => {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              req.body = body ? JSON.parse(body) : {};
            } catch {
              req.body = {};
            }
            
            const urlObj = new URL(req.url, 'http://localhost');
            req.query = Object.fromEntries(urlObj.searchParams);

            res.status = (code) => {
              res.statusCode = code;
              return res;
            };
            res.json = (data) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return res;
            };

            await khayaHandler(req, res);
          });
        });
      }
    }
  ],
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
