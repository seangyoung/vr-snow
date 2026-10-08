import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Pass dist and its deployed base to verify the actual Vite output.
const root = resolve(process.argv[2] ?? 'public');
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
assert.ok(manifest.name && manifest.short_name);
assert.equal(manifest.display, 'standalone');
assert.notEqual(manifest.prefer_related_applications, true);
for (const base of ['/vr-snow/', '/vr-snow/walkable/']) {
  const url = new URL(`${base}manifest.json`, 'https://example.org');
  for (const key of ['start_url', 'scope']) {
    assert.equal(new URL(manifest[key], url).pathname, base, `${key} must preserve the deployment`);
  }
  // An explicit relative id resolves against the origin, NOT the manifest directory.
  // Omit it to use the resolved start_url as the deployment-specific identity.
  const start = new URL(manifest.start_url, url);
  const identity = manifest.id === undefined ? start : new URL(manifest.id, start.origin);
  assert.equal(identity.pathname, base, 'App identity must distinguish stable from walkable');
  for (const icon of manifest.icons) {
    assert.ok(new URL(icon.src, url).pathname.startsWith(`${base}icons/`));
  }
}
for (const size of [192, 512]) {
  assert.ok(manifest.icons.some(icon => icon.sizes === `${size}x${size}` && icon.purpose === 'any'));
}
assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable' && icon.sizes === '512x512'));
for (const [path, size] of [
  ...manifest.icons.map(icon => [icon.src, Number(icon.sizes.split('x')[0])]),
  ['icons/apple-touch-icon.png', 180], ['icons/favicon-32.png', 32],
]) {
  const png = await readFile(`${root}/${path}`);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), size, `${path} width`);
  assert.equal(png.readUInt32BE(20), size, `${path} height`);
  assert.equal(png[25], 2, `${path} must be opaque RGB`);
}
if (process.argv[2]) {
  const base = process.argv[3];
  assert.ok(base?.startsWith('/') && base.endsWith('/'), 'Provide the build base path');
  const html = await readFile(`${root}/index.html`, 'utf8');
  for (const asset of ['manifest.json', 'icons/icon.svg', 'icons/favicon-32.png', 'icons/apple-touch-icon.png']) {
    assert.ok(html.includes(`href="${base}${asset}"`), `Missing deployed link: ${asset}`);
    await readFile(`${root}/${asset}`);
  }
  assert.ok(!html.includes('%BASE_URL%'));
}
console.log('Web app manifest, deployment scope, icon files and dimensions passed.');
