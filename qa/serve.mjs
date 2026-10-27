/**
 * Popup 视觉 QA：一键起一个本地测试页。
 *
 * 1. 复制 popup/ → qa/popup-test/（该目录为生成物，勿手改）
 * 2. 注入 chrome API stub（qa/chrome-stub.js → stub.js）
 * 3. 起静态服务器，浏览器打开后即可脱离扩展环境预览 / 调试 Popup
 *
 * 用法：node qa/serve.mjs [port=8791]
 * 打开 http://127.0.0.1:<port>/popup.html
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');
const source = join(projectRoot, 'popup');
const target = join(here, 'popup-test');
const port = Number(process.argv[2] ?? 8791);

if (!existsSync(join(source, 'popup.html'))) {
  console.error('未找到 popup/popup.html');
  process.exit(1);
}

mkdirSync(target, { recursive: true });
copyFileSync(join(source, 'popup.html'), join(target, 'popup.html'));
copyFileSync(join(source, 'popup.css'), join(target, 'popup.css'));
copyFileSync(join(source, 'popup.js'), join(target, 'popup.js'));
copyFileSync(join(projectRoot, 'shared.js'), join(target, 'shared.js'));
for (const filename of ['content.js', 'content.css', 'search.js']) {
  copyFileSync(join(projectRoot, filename), join(target, filename));
}
copyFileSync(join(here, 'search-preview.html'), join(target, 'search-preview.html'));
copyFileSync(join(here, 'layout-preview.html'), join(target, 'layout-preview.html'));
copyFileSync(join(here, 'chrome-stub.js'), join(target, 'stub.js'));

const popupFile = join(target, 'popup.html');
let html = readFileSync(popupFile, 'utf8');
if (!html.includes('/stub.js')) {
  html = html.replace('<script src="./popup.js">', '<script src="/stub.js"></script>\n    <script src="./popup.js">');
  writeFileSync(popupFile, html);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

const server = createServer((req, res) => {
  const path = req.url.split('?')[0];
  const name = path === '/' ? 'popup.html' :
    ['/explore', '/search_result', '/search_result_ai'].includes(path) ? 'search-preview.html' :
    path === '/layout' ? 'layout-preview.html' : path.slice(1);
  if (name.includes('..') || name.includes('\\')) {
    res.writeHead(400).end('bad path');
    return;
  }
  const file = name.startsWith('lite/') ? join(projectRoot, 'dist', 'home-search-only', name.slice(5)) : join(target, name);
  if (!existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  let body = readFileSync(file);
  if (name === 'search-preview.html' && new URL(req.url, 'http://localhost').searchParams.get('variant') === 'lite') {
    body = body.toString().replace(/(href|src)="\/(content\.css|shared\.js|content\.js|search\.js)"/g, '$1="/lite/$2"');
  }
  if (name === 'lite/popup.html') {
    body = body.toString().replace('<script src="shared.js">', '<script src="/stub.js"></script><script src="shared.js">');
  }
  res.end(body);
});
server.listen(port, '127.0.0.1', () => {
  const actualPort = server.address().port;
  console.log(`Popup QA: http://127.0.0.1:${actualPort}/popup.html`);
  console.log(`Search QA: http://127.0.0.1:${actualPort}/explore`);
});
