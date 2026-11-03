import { BASE_CLASSES, CLASS, HYBRID_CLASSES, NO_CLASS, TERRAINS, type Terrain } from "./config";

export type PlayerClass = { key: string; name: string; terrains: Terrain[] };

export type DatedTerrainPlay = { at: Date; terrain: Terrain; count: number };

const MS_PER_MONTH = 30.4375 * 24 * 3600 * 1000;

/** Counts plays per terrain over the class window (all time below the minimum). */
export function classTerrainCounts(plays: readonly DatedTerrainPlay[], at: Date): Record<Terrain, number> {
  const since = at.getTime() - CLASS.windowMonths * MS_PER_MONTH;
  const recent = plays.filter((p) => p.at.getTime() >= since && p.at.getTime() <= at.getTime());
  const recentTotal = recent.reduce((n, p) => n + p.count, 0);
  const use = recentTotal >= CLASS.minPlaysForWindow ? recent : plays.filter((p) => p.at.getTime() <= at.getTime());
  const counts = Object.fromEntries(TERRAINS.map((t) => [t, 0])) as Record<Terrain, number>;
  for (const p of use) counts[p.terrain] += p.count;
  return counts;
}

/** Class from terrain counts: the top terrain, or a hybrid when the top two are within 10 points of share. */
export function classFromCounts(counts: Record<Terrain, number>): PlayerClass {
  const total = TERRAINS.reduce((n, t) => n + counts[t], 0);
  if (total === 0) return { key: NO_CLASS.key, name: NO_CLASS.name, terrains: [] };
  const ranked = [...TERRAINS].sort((a, b) => counts[b] - counts[a] || TERRAINS.indexOf(a) - TERRAINS.indexOf(b));
  const [first, second] = ranked as [Terrain, Terrain];
  if (counts[second] > 0 && (counts[first] - counts[second]) / total <= CLASS.hybridWithin) {
    const pair = [first, second].sort((a, b) => TERRAINS.indexOf(a) - TERRAINS.indexOf(b)) as [Terrain, Terrain];
    const key = `${pair[0]}+${pair[1]}`;
    return { key, name: HYBRID_CLASSES[key] ?? BASE_CLASSES[first], terrains: pair };
  }
  return { key: first, name: BASE_CLASSES[first], terrains: [first] };
}

export function classAt(plays: readonly DatedTerrainPlay[], at: Date): PlayerClass {
  return classFromCounts(classTerrainCounts(plays, at));
}
