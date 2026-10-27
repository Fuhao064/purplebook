/** 生成可独立加载的轻量版，与完整版共用搜索交互和弹窗样式。 */
import { cpSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist', 'home-search-only');
mkdirSync(output, { recursive: true });
cpSync(join(root, 'variants', 'home-search-only'), output, { recursive: true });
copyFileSync(join(root, 'search.js'), join(output, 'search.js'));
copyFileSync(join(root, 'popup', 'popup.css'), join(output, 'popup.css'));
cpSync(join(root, 'icons'), join(output, 'icons'), { recursive: true });
console.log(`轻量版加载目录：${output}`);
