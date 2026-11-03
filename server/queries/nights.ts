import type { Terrain } from "@/game/config";
import { db } from "@/lib/db";
import { canEditGameNight, canJoinGameNight, type GuildRole } from "@/lib/permissions";
import type { PlayerColorKey } from "@/lib/colors";
import { displayName, friendIds } from "@/server/social";
import { VOTING } from "@/game/config";

export type VoteRow = { proposalId: string; gameId: string; slug: string; name: string; terrain: Terrain; votes: number; mine: boolean; proposedBy: string; canWithdraw: boolean };

export async function getNight(nightId: string, viewerId: string) {
  const night = await db.gameNight.findUnique({
    where: { id: nightId },
    include: {
      host: { select: { id: true, displayName: true, handle: true, color: true } },
      guild: { select: { id: true, name: true, slug: true } },
      campaign: { select: { id: true, name: true } },
      rsvps: { include: { user: { select: { id: true, displayName: true, handle: true, color: true } } } },
      proposals: { include: { game: { select: { id: true, slug: true, name: true, terrain: true, terrainOverride: true } }, proposedBy: { select: { id: true, displayName: true, handle: true } }, votes: { select: { userId: true } } } },
      quests: { select: { id: true, game: { select: { name: true } } }, orderBy: { playedAt: "asc" } },
    },
  });
  if (!night) return null;
  const role = night.guildId ? (((await db.guildMember.findUnique({ where: { guildId_userId: { guildId: night.guildId, userId: viewerId } } }))?.role as GuildRole | undefined) ?? null) : null;
  const isFriendOfHost = (await friendIds(night.hostId)).includes(viewerId);
  const canJoin = canJoinGameNight(viewerId, night, { guildRole: role, isFriendOfHost });
  const votes: VoteRow[] = night.proposals
    .map((p) => ({
      proposalId: p.id,
      gameId: p.gameId,
      slug: p.game.slug,
      name: p.game.name,
      terrain: (p.game.terrainOverride ?? p.game.terrain) as Terrain,
      votes: p.votes.length,
      mine: p.votes.some((v) => v.userId === viewerId),
      proposedBy: displayName(p.proposedBy),
      canWithdraw: p.proposedById === viewerId || night.hostId === viewerId,
    }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
  const voters = new Set(night.proposals.flatMap((p) => p.votes.map((v) => v.userId)));
  const used = night.proposals.filter((p) => p.votes.some((v) => v.userId === viewerId)).length;
  const person = (u: { displayName: string | null; handle: string | null; color: PlayerColorKey }) => ({ name: displayName(u), color: u.color });
  return {
    night,
    canJoin,
    canEdit: canEditGameNight(viewerId, night, role),
    votes,
    voterCount: voters.size,
    votesLeft: VOTING.votesPerPerson - used,
    going: night.rsvps.filter((r) => r.status === "going").map((r) => person(r.user)),
    maybe: night.rsvps.filter((r) => r.status === "maybe").map((r) => person(r.user)),
    cant: night.rsvps.filter((r) => r.status === "cant").map((r) => person(r.user)),
    myRsvp: night.rsvps.find((r) => r.userId === viewerId)?.status ?? null,
    hostName: night.hostId === viewerId ? "yours" : `${displayName(night.host)}’s`,
  };
}

/** Games someone can propose: the host's collection and the viewer's own shelf. */
export async function proposable(hostId: string, viewerId: string) {
  const items = await db.shelfItem.findMany({
    where: { userId: { in: [hostId, viewerId] } },
    select: { game: { select: { id: true, name: true, terrain: true, terrainOverride: true } }, userId: true },
    orderBy: { game: { name: "asc" } },
  });
  const seen = new Set<string>();
  return items
    .filter((i) => (seen.has(i.game.id) ? false : (seen.add(i.game.id), true)))
    .map((i) => ({ id: i.game.id, name: i.game.name, terrain: (i.game.terrainOverride ?? i.game.terrain) as Terrain, mine: i.userId === viewerId }));
}
