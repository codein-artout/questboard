import type { Terrain, ScoringType } from "@/game/config";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";
import { nextNightFor } from "@/server/queries/island";
import { displayName, partyCandidates } from "@/server/social";
import type { PlayerColorKey } from "@/lib/colors";

export type LogGame = { id: string; slug: string; name: string; terrain: Terrain; scoring: ScoringType; maxPlayers: number | null; source: string };
export type LogPerson = { id: string; name: string; color: PlayerColorKey; isFriend: boolean };
export type LogContext = {
  me: LogPerson;
  people: LogPerson[];
  guests: { id: string; name: string }[];
  guilds: { id: string; name: string; memberIds: string[] }[];
  suggestions: { label: string; games: LogGame[] }[];
  night: { id: string; title: string; guildId: string | null; hostId: string; location: string; attendeeIds: string[] } | null;
  preset: LogGame | null;
  draft: Record<string, unknown> | null;
};

const gameSelect = { id: true, slug: true, name: true, terrain: true, terrainOverride: true, scoring: true, maxPlayers: true, source: true } as const;
const toLogGame = (g: { id: string; slug: string; name: string; terrain: string; terrainOverride: string | null; scoring: string; maxPlayers: number | null; source: string }): LogGame => ({
  id: g.id,
  slug: g.slug,
  name: g.name,
  terrain: (g.terrainOverride ?? g.terrain) as Terrain,
  scoring: g.scoring as ScoringType,
  maxPlayers: g.maxPlayers,
  source: g.source,
});

export async function getLogContext(viewer: SessionUser, opts: { gameSlug?: string; nightId?: string }): Promise<LogContext> {
  const [candidates, guests, guilds, recent, draft, nextNight] = await Promise.all([
    partyCandidates(viewer.id),
    db.guest.findMany({ where: { ownerId: viewer.id, claimedById: null }, select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.guild.findMany({ where: { members: { some: { userId: viewer.id } } }, select: { id: true, name: true, members: { select: { userId: true } } } }),
    db.quest.findMany({
      where: { participants: { some: { userId: viewer.id } } },
      orderBy: { playedAt: "desc" },
      take: 40,
      select: { game: { select: gameSelect } },
    }),
    db.questDraft.findUnique({ where: { userId: viewer.id } }),
    nextNightFor(viewer.id),
  ]);
  // Tonight's game night (or the one passed in) suggests its top-voted games first.
  const nightId = opts.nightId ?? nextNight?.id;
  const night = nightId
    ? await db.gameNight.findUnique({
        where: { id: nightId },
        include: {
          rsvps: { where: { status: "going" }, select: { userId: true } },
          proposals: { include: { game: { select: gameSelect }, _count: { select: { votes: true } } } },
          host: { select: { displayName: true, handle: true } },
        },
      })
    : null;
  const nightIsToday = night && Math.abs(night.startsAt.getTime() - Date.now()) < 20 * 3600 * 1000;
  const voted = night ? [...night.proposals].sort((a, b) => b._count.votes - a._count.votes).map((p) => toLogGame(p.game)) : [];
  const seen = new Set<string>();
  const recentGames = recent.map((r) => toLogGame(r.game)).filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true))).slice(0, 8);
  const suggestions: LogContext["suggestions"] = [];
  if (night && (nightIsToday || opts.nightId) && voted.length) suggestions.push({ label: `From the ${night.title ?? "game night"} vote`, games: voted.slice(0, 4) });
  if (recentGames.length) suggestions.push({ label: "Played recently", games: recentGames });
  const preset = opts.gameSlug ? await db.game.findUnique({ where: { slug: opts.gameSlug }, select: gameSelect }) : null;
  return {
    me: { id: viewer.id, name: displayName(viewer), color: viewer.color, isFriend: false },
    people: candidates.map((c) => ({ id: c.id, name: displayName(c), color: c.color, isFriend: c.isFriend })),
    guests,
    guilds: guilds.map((g) => ({ id: g.id, name: g.name, memberIds: g.members.map((m) => m.userId) })),
    suggestions,
    night: night && (nightIsToday || opts.nightId)
      ? { id: night.id, title: night.title ?? `Game night at ${night.location}`, guildId: night.guildId, hostId: night.hostId, location: night.location, attendeeIds: night.rsvps.map((r) => r.userId) }
      : null,
    preset: preset ? toLogGame(preset) : null,
    draft: (draft?.data as Record<string, unknown> | undefined) ?? null,
  };
}

export async function getQuestForEdit(viewerId: string, questId: string) {
  const q = await db.quest.findUnique({
    where: { id: questId },
    include: { game: { select: gameSelect }, participants: { orderBy: { seat: "asc" }, include: { guest: { select: { name: true } } } } },
  });
  if (!q || q.loggedById !== viewerId) return null;
  return { quest: q, game: toLogGame(q.game) };
}
