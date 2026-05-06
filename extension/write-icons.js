// write-icons.js — run with: node extension/write-icons.js
// Writes pre-rendered shield icons as PNG blobs. No npm deps needed.
// Delete this file after running.

import fs   from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const OUT = path.join(__dirname, "icons");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// ── Minimal PNG encoder ───────────────────────────────────────────────────────
function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const tb  = Buffer.from(type, "ascii");
  const crc = u32be(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([u32be(data.length), tb, data, crc]);
}
function makePNG(size, getRGBA) {
  const ihdr = Buffer.concat([u32be(size), u32be(size), Buffer.from([8,6,0,0,0])]);
  const raw  = Buffer.alloc((1 + size * 4) * size);
  let off = 0;
  for (let y = 0; y < size; y++) {
    raw[off++] = 0;
    for (let x = 0; x < size; x++) {
      const [r,g,b,a] = getRGBA(x, y, size);
      raw[off++]=r; raw[off++]=g; raw[off++]=b; raw[off++]=a;
    }
  }
  const deflated = zlib.deflateSync(raw, { level: 9 });
  const SIG = Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([SIG, chunk("IHDR",ihdr), chunk("IDAT",deflated), chunk("IEND",Buffer.alloc(0))]);
}

// ── Shield pixel function ─────────────────────────────────────────────────────
function shieldRGBA(x, y, w) {
  const nx = x / (w - 1);
  const ny = y / (w - 1);
  const cx = nx - 0.5, cy = ny - 0.5;
  const dist = Math.sqrt(cx * cx + cy * cy);

  if (dist > 0.5) return [0, 0, 0, 0]; // transparent

  // Background
  const bgR = Math.round(17  + cy * 10);
  const bgG = Math.round(20  + cy * 8);
  const bgB = Math.round(40  + cy * 12);

  // Shield region
  const sx = (nx - 0.15) / 0.7;
  const sy = (ny - 0.08) / 0.84;
  let inShield = false;
  if (sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1) {
    if (sy < 0.62) {
      inShield = true;
    } else {
      const halfW = 0.5 * (1 - (sy - 0.62) / 0.38);
      inShield = sx >= 0.5 - halfW && sx <= 0.5 + halfW;
    }
  }

  // Cyan glow ring
  const ringW = 0.04;
  const rDist = Math.abs(dist - 0.47);
  if (rDist < ringW) {
    const alpha = Math.round(180 * (1 - rDist / ringW));
    return [34, 211, 238, alpha];
  }

  if (inShield) {
    const t = 1 - sy * 0.6;
    const r = Math.round(17  + (1-t) * 10);
    const g = Math.round(80  + t * 131 * 0.4);
    const b = Math.round(100 + t * 138 * 0.4);
    const a = Math.round(200 + t * 55);
    // Checkmark
    const checkY = sy - 0.55;
    const onCheck =
      (sx > 0.2 && sx < 0.48 && Math.abs(checkY - (sx - 0.2) * 0.7) < 0.045) ||
      (sx > 0.44 && sx < 0.82 && Math.abs(checkY - (0.82 - sx) * 0.7) < 0.045);
    if (onCheck && sy > 0.45 && sy < 0.85) return [34, 211, 238, 255];
    return [r, g, b, a];
  }

  return [bgR, bgG, bgB, Math.round(220 * (1 - dist * 0.3))];
}

// ── Write all sizes ──────────────────────────────────────────────────────────
for (const size of [16, 48, 128]) {
  const buf  = makePNG(size, shieldRGBA);
  const file = path.join(OUT, `icon${size}.png`);
  fs.writeFileSync(file, buf);
  console.log(`✓ ${file}  (${buf.length} bytes)`);
}
console.log("\n✅ Done — reload the extension in chrome://extensions");
