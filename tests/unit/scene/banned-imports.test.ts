import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The imports the plan bans from src/: drei's Text, Text3D, Environment and useGLTF (troika workers, CDN presets,
 * GLTF decoders the CSP would block), three's own post-processing (pmndrs `postprocessing` is the one chain),
 * Lenis (the scroll is virtual) and anything troika.
 */
const BANNED_DREI = new Set(['Text', 'Text3D', 'Environment', 'useGLTF']);

/** Every module specifier in `source`: static imports and re-exports, side-effect imports and dynamic import(). */
function specifiers(source: string): { spec: string; names: string[] }[] {
  const found: { spec: string; names: string[] }[] = [];
  const named = /\b(?:import|export)\s+(?:type\s+)?([\w*\s{},$]*?)\s*from\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(named)) {
    const braces = /\{([^}]*)\}/.exec(match[1]);
    const names = braces
      ? braces[1]
          .split(',')
          .map((part) => part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim())
          .filter(Boolean)
      : [];
    found.push({ spec: match[2], names });
  }
  for (const match of source.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) found.push({ spec: match[1], names: [] });
  for (const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push({ spec: match[1], names: [] });
  return found;
}

/** What is banned in `source`, as readable reasons; empty when it is clean. */
function banned(source: string): string[] {
  const reasons: string[] = [];
  for (const { spec, names } of specifiers(source)) {
    if (spec === '@react-three/drei') {
      for (const name of names) if (BANNED_DREI.has(name)) reasons.push(`drei ${name}`);
    }
    const deep = /^@react-three\/drei\/(?:core|web|native)\/(\w+)$/.exec(spec);
    if (deep && (BANNED_DREI.has(deep[1]) || deep[1] === 'Gltf')) reasons.push(`drei ${deep[1]}`);
    if (/^three\/(?:addons|examples\/jsm)\/postprocessing(?:\/|$)/.test(spec)) reasons.push(`three's own post-processing: ${spec}`);
    if (/^lenis(?:\/|$)/.test(spec)) reasons.push(`lenis: ${spec}`);
    if (/^troika/.test(spec)) reasons.push(`troika: ${spec}`);
  }
  return reasons;
}

const SRC = fileURLToPath(new URL('../../../src', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe('the banned-import rule', () => {
  it('catches each banned import, however it is written', () => {
    const caught = [
      "import { Text } from '@react-three/drei';",
      "import { OrbitControls, Text3D as Title } from '@react-three/drei';",
      'import {\n  Environment,\n  PerformanceMonitor,\n} from "@react-three/drei";',
      "import { type useGLTF } from '@react-three/drei';",
      "export { Text } from '@react-three/drei';",
      "import { Text } from '@react-three/drei/core/Text';",
      "import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';",
      "import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';",
      "import Lenis from 'lenis';",
      "import { ReactLenis } from 'lenis/react';",
      "const lenis = await import('lenis');",
      "import { Text } from 'troika-three-text';",
      "import 'troika-worker-utils';",
    ];
    for (const source of caught) expect(banned(source), source).not.toEqual([]);
  });

  it('lets the allowed ones through', () => {
    const allowed = [
      "import { PerformanceMonitor } from '@react-three/drei';",
      "import { PerformanceMonitor } from '@react-three/drei/core/PerformanceMonitor';",
      "import { Bloom, EffectComposer } from '@react-three/postprocessing';",
      "import { Effect } from 'postprocessing';",
      "import { damp3 } from 'maath/easing';",
      "import { TextureLoader } from 'three';",
      "const Text = 'a word';",
    ];
    for (const source of allowed) expect(banned(source), source).toEqual([]);
  });

  it('finds none in src/', () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(50);
    const offences = files.flatMap((file) => banned(readFileSync(file, 'utf8')).map((reason) => `${relative(SRC, file)}: ${reason}`));
    expect(offences).toEqual([]);
  });
});
