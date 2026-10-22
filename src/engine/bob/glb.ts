/**
 * A small reader for the JSON of a binary glTF (GLB) file: enough to look at
 * the compass model's structure (its node names, which meshes carry which
 * attributes, what its animation drives) without loading it into three.js. The
 * tests use it to pin what tools/blender/export_compass.py writes. It reads
 * bytes with `DataView` and `TextDecoder` and imports nothing from three.
 *
 * A GLB is a 12-byte header (the magic `glTF`, the version, the file's length)
 * and then chunks, each an 8-byte header (its length and its type) and its
 * bytes. The first chunk is the JSON; the binary buffer that follows it is not
 * read here. All numbers are little-endian.
 */

/**
 * The most bytes the compass GLB may take. The loader's page carries it
 * alongside the rest of the site, so the export script's segment counts are
 * tuned to stay under this (tests/unit/bob/compass-glb.test.ts checks it).
 */
export const COMPASS_GLB_BUDGET = 700_000;

/**
 * The most bytes the beads' GLB may take (public/models/bob-beads.glb,
 * tools/blender/export_beads.py): the three beads, their objects and the baked
 * vein maps inside it (tests/unit/bob/beads-glb.test.ts checks it).
 */
export const BEADS_GLB_BUDGET = 1_500_000;

/**
 * The part of a glTF's JSON that the compass tests read. A node's `mesh` is an
 * index into `meshes`, its `children` are indices into `nodes`, and a mesh
 * primitive's attributes map a name (`POSITION`, `TEXCOORD_0`) to an
 * accessor's index. An animation channel's `target` is the node it drives and
 * the property (`translation`, `rotation`) it sets.
 */
export interface GlbJson {
  nodes: { name?: string; mesh?: number; children?: number[] }[];
  meshes: { primitives: { attributes: Record<string, number> }[] }[];
  animations?: { name?: string; channels: { target: { node: number; path: string } }[] }[];
}

/** The magic at the start of every GLB, the bytes `glTF` read as a little-endian number. */
const GLB_MAGIC = 0x46546c67;

/** The only GLB version there is. */
const GLB_VERSION = 2;

/** The type of a chunk that holds JSON, the bytes `JSON` read as a little-endian number. */
const CHUNK_JSON = 0x4e4f534a;

/** The sizes of the file header and of a chunk header, in bytes. */
const FILE_HEADER = 12;
const CHUNK_HEADER = 8;

/** A number written as hex with its `0x`, for the messages. */
function hex(n: number): string {
  return `0x${n.toString(16)}`;
}

/**
 * The JSON of a GLB, parsed. It checks the file the way a loader would before
 * it trusts it, and throws a `TypeError` that says which check failed:
 * - the file is long enough for its header;
 * - the magic is `glTF`;
 * - the version is 2;
 * - the first chunk is a JSON chunk, and the file holds all of it;
 * - the chunk's text is JSON, an object with `nodes` and `meshes` lists (the
 *   compass always has both).
 *
 * `bytes` may be a view into a larger buffer, as `Buffer`s from `readFileSync`
 * often are: only the view's own bytes are read.
 */
export function readGlbJson(bytes: Uint8Array): GlbJson {
  if (bytes.byteLength < FILE_HEADER) {
    throw new TypeError(`not a GLB: ${bytes.byteLength} bytes is too short for the ${FILE_HEADER}-byte header`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    throw new TypeError(`not a GLB: the magic is ${hex(magic)}, not ${hex(GLB_MAGIC)}`);
  }
  const version = view.getUint32(4, true);
  if (version !== GLB_VERSION) {
    throw new TypeError(`unsupported GLB version ${version}: only version ${GLB_VERSION} is read`);
  }

  if (bytes.byteLength < FILE_HEADER + CHUNK_HEADER) {
    throw new TypeError(`GLB has no first chunk: ${bytes.byteLength} bytes is too short for a chunk header`);
  }
  const length = view.getUint32(FILE_HEADER, true);
  const type = view.getUint32(FILE_HEADER + 4, true);
  if (type !== CHUNK_JSON) {
    throw new TypeError(`the first GLB chunk is type ${hex(type)}, not JSON (${hex(CHUNK_JSON)})`);
  }
  const start = FILE_HEADER + CHUNK_HEADER;
  if (start + length > bytes.byteLength) {
    throw new TypeError(`the GLB's JSON chunk needs ${length} bytes but the file holds only ${bytes.byteLength - start} after its header`);
  }

  let parsed: unknown;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(start, start + length));
    parsed = JSON.parse(text);
  } catch (error) {
    throw new TypeError(`the GLB's JSON chunk is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new TypeError("the GLB's JSON chunk is not an object");
  }
  for (const key of ['nodes', 'meshes']) {
    if (!Array.isArray((parsed as Record<string, unknown>)[key])) {
      throw new TypeError(`the GLB's JSON has no "${key}" list`);
    }
  }
  return parsed as GlbJson;
}
