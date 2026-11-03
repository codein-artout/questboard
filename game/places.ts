import type { ScoringType } from "./config";

export type ScoredEntry = { key: string; score: number | null; team?: string | null };

/**
 * Places from scores (highest first). Ties share the higher place, and the next
 * place skips ("1, 1, 3"). Entries without a score get no place. In team mode,
 * a team's score is its best member's score unless every member has the same
 * team score; all members share the team's place.
 */
export function placesFromScores(entries: readonly ScoredEntry[], lowestWins = false): Map<string, number> {
  const out = new Map<string, number>();
  const scored = entries.filter((e) => e.score !== null && Number.isFinite(e.score));
  const cmp = (a: number, b: number) => (lowestWins ? a - b : b - a);
  const sorted = [...scored].sort((a, b) => cmp(a.score!, b.score!));
  sorted.forEach((e) => {
    const better = sorted.filter((o) => cmp(o.score!, e.score!) < 0).length;
    out.set(e.key, better + 1);
  });
  return out;
}

export function teamPlaces(entries: readonly ScoredEntry[]): Map<string, number> {
  const teams = new Map<string, number>();
  for (const e of entries) {
    if (!e.team || e.score === null) continue;
    teams.set(e.team, Math.max(teams.get(e.team) ?? -Infinity, e.score));
  }
  const teamPlace = placesFromScores([...teams].map(([key, score]) => ({ key, score })));
  const out = new Map<string, number>();
  for (const e of entries) {
    const p = e.team ? teamPlace.get(e.team) : undefined;
    if (p !== undefined) out.set(e.key, p);
  }
  return out;
}

/** Whether a scoring type is competitive (has winners and losers among players). */
export function isCompetitive(scoring: ScoringType): boolean {
  return scoring !== "coop";
}

/** "1st", "2nd", "3rd", "11th". */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

/** Display label for a place, with "=" for ties. */
export function placeLabel(place: number, tied: boolean): string {
  return `${tied ? "=" : ""}${ordinal(place)}`;
}
