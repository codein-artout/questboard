/**
 * Live places for the log form and the server. Pure and shared, so what you
 * see while scoring is exactly what gets saved.
 */
import type { ScoringType } from "@/game/config";
import { placesFromScores, teamPlaces } from "@/game/places";

export type PlaceInput = {
  key: string;
  score: number | null;
  team: string | null;
  won: boolean;
  rank: number | null;
};

export function computePlaces(mode: ScoringType, entries: readonly PlaceInput[]): Map<string, number> {
  switch (mode) {
    case "coop":
      return new Map();
    case "points":
      return placesFromScores(entries);
    case "ranked": {
      const out = new Map<string, number>();
      if (entries.some((e) => e.rank !== null)) {
        for (const e of entries) if (e.rank !== null) out.set(e.key, e.rank);
        return out;
      }
      return placesFromScores(entries);
    }
    case "teams": {
      if (entries.some((e) => e.score !== null && e.team)) return teamPlaces(entries);
      return winnerPlaces(entries);
    }
    case "win_lose":
      if (entries.some((e) => e.won)) return winnerPlaces(entries);
      return placesFromScores(entries);
  }
}

function winnerPlaces(entries: readonly PlaceInput[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!entries.some((e) => e.won)) return out;
  for (const e of entries) out.set(e.key, e.won ? 1 : 2);
  return out;
}

/** "Priya wins by 3", "Mission complete, together", "Team red wins". */
export function outcomeLine(
  mode: ScoringType,
  parts: readonly { name: string; score: number | null; place: number | null; team: string | null }[],
  coopWin: boolean | null,
): string {
  if (mode === "coop") return coopWin === true ? "Won together" : coopWin === false ? "Lost together" : "Played together";
  const winners = parts.filter((p) => p.place === 1);
  if (!winners.length) return "No result recorded";
  if (mode === "teams") {
    const team = winners[0]!.team;
    return team ? `Team ${team} wins` : `${listNames(winners.map((w) => w.name))} win`;
  }
  if (winners.length > 1) return `${listNames(winners.map((w) => w.name))} tie for first`;
  const w = winners[0]!;
  const second = parts.filter((p) => p.place === 2 && p.score !== null).map((p) => p.score!).sort((a, b) => b - a)[0];
  if (mode === "points" && w.score !== null && second !== undefined) {
    const by = Math.round((w.score - second) * 10) / 10;
    return `${w.name} wins by ${by}`;
  }
  return `${w.name} wins`;
}

export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
