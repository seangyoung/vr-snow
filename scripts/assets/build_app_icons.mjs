// Optional asset-authoring dependency: sharp. Not required to build or run the app.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const sharp = createRequire(import.meta.url)('sharp');
const icons = fileURLToPath(new URL('../../public/icons/', import.meta.url));
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
]) {
  await sharp(`${icons}icon.svg`).resize(size, size).removeAlpha().png().toFile(`${icons}${name}`);
}
