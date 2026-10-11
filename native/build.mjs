// Compiles native/physics.c to public/wasm/physics.wasm.
//
// Uses @yowasp/clang: Clang/LLD themselves compiled to WebAssembly, so the
// build runs anywhere Node runs (Windows, macOS, CI) with no C toolchain
// installed. Skips work when the .wasm is newer than its sources.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sources = ['physics.c', 'physics.h'];
const output = join(here, '..', 'public', 'wasm', 'physics.wasm');
const force = process.argv.includes('--force');

async function mtime(path) {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return 0;
  }
}

async function isUpToDate() {
  const built = await mtime(output);
  if (!built) return false;
  const newest = Math.max(...(await Promise.all(sources.map((file) => mtime(join(here, file))))), await mtime(fileURLToPath(import.meta.url)));
  return built > newest;
}

if (!force && (await isUpToDate())) {
  console.log('[wasm] physics.wasm is up to date');
  process.exit(0);
}

const started = Date.now();
const { runClang } = await import('@yowasp/clang');
const files = Object.fromEntries(await Promise.all(sources.map(async (file) => [file, await readFile(join(here, file), 'utf8')])));

const result = await runClang(
  [
    'clang',
    '--target=wasm32',
    '-std=c11',
    '-O3',
    '-flto',
    '-nostdlib',
    '-ffreestanding',
    '-mbulk-memory',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-Wl,--no-entry',
    '-Wl,--strip-all',
    '-Wl,--lto-O3',
    '-o',
    'physics.wasm',
    'physics.c'
  ],
  files
);

const wasm = result['physics.wasm'];
if (!wasm) throw new Error('[wasm] clang did not produce physics.wasm');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, wasm);
console.log(`[wasm] built physics.wasm (${wasm.byteLength} bytes) in ${Date.now() - started} ms`);
