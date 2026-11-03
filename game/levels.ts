import { xpForLevel } from "./config";

export type LevelState = { level: number; xpIntoLevel: number; xpForNext: number };

/** Level from total XP. Level 1 starts at 0; each level needs 500 + 250 x (level - 1). */
export function levelFromXp(totalXp: number): LevelState {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, xpIntoLevel: remaining, xpForNext: xpForLevel(level) };
}

/** Total XP needed to reach the start of `level`. */
export function xpToReach(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForLevel(l);
  return total;
}
