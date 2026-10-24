import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dir, '..');
const port = Number(process.env.CARD_RV_TEST_PORT ?? 4176);
const server = Bun.serve({
  port,
  hostname: '127.0.0.1',
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    if (pathname === '/')
      return new Response(
        '<!doctype html><html><head><meta charset="utf-8"></head><body><main id="background">模拟酒馆主页面</main></body></html>',
        { headers: { 'Content-Type': 'text/html' } },
      );
    const path = resolve(root, '.' + pathname);
    if (!path.startsWith(root + sep)) return new Response('Forbidden', { status: 403 });
    if (
      !(
        pathname.startsWith('/.test-data/card-rv/') ||
        pathname.startsWith('/node_modules/vue/dist/') ||
        pathname.startsWith('/tests/browser/')
      )
    )
      return new Response('Not found', { status: 404 });
    const file = Bun.file(path);
    return (await file.exists()) ? new Response(file) : new Response('Not found', { status: 404 });
  },
});
console.log(`房车模拟浏览器服务: ${server.url}`);
