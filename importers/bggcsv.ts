/**
 * Importer for BoardGameGeek play logs exported as CSV.
 *
 * There is no single canonical "BGG plays CSV": the site's own export, the
 * various third-party tools, and hand-made spreadsheets all differ. So this
 * importer is header-driven. Headers are matched case-insensitively after
 * removing everything that is not a letter or digit ("Play ID", "play_id"
 * and "playid" are the same column), with the aliases listed in
 * `COLUMN_ALIASES`.
 *
 * Players may be given in either of two layouts (both are supported, and if a
 * file somehow has both, the repeated columns win):
 *
 * (a) One `players` column, see `parseCompactPlayers` for the grammar.
 * (b) Repeated columns `player1name`, `player1score`, `player1win`,
 *     `player1new`, `player1color`, `player1username` ... `playerNname`
 *     (also `player_1_name`, `Player 1 Name`, etc.).
 *
 * CSV carries no cooperative flag, so `cooperative` is always false and
 * `coopWin` null; matching against the game catalog can fix that later.
 */

import type { ImportedPlay, ImportedPlayer, Importer, ParseResult } from "./types";

// ---------------------------------------------------------------------------
// RFC 4180 CSV parsing
// ---------------------------------------------------------------------------

/** Result of `parseCsv`. */
export type CsvParseResult = {
  rows: string[][];
  /** True when the input ended inside a quoted field (the field is kept as read). */
  unterminatedQuote: boolean;
};

/**
 * Parses CSV text per RFC 4180, with the usual real-world leniency:
 * - a leading UTF-8 BOM is dropped;
 * - records may end in CRLF, LF or a lone CR;
 * - quoted fields may contain commas, line breaks (normalized to "\n") and
 *   doubled quotes (`""` -> `"`);
 * - a quote in the middle of an unquoted field is kept literally, and text
 *   after a closing quote is appended to the field;
 * - blank lines are skipped.
 */
export function parseCsv(text: string, delimiter = ","): CsvParseResult {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;
  let i = 0;

  const endField = (): void => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const endRow = (): void => {
    endField();
    const blank = row.length === 1 && row[0] === "";
    if (!blank) rows.push(row);
    row = [];
  };

  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      if (ch === "\r") {
        field += "\n";
        i += input[i + 1] === "\n" ? 2 : 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      endField();
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      endRow();
      i += ch === "\r" && input[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += ch;
    fieldStarted = true;
    i += 1;
  }
  if (fieldStarted || field !== "" || row.length > 0) endRow();
  return { rows, unterminatedQuote: inQuotes };
}

// ---------------------------------------------------------------------------
// Header mapping
// ---------------------------------------------------------------------------

/** Lower-cases and strips everything but letters and digits. */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type ColumnKey =
  | "playId"
  | "gameName"
  | "gameId"
  | "date"
  | "quantity"
  | "length"
  | "incomplete"
  | "location"
  | "comments"
  | "year"
  | "players"
  | "username"
  | "me";

/** Accepted (normalized) header names per column, in priority order. */
const COLUMN_ALIASES: Record<ColumnKey, readonly string[]> = {
  playId: ["playid", "id"],
  gameName: ["objectname", "gamename", "game", "name"],
  gameId: ["objectid", "gameid", "bggid"],
  date: ["date", "playdate"],
  quantity: ["quantity", "qty"],
  length: ["length", "duration", "durationmin", "durationminutes", "lengthmin", "lengthminutes"],
  incomplete: ["incomplete"],
  location: ["location"],
  comments: ["comments", "comment", "notes"],
  year: ["yearpublished", "year"],
  players: ["players"],
  username: ["username"],
  me: ["me", "meusername", "myusername"],
};

type PlayerField = "name" | "username" | "userid" | "score" | "win" | "new" | "color" | "team" | "rank";

/** Suffixes accepted after `playerN` in layout (b). */
const PLAYER_FIELD_ALIASES: Record<string, PlayerField> = {
  name: "name",
  username: "username",
  userid: "userid",
  score: "score",
  win: "win",
  winner: "win",
  won: "win",
  new: "new",
  firstplay: "new",
  color: "color",
  colour: "color",
  team: "team",
  rank: "rank",
  position: "rank",
};

const PLAYER_COLUMN = /^player(\d+)([a-z]+)$/;

type ColumnMap = {
  columns: Partial<Record<ColumnKey, number>>;
  /** Player slot number -> field -> column index. Slots are sorted ascending. */
  playerSlots: Array<Partial<Record<PlayerField, number>>>;
};

/** Resolves header cells to column indexes. Returns null unless both a game-name and a date column exist. */
export function mapHeaders(headers: readonly string[]): ColumnMap | null {
  const normalized = headers.map(normalizeHeader);
  const columns: Partial<Record<ColumnKey, number>> = {};
  for (const key of Object.keys(COLUMN_ALIASES) as ColumnKey[]) {
    for (const alias of COLUMN_ALIASES[key]) {
      const index = normalized.indexOf(alias);
      if (index !== -1) {
        columns[key] = index;
        break;
      }
    }
  }
  if (columns.gameName === undefined || columns.date === undefined) return null;

  const slots = new Map<number, Partial<Record<PlayerField, number>>>();
  normalized.forEach((header, index) => {
    const match = PLAYER_COLUMN.exec(header);
    if (!match) return;
    const field = PLAYER_FIELD_ALIASES[match[2] ?? ""];
    if (field === undefined) return;
    const slotNumber = Number(match[1]);
    const slot = slots.get(slotNumber) ?? {};
    if (slot[field] === undefined) slot[field] = index;
    slots.set(slotNumber, slot);
  });
  const playerSlots = [...slots.entries()].sort((a, b) => a[0] - b[0]).map(([, slot]) => slot);
  return { columns, playerSlots };
}

// ---------------------------------------------------------------------------
// Field parsing
// ---------------------------------------------------------------------------

/** Trimmed non-empty string, or null. */
function cleanText(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Number or null when blank / not numeric. Accepts a decimal comma ("12,5"). */
export function parseScore(value: string | undefined): number | null {
  const text = cleanText(value);
  if (text === null) return null;
  const n = Number(/^-?\d+,\d+$/.test(text) ? text.replace(",", ".") : text);
  return Number.isFinite(n) ? n : null;
}

const TRUE_WORDS = new Set(["1", "true", "yes", "y", "w", "win", "winner", "x"]);

/** Truthy flag cells: 1, true, yes, y, w, win, winner, x (case-insensitive). */
export function parseFlag(value: string | undefined): boolean {
  const text = cleanText(value);
  return text !== null && TRUE_WORDS.has(text.toLowerCase());
}

function positiveInt(value: string | undefined): number | null {
  const n = parseScore(value);
  if (n === null || n <= 0) return null;
  return Math.round(n);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * Parses a play date. Accepted forms:
 * - `YYYY-MM-DD` (also `YYYY/MM/DD`, single-digit month/day allowed);
 * - `M/D/YYYY` (US order, as written by US-locale spreadsheets; also `M-D-YYYY`);
 * - either form optionally followed by a time `HH:MM` or `HH:MM:SS`
 *   (separated by a space or "T").
 * Date-only values get 12:00 local time. Returns null for impossible dates.
 */
export function parseCsvDate(value: string | undefined): { localDate: string; playedAt: string } | null {
  const text = cleanText(value);
  if (text === null) return null;
  const time = /(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const iso = new RegExp(`^(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})${time.source}`).exec(text);
  const us = iso ? null : new RegExp(`^(\\d{1,2})[/-](\\d{1,2})[/-](\\d{4})${time.source}`).exec(text);
  let year: number;
  let month: number;
  let day: number;
  let rest: Array<string | undefined>;
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
    rest = iso.slice(4);
  } else if (us) {
    month = Number(us[1]);
    day = Number(us[2]);
    year = Number(us[3]);
    rest = us.slice(4);
  } else {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  const localDate = `${year}-${pad2(month)}-${pad2(day)}`;
  const [hh, mm, ss] = rest;
  if (hh === undefined || mm === undefined) return { localDate, playedAt: `${localDate}T12:00:00` };
  const hour = Number(hh);
  const minute = Number(mm);
  const second = ss === undefined ? 0 : Number(ss);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { localDate, playedAt: `${localDate}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}` };
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

/** Usernames that identify the exporter on this row (lower-cased). */
type MeContext = { usernames: Set<string> };

const ME_MARKER = /\s*\(me\)\s*/i;

/** Removes a "(me)" marker from a name; reports whether one was present. */
function stripMeMarker(name: string): { name: string; isMe: boolean } {
  if (!ME_MARKER.test(name)) return { name: name.trim(), isMe: false };
  return { name: name.replace(ME_MARKER, " ").replace(/\s+/g, " ").trim(), isMe: true };
}

function makePlayer(
  rawName: string | null,
  fields: {
    username?: string | null;
    userid?: string | null;
    score?: number | null;
    winner?: boolean;
    firstPlay?: boolean;
    color?: string | null;
    team?: string | null;
    rank?: number | null;
  },
  me: MeContext,
): ImportedPlayer | null {
  const username = fields.username ?? null;
  const marked = stripMeMarker(rawName ?? "");
  const name = marked.name !== "" ? marked.name : username;
  if (name === null || name === "") return null;
  const usernameIsMe = username !== null && me.usernames.has(username.toLowerCase());
  const userid = fields.userid ?? null;
  return {
    name,
    sourcePlayerId: userid !== null && userid !== "0" ? userid : username,
    isMe: marked.isMe || usernameIsMe,
    score: fields.score ?? null,
    winner: fields.winner ?? false,
    rank: fields.rank ?? null,
    team: fields.team ?? null,
    firstPlay: fields.firstPlay ?? false,
    color: fields.color ?? null,
  };
}

const WIN_TOKENS = new Set(["w", "win", "winner", "won", "(w)", "(win)", "*"]);
const NEW_TOKENS = new Set(["new", "(new)", "n"]);
const NUMBER_TOKEN = /^-?\d+(?:[.,]\d+)?$/;

/** Parses one free-text entry of the compact layout, e.g. `Ciao (me) [blue] 45 W new`. */
function parseFreeTextEntry(entry: string, me: MeContext): ImportedPlayer | null {
  let color: string | null = null;
  const withoutColor = entry.replace(/\[([^\]]*)\]/, (_m, c: string) => {
    color = cleanText(c);
    return " ";
  });
  const tokens = withoutColor.trim().split(/\s+/).filter((t) => t !== "");
  let winner = false;
  let firstPlay = false;
  let score: number | null = null;
  // Peel flags and one score off the end, always leaving at least one name token.
  while (tokens.length > 1) {
    const last = (tokens[tokens.length - 1] ?? "").toLowerCase();
    if (WIN_TOKENS.has(last)) winner = true;
    else if (NEW_TOKENS.has(last)) firstPlay = true;
    else if (score === null && NUMBER_TOKEN.test(last)) score = parseScore(last);
    else break;
    tokens.pop();
  }
  return makePlayer(tokens.join(" "), { score, winner, firstPlay, color }, me);
}

/** Parses one pipe entry of the compact layout: `name|score|win|new|color|username`. */
function parsePipeEntry(entry: string, me: MeContext): ImportedPlayer | null {
  const [name, score, win, isNew, color, username] = entry.split("|").map((p) => p.trim());
  return makePlayer(
    cleanText(name),
    {
      score: parseScore(score),
      winner: parseFlag(win),
      firstPlay: parseFlag(isNew),
      color: cleanText(color),
      username: cleanText(username),
    },
    me,
  );
}

/**
 * Parses the single `players` column (layout (a)).
 *
 * Grammar (whitespace around every token is ignored):
 *
 *     players   := entry ( (";" | newline) entry )*        empty entries are skipped
 *     entry     := pipeEntry | textEntry                   an entry containing "|" is a pipeEntry
 *     pipeEntry := name "|" [score] [ "|" [win] [ "|" [new] [ "|" [color] [ "|" [username] ]]]]
 *                  win / new: 1, true, yes, y, w, win, winner, x  => true; anything else false
 *     textEntry := name [ "(me)" ] [ "[" color "]" ] [ score ] { flag }
 *     score     := optional "-", digits, optional "." or "," decimals   (e.g. 45, -3, 12.5)
 *     flag      := "W" | "win" | "winner" | "won" | "(W)" | "*"        => winner
 *                | "new" | "(new)" | "N"                               => first play
 *
 * In a textEntry, the score and flags are read right to left from the end of
 * the entry, in any order, and the remaining text is the name (at least one
 * word always stays the name). So a name that itself ends in a number, like
 * "Player 2", must be followed by a score or it will be read as "Player"
 * scoring 2. "(me)" may appear anywhere in either kind of entry's name and
 * marks the exporter. Examples:
 *
 *     Ciao (me) 45 W; Priya 41; Ravi 38
 *     Ciao|45|1;Priya|41|0
 *     Ana [red] 12 new; Ben (me) 15 W
 */
export function parseCompactPlayers(cell: string, me: MeContext = { usernames: new Set() }): ImportedPlayer[] {
  const players: ImportedPlayer[] = [];
  for (const raw of cell.split(/[;\n]/)) {
    const entry = raw.trim();
    if (entry === "") continue;
    const player = entry.includes("|") ? parsePipeEntry(entry, me) : parseFreeTextEntry(entry, me);
    if (player) players.push(player);
  }
  return players;
}

/** Reads layout (b): repeated `playerN*` columns. */
function readPlayerSlots(row: readonly string[], map: ColumnMap, me: MeContext): ImportedPlayer[] {
  const players: ImportedPlayer[] = [];
  for (const slot of map.playerSlots) {
    const cell = (field: PlayerField): string | undefined => {
      const index = slot[field];
      return index === undefined ? undefined : row[index];
    };
    const player = makePlayer(
      cleanText(cell("name")),
      {
        username: cleanText(cell("username")),
        userid: cleanText(cell("userid")),
        score: parseScore(cell("score")),
        winner: parseFlag(cell("win")),
        firstPlay: parseFlag(cell("new")),
        color: cleanText(cell("color")),
        team: cleanText(cell("team")),
        rank: positiveInt(cell("rank")),
      },
      me,
    );
    if (player) players.push(player);
  }
  return players;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** How many leading rows may precede the header (titles, export notes). */
const HEADER_SEARCH_ROWS = 10;

function findHeader(rows: readonly string[][]): { index: number; map: ColumnMap } | null {
  const limit = Math.min(rows.length, HEADER_SEARCH_ROWS);
  for (let index = 0; index < limit; index += 1) {
    const map = mapHeaders(rows[index] ?? []);
    if (map) return { index, map };
  }
  return null;
}

function meContextFor(row: readonly string[], map: ColumnMap): MeContext {
  const usernames = new Set<string>();
  for (const key of ["username", "me"] as const) {
    const index = map.columns[key];
    const value = index === undefined ? null : cleanText(row[index]);
    if (value !== null) usernames.add(value.toLowerCase());
  }
  return { usernames };
}

/** Maps one data row; returns a warning string instead when the row is skipped. */
function mapRow(row: readonly string[], lineLabel: string, map: ColumnMap): ImportedPlay | string {
  const get = (key: ColumnKey): string | undefined => {
    const index = map.columns[key];
    return index === undefined ? undefined : row[index];
  };
  const gameName = cleanText(get("gameName"));
  if (gameName === null) return `${lineLabel}: no game name; skipped.`;
  const rawDate = cleanText(get("date"));
  const date = parseCsvDate(rawDate ?? undefined);
  if (!date) {
    return rawDate === null
      ? `${lineLabel} (${gameName}): no date; skipped.`
      : `${lineLabel} (${gameName}): unreadable date "${rawDate}"; skipped.`;
  }
  const me = meContextFor(row, map);
  const players =
    map.playerSlots.length > 0
      ? readPlayerSlots(row, map, me)
      : parseCompactPlayers(get("players") ?? "", me);
  const playId = cleanText(get("playId"));
  const gameId = cleanText(get("gameId"));

  return {
    sourceId: playId !== null && playId !== "0" ? playId : null,
    gameName,
    gameYear: positiveInt(get("year")),
    sourceGameId: gameId !== null && gameId !== "0" ? gameId : null,
    playedAt: date.playedAt,
    localDate: date.localDate,
    durationMin: positiveInt(get("length")),
    location: cleanText(get("location")),
    cooperative: false,
    coopWin: null,
    quantity: positiveInt(get("quantity")) ?? 1,
    incomplete: parseFlag(get("incomplete")),
    notes: cleanText(get("comments")),
    players,
  };
}

/** Parses a BGG plays CSV. Throws when no header row with game-name and date columns is found. */
export function parseBggCsv(text: string): ParseResult {
  const { rows, unterminatedQuote } = parseCsv(text);
  const header = findHeader(rows);
  if (!header) {
    throw new Error(
      'This CSV has no recognizable header row. Expected a game column (such as "objectname", "game" or "name") and a "date" column.',
    );
  }
  const warnings: string[] = [];
  if (unterminatedQuote) {
    warnings.push("The file ends inside a quoted field; the last row may be incomplete.");
  }
  const plays: ImportedPlay[] = [];
  for (let index = header.index + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (row.every((cell) => cell.trim() === "")) continue;
    // Record numbers count the header as record 1 (lines can differ when fields contain newlines).
    const mapped = mapRow(row, `Row ${index + 1}`, header.map);
    if (typeof mapped === "string") warnings.push(mapped);
    else plays.push(mapped);
  }
  return { plays, warnings };
}

/** Importer for BoardGameGeek plays CSV files (either player layout). */
export const bggCsvImporter: Importer = {
  id: "bgg-csv",
  label: "BoardGameGeek plays (CSV)",
  extensions: [".csv"],
  detect(fileName: string, head: string): boolean {
    if (!fileName.toLowerCase().endsWith(".csv")) return false;
    // Drop a possibly truncated last line before sniffing.
    const lastBreak = Math.max(head.lastIndexOf("\n"), head.lastIndexOf("\r"));
    const complete = lastBreak > 0 ? head.slice(0, lastBreak) : head;
    return findHeader(parseCsv(complete).rows) !== null;
  },
  parse: parseBggCsv,
};
