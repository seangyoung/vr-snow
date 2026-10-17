// Optional authoring dependency: sharp (as with build_app_icons.mjs).
// Regenerate the lightweight tabletop print from the app's existing Snow map layers.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const sharp = createRequire(import.meta.url)('sharp');
const root = new URL('../../', import.meta.url);
let map = await readFile(new URL('public/maps/broad-street.svg', root), 'utf8');
const boundary = await readFile(new URL('public/maps/pump-service-area.svg', root), 'utf8');
map = map.replace(/<\?xml[^>]*>/, '').replace(/<!--.*?-->/gs, '')
  .replace(/<svg[^>]*>/, '<svg x="80" y="260" width="1240" height="1240" viewBox="0 0 20020 20020" xmlns="http://www.w3.org/2000/svg">');
// Use the existing cleaned boundary rather than the scan's page-frame subpaths.
map = map.replace(/<path\b[^>]*id="PumpServiceArea"[^>]*\/>/, boundary.match(/<path\b[^>]*\/>/)[0]);
map = map.replace(/<path\b[^>]*id="(?:Streets|Deaths|Pumps)"[^>]*>/g, tag => {
  const id=tag.match(/id="([^"]+)"/)[1];
  return tag.replace(/\s(?:fill|stroke|stroke-width|opacity)="[^"]*"/g, '')
    .replace('<path', `<path fill="${id==='Deaths'?'#352b22':'none'}" stroke="#352b22" stroke-width="${id==='Pumps'?42:id==='Streets'?20:10}"`);
});
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1900" viewBox="0 0 1400 1900">
<rect width="1400" height="1900" fill="#e8ddc3"/>
<rect x="35" y="35" width="1330" height="1830" fill="none" stroke="#8e7b58" stroke-width="2"/>
<text x="700" y="125" text-anchor="middle" font-family="Georgia,serif" font-size="45" fill="#352b22">CHOLERA NEAR GOLDEN SQUARE</text>
<text x="700" y="185" text-anchor="middle" font-family="Georgia,serif" font-size="32" fill="#51432e">John Snow · Broad Street and the surrounding streets</text>
${map}
<path d="M 90 1570 H 1310" stroke="#8e7b58" stroke-width="2"/>
<text x="700" y="1650" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#352b22">Each bar marks a death. Circles mark public pumps.</text>
<text x="700" y="1715" text-anchor="middle" font-family="Georgia,serif" font-size="31" fill="#51432e">Boundary: the area nearest to the Broad Street pump.</text>
</svg>`;
await writeFile(new URL('public/maps/board-table-map.png', root), await sharp(Buffer.from(svg)).png().toBuffer());
console.log('Built public/maps/board-table-map.png (1400 × 1900).');
