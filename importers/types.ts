/**
 * Play-history importers. Each importer turns a file exported from another
 * play logger into a list of normalized plays. Importers are pure: text in,
 * plays out. Matching games and players to Questboard records happens later.
 */

export type ImportedPlayer = {
  /** Display name as written in the file. */
  name: string;
  /** Stable id of the player inside the source file, when the format has one. */
  sourcePlayerId: string | null;
  /** True when this row is the person who exported the file. */
  isMe: boolean;
  score: number | null;
  /** True when the source marks this player as a winner. */
  winner: boolean;
  /** Finishing position (1 = first) when the source records one. */
  rank: number | null;
  team: string | null;
  /** True when the source marks this as the player's first play of the game. */
  firstPlay: boolean;
  /** Player color/faction text, informational only. */
  color: string | null;
};

export type ImportedPlay = {
  /** The source's play id, used for idempotency. Null when the format has none. */
  sourceId: string | null;
  gameName: string;
  gameYear: number | null;
  /** The source's own game id (e.g. a BGG object id) for matching across files. */
  sourceGameId: string | null;
  /** ISO 8601 timestamp. Date-only sources use 12:00 local time ("YYYY-MM-DDT12:00:00"). */
  playedAt: string;
  /** YYYY-MM-DD in the player's local calendar. */
  localDate: string;
  durationMin: number | null;
  location: string | null;
  cooperative: boolean;
  /** For cooperative plays: did the group win? null when unknown. */
  coopWin: boolean | null;
  /** Play counts as N plays (BGG "quantity"). Always >= 1. */
  quantity: number;
  incomplete: boolean;
  notes: string | null;
  players: ImportedPlayer[];
};

export type ParseResult = {
  plays: ImportedPlay[];
  warnings: string[];
};

export interface Importer {
  id: "bgstats" | "bgg-csv";
  label: string;
  /** File extensions this importer accepts, lower case with dot. */
  extensions: string[];
  /** Cheap sniff on the file name and the first few KB of content. */
  detect(fileName: string, head: string): boolean;
  parse(text: string): ParseResult;
}
