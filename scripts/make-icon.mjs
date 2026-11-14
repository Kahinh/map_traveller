// Génère `src-tauri/app-icon.png` (1024×1024), icône ORIGINALE provisoire de Map Traveller :
// carré arrondi dégradé lavande + losange accent. Puis : `npx tauri icon src-tauri/app-icon.png`.
// Aucune dépendance : encodeur PNG minimal (zlib natif).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const S = 1024;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const FROM = hex('#646392');
const TO = hex('#4b4d77');
const ACCENT = hex('#e5f052');
const INK = hex('#252739');

const px = Buffer.alloc(S * S * 4);
const R = 200; // rayon des coins
const inRounded = (x, y) => {
  const cx = Math.min(Math.max(x, R), S - 1 - R);
  const cy = Math.min(Math.max(y, R), S - 1 - R);
  return (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
};

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const o = (y * S + x) * 4;
    if (!inRounded(x, y)) continue; // transparent
    const t = (x + y) / (2 * S);
    let c = FROM.map((v, i) => Math.round(v + (TO[i] - v) * t));
    // Losange (destination) + point central (position atteinte)
    const d = Math.abs(x - S / 2) + Math.abs(y - S / 2);
    if (d < 330 && d > 250) c = ACCENT;
    if ((x - S / 2) ** 2 + (y - S / 2) ** 2 < 90 ** 2) c = ACCENT;
    if ((x - S / 2) ** 2 + (y - S / 2) ** 2 < 45 ** 2) c = INK;
    px[o] = c[0];
    px[o + 1] = c[1];
    px[o + 2] = c[2];
    px[o + 3] = 255;
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // profondeur
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(new URL('../src-tauri/app-icon.png', import.meta.url), png);
console.log('src-tauri/app-icon.png généré');
