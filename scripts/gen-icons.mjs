/**
 * 生成扩展图标（16/32/48/128）：紫色圆角方块 + 白色 "P"。
 * 纯 Node 实现 PNG 编码（zlib deflate + 手算 CRC32），零依赖。
 *
 * 用法：node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'icons');

// ---- CRC32 ----
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 绘制 ----

/** 5x7 像素字体 "P" */
const GLYPH_P = ['11110', '10001', '10001', '11110', '10000', '10000', '10000'];

const BG = [124, 92, 255]; // #7C5CFF
const FG = [255, 255, 255];

function inRoundedRect(x, y, size, radius) {
  const px = x + 0.5;
  const py = y + 0.5;
  const r = radius;
  const corners = [
    [r, r],
    [size - r, r],
    [r, size - r],
    [size - r, size - r],
  ];
  for (const [cx, cy] of corners) {
    const inCornerX = px < r || px > size - r;
    const inCornerY = py < r || py > size - r;
    if (inCornerX && inCornerY) {
      const dx = px - cx;
      const dy = py - cy;
      return dx * dx + dy * dy <= r * r;
    }
  }
  return px >= 0 && px <= size && py >= 0 && py <= size;
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;

  const glyphScale = Math.max(1, Math.floor((size * 0.5) / 7));
  const glyphW = 5 * glyphScale;
  const glyphH = 7 * glyphScale;
  const offsetX = Math.floor((size - glyphW) / 2);
  const offsetY = Math.floor((size - glyphH) / 2);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      if (!inRoundedRect(x, y, size, radius)) continue;

      const gx = Math.floor((x - offsetX) / glyphScale);
      const gy = Math.floor((y - offsetY) / glyphScale);
      const inGlyph =
        gx >= 0 && gx < 5 && gy >= 0 && gy < 7 && GLYPH_P[gy]?.[gx] === '1';

      const color = inGlyph ? FG : BG;
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, drawIcon(size));
  console.log(`✓ ${file}`);
}
