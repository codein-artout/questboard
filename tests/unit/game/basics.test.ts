import { describe, expect, it } from "vitest";
import { classFromCounts, classAt } from "@/game/class";
import { HYBRID_CLASSES, TERRAINS, xpForLevel } from "@/game/config";
import { distance, hexKey, neighbors, ring, ringOf, spiral } from "@/game/hex";
import { chooseSlot, islandSurroundings, placeTiles, type PlacedTile } from "@/game/layout";
import { levelFromXp, xpToReach } from "@/game/levels";
import { autoMonogram, monogramFor } from "@/game/monogram";
import { ordinal, placeLabel, placesFromScores, teamPlaces } from "@/game/places";
import { deriveTerrain, effectiveTerrain } from "@/game/terrain";
import { nextTier, tierForPlays, tierName, withArticle } from "@/game/tiers";

describe("tiers", () => {
  it.each([
    [0, 0],
    [1, 1],
    [4, 1],
    [5, 2],
    [9, 2],
    [10, 3],
    [24, 3],
    [25, 4],
    [49, 4],
    [50, 5],
    [99, 5],
    [100, 6],
    [1000, 6],
  ])("%i plays is tier %i", (plays, tier) => {
    expect(tierForPlays(plays)).toBe(tier);
  });
  it("names tiers and counts plays to the next", () => {
    expect(tierName(4)).toBe("Keep");
    expect(nextTier(22)).toMatchObject({ playsNeeded: 3, tier: { name: "Keep" } });
    expect(nextTier(100)).toBeNull();
    expect(withArticle("Outpost")).toBe("an Outpost");
    expect(withArticle("Keep")).toBe("a Keep");
  });
});

describe("terrain", () => {
  const g = (categories: string[], mechanics: string[], maxPlayers: number | null = 4) => ({ categories, mechanics, maxPlayers });
  it("follows the rule order", () => {
    expect(deriveTerrain(g(["Deduction"], ["Cooperative Game"]))).toBe("meadow");
    expect(deriveTerrain(g(["Party Game"], ["Hidden Roles"]))).toBe("marsh");
    expect(deriveTerrain(g(["Bluffing", "Party Game"], []))).toBe("marsh");
    expect(deriveTerrain(g(["Word Game"], []))).toBe("reef");
    expect(deriveTerrain(g(["Party Game", "Abstract Strategy"], []))).toBe("reef");
    expect(deriveTerrain(g(["Abstract Strategy"], [], 4))).toBe("tundra");
    expect(deriveTerrain(g(["Wargame"], [], 2))).toBe("tundra");
    expect(deriveTerrain(g(["Wargame"], [], 4))).toBe("peaks");
    expect(deriveTerrain(g(["Territory Building"], []))).toBe("peaks");
    expect(deriveTerrain(g([], ["Area Majority / Influence"]))).toBe("peaks");
    expect(deriveTerrain(g(["Economic"], ["Engine Building"]))).toBe("forest");
    expect(deriveTerrain(g([], [], null))).toBe("forest");
  });
  it("only checks tags in their own field", () => {
    expect(deriveTerrain(g(["Cooperative Game"], []))).toBe("forest");
    expect(deriveTerrain(g([], ["Deduction"]))).toBe("forest");
  });
  it("applies overrides player first, then admin", () => {
    expect(effectiveTerrain("forest", "peaks", "reef")).toBe("reef");
    expect(effectiveTerrain("forest", "peaks", null)).toBe("peaks");
    expect(effectiveTerrain("forest", null, undefined)).toBe("forest");
  });
});

describe("monograms", () => {
  it.each([
    ["Azul", "Azul"],
    ["Cascadia", "Cascadia"],
    ["Terraforming Mars", "T. Mars"],
    ["Blood on the Clocktower", "BotC"],
    ["Telestrations", "Telestr."],
    ["Dune: Imperium", "Dune"],
    ["The Resistance", "Resistance".length <= 8 ? "Resistance" : "Resista."],
    ["Spirit Island", "Spirit"],
  ])("%s -> %s", (name, mono) => {
    const m = autoMonogram(name);
    expect(m.length).toBeLessThanOrEqual(8);
    if (name !== "The Resistance") expect(m).toBe(mono);
  });
  it("prefers overrides, then the catalog short form", () => {
    expect(monogramFor("Twilight Imperium: Fourth Edition", "TI4")).toBe("TI4");
    expect(monogramFor("Twilight Imperium: Fourth Edition", "TI4", "Twilight")).toBe("Twilight");
  });
});

describe("places", () => {
  it("shares places on ties and skips the next", () => {
    const p = placesFromScores([
      { key: "a", score: 10 },
      { key: "b", score: 12 },
      { key: "c", score: 10 },
      { key: "d", score: 3 },
      { key: "e", score: null },
    ]);
    expect(Object.fromEntries(p)).toEqual({ b: 1, a: 2, c: 2, d: 4 });
  });
  it("supports lowest-wins scoring", () => {
    expect(placesFromScores([{ key: "a", score: 5 }, { key: "b", score: 2 }], true).get("b")).toBe(1);
  });
  it("places teams by their best score", () => {
    const p = teamPlaces([
      { key: "a", score: 3, team: "red" },
      { key: "b", score: 3, team: "red" },
      { key: "c", score: 5, team: "blue" },
    ]);
    expect(Object.fromEntries(p)).toEqual({ a: 2, b: 2, c: 1 });
  });
  it("formats ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st"]);
    expect(placeLabel(2, true)).toBe("=2nd");
  });
});

describe("levels", () => {
  it("needs 500 + 250 x (level - 1) per level", () => {
    expect(xpForLevel(1)).toBe(500);
    expect(xpForLevel(14)).toBe(3750);
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 500 });
    expect(levelFromXp(499).level).toBe(1);
    expect(levelFromXp(500)).toEqual({ level: 2, xpIntoLevel: 0, xpForNext: 750 });
    expect(levelFromXp(1250)).toEqual({ level: 3, xpIntoLevel: 0, xpForNext: 1000 });
    expect(xpToReach(3)).toBe(1250);
    for (let l = 1; l < 30; l++) expect(levelFromXp(xpToReach(l)).level).toBe(l);
  });
});

describe("class", () => {
  const counts = (o: Partial<Record<(typeof TERRAINS)[number], number>>) =>
    ({ forest: 0, peaks: 0, meadow: 0, marsh: 0, reef: 0, tundra: 0, ...o });
  it("uses the top terrain", () => {
    expect(classFromCounts(counts({ forest: 10, peaks: 3 })).name).toBe("The Architect");
    expect(classFromCounts(counts({ marsh: 4 })).name).toBe("The Oracle");
    expect(classFromCounts(counts({})).name).toBe("The Wanderer");
  });
  it("uses a hybrid when the top two are within 10 points", () => {
    expect(classFromCounts(counts({ forest: 10, peaks: 9 })).name).toBe("The Conqueror");
    expect(classFromCounts(counts({ peaks: 10, forest: 9 })).key).toBe("forest+peaks");
    // 50 vs 40 out of 100 is exactly 10 points: hybrid.
    expect(classFromCounts(counts({ forest: 50, peaks: 40, reef: 10 })).name).toBe("The Conqueror");
    expect(classFromCounts(counts({ forest: 51, peaks: 40, reef: 9 })).name).toBe("The Architect");
  });
  it("has all 15 hybrids", () => {
    const keys = new Set<string>();
    for (let i = 0; i < TERRAINS.length; i++) for (let j = i + 1; j < TERRAINS.length; j++) keys.add(`${TERRAINS[i]}+${TERRAINS[j]}`);
    expect(keys.size).toBe(15);
    for (const k of keys) expect(HYBRID_CLASSES[k]).toMatch(/^The /);
    expect(new Set(Object.values(HYBRID_CLASSES)).size).toBe(15);
    for (const k of keys) {
      const [a, b] = k.split("+") as [(typeof TERRAINS)[number], (typeof TERRAINS)[number]];
      expect(classFromCounts(counts({ [a]: 5, [b]: 5 })).name).toBe(HYBRID_CLASSES[k]);
    }
  });
  it("looks at the last 12 months only with 30+ plays, else all time", () => {
    const now = new Date("2026-06-01");
    const old = Array.from({ length: 40 }, () => ({ at: new Date("2024-01-01"), terrain: "reef" as const, count: 1 }));
    const recentFew = Array.from({ length: 10 }, () => ({ at: new Date("2026-05-01"), terrain: "forest" as const, count: 1 }));
    expect(classAt([...old, ...recentFew], now).name).toBe("The Trickster");
    const recentMany = Array.from({ length: 30 }, () => ({ at: new Date("2026-05-01"), terrain: "forest" as const, count: 1 }));
    expect(classAt([...old, ...recentMany], now).name).toBe("The Architect");
  });
});

describe("hex", () => {
  it("builds rings and spirals", () => {
    expect(ring(0)).toHaveLength(1);
    expect(ring(1)).toHaveLength(6);
    expect(ring(3)).toHaveLength(18);
    expect(spiral(2)).toHaveLength(19);
    for (const h of ring(4)) expect(ringOf(h)).toBe(4);
    expect(new Set(spiral(3).map(hexKey)).size).toBe(37);
    for (const n of neighbors({ q: 0, r: 0 })) expect(distance(n, { q: 0, r: 0 })).toBe(1);
  });
});

describe("island layout", () => {
  it("starts at the center", () => {
    expect(chooseSlot(new Map(), "forest", "x")).toEqual({ q: 0, r: 0 });
  });
  it("places a tile next to the most tiles of its terrain", () => {
    const occ = new Map<string, PlacedTile>();
    const put = (q: number, r: number, terrain: PlacedTile["terrain"]) => occ.set(hexKey({ q, r }), { q, r, terrain });
    put(0, 0, "forest");
    put(1, 0, "forest");
    put(-1, 0, "reef");
    const h = chooseSlot(occ, "forest", "seed");
    const sameAdj = neighbors(h).filter((n) => occ.get(hexKey(n))?.terrain === "forest").length;
    expect(sameAdj).toBe(2);
    const r = chooseSlot(occ, "reef", "seed");
    expect(neighbors(r).some((n) => occ.get(hexKey(n))?.terrain === "reef")).toBe(true);
  });
  it("is deterministic and keeps existing positions", () => {
    const reqs = Array.from({ length: 20 }, (_, i) => ({ id: `g${i}`, terrain: TERRAINS[i % 6]! }));
    const a = placeTiles([], reqs, "u1");
    const b = placeTiles([], reqs, "u1");
    expect([...a]).toEqual([...b]);
    expect(new Set([...a.values()].map(hexKey)).size).toBe(20);
    const existing = [{ id: "g0", q: 3, r: -3, terrain: "forest" as const }];
    const c = placeTiles(existing, reqs, "u1");
    expect(c.get("g0")).toEqual({ q: 3, r: -3 });
  });
  it("fills ring by ring", () => {
    const reqs = Array.from({ length: 7 }, (_, i) => ({ id: `g${i}`, terrain: "forest" as const }));
    const pos = placeTiles([], reqs, "u");
    expect(Math.max(...[...pos.values()].map(ringOf))).toBe(1);
  });
  it("puts shelf tiles on the outer ring and one ring of unexplored slots", () => {
    const tiles = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
    const around = islandSurroundings(tiles, ["s1", "s2"], "u");
    const shelf = around.filter((s) => s.kind === "shelf");
    expect(shelf).toHaveLength(2);
    for (const s of shelf) expect(ringOf(s)).toBe(2);
    const unexplored = around.filter((s) => s.kind === "unexplored");
    expect(Math.max(...unexplored.map(ringOf))).toBe(2);
    expect(unexplored.some((u) => ringOf(u) === 1)).toBe(true);
  });
  it("overflows shelf tiles outward", () => {
    const shelfIds = Array.from({ length: 10 }, (_, i) => `s${i}`);
    const around = islandSurroundings([{ q: 0, r: 0 }], shelfIds, "u");
    const shelf = around.filter((s) => s.kind === "shelf");
    expect(shelf.filter((s) => ringOf(s) === 1)).toHaveLength(6);
    expect(shelf.filter((s) => ringOf(s) === 2)).toHaveLength(4);
  });
});
