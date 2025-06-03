import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolve = (p: string) => path.resolve(__dirname, p);

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const app = express();

  let vite: any;
  if (!isProd) {
    vite = await createViteServer({
      server: { middlewareMode: true },
      root: resolve('../../apps/frontend'),
    });
    app.use(vite.middlewares);
  } else {
    app.use('/assets', express.static(resolve('../../apps/frontend/dist/assets')));
  }

  app.get('/action/:id', async (req, res, next) => {
    try {
      const url = req.originalUrl;
      let template: string;
      let render: (url: string) => Promise<string> | string;

      if (!isProd) {
        template = fs.readFileSync(resolve('../../apps/frontend/index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        render = (await vite.ssrLoadModule('/src/entry-server.tsx')).render;
      } else {
        template = fs.readFileSync(resolve('../../apps/frontend/dist/index.html'), 'utf-8');
        render = (await import('../../apps/frontend/dist-ssr/entry-server.js')).render;
      }

      const appHtml = await render(url);
      const html = template.replace('<!--ssr-outlet-->', appHtml);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      vite?.ssrFixStacktrace(e as any);
      next(e);
    }
  });

  app.use('*', (req, res) => {
    res.sendFile(resolve('../../apps/frontend/dist/index.html'));
  });

  const port = process.env.SSR_PORT || 4000;
  app.listen(port, () => {
    console.log(`SSR server listening on port ${port}`);
  });
}

startServer();
