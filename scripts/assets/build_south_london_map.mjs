// Build a local, Quest-sized texture from Wellcome image L0063432.
// Source, license and adaptation details: public/maps/south-london-water-supply.source.md
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const sharp=createRequire(import.meta.url)('sharp');
const url='https://upload.wikimedia.org/wikipedia/commons/6/62/Map_showing_the_intimate_mixture_of_the_water_supply..._Wellcome_L0063432.jpg';
const response=process.argv[2]?undefined:await fetch(url);
if(response && !response.ok)throw new Error(`Map download failed: ${response.status}`);
const original=process.argv[2]?await readFile(process.argv[2]):Buffer.from(await response.arrayBuffer());
// Preserve the original printed colours and lettering; only resample/compress.
await writeFile(new URL('../../public/maps/south-london-water-supply.jpg',import.meta.url),
  await sharp(original).resize({width:2048}).jpeg({quality:90,chromaSubsampling:'4:4:4'}).toBuffer());
console.log('Built south-london-water-supply.jpg (2048 pixels wide).');
