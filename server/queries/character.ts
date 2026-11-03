import { TERRAINS, TERRAIN_INFO, BASE_CLASSES, HYBRID_CLASSES, type Terrain } from "@/game/config";
import type { TitleProgress } from "@/game/types";
import { db } from "@/lib/db";
import { displayName } from "@/server/social";

const CLASS_BLURB: Record<string, string> = {
  forest: "Most of your quests are engine builders.",
  peaks: "Most of your quests are fights over territory.",
  meadow: "Most of your quests are played together, against the game.",
  marsh: "Most of your quests are about secrets and reading people.",
  reef: "Most of your quests are loud ones for big tables.",
  tundra: "Most of your quests are pure strategy, often head to head.",
};

export function classBlurb(key: string, isSelf: boolean): string {
  if (key === "none") return isSelf ? "Play a few quests and your class appears." : "No class yet.";
  const terrains = key.split("+") as Terrain[];
  const base = terrains.length === 2 ? `Your quests split between ${TERRAIN_INFO[terrains[0]!].name.toLowerCase()} and ${TERRAIN_INFO[terrains[1]!].name.toLowerCase()} games.` : CLASS_BLURB[key] ?? "";
  return `${isSelf ? base : base.replace(/^Most of your/, "Most of their").replace(/^Your/, "Their")} ${isSelf ? "Your" : "Their"} class shifts as the island does.`;
}

export const classTerrains = (key: string): Terrain[] => (key === "none" ? [] : (key.split("+") as Terrain[]));
export const isKnownClass = (key: string) => key in BASE_CLASSES || key in HYBRID_CLASSES;

export async function getCharacter(userId: string, viewerId: string | null) {
  const [user, stats, titles, tiles] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, handle: true, displayName: true, color: true, displayedTitleId: true, privacy: true } }),
    db.playerStats.findUnique({ where: { userId }, include: { nemesis: { select: { id: true, handle: true, displayName: true, color: true } } } }),
    db.titleAward.findMany({ where: { userId }, orderBy: { earnedAt: "desc" } }),
    db.tile.findMany({ where: { userId, plays: { gt: 0 } }, select: { plays: true, terrainOverride: true, game: { select: { terrain: true, terrainOverride: true } } } }),
  ]);
  const regions = TERRAINS.map((t) => ({ terrain: t, name: TERRAIN_INFO[t].name, color: TERRAIN_INFO[t].face, games: 0, plays: 0 }));
  for (const tile of tiles) {
    const t = (tile.terrainOverride ?? tile.game.terrainOverride ?? tile.game.terrain) as Terrain;
    const r = regions.find((x) => x.terrain === t)!;
    r.games++;
    r.plays += tile.plays;
  }
  const progress = ((stats?.titleProgress as unknown as TitleProgress[] | undefined) ?? []).map((p) => ({ ...p, earnedAt: titles.find((t) => t.titleId === p.id)?.earnedAt ?? null }));
  const displayed = titles.find((t) => t.titleId === user.displayedTitleId) ?? null;
  return {
    user: { ...user, name: displayName(user) },
    stats,
    regions,
    progress: progress.sort((a, b) => Number(b.earned) - Number(a.earned) || b.current / b.target - a.current / a.target),
    displayedTitle: displayed?.name ?? null,
    isSelf: userId === viewerId,
    nemesis: stats?.nemesis ? { ...stats.nemesis, name: displayName(stats.nemesis), wins: stats.nemesisWins, losses: stats.nemesisLosses, meetings: stats.nemesisMeetings } : null,
  };
}

/** Head-to-head between two players: confirmed, live, competitive quests with both registered. */
export async function getHeadToHead(aId: string, bId: string) {
  const quests = await db.quest.findMany({
    where: { status: "confirmed", source: "live", coop: false, AND: [{ participants: { some: { userId: aId } } }, { participants: { some: { userId: bId } } }] },
    include: { game: { select: { name: true, slug: true, terrain: true, terrainOverride: true } }, participants: { select: { userId: true, place: true, score: true, team: true } } },
    orderBy: { playedAt: "desc" },
  });
  let wins = 0;
  let losses = 0;
  let draws = 0;
  const byGame = new Map<string, { name: string; slug: string; terrain: Terrain; wins: number; losses: number; draws: number }>();
  const recent: { id: string; game: string; playedAt: Date; result: "win" | "loss" | "draw"; myScore: number | null; theirScore: number | null }[] = [];
  for (const q of quests) {
    const a = q.participants.find((p) => p.userId === aId);
    const b = q.participants.find((p) => p.userId === bId);
    if (!a?.place || !b?.place || (a.team && a.team === b.team)) continue;
    const result = a.place < b.place ? "win" : a.place > b.place ? "loss" : "draw";
    if (result === "win") wins++;
    else if (result === "loss") losses++;
    else draws++;
    const g = byGame.get(q.gameId) ?? { name: q.game.name, slug: q.game.slug, terrain: (q.game.terrainOverride ?? q.game.terrain) as Terrain, wins: 0, losses: 0, draws: 0 };
    g[result === "win" ? "wins" : result === "loss" ? "losses" : "draws"]++;
    byGame.set(q.gameId, g);
    if (recent.length < 15) recent.push({ id: q.id, game: q.game.name, playedAt: q.playedAt, result, myScore: a.score, theirScore: b.score });
  }
  return { wins, losses, draws, meetings: wins + losses + draws, games: [...byGame.values()].sort((x, y) => y.wins + y.losses + y.draws - (x.wins + x.losses + x.draws)), recent };
}
