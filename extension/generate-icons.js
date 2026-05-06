// generate-icons.js — creates icon16.png, icon48.png, icon128.png
// Uses only Node.js built-ins (zlib + fs). No npm packages required.
"use strict";

const fs   = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "icons");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── PNG helpers ──────────────────────────────────────────────────────────────
function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let j = 0; j < 8; j++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len       = u32be(data.length);
  const crcBuf    = Buffer.concat([typeBytes, data]);
  const crc       = u32be(crc32(crcBuf));
  return Buffer.concat([len, typeBytes, data, crc]);
}

function makePNG(width, height, getRGBA) {
  // IHDR
  const ihdr = Buffer.concat([
    u32be(width), u32be(height),
    Buffer.from([8, 6, 0, 0, 0]),   // 8-bit RGBA, deflate, adaptive, non-interlaced
  ]);

  // Raw scanlines: filter byte (0) + RGBA per pixel
  const raw = Buffer.alloc((1 + width * 4) * height);
  let off = 0;
  for (let y = 0; y < height; y++) {
    raw[off++] = 0; // filter type = None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getRGBA(x, y, width, height);
      raw[off++] = r; raw[off++] = g; raw[off++] = b; raw[off++] = a;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    PNG_SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Icon pixel painter — draws a shield on midnight-blue ─────────────────────
function shieldRGBA(x, y, w, h) {
  // Normalized coords [0,1]
  const nx = x / (w - 1);
  const ny = y / (h - 1);

  // Background: midnight blue circle
  const cx = nx - 0.5, cy = ny - 0.5;
  const dist = Math.sqrt(cx * cx + cy * cy);

  if (dist > 0.5) return [0, 0, 0, 0]; // transparent outside circle

  // Gradient background: dark navy
  const bgR = Math.round(17  + cy * 10);
  const bgG = Math.round(20  + cy * 8);
  const bgB = Math.round(40  + cy * 12);

  // Shield shape: roughly a pentagon / shield polygon
  // Shield spans x=[0.15,0.85], y=[0.08,0.92]
  const sx = (nx - 0.15) / 0.7; // 0..1 within shield x
  const sy = (ny - 0.08) / 0.84; // 0..1 within shield y

  let inShield = false;
  if (sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1) {
    if (sy < 0.62) {
      // Rectangular top part
      inShield = true;
    } else {
      // Rounded bottom: shield tapers to a point
      // At sy=1 (bottom), x must be 0.5 ± (1-sy)*something
      const halfW = 0.5 * (1 - (sy - 0.62) / 0.38);
      inShield = sx >= 0.5 - halfW && sx <= 0.5 + halfW;
    }
  }

  // Cyan glow ring
  const ringW = 0.04;
  const rDist = Math.abs(dist - 0.47);
  const onRing = rDist < ringW;

  if (onRing) {
    const alpha = Math.round(180 * (1 - rDist / ringW));
    return [34, 211, 238, alpha]; // cyan ring
  }

  if (inShield) {
    // Shield fill — cyan gradient
    const t = 1 - sy * 0.6;
    const r = Math.round(17  + (1 - t) * 10);
    const g = Math.round(80  + t * 131 * 0.4);
    const b = Math.round(100 + t * 138 * 0.4);
    const a = Math.round(200 + t * 55);

    // Checkmark accent at center-bottom of shield
    const checkX = Math.abs(sx - 0.5);
    const checkY = sy - 0.55;
    const onCheck =
      (sx > 0.2 && sx < 0.48 && Math.abs(checkY - (sx - 0.2) * 0.7) < 0.045) ||
      (sx > 0.44 && sx < 0.82 && Math.abs(checkY - (0.82 - sx) * 0.7) < 0.045);

    if (onCheck && sy > 0.45 && sy < 0.85) {
      return [34, 211, 238, 255]; // bright cyan checkmark
    }

    return [r, g, b, a];
  }

  // Background with subtle radial gradient
  return [bgR, bgG, bgB, Math.round(220 * (1 - dist * 0.3))];
}

// ── Generate all three sizes ──────────────────────────────────────────────────
const sizes = [16, 48, 128];
for (const size of sizes) {
  const png  = makePNG(size, size, shieldRGBA);
  const file = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`✓ Created ${file} (${png.length} bytes)`);
}

console.log("\n✅ All icons created! You can now load the extension in Chrome.");
