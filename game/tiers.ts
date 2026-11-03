import { TIERS, type TierNumber } from "./config";

export type TierInfo = (typeof TIERS)[number];

/** Tier for a play count: 0 means no confirmed plays yet. */
export function tierForPlays(plays: number): TierNumber {
  let t: TierNumber = 0;
  for (const info of TIERS) if (plays >= info.plays) t = info.tier;
  return t;
}

export function tierInfo(tier: number): TierInfo | null {
  return TIERS.find((t) => t.tier === tier) ?? null;
}

export function tierName(tier: number): string {
  return tierInfo(tier)?.name ?? "Unexplored";
}

/** The next tier and how many more plays it needs, or null at Wonder. */
export function nextTier(plays: number): { tier: TierInfo; playsNeeded: number } | null {
  const next = TIERS.find((t) => t.plays > plays);
  return next ? { tier: next, playsNeeded: next.plays - plays } : null;
}

/** "a Keep" / "an Outpost". */
export function withArticle(name: string): string {
  return /^[AEIOU]/i.test(name) ? `an ${name}` : `a ${name}`;
}
