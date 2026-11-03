import type { EngineGame, EngineInput, EngineParticipant, EngineQuest } from "@/game/types";

export const USERS = ["ana", "ben", "cy", "dee", "eli", "fay"] as const;

export const G = {
  cascadia: { id: "cascadia", name: "Cascadia", terrain: "forest", weight: 1.8, maxTime: 45, scoring: "points", baseGameId: null },
  wingspan: { id: "wingspan", name: "Wingspan", terrain: "forest", weight: 2.4, maxTime: 70, scoring: "points", baseGameId: null },
  wingspanEu: { id: "wingspan-eu", name: "Wingspan: European Expansion", terrain: "forest", weight: 2.4, maxTime: 70, scoring: "points", baseGameId: "wingspan" },
  hive: { id: "hive", name: "Hive", terrain: "tundra", weight: 2.3, maxTime: 20, scoring: "win_lose", baseGameId: null },
  pandemic: { id: "pandemic", name: "Pandemic", terrain: "meadow", weight: 2.4, maxTime: 45, scoring: "coop", baseGameId: null },
  codenames: { id: "codenames", name: "Codenames", terrain: "reef", weight: 1.3, maxTime: 15, scoring: "teams", baseGameId: null },
  ti4: { id: "ti4", name: "Twilight Imperium", terrain: "peaks", weight: 4.3, maxTime: 480, scoring: "points", baseGameId: null },
  resistance: { id: "resistance", name: "The Resistance", terrain: "marsh", weight: 1.6, maxTime: 30, scoring: "teams", baseGameId: null },
} satisfies Record<string, EngineGame>;

let seq = 0;
export function resetSeq() {
  seq = 0;
}

export type P = Partial<EngineParticipant> & { u?: string; guest?: string };

export function part(p: P): EngineParticipant {
  return {
    userId: p.u ?? null,
    guestId: p.guest ?? null,
    name: p.name ?? p.u ?? p.guest ?? "Guest",
    team: p.team ?? null,
    score: p.score ?? null,
    midScore: p.midScore ?? null,
    place: p.place ?? null,
  };
}

/** Build a quest. `day` is days after 2026-01-01 (noon UTC). */
export function quest(game: keyof typeof G | string, day: number, players: P[], extra: Partial<EngineQuest> = {}): EngineQuest {
  seq++;
  const playedAt = new Date(Date.UTC(2026, 0, 1, 12, 0, 0) + day * 86400000 + seq * 1000);
  const g = (G as Record<string, EngineGame>)[game];
  return {
    id: extra.id ?? `q${String(seq).padStart(4, "0")}`,
    gameId: g?.id ?? game,
    playedAt,
    createdAt: playedAt,
    localDate: playedAt.toISOString().slice(0, 10),
    tzOffsetMin: 0,
    durationMin: 45,
    status: "confirmed",
    source: "live",
    loggedById: players[0]?.u ?? null,
    hostUserId: null,
    guildId: null,
    gameNightId: null,
    coop: g?.scoring === "coop",
    coopWin: null,
    difficulty: null,
    quantity: 1,
    participants: players.map(part),
    ...extra,
  };
}

/** Points quest with places computed from scores. */
export function scored(game: keyof typeof G, day: number, scores: Record<string, number>, extra: Partial<EngineQuest> = {}): EngineQuest {
  const entries = Object.entries(scores);
  const players = entries.map(([u, score]) => ({ u, score, place: entries.filter(([, s]) => s > score).length + 1 }));
  return quest(game, day, players, extra);
}

export function input(quests: EngineQuest[], extra: Partial<EngineInput> = {}): EngineInput {
  return {
    now: new Date(Date.UTC(2027, 0, 1)),
    users: USERS.map((id) => ({ id, name: id[0]!.toUpperCase() + id.slice(1) })),
    games: Object.values(G),
    quests,
    shelf: [],
    friendships: [],
    guilds: [],
    campaigns: [],
    existingTiles: [],
    existingGuildTiles: [],
    ...extra,
  };
}

export function lines(out: ReturnType<typeof import("@/game/engine").computeWorld>, questId: string, userId: string) {
  return out.outcomes.find((o) => o.questId === questId && o.userId === userId)?.payload.lines ?? [];
}

export function sources(out: ReturnType<typeof import("@/game/engine").computeWorld>, questId: string, userId: string) {
  return Object.fromEntries(lines(out, questId, userId).map((l) => [l.source, l.amount]));
}
