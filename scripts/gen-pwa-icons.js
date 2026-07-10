// One-off: rasterize the PWA icons into client/public. Run: node scripts/gen-pwa-icons.js
const sharp = require('sharp');
const path = require('path');

const svg = (size, pad) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 96 : 72}" fill="#4f46e5"/>
  <g transform="translate(256 256)" fill="#ffffff">
    <path d="M0 -104 L176 -24 L0 56 L-176 -24 Z"/>
    <path d="M-120 -8 L-120 60 C-120 100 120 100 120 60 L120 -8 L0 44 Z" fill="#c7d2fe"/>
    <rect x="150" y="-24" width="10" height="96" rx="5"/>
    <circle cx="155" cy="80" r="16"/>
  </g>
</svg>`);

const out = path.resolve(__dirname, '..', 'client', 'public');
(async () => {
  await sharp(svg(512, false)).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'));
  await sharp(svg(512, false)).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'));
  await sharp(svg(512, true)).resize(512, 512).png().toFile(path.join(out, 'icon-maskable-512.png'));
  console.log('PWA icons written to client/public/');
})();
