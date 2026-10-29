import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const defaultRoot = fileURLToPath(new URL('./dist/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

export function createPreviewServer(root = defaultRoot) {
  const base = resolve(root) + sep;
  return createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method not allowed');
      return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400); response.end('Bad request'); return; }
    const file = resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(base) || pathname.includes('\0')) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 5174);
  const server = createPreviewServer();
  server.on('error', error => {
    process.stderr.write(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请使用 PORT 指定其他端口。\n` : `预览服务启动失败：${error.message}\n`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => process.stdout.write(`Cupnote is ready at http://localhost:${port}\n`));
}
