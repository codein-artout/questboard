import { beforeEach, describe, expect, it } from "vitest";
import { computeWorld, pickNemesis, shelfBountyXp, spreadFromEdges } from "@/game/engine";
import { XP } from "@/game/config";
import { G, input, quest, resetSeq, scored, sources } from "./helpers";

beforeEach(() => resetSeq());

const tileOf = (out: ReturnType<typeof computeWorld>, u: string, g: string) => out.tiles.find((t) => t.userId === u && t.gameId === g);
const statsOf = (out: ReturnType<typeof computeWorld>, u: string) => out.stats.find((s) => s.userId === u)!;
const hasTitle = (out: ReturnType<typeof computeWorld>, u: string, id: string) => out.titles.some((t) => t.userId === u && t.titleId === id);

describe("XP sources", () => {
  it("awards showed up, place, and new land on a first play", () => {
    const q1 = scored("cascadia", 0, { ana: 90, ben: 80, cy: 70, dee: 60 });
    const out = computeWorld(input([q1]));
    expect(sources(out, q1.id, "ana")).toMatchObject({ showed_up: 40, place: 30, new_land: 40 });
    expect(sources(out, q1.id, "ben")).toMatchObject({ place: 20 });
    expect(sources(out, q1.id, "cy")).toMatchObject({ place: 10 });
    expect(sources(out, q1.id, "dee").place).toBeUndefined();
    expect(statsOf(out, "ana").xp).toBe(110);
  });

  it("gives ties the higher place's XP", () => {
    const q1 = scored("cascadia", 0, { ana: 90, ben: 90, cy: 70 });
    const out = computeWorld(input([q1]));
    expect(sources(out, q1.id, "ana").place).toBe(30);
    expect(sources(out, q1.id, "ben").place).toBe(30);
    expect(sources(out, q1.id, "cy").place).toBe(10);
  });

  it("pays co-op wins and losses to everyone", () => {
    const win = quest("pandemic", 0, [{ u: "ana" }, { u: "ben" }], { coopWin: true });
    const loss = quest("pandemic", 1, [{ u: "ana" }, { u: "ben" }], { coopWin: false });
    const out = computeWorld(input([win, loss]));
    expect(sources(out, win.id, "ben").coop).toBe(XP.coopWin);
    expect(sources(out, loss.id, "ana").coop).toBe(XP.coopLoss);
  });

  it("awards tier-ups at 5, 10, 25, 50 and 100 plays", () => {
    const qs = Array.from({ length: 100 }, (_, i) => quest("hive", i, [{ u: "ana", place: 1 }, { u: "ben", place: 2 }]));
    const out = computeWorld(input(qs));
    const tierXp = qs.map((q) => sources(out, q.id, "ana").tier_up ?? 0);
    expect(tierXp[4]).toBe(20);
    expect(tierXp[9]).toBe(30);
    expect(tierXp[24]).toBe(50);
    expect(tierXp[49]).toBe(80);
    expect(tierXp[99]).toBe(150);
    expect(tierXp.filter((x) => x > 0)).toHaveLength(5);
    expect(tileOf(out, "ana", "hive")).toMatchObject({ plays: 100, tier: 6 });
  });

  it("awards a personal best only when beating an earlier score", () => {
    const a = scored("cascadia", 0, { ana: 80, ben: 70 });
    const b = scored("cascadia", 1, { ana: 85, ben: 60 });
    const c = scored("cascadia", 2, { ana: 85, ben: 90 });
    const out = computeWorld(input([a, b, c]));
    expect(sources(out, a.id, "ana").personal_best).toBeUndefined();
    expect(sources(out, b.id, "ana").personal_best).toBe(20);
    expect(sources(out, c.id, "ana").personal_best).toBeUndefined();
    expect(sources(out, c.id, "ben").personal_best).toBe(20);
    expect(out.outcomes.find((o) => o.questId === b.id && o.userId === "ana")!.payload.personalBest).toEqual({ score: 85, previous: 80 });
  });

  it("pays experienced players 20 per learner, at most 3", () => {
    const first = scored("cascadia", 0, { ana: 50, ben: 40 });
    const teach = scored("cascadia", 1, { ana: 50, cy: 40, dee: 30, eli: 20, fay: 10 });
    const out = computeWorld(input([first, teach]));
    expect(sources(out, first.id, "ana").taught).toBeUndefined();
    expect(sources(out, teach.id, "ana").taught).toBe(60);
    expect(sources(out, teach.id, "cy").taught).toBeUndefined();
  });

  it("pays a shelf bounty by months owned, only after owning it a while", () => {
    expect(shelfBountyXp(new Date("2026-01-01"), new Date("2026-01-03"))).toBe(0);
    expect(shelfBountyXp(new Date("2026-01-01"), new Date("2026-02-01"))).toBe(80);
    expect(shelfBountyXp(new Date("2026-01-01"), new Date("2026-05-15"))).toBe(100);
    expect(shelfBountyXp(new Date("2026-01-01"), new Date("2026-11-01"))).toBe(120);
    expect(shelfBountyXp(new Date("2024-01-01"), new Date("2026-01-01"))).toBe(150);
    const q1 = scored("cascadia", 40, { ana: 50, ben: 40 });
    const out = computeWorld(input([q1], { shelf: [{ userId: "ana", gameId: "cascadia", acquiredAt: new Date("2025-06-01") }] }));
    expect(sources(out, q1.id, "ana").shelf_bounty).toBe(120);
    expect(sources(out, q1.id, "ben").shelf_bounty).toBeUndefined();
  });

  it("pays hosting and doubles showed-up XP on raids", () => {
    const q1 = scored("ti4", 0, { ana: 10, ben: 8 }, { hostUserId: "ben", durationMin: 320 });
    const out = computeWorld(input([q1]));
    expect(sources(out, q1.id, "ben")).toMatchObject({ hosting: 10, showed_up: 40, raid: 40 });
    expect(sources(out, q1.id, "ana").hosting).toBeUndefined();
    expect(hasTitle(out, "ana", "survived-the-galaxy")).toBe(true);
  });

  it("halves XP from the 4th play of a game in one day", () => {
    const qs = [0, 0, 0, 0].map(() => quest("hive", 0, [{ u: "ana", place: 2 }, { u: "ben", place: 1 }]));
    const out = computeWorld(input(qs));
    expect(sources(out, qs[2]!.id, "ana").grind).toBeUndefined();
    expect(sources(out, qs[3]!.id, "ana")).toMatchObject({ showed_up: 40, place: 20, grind: -30 });
  });

  it("counts at most 12 quests a day toward XP", () => {
    const games = ["cascadia", "wingspan", "hive", "codenames", "ti4", "resistance"] as const;
    const qs = Array.from({ length: 13 }, (_, i) => quest(games[i % 6]!, 0, [{ u: "ana", place: 1 }, { u: "ben", place: 2 }]));
    const out = computeWorld(input(qs));
    expect(out.outcomes.find((o) => o.questId === qs[11]!.id && o.userId === "ana")!.xp).toBeGreaterThan(0);
    expect(out.outcomes.find((o) => o.questId === qs[12]!.id && o.userId === "ana")!.xp).toBe(0);
    expect(tileOf(out, "ana", "cascadia")!.plays).toBe(3);
  });

  it("counts imported plays at 50% and only for the importer", () => {
    const imp = quest("cascadia", 0, [{ u: "ana", score: 50, place: 1 }, { u: "ben", score: 40, place: 2 }], { source: "import", loggedById: "ana", quantity: 2 });
    const out = computeWorld(input([imp]));
    expect(sources(out, imp.id, "ana")).toMatchObject({ showed_up: 40, place: 30, new_land: 40, imported: -55 });
    expect(out.outcomes.some((o) => o.userId === "ben")).toBe(false);
    expect(tileOf(out, "ana", "cascadia")!.plays).toBe(2);
    expect(out.crowns).toHaveLength(0);
  });

  it("gives rivalry XP when your nemesis is in the party", () => {
    const qs = Array.from({ length: 6 }, (_, i) => scored("cascadia", i, i % 2 ? { ana: 50, ben: 40 } : { ana: 40, ben: 50 }));
    const out = computeWorld(input(qs, { now: new Date("2026-01-20") }));
    expect(sources(out, qs[4]!.id, "ana").rivalry).toBeUndefined();
    expect(sources(out, qs[5]!.id, "ana").rivalry).toBe(20);
    expect(statsOf(out, "ana")).toMatchObject({ nemesisId: "ben", nemesisMeetings: 6 });
  });

  it("doubles finale-night XP for guild campaigns and ranks standings", () => {
    const guild = { id: "g1", name: "Crew", founderId: "ana", memberIds: ["ana", "ben", "cy"] };
    const campaign = { id: "c1", guildId: "g1", name: "Autumn campaign", startsAt: new Date("2026-01-01"), endsAt: new Date("2026-01-10"), finaleNightIds: ["n1"] };
    const reg = scored("cascadia", 1, { ana: 50, ben: 40 }, { guildId: "g1" });
    const fin = scored("cascadia", 9, { ana: 30, ben: 40 }, { guildId: "g1", gameNightId: "n1" });
    const out = computeWorld(input([reg, fin], { guilds: [guild], campaigns: [campaign] }));
    const finLines = sources(out, fin.id, "ben");
    expect(finLines.finale).toBeGreaterThan(0);
    const benStanding = out.campaignStandings.find((s) => s.userId === "ben")!;
    expect(benStanding.rank).toBe(1);
    expect(out.campaignChampions).toEqual([{ campaignId: "c1", userId: "ben" }]);
    expect(hasTitle(out, "ben", "champion:c1")).toBe(true);
  });

  it("counts expansions toward the base game's tile", () => {
    const a = scored("wingspan", 0, { ana: 50, ben: 40 });
    const b = quest("wingspan-eu", 1, [{ u: "ana", score: 60, place: 1 }, { u: "ben", score: 50, place: 2 }]);
    const out = computeWorld(input([a, b]));
    expect(tileOf(out, "ana", "wingspan")!.plays).toBe(2);
    expect(tileOf(out, "ana", "wingspan-eu")).toBeUndefined();
    expect(sources(out, b.id, "ana").new_land).toBeUndefined();
  });
});

describe("confirmation states", () => {
  it("ignores disputed quests and shadows pending ones", () => {
    const ok = scored("cascadia", 0, { ana: 50, ben: 40 });
    const pend = scored("wingspan", 1, { ana: 50, ben: 40 }, { status: "pending" });
    const disp = scored("hive", 2, { ana: 1, ben: 2 }, { status: "disputed" });
    const out = computeWorld(input([ok, pend, disp]));
    expect(tileOf(out, "ana", "wingspan")).toMatchObject({ plays: 0, pendingPlays: 1, tier: 0 });
    expect(tileOf(out, "ana", "hive")).toBeUndefined();
    const po = out.outcomes.find((o) => o.questId === pend.id && o.userId === "ana")!;
    expect(po.status).toBe("pending");
    expect(po.payload.newLand).not.toBeNull();
    expect(statsOf(out, "ana").xp).toBe(110);
    expect(statsOf(out, "ana").pendingXp).toBe(110);
    expect(out.ledger.filter((l) => l.status === "pending").length).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const qs = Array.from({ length: 30 }, (_, i) => scored(i % 2 ? "cascadia" : "wingspan", i, { ana: 40 + i, ben: 50, cy: 45 }));
    expect(JSON.stringify(computeWorld(input(qs)))).toBe(JSON.stringify(computeWorld(input(qs))));
  });

  it("keeps existing tile positions on recompute", () => {
    const q1 = scored("cascadia", 0, { ana: 50, ben: 40 });
    const q2 = scored("hive", 1, { ana: 50, ben: 40 });
    const out = computeWorld(input([q1, q2], { existingTiles: [{ userId: "ana", gameId: "hive", q: 2, r: -1, terrainOverride: null }] }));
    expect(tileOf(out, "ana", "hive")).toMatchObject({ q: 2, r: -1 });
    const c = tileOf(out, "ana", "cascadia")!;
    expect(Math.max(Math.abs(c.q - 2), Math.abs(c.r + 1), Math.abs(c.q - 2 + c.r + 1))).toBe(1);
  });
});

describe("crowns", () => {
  const guild = { id: "g1", name: "Crew", founderId: "ana", memberIds: ["ana", "ben", "cy", "dee"] };

  it("goes to the highest single score in points games and moves when beaten", () => {
    const a = scored("cascadia", 0, { ana: 90, ben: 80 }, { guildId: "g1" });
    const b = scored("cascadia", 1, { ana: 85, ben: 95 }, { guildId: "g1" });
    const out = computeWorld(input([a, b], { guilds: [guild] }));
    const crown = out.crowns.find((c) => c.scopeKey === "guild:g1" && c.gameId === "cascadia")!;
    expect(crown).toMatchObject({ holderUserId: "ben", recordLabel: "95" });
    expect(sources(out, b.id, "ben").took_crown).toBe(40);
    expect(sources(out, a.id, "ana").took_crown).toBeUndefined();
    const ev = out.outcomes.find((o) => o.questId === b.id && o.userId === "ben")!.payload.crownsTaken;
    expect(ev.some((e) => e.fromUserId === "ana")).toBe(true);
    expect(out.crownChanges.filter((c) => c.scopeKey === "guild:g1").map((c) => [c.fromUserId, c.toUserId])).toEqual([
      [null, "ana"],
      ["ana", "ben"],
    ]);
  });

  it("keeps the incumbent on a tied score", () => {
    const a = scored("cascadia", 0, { ana: 90, ben: 80 }, { guildId: "g1" });
    const b = scored("cascadia", 1, { ana: 70, ben: 90 }, { guildId: "g1" });
    const out = computeWorld(input([a, b], { guilds: [guild] }));
    expect(out.crowns.find((c) => c.scopeKey === "guild:g1")!.holderUserId).toBe("ana");
  });

  it("needs 5 plays for win-rate crowns and breaks ties by wins", () => {
    const qs = Array.from({ length: 4 }, (_, i) => quest("hive", i, [{ u: "ana", place: 1 }, { u: "ben", place: 2 }], { guildId: "g1" }));
    expect(computeWorld(input(qs, { guilds: [guild] })).crowns.find((c) => c.scopeKey === "guild:g1")).toBeUndefined();
    qs.push(quest("hive", 5, [{ u: "ana", place: 2 }, { u: "ben", place: 1 }], { guildId: "g1" }));
    const out = computeWorld(input(qs, { guilds: [guild] }));
    expect(out.crowns.find((c) => c.scopeKey === "guild:g1")).toMatchObject({ holderUserId: "ana", recordLabel: "80% wins" });
  });

  it("gives co-op crowns to the guild", () => {
    const a = quest("pandemic", 0, [{ u: "ana" }, { u: "ben" }], { guildId: "g1", coopWin: true, difficulty: 5 });
    const out = computeWorld(input([a], { guilds: [guild] }));
    expect(out.crowns.find((c) => c.scopeKey === "guild:g1")).toMatchObject({ heldByGuild: true, holderUserId: null });
  });

  it("gives friends co-op crowns to the group with most wins at the highest difficulty", () => {
    const fr: [string, string][] = [["ana", "ben"], ["ana", "cy"]];
    const a = quest("pandemic", 0, [{ u: "ana" }, { u: "ben" }], { coopWin: true, difficulty: 4 });
    const b = quest("pandemic", 1, [{ u: "ana" }, { u: "cy" }], { coopWin: true, difficulty: 5 });
    const out = computeWorld(input([a, b], { friendships: fr }));
    const c = out.crowns.find((x) => x.scopeKey === "friends:ana" && x.gameId === "pandemic")!;
    expect(c.holderGroup.sort()).toEqual(["ana", "cy"]);
    // Ana already held it with Ben; Cy claims a vacant crown on their own island (no XP).
    expect(sources(out, b.id, "ana").took_crown).toBeUndefined();
    expect(out.outcomes.find((o) => o.questId === b.id && o.userId === "cy")!.payload.crownsClaimed).toHaveLength(1);
  });

  it("needs another registered player", () => {
    const solo = quest("cascadia", 0, [{ u: "ana", score: 120, place: 1 }, { guest: "g", name: "Guest", score: 50, place: 2 }], { guildId: "g1" });
    const out = computeWorld(input([solo], { guilds: [guild] }));
    expect(out.crowns).toHaveLength(0);
  });

  it("keeps a friends crown per island owner among their friends", () => {
    const fr: [string, string][] = [["ana", "ben"]];
    const a = scored("cascadia", 0, { ana: 90, ben: 100 });
    const b = scored("cascadia", 1, { cy: 120, dee: 10 });
    const out = computeWorld(input([a, b], { friendships: fr }));
    expect(out.crowns.find((c) => c.scopeKey === "friends:ana")!.holderUserId).toBe("ben");
    expect(out.crowns.find((c) => c.scopeKey === "friends:cy")!.holderUserId).toBe("cy");
    expect(statsOf(out, "ben").crownsHeld).toBe(1);
  });
});

describe("teaching lineage", () => {
  it("picks the host first, then the most experienced player", () => {
    const pre = [
      scored("cascadia", 0, { ana: 1, ben: 2 }),
      scored("cascadia", 1, { ana: 1, cy: 2 }),
      scored("cascadia", 2, { ana: 1, cy: 2 }),
    ];
    const hosted = scored("cascadia", 3, { ben: 1, cy: 2, dee: 3 }, { hostUserId: "ben" });
    const noHost = scored("cascadia", 4, { ana: 1, cy: 2, eli: 3 });
    const out = computeWorld(input([...pre, hosted, noHost]));
    const edge = (l: string) => out.taughtBy.find((e) => e.learnerId === l);
    // Nobody can teach a game on its first play at the table.
    expect(edge("ben")).toBeUndefined();
    expect(edge("cy")?.teacherId).toBe("ana");
    expect(edge("dee")?.teacherId).toBe("ben");
    expect(edge("eli")?.teacherId).toBe("ana");
  });

  it("counts spread through descendants", () => {
    const edges = [
      { teacherId: "a", learnerId: "b" },
      { teacherId: "a", learnerId: "c" },
      { teacherId: "b", learnerId: "d" },
      { teacherId: "d", learnerId: "e" },
    ];
    expect(spreadFromEdges(edges, "a")).toEqual({ direct: 2, total: 4 });
    expect(spreadFromEdges(edges, "b")).toEqual({ direct: 1, total: 2 });
  });

  it("does not let guests learn until claimed", () => {
    const pre = scored("cascadia", 0, { ana: 1, ben: 2 });
    const g = quest("cascadia", 1, [{ u: "ana", score: 5, place: 1 }, { guest: "x", name: "Sam", score: 1, place: 2 }]);
    const out = computeWorld(input([pre, g]));
    expect(out.taughtBy).toHaveLength(0);
    expect(sources(out, g.id, "ana").taught).toBeUndefined();
  });
});

describe("house records", () => {
  it("tracks records at the host's place", () => {
    const a = quest("cascadia", 0, [
      { u: "ana", score: 90, midScore: 30, place: 1 },
      { u: "ben", score: 89, midScore: 50, place: 2 },
      { u: "cy", score: 40, midScore: 40, place: 3 },
    ], { hostUserId: "ana", durationMin: 40 });
    const b = scored("cascadia", 1, { ana: 70, ben: 60 }, { hostUserId: "ana", durationMin: 25 });
    const out = computeWorld(input([a, b]));
    const rec = (k: string) => out.houseRecords.find((r) => r.kind === k)!;
    expect(rec("highest_score")).toMatchObject({ value: 90, holderUserId: "ana" });
    expect(rec("lowest_winning_score")).toMatchObject({ value: 70 });
    expect(rec("fastest")).toMatchObject({ value: 25 });
    expect(rec("longest")).toMatchObject({ value: 40 });
    expect(rec("largest_party")).toMatchObject({ value: 3 });
    expect(rec("comeback")).toMatchObject({ value: 2, holderUserId: "ana", detail: "last at the midpoint" });
  });
});

describe("nemesis", () => {
  it("needs 5 meetings in 90 days and prefers the closest to 50/50", () => {
    const at = new Date("2026-03-01");
    const m = (otherId: string, d: string, result: 1 | 0 | -1) => ({ otherId, at: new Date(d), result });
    const meetings = [
      ...Array.from({ length: 6 }, () => m("ben", "2026-02-01", 1)),
      ...Array.from({ length: 3 }, () => m("cy", "2026-02-01", 1)),
      ...Array.from({ length: 3 }, () => m("cy", "2026-02-02", -1)),
      ...Array.from({ length: 10 }, () => m("dee", "2025-06-01", 1)),
    ];
    expect(pickNemesis(meetings, at)).toMatchObject({ id: "cy", wins: 3, losses: 3 });
    expect(pickNemesis(meetings.slice(0, 4), at)).toBeNull();
  });
});

describe("titles", () => {
  it("Bridesmaid: five 2nd places in a row", () => {
    const qs = Array.from({ length: 5 }, (_, i) => scored("cascadia", i, { ana: 50, ben: 40, cy: 30 }));
    const out = computeWorld(input(qs));
    expect(hasTitle(out, "ben", "bridesmaid")).toBe(true);
    expect(hasTitle(out, "ana", "bridesmaid")).toBe(false);
    expect(out.outcomes.find((o) => o.questId === qs[4]!.id && o.userId === "ben")!.payload.titles.map((t) => t.id)).toContain("bridesmaid");
  });
  it("Kingmaker: last in a game won by a point", () => {
    const out = computeWorld(input([scored("cascadia", 0, { ana: 50, ben: 49, cy: 10 })]));
    expect(hasTitle(out, "cy", "kingmaker")).toBe(true);
    expect(hasTitle(out, "ben", "kingmaker")).toBe(false);
  });
  it("Cartographer and Polyglot", () => {
    const games = ["cascadia", "ti4", "pandemic", "resistance", "codenames", "hive"] as const;
    const qs = games.map((g, i) => quest(g, i, [{ u: "ana", place: 1 }, { u: "ben", place: 2 }], { coopWin: true }));
    const out = computeWorld(input(qs));
    expect(hasTitle(out, "ana", "cartographer")).toBe(true);
    const prog = statsOf(out, "ana").titleProgress.find((t) => t.id === "polyglot")!;
    expect(prog).toMatchObject({ current: 6, target: 25, earned: false, text: "6 of 25 games" });
  });
  it("Night Owl counts quests ending after midnight local time", () => {
    const qs = Array.from({ length: 10 }, (_, i) =>
      quest("hive", i * 2, [{ u: "ana", place: 1 }, { u: "ben", place: 2 }], { playedAt: new Date(Date.UTC(2026, 1, 1 + i, 22, 30)), durationMin: 120, tzOffsetMin: 60 }),
    );
    const out = computeWorld(input(qs));
    expect(hasTitle(out, "ana", "night-owl")).toBe(true);
  });
  it("Comeback: win after three straight losses in a game", () => {
    const qs = [2, 2, 2, 1].map((place, i) => quest("hive", i, [{ u: "ana", place }, { u: "ben", place: place === 1 ? 2 : 1 }]));
    expect(hasTitle(computeWorld(input(qs)), "ana", "comeback")).toBe(true);
  });
  it("Underdog: beat someone who wins 70%+ of your meetings", () => {
    const qs = [...Array.from({ length: 5 }, (_, i) => quest("hive", i, [{ u: "ana", place: 2 }, { u: "ben", place: 1 }])), quest("hive", 6, [{ u: "ana", place: 1 }, { u: "ben", place: 2 }])];
    const out = computeWorld(input(qs));
    expect(hasTitle(out, "ana", "underdog")).toBe(true);
  });
  it("Crown Collector and Usurper", () => {
    const guild = { id: "g1", name: "Crew", founderId: "ben", memberIds: ["ana", "ben"] };
    const gs = ["cascadia", "wingspan", "ti4", "codenames", "resistance"] as const;
    const qs = [
      ...gs.map((g, i) => quest(g, i, [{ u: "ben", score: 10, place: 1 }, { u: "ana", score: 5, place: 2 }], { guildId: "g1" })),
      ...gs.slice(0, 3).map((g, i) => quest(g, 10 + i, [{ u: "ana", score: 20, place: 1 }, { u: "ben", score: 5, place: 2 }], { guildId: "g1" })),
    ];
    const out = computeWorld(input(qs, { guilds: [guild] }));
    expect(hasTitle(out, "ben", "crown-collector")).toBe(true);
    expect(hasTitle(out, "ana", "usurper")).toBe(true);
  });
  it("Founder: a guild you started reaches 10 quests", () => {
    const guild = { id: "g1", name: "Crew", founderId: "cy", memberIds: ["ana", "ben", "cy"] };
    const qs = Array.from({ length: 10 }, (_, i) => scored("cascadia", i, { ana: 50, ben: 40 }, { guildId: "g1" }));
    expect(hasTitle(computeWorld(input(qs, { guilds: [guild] })), "cy", "founder")).toBe(true);
  });
  it("Evangelist: teach one game to 10 people", () => {
    const people = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const qs = people.map((p, i) => quest("cascadia", i, [{ u: "ana", score: 10, place: 1 }, { u: p, score: 5, place: 2 }]));
    const out = computeWorld(input([scored("cascadia", -1, { ana: 1, ben: 2 }), ...qs]));
    expect(hasTitle(out, "ana", "evangelist")).toBe(true);
    expect(statsOf(out, "ana").peopleTaught).toBe(10);
  });
  it("Shelf Cleared: play everything you own with at least 10 owned", () => {
    const owned = Object.values(G).filter((g) => !g.baseGameId).map((g) => g.id);
    const shelf = [...owned, "x1", "x2", "x3"].map((gameId) => ({ userId: "ana", gameId, acquiredAt: new Date("2025-01-01") }));
    const games = [...Object.values(G), ...["x1", "x2", "x3"].map((id) => ({ ...G.cascadia, id, name: id }))];
    const qs = [...owned, "x1", "x2", "x3"].map((g, i) => quest(g, i, [{ u: "ana", place: 1 }, { u: "ben", place: 2 }], { coopWin: true }));
    expect(hasTitle(computeWorld(input(qs, { shelf, games })), "ana", "shelf-cleared")).toBe(true);
    expect(hasTitle(computeWorld(input(qs.slice(1), { shelf, games })), "ana", "shelf-cleared")).toBe(false);
  });
  it("ships at least 25 titles with progress", () => {
    const out = computeWorld(input([scored("cascadia", 0, { ana: 1, ben: 2 })]));
    const prog = statsOf(out, "ana").titleProgress;
    expect(prog.length).toBeGreaterThanOrEqual(25);
    for (const t of prog) expect(t.text.length).toBeGreaterThan(0);
  });
  it("never counts imports toward social titles", () => {
    const qs = Array.from({ length: 5 }, (_, i) => quest("cascadia", i, [{ u: "ben", score: 50, place: 2 }, { u: "ana", score: 60, place: 1 }], { source: "import", loggedById: "ben" }));
    expect(hasTitle(computeWorld(input(qs)), "ben", "bridesmaid")).toBe(false);
  });
});

describe("stats", () => {
  it("computes h-index, class and guild tiles", () => {
    const guild = { id: "g1", name: "Crew", founderId: "ana", memberIds: ["ana", "ben", "cy"] };
    const qs = [
      ...Array.from({ length: 3 }, (_, i) => scored("cascadia", i, { ana: 1, ben: 2, cy: 3 }, { guildId: "g1" })),
      ...Array.from({ length: 2 }, (_, i) => scored("wingspan", 5 + i, { ana: 1, ben: 2 }, { guildId: "g1" })),
      scored("ti4", 9, { ana: 1, ben: 2 }),
    ];
    const out = computeWorld(input(qs, { guilds: [guild] }));
    expect(statsOf(out, "ana")).toMatchObject({ hIndex: 2, gamesExplored: 3, totalPlays: 6, className: "The Architect" });
    expect(out.guildTiles).toEqual([expect.objectContaining({ guildId: "g1", gameId: "cascadia", plays: 3, tier: 1 })]);
  });
});
