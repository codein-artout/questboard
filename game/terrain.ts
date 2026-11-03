import { DEFAULT_TERRAIN, TERRAIN_RULES, type Terrain } from "./config";

export type TaggedGame = {
  categories: readonly string[];
  mechanics: readonly string[];
  maxPlayers: number | null;
};

/** Derives a game's terrain from its tags, checking rules in order (GAME.md). */
export function deriveTerrain(game: TaggedGame): Terrain {
  for (const rule of TERRAIN_RULES) {
    if (rule.categories?.some((c) => game.categories.includes(c))) return rule.terrain;
    if (rule.mechanics?.some((m) => game.mechanics.includes(m))) return rule.terrain;
    if (rule.maxPlayersAtMost !== undefined && game.maxPlayers !== null && game.maxPlayers <= rule.maxPlayersAtMost) {
      return rule.terrain;
    }
  }
  return DEFAULT_TERRAIN;
}

/** Player override beats admin override beats derived terrain. */
export function effectiveTerrain(
  derived: Terrain,
  gameOverride: Terrain | null | undefined,
  tileOverride?: Terrain | null,
): Terrain {
  return tileOverride ?? gameOverride ?? derived;
}
