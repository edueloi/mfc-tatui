import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Site público do MFC (sites/mfc-encontros/dist): fica na mesma porta do sistema, em /site/.
 * Uma única fonte dos arquivos: o servidor de desenvolvimento lê direto da pasta do site e o build copia para dist/site
 * (o backend em produção já serve a pasta dist inteira).
 */
const SITE_DIR = path.resolve(__dirname, '../sites/mfc-encontros/dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function mfcSite(): Plugin {
  return {
    name: 'mfc-site',
    configureServer(server) {
      server.middlewares.use('/site', (req, res, next) => {
        if ((req.originalUrl || '').split('?')[0] === '/site') { res.statusCode = 302; res.setHeader('Location', '/site/'); res.end(); return; }
        const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
        const target = path.resolve(SITE_DIR, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
        // Nunca sai da pasta do site (ex.: /site/../../.env).
        if (!target.startsWith(SITE_DIR + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return next();
        res.setHeader('Content-Type', MIME[path.extname(target).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(target).pipe(res);
      });
    },
    closeBundle() {
      if (fs.existsSync(SITE_DIR)) fs.cpSync(SITE_DIR, path.resolve(__dirname, 'dist/site'), { recursive: true });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), mfcSite()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
