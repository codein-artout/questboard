import { describe, expect, it } from "vitest";
import { computePlaces, listNames, outcomeLine } from "@/lib/quest-places";
import { dayPhrase, duration, feedWhen, plural, relativeDay, theGame } from "@/lib/format";
import { questInputSchema } from "@/lib/validation/quest";
import { handleSchema } from "@/lib/validation/profile";

const e = (key: string, o: Partial<{ score: number | null; team: string | null; won: boolean; rank: number | null }> = {}) => ({ key, score: null, team: null, won: false, rank: null, ...o });

describe("computePlaces", () => {
  it("handles every mode", () => {
    expect(Object.fromEntries(computePlaces("points", [e("a", { score: 5 }), e("b", { score: 9 }), e("c", { score: 5 })]))).toEqual({ b: 1, a: 2, c: 2 });
    expect(Object.fromEntries(computePlaces("win_lose", [e("a", { won: true }), e("b")]))).toEqual({ a: 1, b: 2 });
    expect(Object.fromEntries(computePlaces("ranked", [e("a", { rank: 2 }), e("b", { rank: 1 })]))).toEqual({ a: 2, b: 1 });
    expect(Object.fromEntries(computePlaces("teams", [e("a", { team: "Red", won: true }), e("b", { team: "Blue" })]))).toEqual({ a: 1, b: 2 });
    expect(Object.fromEntries(computePlaces("teams", [e("a", { team: "Red", score: 3 }), e("b", { team: "Blue", score: 5 })]))).toEqual({ a: 2, b: 1 });
    expect(computePlaces("coop", [e("a"), e("b")]).size).toBe(0);
  });
  it("writes outcome lines", () => {
    const parts = [{ name: "Priya", score: 94, place: 1, team: null }, { name: "Ciao", score: 91, place: 2, team: null }];
    expect(outcomeLine("points", parts, null)).toBe("Priya wins by 3");
    expect(outcomeLine("coop", [], true)).toBe("Won together");
    expect(outcomeLine("points", [{ ...parts[0]!, place: 1 }, { ...parts[1]!, place: 1 }], null)).toBe("Priya and Ciao tie for first");
    expect(listNames(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("format", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  it("formats days", () => {
    expect(relativeDay(new Date("2026-11-05T08:00:00Z"), now)).toBe("Today");
    expect(relativeDay(new Date("2026-11-04T08:00:00Z"), now)).toBe("Yesterday");
    expect(relativeDay(new Date("2026-10-27T08:00:00Z"), now)).toBe("Last Tuesday");
    expect(relativeDay(new Date("2026-10-10T08:00:00Z"), now)).toBe("10 Oct");
    expect(relativeDay(new Date("2025-10-10T08:00:00Z"), now)).toBe("10 Oct 2025");
    expect(dayPhrase(new Date("2026-11-04T08:00:00Z"), now)).toBe("yesterday");
    expect(dayPhrase(new Date("2026-10-10T08:00:00Z"), now)).toBe("10 Oct");
    expect(feedWhen(new Date("2026-11-05T21:40:00Z"), now)).toBe("9:40 PM");
  });
  it("formats durations, plurals and articles", () => {
    expect(duration(48)).toBe("48 min");
    expect(duration(320)).toBe("5 h 20 min");
    expect(duration(120)).toBe("2 h");
    expect(plural(1, "play")).toBe("1 play");
    expect(plural(1200, "play")).toBe("1,200 plays");
    expect(theGame("Wingspan")).toBe("the Wingspan");
    expect(theGame("The Crew")).toBe("The Crew");
  });
});

describe("input validation", () => {
  const base = {
    gameId: "g1", playedAt: new Date().toISOString(), localDate: "2026-11-03", tzOffsetMin: 0, durationMin: 40, location: null, hostUserId: null, guildId: null, gameNightId: null,
    mode: "points", coopWin: null, difficulty: null, notes: null, photoKey: null, markOwned: false,
    participants: [{ userId: "u1", guestId: null, guestName: null, team: null, score: 3, midScore: null, won: false, rank: null }],
  };
  it("accepts a valid quest and rejects bad ones", () => {
    expect(questInputSchema.safeParse(base).success).toBe(true);
    expect(questInputSchema.safeParse({ ...base, participants: [] }).success).toBe(false);
    expect(questInputSchema.safeParse({ ...base, mode: "coop" }).success).toBe(false);
    expect(questInputSchema.safeParse({ ...base, playedAt: new Date(Date.now() + 5 * 86400000).toISOString() }).success).toBe(false);
    expect(questInputSchema.safeParse({ ...base, participants: [...base.participants, ...base.participants] }).success).toBe(false);
    expect(questInputSchema.safeParse({ ...base, hostUserId: "stranger" }).success).toBe(false);
    expect(questInputSchema.safeParse({ ...base, photoKey: "../etc/passwd" }).success).toBe(false);
  });
  it("validates handles", () => {
    expect(handleSchema.safeParse("Ciao_99").success).toBe(true);
    expect(handleSchema.safeParse("ab").success).toBe(false);
    expect(handleSchema.safeParse("admin").success).toBe(false);
    expect(handleSchema.safeParse("no spaces").success).toBe(false);
  });
});
