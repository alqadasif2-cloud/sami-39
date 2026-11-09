import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Body parsers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.raw({ type: ['application/octet-stream', 'application/vnd.android.package-archive'], limit: '100mb' }));

  // Static directory for file uploads
  const uploadsDir = path.resolve(__dirname, 'data/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Mount API router under /api
  app.use('/api', apiRouter);

  // Serve static assets from public/ directory
  const publicDir = path.resolve(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
    }
    app.get('*', (_req, res) => {
      const htmlPath = fs.existsSync(path.resolve(distDir, 'index.html'))
        ? path.resolve(distDir, 'index.html')
        : path.resolve(__dirname, 'index.html');
      res.sendFile(htmlPath);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Sami Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Sami Server] Fatal startup error:', err);
  process.exit(1);
});
