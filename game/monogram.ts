/**
 * Monograms: up to ~8 characters of a game's name for small tiles.
 * "Terraforming Mars" -> "T. Mars", "Blood on the Clocktower" -> "BotC",
 * "Telestrations" -> "Telestr.". A catalog `short` or a player's override wins.
 */

export const MONOGRAM_MAX = 8;
const SMALL_WORDS = new Set(["of", "the", "on", "and", "in", "a", "an", "to", "for", "at", "de", "du", "la", "le"]);
const ROMAN = /^(i{1,3}|iv|v|vi{0,3}|ix|x)$/i;

function clip(word: string, max: number): string {
  return word.length <= max ? word : `${word.slice(0, max - 1)}.`;
}

export function autoMonogram(name: string): string {
  let base = name.trim();
  // Drop subtitles and edition notes: "Dune: Imperium" keeps "Dune", "Brass: Birmingham" keeps "Brass".
  const colon = base.indexOf(":");
  if (base.length > MONOGRAM_MAX && colon > 0) base = base.slice(0, colon);
  base = base.replace(/\s*\((.*?)\)\s*/g, " ").trim();
  if (base.length > MONOGRAM_MAX) base = base.replace(/^(the|a|an)\s+/i, "");
  if (base.length <= MONOGRAM_MAX) return base;

  const words = base.split(/[\s\-–]+/).filter(Boolean);
  if (words.length >= 3) {
    const initials = words
      .map((w) => (SMALL_WORDS.has(w.toLowerCase()) ? w[0]!.toLowerCase() : /^\d+$/.test(w) || ROMAN.test(w) ? w.toUpperCase() : w[0]!.toUpperCase()))
      .join("");
    if (initials.length <= MONOGRAM_MAX) return initials;
  }
  if (words.length === 2) {
    const [first, last] = words as [string, string];
    if (last.length <= MONOGRAM_MAX - 3) return `${first[0]!.toUpperCase()}. ${last}`;
    if (first.length <= MONOGRAM_MAX) return first;
  }
  if (words.length >= 2 && words[0]!.length <= MONOGRAM_MAX) return words[0]!;
  return clip(words[0] ?? base, MONOGRAM_MAX);
}

export function monogramFor(name: string, catalogShort?: string | null, override?: string | null): string {
  const pick = override?.trim() || catalogShort?.trim();
  if (pick) return pick.slice(0, 12);
  return autoMonogram(name);
}
