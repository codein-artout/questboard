import type { Terrain } from "./config";
import type { DatedTerrainPlay } from "./class";

/** Running per-player state while the engine folds over history. */

export type GameRecord = {
  plays: number;
  firstAt: Date | null;
  lastAt: Date | null;
  best: number | null;
  wins: number;
  /** Consecutive losses in this game (for the Comeback title). */
  lossStreak: number;
  terrain: Terrain;
};

export type Meeting = { otherId: string; at: Date; result: 1 | 0 | -1 };

export type UserState = {
  id: string;
  name: string;
  games: Map<string, GameRecord>;
  xp: number;
  pendingXp: number;
  terrainPlays: DatedTerrainPlay[];
  /** Quests that counted toward XP per local day (daily cap). */
  xpQuestsPerDay: Map<string, number>;
  /** Plays per `${localDate}|${tileGameId}` (grinding cap). */
  gamePlaysPerDay: Map<string, number>;
  /** All quests per local day (Marathon). */
  questsPerDay: Map<string, number>;
  meetings: Meeting[];
  h2h: Map<string, { wins: number; losses: number; meetings: number }>;
  quests: number;
  wins: number;
  secondStreak: number;
  maxSecondStreak: number;
  kingmaker: number;
  survivedGalaxy: number;
  nightOwl: number;
  comebacks: number;
  underdogs: number;
  hosted: number;
  raids: number;
  weeks: Set<number>;
  coplayers: Set<string>;
  hostedPeople: Set<string>;
  coopWins: number;
  newLandTimes: Date[];
  heavyPlays: number;
  crownTakeTimes: Date[];
  maxCrownsHeld: number;
  titles: Map<string, { earnedAt: Date; questId: string | null; name: string }>;
};

export function newUserState(id: string, name: string): UserState {
  return {
    id,
    name,
    games: new Map(),
    xp: 0,
    pendingXp: 0,
    terrainPlays: [],
    xpQuestsPerDay: new Map(),
    gamePlaysPerDay: new Map(),
    questsPerDay: new Map(),
    meetings: [],
    h2h: new Map(),
    quests: 0,
    wins: 0,
    secondStreak: 0,
    maxSecondStreak: 0,
    kingmaker: 0,
    survivedGalaxy: 0,
    nightOwl: 0,
    comebacks: 0,
    underdogs: 0,
    hosted: 0,
    raids: 0,
    weeks: new Set(),
    coplayers: new Set(),
    hostedPeople: new Set(),
    coopWins: 0,
    newLandTimes: [],
    heavyPlays: 0,
    crownTakeTimes: [],
    maxCrownsHeld: 0,
    titles: new Map(),
  };
}

/** Facts about the wider world that some titles need. */
export type WorldFacts = {
  /** Learners per teacher per game. */
  learnersByGame: (userId: string) => Map<string, number>;
  /** Max spread (all descendants) of any one game from this teacher. */
  maxSpread: (userId: string) => number;
  crownsHeld: (userId: string) => number;
  /** Max confirmed guild quests among guilds this user founded. */
  foundedGuildQuests: (userId: string) => number;
  shelf: (userId: string) => { owned: number; unplayed: number };
};

/** Max number of timestamps inside any window of `days`. */
export function maxInWindow(times: readonly Date[], days: number): number {
  const sorted = times.map((t) => t.getTime()).sort((a, b) => a - b);
  const span = days * 86400000;
  let best = 0;
  let start = 0;
  for (let end = 0; end < sorted.length; end++) {
    while (sorted[end]! - sorted[start]! > span) start++;
    best = Math.max(best, end - start + 1);
  }
  return best;
}

/** Longest run of consecutive week numbers. */
export function longestWeekRun(weeks: ReadonlySet<number>): number {
  const sorted = [...weeks].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const w of sorted) {
    run = prev !== null && w === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

/** Week number (Monday-based) of a YYYY-MM-DD local date. */
export function weekNumber(localDate: string): number {
  const t = Date.parse(`${localDate}T00:00:00Z`);
  // 1970-01-05 was a Monday.
  return Math.floor((t - Date.UTC(1970, 0, 5)) / (7 * 86400000));
}
