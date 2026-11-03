import { z } from "zod";
import { SCORING_TYPES } from "@/game/config";
import { CATEGORIES, MECHANICS } from "./vocab";

const scoringInput = z.enum(["points", "win-lose", "co-op", "ranked", "teams"]);

/** Maps catalog scoring strings to the database enum. */
export const SCORING_FROM_CATALOG = {
  points: "points",
  "win-lose": "win_lose",
  "co-op": "coop",
  ranked: "ranked",
  teams: "teams",
} as const satisfies Record<z.infer<typeof scoringInput>, (typeof SCORING_TYPES)[number]>;

const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();

export const catalogEntrySchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case").max(80),
    name: z.string().min(1).max(120),
    altNames: z.array(z.string().min(1).max(120)).max(20),
    short: z.string().min(1).max(8).nullable(),
    year: nullableInt(-3000, 2026),
    minPlayers: nullableInt(1, 100),
    maxPlayers: nullableInt(1, 100),
    minTime: nullableInt(1, 6000),
    maxTime: nullableInt(1, 6000),
    weight: z.number().min(1).max(5).nullable(),
    categories: z.array(z.enum(CATEGORIES)).max(12),
    mechanics: z.array(z.enum(MECHANICS)).max(16),
    scoring: scoringInput,
    baseGame: z.string().nullable(),
    /** Optional Wikidata item id, filled by scripts/enrich-wikidata.ts. */
    wikidataId: z.string().regex(/^Q\d+$/).nullable().optional(),
  })
  .strict()
  .superRefine((g, ctx) => {
    if (g.minPlayers !== null && g.maxPlayers !== null && g.minPlayers > g.maxPlayers) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "minPlayers > maxPlayers", path: ["minPlayers"] });
    }
    if (g.minTime !== null && g.maxTime !== null && g.minTime > g.maxTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "minTime > maxTime", path: ["minTime"] });
    }
    if (g.baseGame === g.slug) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "game is its own base", path: ["baseGame"] });
    if (new Set(g.categories).size !== g.categories.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate category", path: ["categories"] });
    if (new Set(g.mechanics).size !== g.mechanics.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate mechanic", path: ["mechanics"] });
  });

export type CatalogEntry = z.infer<typeof catalogEntrySchema>;

export const catalogSchema = z.array(catalogEntrySchema).superRefine((games, ctx) => {
  const slugs = new Map<string, number>();
  const names = new Map<string, number>();
  games.forEach((g, i) => {
    if (slugs.has(g.slug)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate slug ${g.slug}`, path: [i, "slug"] });
    slugs.set(g.slug, i);
    const key = normalizeName(g.name);
    if (names.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate name ${g.name}`, path: [i, "name"] });
    names.set(key, i);
  });
  games.forEach((g, i) => {
    if (g.baseGame && !slugs.has(g.baseGame)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown base game ${g.baseGame}`, path: [i, "baseGame"] });
    }
    const base = g.baseGame ? games[slugs.get(g.baseGame) ?? -1] : undefined;
    if (base?.baseGame) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "expansion of an expansion", path: [i, "baseGame"] });
  });
});

export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

/** Text indexed for fuzzy search: name and alternate names, lower-cased and de-accented. */
export function searchTextFor(name: string, altNames: readonly string[]): string {
  return [name, ...altNames]
    .map((n) => n.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase())
    .join(" | ");
}

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}
