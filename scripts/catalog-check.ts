/**
 * pnpm catalog:check — validates data/catalog.json with zod and reports nulls,
 * likely duplicates and the terrain distribution. Exits non-zero on invalid data.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { TERRAINS } from "../game/config";
import { deriveTerrain } from "../game/terrain";
import { catalogSchema, normalizeName } from "../lib/catalog/schema";

const file = path.resolve(__dirname, "../data/catalog.json");
const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
const parsed = catalogSchema.safeParse(raw);
if (!parsed.success) {
  console.error("catalog.json failed validation:");
  for (const issue of parsed.error.issues.slice(0, 50)) console.error(`  [${issue.path.join(".")}] ${issue.message}`);
  process.exit(1);
}
const games = parsed.data;
const base = games.filter((g) => !g.baseGame);
console.log(`Catalog: ${games.length} entries (${base.length} base games, ${games.length - base.length} expansions)\n`);

const fields = ["year", "minPlayers", "maxPlayers", "minTime", "maxTime", "weight", "short"] as const;
console.log("Null fields:");
for (const f of fields) {
  const n = games.filter((g) => g[f] === null).length;
  console.log(`  ${f.padEnd(11)} ${String(n).padStart(4)}  (${Math.round((n / games.length) * 100)}%)`);
}
const noTags = games.filter((g) => g.categories.length === 0 && g.mechanics.length === 0);
console.log(`  no tags at all: ${noTags.length}${noTags.length ? ` (${noTags.map((g) => g.slug).join(", ")})` : ""}`);

// Likely duplicates: same normalized name minus edition words, or an alt name equal to another game's name.
const strip = (n: string) => normalizeName(n.replace(/\b(the|second|2nd|third|3rd|fourth|4th|edition|board game)\b/gi, ""));
const byStripped = new Map<string, string[]>();
for (const g of games) byStripped.set(strip(g.name), [...(byStripped.get(strip(g.name)) ?? []), g.slug]);
const nameIndex = new Map(games.map((g) => [normalizeName(g.name), g.slug]));
const dupes = [...byStripped.values()].filter((v) => v.length > 1);
const altClash = games.flatMap((g) =>
  g.altNames.filter((a) => nameIndex.has(normalizeName(a)) && nameIndex.get(normalizeName(a)) !== g.slug).map((a) => `${g.slug} alt "${a}"`),
);
console.log(`\nLikely duplicates: ${dupes.length ? dupes.map((d) => d.join(" ~ ")).join("; ") : "none"}`);
console.log(`Alt names clashing with another game's name: ${altClash.length ? altClash.join("; ") : "none"}`);

const dist = Object.fromEntries(TERRAINS.map((t) => [t, 0])) as Record<(typeof TERRAINS)[number], number>;
for (const g of base) dist[deriveTerrain(g)]++;
console.log("\nTerrain distribution (base games):");
for (const t of TERRAINS) {
  const n = dist[t];
  console.log(`  ${t.padEnd(7)} ${String(n).padStart(4)}  ${"#".repeat(Math.round((n / base.length) * 60))}`);
}
const scoring = new Map<string, number>();
for (const g of games) scoring.set(g.scoring, (scoring.get(g.scoring) ?? 0) + 1);
console.log(`\nScoring: ${[...scoring].map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log("\nOK");
