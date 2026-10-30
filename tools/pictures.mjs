// The pictures on each project's own page over the stack (spec 2026-10-29-bob-stack-2-design.md, "The pictures"): the
// PNGs taken from each project's own code turned into WebP for the site, a phone screen at most 1170 x 2532 and a
// website at most 1440 x 900, never enlarged.
//
//   node tools/pictures.mjs <from folder> <to folder> [name ...]
//
// Only the pictures the projects name are made, all of them or the ones named; a missing one stops the run.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const PICTURES = [
  { name: 'steady-welcome', size: [1170, 2532] },
  { name: 'steady-home', size: [1170, 2532] },
  { name: 'steady-reminders', size: [1170, 2532] },
  { name: 'jontai-dawn', size: [1440, 900] },
  { name: 'cookies-playing', size: [1440, 900] },
  { name: 'portle-portfolio', size: [1440, 900] }
];
const QUALITY = 82;

const [from, to, ...names] = process.argv.slice(2);
if (!from || !to) {
  console.error('usage: node tools/pictures.mjs <from folder> <to folder> [name ...]');
  process.exit(2);
}
mkdirSync(to, { recursive: true });
const unknown = names.filter((name) => !PICTURES.some((picture) => picture.name === name));
if (unknown.length) {
  console.error(`not a picture the projects name: ${unknown.join(', ')}`);
  process.exit(2);
}
for (const { name, size } of PICTURES.filter((picture) => !names.length || names.includes(picture.name))) {
  const out = join(to, `${name}.webp`);
  const info = await sharp(join(from, `${name}.png`))
    .resize({ width: size[0], height: size[1], fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(out);
  console.log(`${out}: ${info.width} x ${info.height}, ${Math.round(info.size / 1024)} kB`);
}
