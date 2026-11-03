import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TERRAINS } from "@/game/config";
import { deriveTerrain } from "@/game/terrain";
import { catalogEntrySchema, catalogSchema, normalizeName, searchTextFor, slugify } from "@/lib/catalog/schema";
import { toGameRow } from "@/lib/catalog/load";

const raw: unknown = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/catalog.json"), "utf8"));

describe("data/catalog.json", () => {
  const parsed = catalogSchema.safeParse(raw);
  it("validates against the zod schema", () => {
    if (!parsed.success) throw new Error(parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
    expect(parsed.success).toBe(true);
  });
  const games = parsed.success ? parsed.data : [];
  it("has about 500 games", () => {
    expect(games.length).toBeGreaterThanOrEqual(480);
  });
  it("covers every terrain with a healthy number of base games", () => {
    const counts = Object.fromEntries(TERRAINS.map((t) => [t, 0]));
    for (const g of games.filter((x) => !x.baseGame)) counts[deriveTerrain(g)]!++;
    for (const t of TERRAINS) expect(counts[t]).toBeGreaterThanOrEqual(15);
  });
  it("includes well-known games with the right terrain", () => {
    const bySlug = new Map(games.map((g) => [g.slug, g]));
    const t = (slug: string) => deriveTerrain(bySlug.get(slug)!);
    expect(t("wingspan")).toBe("forest");
    expect(t("pandemic")).toBe("meadow");
    expect(t("codenames")).not.toBe("forest");
    expect(t("hive")).toBe("tundra");
    expect(t("blood-on-the-clocktower")).toBe("marsh");
    expect(t("twilight-imperium-fourth-edition")).toBe("peaks");
  });
  it("links expansions to base games in the catalog", () => {
    const slugs = new Set(games.map((g) => g.slug));
    for (const g of games.filter((x) => x.baseGame)) expect(slugs.has(g.baseGame!)).toBe(true);
  });
});

describe("catalog schema", () => {
  const ok = { slug: "test-game", name: "Test Game", altNames: [], short: null, year: 2020, minPlayers: 1, maxPlayers: 4, minTime: 30, maxTime: 60, weight: 2.1, categories: ["Economic"], mechanics: ["Engine Building"], scoring: "points", baseGame: null };
  it("accepts a valid entry", () => expect(catalogEntrySchema.safeParse(ok).success).toBe(true));
  it.each([
    ["bad slug", { ...ok, slug: "Test Game" }],
    ["unknown category", { ...ok, categories: ["Cooperative Game"] }],
    ["unknown mechanic", { ...ok, mechanics: ["Deduction"] }],
    ["min > max players", { ...ok, minPlayers: 5, maxPlayers: 2 }],
    ["weight out of range", { ...ok, weight: 6 }],
    ["unknown scoring", { ...ok, scoring: "highest" }],
    ["extra field", { ...ok, bgg: 123 }],
    ["short too long", { ...ok, short: "Too long name" }],
  ])("rejects %s", (_n, entry) => expect(catalogEntrySchema.safeParse(entry).success).toBe(false));
  it("rejects duplicate slugs and names, and unknown base games", () => {
    expect(catalogSchema.safeParse([ok, ok]).success).toBe(false);
    expect(catalogSchema.safeParse([ok, { ...ok, slug: "other", name: "test game" }]).success).toBe(false);
    expect(catalogSchema.safeParse([{ ...ok, baseGame: "missing" }]).success).toBe(false);
  });
  it("normalizes names, slugs and search text", () => {
    expect(normalizeName("Orléans")).toBe("orleans");
    expect(normalizeName("Tigris & Euphrates")).toBe("tigrisandeuphrates");
    expect(slugify("Dune: Imperium – Uprising")).toBe("dune-imperium-uprising");
    expect(searchTextFor("Catan", ["Settlers of Catan"])).toBe("catan | settlers of catan");
  });
  it("maps entries to game rows with a derived terrain", () => {
    const row = toGameRow({ ...ok, scoring: "win-lose", mechanics: ["Cooperative Game"] } as never);
    expect(row).toMatchObject({ scoring: "win_lose", terrain: "meadow", searchText: "test game" });
  });
});
