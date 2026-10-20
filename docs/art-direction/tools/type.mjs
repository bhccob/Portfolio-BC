// Text as SVG outline paths (opentype.js), so renders never depend on system fonts.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import opentype from 'opentype.js';

const require = createRequire(import.meta.url);
const cache = new Map();
export function font(pkg, file) {
  const key = `${pkg}/${file}`;
  if (!cache.has(key)) {
    const p = require.resolve(`${pkg}/files/${file}`);
    const b = fs.readFileSync(p);
    cache.set(key, opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)));
  }
  return cache.get(key);
}
// tracking in em; anchor 'start' | 'middle' | 'end'
export function text(f, str, x, y, size, { tracking = 0, anchor = 'start', fill = '#fff', opacity = 1 } = {}) {
  const w = advance(f, str, size, tracking);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  const d = serialize(f.getPath(str, x0, y, size, { letterSpacing: tracking, kerning: true }).commands);
  return `<path d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`;
}
// opentype.js 2.0.0's toPathData emits NaN for some coordinates; write the commands ourselves.
const n = v => (Math.round(v * 100) / 100).toString();
function serialize(cmds) {
  return cmds.map(c => {
    if (c.type === 'M' || c.type === 'L') return `${c.type}${n(c.x)} ${n(c.y)}`;
    if (c.type === 'Q') return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
    if (c.type === 'C') return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
    return 'Z';
  }).join('');
}
// Visual width: trailing tracking after the last glyph is not counted.
export function advance(f, str, size, tracking = 0) {
  return f.getAdvanceWidth(str, size, { letterSpacing: tracking, kerning: true }) - (str.length ? tracking * size : 0);
}
