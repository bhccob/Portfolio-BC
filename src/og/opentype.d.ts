// The small part of opentype.js (2.x ships no types) that the share-image renderer uses.
declare module 'opentype.js' {
  export interface Path {
    toPathData(decimalPlaces?: number): string;
  }

  export interface Glyph {
    index: number;
    advanceWidth?: number;
    getPath(x: number, y: number, fontSize: number): Path;
  }

  export interface Font {
    unitsPerEm: number;
    charToGlyph(char: string): Glyph;
    getKerningValue(left: Glyph, right: Glyph): number;
  }

  export function parse(buffer: ArrayBuffer): Font;

  const opentype: { parse: typeof parse };
  export default opentype;
}
