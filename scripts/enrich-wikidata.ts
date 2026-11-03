/**
 * pnpm enrich:wikidata — fill gaps in data/catalog.json from Wikidata (CC0).
 *
 * For catalog entries missing a year, player counts or a Wikidata id, queries
 * the public SPARQL endpoint for board games (Q131436 and subclasses) with a
 * matching English label, and fills ONLY the empty fields (never overwrites).
 * Ambiguous matches (several items with the label and no year to tell them
 * apart) are skipped and reported.
 *
 *   pnpm enrich:wikidata              # update data/catalog.json
 *   pnpm enrich:wikidata --dry-run    # print what would change
 *   pnpm enrich:wikidata --limit 50   # only look at the first 50 candidates
 *
 * Needs network access to query.wikidata.org. Never run in tests or CI; the
 * app does not depend on it. Re-run `pnpm catalog:check` and `pnpm catalog:sync` after.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { catalogSchema, type CatalogEntry } from "../lib/catalog/schema";

const ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "QuestboardCatalogEnricher/1.0 (open-source board game catalog maintenance)";
const BATCH = 40;
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

type Row = { item: string; label: string; year: number | null; min: number | null; max: number | null };

const sparqlString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"@en`;

async function query(labels: string[]): Promise<Row[]> {
  const q = `SELECT ?item ?label (MIN(YEAR(?date)) AS ?year) (MIN(?mn) AS ?min) (MAX(?mx) AS ?max) WHERE {
    VALUES ?label { ${labels.map(sparqlString).join(" ")} }
    ?item rdfs:label ?label ; wdt:P31/wdt:P279* wd:Q131436 .
    OPTIONAL { ?item wdt:P577 ?date }
    OPTIONAL { ?item wdt:P1872 ?mn }
    OPTIONAL { ?item wdt:P1873 ?mx }
  } GROUP BY ?item ?label`;
  const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(q)}&format=json`, { headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Wikidata returned ${res.status}`);
  const json = (await res.json()) as { results: { bindings: Record<string, { value: string }>[] } };
  const num = (v?: { value: string }) => (v ? Number(v.value) : null);
  return json.results.bindings.map((b) => ({
    item: b.item!.value.split("/").pop()!,
    label: b.label!.value,
    year: num(b.year),
    min: num(b.min),
    max: num(b.max),
  }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const file = path.resolve(__dirname, "../data/catalog.json");
  const games = catalogSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const candidates = games.filter((g) => !g.wikidataId || g.year === null || g.minPlayers === null || g.maxPlayers === null).slice(0, limit);
  console.log(`[wikidata] ${candidates.length} entries with gaps`);
  let changed = 0;
  const ambiguous: string[] = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const rows = await query(batch.map((g) => g.name));
    for (const g of batch) {
      const matches = rows.filter((r) => r.label === g.name);
      const pick: Row | undefined = matches.length === 1 ? matches[0] : matches.find((r) => g.year !== null && r.year === g.year);
      if (!pick) {
        if (matches.length > 1) ambiguous.push(g.name);
        continue;
      }
      const before = JSON.stringify(g);
      const e = g as CatalogEntry;
      e.wikidataId ??= pick.item;
      if (e.year === null && pick.year && pick.year > 1800 && pick.year <= new Date().getFullYear()) e.year = pick.year;
      if (e.minPlayers === null && pick.min && pick.min > 0 && pick.min < 100) e.minPlayers = pick.min;
      if (e.maxPlayers === null && pick.max && pick.max > 0 && pick.max < 100 && pick.max >= (e.minPlayers ?? 1)) e.maxPlayers = pick.max;
      if (JSON.stringify(e) !== before) {
        changed++;
        console.log(`  ${g.slug}: ${before === JSON.stringify(e) ? "" : `${pick.item}${pick.year ? ` ${pick.year}` : ""}${pick.min ? ` ${pick.min}-${pick.max ?? "?"}p` : ""}`}`);
      }
    }
    await sleep(1100); // be polite to the public endpoint
  }
  catalogSchema.parse(games);
  if (!dryRun && changed) writeFileSync(file, `${JSON.stringify(games, null, 1)}\n`);
  console.log(`[wikidata] ${changed} entries ${dryRun ? "would change" : "updated"}; ${ambiguous.length} ambiguous: ${ambiguous.slice(0, 20).join(", ")}`);
}

main().catch((e) => {
  console.error(`[wikidata] ${e instanceof Error ? e.message : e}`);
  console.error("Is query.wikidata.org reachable from this machine? The app does not need this script to run.");
  process.exit(1);
});
