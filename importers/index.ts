/**
 * Entry point for play-history imports: picks the right importer for a file,
 * runs it, and provides the hash used to de-duplicate plays that have no
 * source id.
 */

import { bgStatsImporter } from "./bgstats";
import { bggCsvImporter } from "./bggcsv";
import type { ImportedPlay, Importer, ParseResult } from "./types";

export type { ImportedPlay, ImportedPlayer, Importer, ParseResult } from "./types";
export { bgStatsImporter } from "./bgstats";
export { bggCsvImporter } from "./bggcsv";

/** Every available importer, in detection order. */
export const importers: Importer[] = [bgStatsImporter, bggCsvImporter];

/** How much of the file `detect` gets to look at. */
export const DETECT_HEAD_CHARS = 8192;

/** Why an import file was rejected. */
export type ImportFormatErrorCode = "unrecognized" | "invalid";

/**
 * Thrown by `parseImportFile`. `message` is safe to show to the user as is.
 */
export class ImportFormatError extends Error {
  readonly code: ImportFormatErrorCode;
  /** The importer that was tried, when one matched. */
  readonly importer: Importer["id"] | null;

  constructor(
    message: string,
    code: ImportFormatErrorCode,
    importer: Importer["id"] | null = null,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ImportFormatError";
    this.code = code;
    this.importer = importer;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Lower-cased extension including the dot (".csv"), or "" when there is none. */
function extensionOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

/**
 * Returns the importer that accepts this file, judged by its extension and a
 * sniff of its first few KB (`head`), or null when none does.
 */
export function detectImporter(fileName: string, head: string): Importer | null {
  const extension = extensionOf(fileName);
  return (
    importers.find(
      (importer) => importer.extensions.includes(extension) && importer.detect(fileName, head),
    ) ?? null
  );
}

const SUPPORTED_HINT = "Supported files are the BG Stats JSON export and BoardGameGeek plays CSV.";

/**
 * Detects the format of `text` and parses it.
 *
 * @throws ImportFormatError with code "unrecognized" when no importer accepts
 *   the file, or "invalid" when the matching importer fails to parse it.
 */
export function parseImportFile(
  fileName: string,
  text: string,
): ParseResult & { importer: Importer["id"] } {
  const head = text.replace(/^﻿/, "").slice(0, DETECT_HEAD_CHARS);
  if (head.trim() === "") {
    throw new ImportFormatError(`"${fileName}" is empty.`, "unrecognized");
  }
  const importer = detectImporter(fileName, head);
  if (!importer) {
    throw new ImportFormatError(
      `We couldn't recognize "${fileName}" as a play history export. ${SUPPORTED_HINT}`,
      "unrecognized",
    );
  }
  try {
    const result = importer.parse(text);
    return { ...result, importer: importer.id };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ImportFormatError(
      `"${fileName}" looked like a ${importer.label} file but couldn't be read: ${detail}`,
      "invalid",
      importer.id,
      { cause: error },
    );
  }
}

/** Normalizes a name for hashing: NFC, trimmed, lower case, single spaces. */
function normalizeForHash(value: string): string {
  return value.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
}

/** UTF-8 bytes of a string, without relying on TextEncoder. */
function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

/**
 * 64-bit FNV-1a over UTF-8 bytes, as 16 lower-case hex digits. Uses four
 * 16-bit limbs so it needs neither BigInt nor node:crypto.
 */
export function fnv1a64(value: string): string {
  // Offset basis 0xcbf29ce484222325, least significant limb first.
  let h0 = 0x2325;
  let h1 = 0x8422;
  let h2 = 0x9ce4;
  let h3 = 0xcbf2;
  for (const byte of utf8Bytes(value)) {
    h0 ^= byte;
    // Multiply by the prime 0x100000001b3 = 2^40 + 0x1b3.
    const t0 = h0 * 0x1b3;
    let t1 = h1 * 0x1b3;
    let t2 = h2 * 0x1b3 + (h0 << 8);
    let t3 = h3 * 0x1b3 + (h1 << 8);
    t1 += t0 >>> 16;
    t2 += t1 >>> 16;
    t3 += t2 >>> 16;
    h0 = t0 & 0xffff;
    h1 = t1 & 0xffff;
    h2 = t2 & 0xffff;
    h3 = t3 & 0xffff;
  }
  return [h3, h2, h1, h0].map((limb) => limb.toString(16).padStart(4, "0")).join("");
}

/**
 * Stable identity hash for a play, used to skip re-imports when the source
 * has no play id. Covers the game name, the local date and the set of player
 * names, all case-insensitive; player order, scores and times do not matter.
 */
export function playHash(play: ImportedPlay): string {
  const players = play.players.map((p) => normalizeForHash(p.name)).sort();
  const key = [normalizeForHash(play.gameName), play.localDate, ...players].join("\u001f");
  return fnv1a64(key);
}
