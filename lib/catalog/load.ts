import { readFileSync } from "node:fs";
import path from "node:path";
import { deriveTerrain } from "@/game/terrain";
import { catalogSchema, SCORING_FROM_CATALOG, searchTextFor, type CatalogEntry } from "./schema";

export type LoadedCatalog = { entries: CatalogEntry[] };

export function catalogPath(): string {
  return path.join(process.cwd(), "data", "catalog.json");
}

/** Reads and validates data/catalog.json. Throws a readable error on invalid data. */
export function loadCatalog(file = catalogPath()): CatalogEntry[] {
  const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
  const parsed = catalogSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 20).map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`data/catalog.json is invalid:\n${issues.join("\n")}`);
  }
  return parsed.data;
}

/** Maps a catalog entry to Game columns (without the base game id). */
export function toGameRow(e: CatalogEntry) {
  return {
    slug: e.slug,
    name: e.name,
    altNames: e.altNames,
    short: e.short,
    year: e.year,
    minPlayers: e.minPlayers,
    maxPlayers: e.maxPlayers,
    minTime: e.minTime,
    maxTime: e.maxTime,
    weight: e.weight,
    categories: e.categories,
    mechanics: e.mechanics,
    scoring: SCORING_FROM_CATALOG[e.scoring],
    terrain: deriveTerrain({ categories: e.categories, mechanics: e.mechanics, maxPlayers: e.maxPlayers }),
    searchText: searchTextFor(e.name, e.altNames),
    wikidataId: e.wikidataId ?? null,
  };
}
