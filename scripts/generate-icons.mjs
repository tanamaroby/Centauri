// Generates PNG favicons / PWA icons from public/icons/icon.svg
// Usage: npm run icons
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

const svg = await readFile(new URL("../public/icons/icon.svg", import.meta.url));
const out = (p) => new URL(`../public/${p}`, import.meta.url).pathname;

const sizes = [
  ["icons/icon-192.png", 192],
  ["icons/icon-512.png", 512],
  ["icons/apple-touch-icon.png", 180],
  ["icons/favicon-32.png", 32],
  ["icons/favicon-16.png", 16],
];
for (const [file, size] of sizes) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out(file));
}

// Maskable icon: artwork scaled into the 80% safe zone on the background colour
const inner = await sharp(svg, { density: 384 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#1e1b4b" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(out("icons/icon-maskable-512.png"));

// favicon.ico (PNG-in-ICO, 32px)
const png32 = await sharp(svg, { density: 384 }).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0); entry.writeUInt8(32, 1); entry.writeUInt8(0, 2); entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png32.length, 8); entry.writeUInt32LE(22, 12);
await writeFile(out("../src/app/favicon.ico"), Buffer.concat([header, entry, png32]));

console.log("Icons generated.");
