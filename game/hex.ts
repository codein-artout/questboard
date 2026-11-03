/** Axial hex coordinates (pointy-top). Pure helpers. */

export type Axial = { q: number; r: number };

export const DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const hexKey = (h: Axial): string => `${h.q},${h.r}`;

export function parseHexKey(key: string): Axial {
  const [q, r] = key.split(",").map(Number);
  return { q: q ?? 0, r: r ?? 0 };
}

/** Distance from the center, i.e. which ring the hex sits on. */
export function ringOf(h: Axial): number {
  return Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(-h.q - h.r));
}

export function distance(a: Axial, b: Axial): number {
  return ringOf({ q: a.q - b.q, r: a.r - b.r });
}

export function neighbors(h: Axial): Axial[] {
  return DIRECTIONS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
}

/** All hexes exactly `n` rings from the center, in a stable order. */
export function ring(n: number): Axial[] {
  if (n === 0) return [{ q: 0, r: 0 }];
  const out: Axial[] = [];
  let h: Axial = { q: -n, r: n }; // start at direction 4 scaled
  for (let side = 0; side < 6; side++) {
    const d = DIRECTIONS[side]!;
    for (let i = 0; i < n; i++) {
      out.push(h);
      h = { q: h.q + d.q, r: h.r + d.r };
    }
  }
  return out;
}

/** All hexes within `radius` rings, center first. */
export function spiral(radius: number): Axial[] {
  const out: Axial[] = [];
  for (let n = 0; n <= radius; n++) out.push(...ring(n));
  return out;
}

/** Pixel center of a hex for a pointy-top tile of the given width. */
export function hexToPixel(h: Axial, width: number): { x: number; y: number } {
  const height = (width * 2) / Math.sqrt(3);
  return { x: width * (h.q + h.r / 2), y: 0.75 * height * h.r };
}

/** Small stable string hash (FNV-1a, 32-bit) for deterministic tie-breaks. */
export function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
