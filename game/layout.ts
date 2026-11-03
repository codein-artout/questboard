import { hexKey, neighbors, ring, ringOf, stableHash, type Axial } from "./hex";
import type { Terrain } from "./config";

export type PlacedTile = Axial & { terrain: Terrain };

/**
 * Picks the slot for a new tile (GAME.md "Island layout"):
 * candidates are free slots touching the island, no further out than one ring
 * beyond the innermost ring that still has room (so the island fills ring by
 * ring). Prefer the slot adjacent to the most tiles of the same terrain, then
 * the smallest ring, then a stable hash.
 */
export function chooseSlot(occupied: ReadonlyMap<string, PlacedTile>, terrain: Terrain, seed: string): Axial {
  if (occupied.size === 0) return { q: 0, r: 0 };
  let maxRing = 0;
  for (const t of occupied.values()) maxRing = Math.max(maxRing, ringOf(t));
  let innermostFree = maxRing + 1;
  for (let n = 0; n <= maxRing; n++) {
    if (ring(n).some((h) => !occupied.has(hexKey(h)))) {
      innermostFree = n;
      break;
    }
  }
  const limit = innermostFree + 1;
  let best: { h: Axial; same: number; ringN: number; hash: number } | null = null;
  for (let n = 0; n <= limit; n++) {
    for (const h of ring(n)) {
      const key = hexKey(h);
      if (occupied.has(key)) continue;
      const adj = neighbors(h).map((x) => occupied.get(hexKey(x)));
      if (!adj.some(Boolean)) continue;
      const same = adj.filter((a) => a?.terrain === terrain).length;
      const cand = { h, same, ringN: n, hash: stableHash(`${seed}:${key}`) };
      if (
        !best ||
        cand.same > best.same ||
        (cand.same === best.same && cand.ringN < best.ringN) ||
        (cand.same === best.same && cand.ringN === best.ringN && cand.hash < best.hash)
      ) {
        best = cand;
      }
    }
  }
  return best?.h ?? { q: 0, r: 0 };
}

export type LayoutRequest = { id: string; terrain: Terrain };

/**
 * Places new tiles in order around existing ones. Existing positions never move.
 * Returns a map from request id to position.
 */
export function placeTiles(
  existing: readonly (PlacedTile & { id: string })[],
  incoming: readonly LayoutRequest[],
  seed: string,
): Map<string, Axial> {
  const occupied = new Map<string, PlacedTile>();
  const out = new Map<string, Axial>();
  for (const t of existing) {
    occupied.set(hexKey(t), t);
    out.set(t.id, { q: t.q, r: t.r });
  }
  for (const req of incoming) {
    if (out.has(req.id)) continue;
    const h = chooseSlot(occupied, req.terrain, `${seed}:${req.id}`);
    occupied.set(hexKey(h), { ...h, terrain: req.terrain });
    out.set(req.id, h);
  }
  return out;
}

export type IslandSlot =
  | (Axial & { kind: "shelf"; id: string })
  | (Axial & { kind: "unexplored" });

/**
 * Display-only slots around an island: shelf "?" tiles on the outermost ring
 * (one ring beyond the last tile), overflowing outward, plus one ring of
 * unexplored slots beyond the outermost tile.
 */
export function islandSurroundings(tiles: readonly Axial[], shelfIds: readonly string[], seed: string): IslandSlot[] {
  const occupied = new Set(tiles.map(hexKey));
  let maxRing = -1;
  for (const t of tiles) maxRing = Math.max(maxRing, ringOf(t));
  const out: IslandSlot[] = [];
  let ringN = maxRing + 1;
  const remaining = [...shelfIds];
  let displayRadius = maxRing + 1;
  while (remaining.length > 0) {
    const free = ring(ringN)
      .filter((h) => !occupied.has(hexKey(h)))
      .sort((a, b) => stableHash(`${seed}:${hexKey(a)}`) - stableHash(`${seed}:${hexKey(b)}`));
    for (const h of free) {
      const id = remaining.shift();
      if (!id) break;
      occupied.add(hexKey(h));
      out.push({ ...h, kind: "shelf", id });
    }
    displayRadius = ringN;
    ringN++;
  }
  for (let n = 0; n <= displayRadius; n++) {
    for (const h of ring(n)) if (!occupied.has(hexKey(h))) out.push({ ...h, kind: "unexplored" });
  }
  return out;
}
