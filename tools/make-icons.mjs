// アイコン画像(PNG)を作るスクリプト。アプリ本体からは使わない。
// 使い方:node tools/make-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const BG_TOP = [253, 228, 236]; // #fde4ec
const BG_BOTTOM = [246, 184, 202]; // #f6b8ca
const HEART = [255, 255, 255];

// ハートの式 (x²+y²−1)³ − x²y³ ≤ 0
const inHeart = (x, y) => (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0;

// ハートの中心と、中心から一番遠い点までの距離を求める
function heartGeometry() {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const pts = [];
  for (let x = -1.5; x <= 1.5; x += 0.005) {
    for (let y = -1.5; y <= 1.5; y += 0.005) {
      if (!inHeart(x, y)) continue;
      pts.push([x, y]);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const r = pts.reduce((m, [x, y]) => Math.max(m, Math.hypot(x - cx, y - cy)), 0);
  return { cx, cy, r };
}
const geo = heartGeometry();

// radiusFrac:ハートが収まる円の半径(画像の一辺に対する割合)
function draw(size, radiusFrac) {
  const px = Buffer.alloc(size * size * 4);
  const scale = (radiusFrac * size) / geo.r;
  const SS = 4; // なめらかにするための細分割
  for (let py = 0; py < size; py++) {
    const t = py / (size - 1);
    const bg = BG_TOP.map((c, i) => c + (BG_BOTTOM[i] - c) * t);
    for (let pxl = 0; pxl < size; pxl++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxl + (sx + 0.5) / SS - size / 2) / scale + geo.cx;
          const y = -(py + (sy + 0.5) / SS - size / 2) / scale + geo.cy;
          if (inHeart(x, y)) hit++;
        }
      }
      const a = hit / (SS * SS);
      const o = (py * size + pxl) * 4;
      for (let i = 0; i < 3; i++) px[o + i] = Math.round(bg[i] * (1 - a) + HEART[i] * a);
      px[o + 3] = 255;
    }
  }
  return encodePNG(size, size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = [
  ['icon-192.png', 192, 0.34],
  ['icon-512.png', 512, 0.34],
  ['icon-maskable-512.png', 512, 0.27], // Android の丸いマスクで欠けないよう小さめ
  ['apple-touch-icon.png', 180, 0.32],
];
for (const [name, size, frac] of files) {
  writeFileSync(new URL(name, OUT), draw(size, frac));
  console.log('wrote', name);
}
