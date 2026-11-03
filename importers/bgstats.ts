/**
 * Importer for the BG Stats app "Export data" JSON file.
 *
 * The export is one JSON object holding lookup tables (`players`, `games`,
 * `locations`) and a `plays` list whose rows point into those tables by
 * numeric id (`gameRefId`, `locationRefId`, `playerScores[].playerRefId`).
 * The exporting user is identified by `userInfo.meRefId`.
 *
 * Validation is deliberately lenient: unknown fields are kept (passthrough),
 * almost every field is optional, and a malformed row is skipped with a
 * warning instead of failing the whole file. Only a file that is not JSON or
 * has no `plays`/`games` arrays at all is rejected.
 */

import { z } from "zod";
import type { ImportedPlay, ImportedPlayer, Importer, ParseResult } from "./types";

/** BG Stats ids are numbers, but tolerate stringified ids. */
const refIdSchema = z.union([z.number(), z.string()]);

const looseString = z.string().nullable().optional();
const looseNumber = z.number().nullable().optional();
const looseBoolean = z.boolean().nullable().optional();

const playerSchema = z
  .object({
    id: refIdSchema,
    name: looseString,
    isAnonymous: looseBoolean,
    uuid: looseString,
    bggUsername: looseString,
  })
  .passthrough();

const locationSchema = z
  .object({
    id: refIdSchema,
    name: looseString,
  })
  .passthrough();

const gameSchema = z
  .object({
    id: refIdSchema,
    name: looseString,
    bggId: z.union([z.number(), z.string()]).nullable().optional(),
    bggYear: z.union([z.number(), z.string()]).nullable().optional(),
    cooperative: looseBoolean,
    highestWins: looseBoolean,
    noPoints: looseBoolean,
    uuid: looseString,
  })
  .passthrough();

const playerScoreSchema = z
  .object({
    playerRefId: refIdSchema,
    score: z.union([z.string(), z.number()]).nullable().optional(),
    winner: looseBoolean,
    newPlayer: looseBoolean,
    startPlayer: looseBoolean,
    rank: z.union([z.number(), z.string()]).nullable().optional(),
    team: looseString,
    role: looseString,
  })
  .passthrough();

const playSchema = z
  .object({
    uuid: looseString,
    gameRefId: refIdSchema,
    locationRefId: refIdSchema.nullable().optional(),
    playDate: z.string(),
    durationMin: z.union([z.number(), z.string()]).nullable().optional(),
    ignored: looseBoolean,
    manualWinner: looseBoolean,
    rounds: looseNumber,
    board: looseString,
    comments: looseString,
    usesTeams: looseBoolean,
    playerScores: z.array(z.unknown()).nullable().optional(),
  })
  .passthrough();

/** Outer shape only; rows are validated one by one so a bad row is skippable. */
const exportSchema = z
  .object({
    userInfo: z
      .object({ meRefId: refIdSchema.nullable().optional() })
      .passthrough()
      .nullable()
      .optional(),
    players: z.array(z.unknown()).nullable().optional(),
    locations: z.array(z.unknown()).nullable().optional(),
    games: z.array(z.unknown()),
    plays: z.array(z.unknown()),
  })
  .passthrough();

type BgsPlayer = z.infer<typeof playerSchema>;
type BgsLocation = z.infer<typeof locationSchema>;
type BgsGame = z.infer<typeof gameSchema>;
type BgsPlayerScore = z.infer<typeof playerScoreSchema>;
type BgsPlay = z.infer<typeof playSchema>;

/** Lookup tables keyed by the stringified BG Stats ref id. */
type Lookups = {
  players: Map<string, BgsPlayer>;
  locations: Map<string, BgsLocation>;
  games: Map<string, BgsGame>;
  meRefId: string | null;
};

/** Strings that only appear in BG Stats exports, used by `detect`. */
const DETECT_MARKERS = ['"playerScores"', '"gameRefId"', '"playerRefId"', '"meRefId"'];

const refKey = (id: string | number): string => String(id).trim();

/** Trimmed non-empty string, or null. */
function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Parses a number from a JSON number or numeric string; null when blank or not finite. */
export function parseLooseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Positive integer or null (BG Stats uses 0 for "not set"). */
function positiveInt(value: unknown): number | null {
  const n = parseLooseNumber(value);
  if (n === null || n <= 0) return null;
  return Math.round(n);
}

/**
 * Splits a BG Stats `playDate` ("2023-01-05 20:15:00", also tolerating a "T"
 * separator, missing seconds, or a bare date) into the normalized fields.
 * Returns null when the date is not a real calendar date.
 */
export function parseBgStatsDate(raw: string): { localDate: string; playedAt: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(raw.trim());
  if (!match) return null;
  const [, y, m, d, hh, mm, ss] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  const localDate = `${y}-${m}-${d}`;
  if (hh === undefined || mm === undefined) {
    return { localDate, playedAt: `${localDate}T12:00:00` };
  }
  const hour = Number(hh);
  const minute = Number(mm);
  const second = ss === undefined ? 0 : Number(ss);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { localDate, playedAt: `${localDate}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}` };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * Validates each element of `rows` with `schema`, keeping the ones that pass
 * and counting the ones that don't.
 */
function validateRows<T>(
  rows: readonly unknown[] | null | undefined,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): { valid: T[]; invalid: number } {
  const valid: T[] = [];
  let invalid = 0;
  for (const row of rows ?? []) {
    const result = schema.safeParse(row);
    if (result.success) valid.push(result.data);
    else invalid += 1;
  }
  return { valid, invalid };
}

function indexById<T extends { id: string | number }>(rows: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) map.set(refKey(row.id), row);
  return map;
}

/** BGG id as a string when positive, otherwise the BG Stats game uuid. */
function sourceGameIdFor(game: BgsGame): string | null {
  const bggId = positiveInt(game.bggId);
  if (bggId !== null) return String(bggId);
  return cleanText(game.uuid);
}

function mapPlayerScore(score: BgsPlayerScore, lookups: Lookups): ImportedPlayer {
  const key = refKey(score.playerRefId);
  const player = lookups.players.get(key);
  const sourcePlayerId = cleanText(player?.uuid) ?? key;
  return {
    name: cleanText(player?.name) ?? `Unknown player ${key}`,
    sourcePlayerId,
    isMe: lookups.meRefId !== null && key === lookups.meRefId,
    score: parseLooseNumber(score.score),
    winner: score.winner === true,
    rank: positiveInt(score.rank),
    team: cleanText(score.team),
    firstPlay: score.newPlayer === true,
    color: cleanText(score.role),
  };
}

/** Maps one validated play; returns a warning string instead when it cannot be imported. */
function mapPlay(play: BgsPlay, index: number, lookups: Lookups): ImportedPlay | string {
  const label = cleanText(play.uuid) ?? `#${index + 1}`;
  const game = lookups.games.get(refKey(play.gameRefId));
  const gameName = cleanText(game?.name);
  if (!game || gameName === null) {
    return `Play ${label}: references unknown game ${refKey(play.gameRefId)}; skipped.`;
  }
  const date = parseBgStatsDate(play.playDate);
  if (!date) return `Play ${label}: unreadable date "${play.playDate}"; skipped.`;

  const scores = validateRows(play.playerScores, playerScoreSchema);
  const players = scores.valid.map((s) => mapPlayerScore(s, lookups));
  const cooperative = game.cooperative === true;
  const location =
    play.locationRefId === null || play.locationRefId === undefined
      ? null
      : cleanText(lookups.locations.get(refKey(play.locationRefId))?.name);

  return {
    sourceId: cleanText(play.uuid),
    gameName,
    gameYear: positiveInt(game.bggYear),
    sourceGameId: sourceGameIdFor(game),
    playedAt: date.playedAt,
    localDate: date.localDate,
    durationMin: positiveInt(play.durationMin),
    location,
    cooperative,
    coopWin: cooperative ? players.some((p) => p.winner) : null,
    quantity: 1,
    incomplete: false,
    notes: cleanText(play.comments),
    players,
  };
}

function buildLookups(data: z.infer<typeof exportSchema>, warnings: string[]): Lookups {
  const players = validateRows(data.players, playerSchema);
  const locations = validateRows(data.locations, locationSchema);
  const games = validateRows(data.games, gameSchema);
  if (players.invalid > 0) warnings.push(`Skipped ${players.invalid} malformed player entries.`);
  if (locations.invalid > 0) warnings.push(`Skipped ${locations.invalid} malformed location entries.`);
  if (games.invalid > 0) warnings.push(`Skipped ${games.invalid} malformed game entries.`);
  const me = data.userInfo?.meRefId;
  return {
    players: indexById(players.valid),
    locations: indexById(locations.valid),
    games: indexById(games.valid),
    meRefId: me === null || me === undefined ? null : refKey(me),
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new Error("This file is not valid JSON, so it can't be a BG Stats export.");
  }
}

/** Parses a full BG Stats export. Throws when the file is not a BG Stats export at all. */
export function parseBgStats(text: string): ParseResult {
  const outer = exportSchema.safeParse(parseJson(text));
  if (!outer.success) {
    throw new Error(
      'This JSON file doesn\'t look like a BG Stats export (expected "games" and "plays" lists).',
    );
  }
  const warnings: string[] = [];
  const lookups = buildLookups(outer.data, warnings);
  const plays: ImportedPlay[] = [];
  let ignored = 0;
  let malformed = 0;

  outer.data.plays.forEach((raw, index) => {
    const parsed = playSchema.safeParse(raw);
    if (!parsed.success) {
      malformed += 1;
      return;
    }
    if (parsed.data.ignored === true) {
      ignored += 1;
      return;
    }
    const mapped = mapPlay(parsed.data, index, lookups);
    if (typeof mapped === "string") warnings.push(mapped);
    else plays.push(mapped);
  });

  if (ignored > 0) {
    warnings.push(`Skipped ${ignored} ${ignored === 1 ? "play" : "plays"} marked as ignored in BG Stats.`);
  }
  if (malformed > 0) {
    warnings.push(`Skipped ${malformed} malformed ${malformed === 1 ? "play" : "plays"}.`);
  }
  return { plays, warnings };
}

/** Importer for BG Stats "Export data" JSON files. */
export const bgStatsImporter: Importer = {
  id: "bgstats",
  label: "BG Stats (JSON export)",
  extensions: [".json"],
  detect(fileName: string, head: string): boolean {
    if (!fileName.toLowerCase().endsWith(".json")) return false;
    if (DETECT_MARKERS.some((marker) => head.includes(marker))) return true;
    return head.includes('"plays"') && head.includes('"games"');
  },
  parse: parseBgStats,
};
