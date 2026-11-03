import { db } from "@/lib/db";
import type { Relation } from "@/lib/permissions";

export async function friendIds(userId: string): Promise<string[]> {
  const rows = await db.friendship.findMany({
    where: { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

/** Users the viewer has blocked or who blocked the viewer. */
export async function blockedIds(userId: string): Promise<Set<string>> {
  const rows = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
}

export async function relationBetween(viewerId: string | null, targetId: string): Promise<Relation> {
  if (!viewerId) return { isSelf: false, isFriend: false, blocked: false };
  if (viewerId === targetId) return { isSelf: true, isFriend: false, blocked: false };
  const [friend, block] = await Promise.all([
    db.friendship.findFirst({
      where: {
        status: "accepted",
        OR: [
          { requesterId: viewerId, addresseeId: targetId },
          { requesterId: targetId, addresseeId: viewerId },
        ],
      },
      select: { id: true },
    }),
    db.block.findFirst({
      where: { OR: [{ blockerId: viewerId, blockedId: targetId }, { blockerId: targetId, blockedId: viewerId }] },
      select: { blockerId: true },
    }),
  ]);
  return { isSelf: false, isFriend: !!friend, blocked: !!block };
}

/** Bulk relations for many targets in two queries (no N+1). */
export async function relationsFor(viewerId: string | null, targetIds: string[]): Promise<Map<string, Relation>> {
  const out = new Map<string, Relation>();
  const ids = [...new Set(targetIds)];
  if (!viewerId) {
    for (const id of ids) out.set(id, { isSelf: false, isFriend: false, blocked: false });
    return out;
  }
  const [friends, blocked] = await Promise.all([friendIds(viewerId), blockedIds(viewerId)]);
  const f = new Set(friends);
  for (const id of ids) out.set(id, { isSelf: id === viewerId, isFriend: f.has(id), blocked: blocked.has(id) });
  return out;
}

/**
 * People the viewer can add to a party: friends, guild mates and anyone they've
 * played with, minus blocks. Ordered by most recent co-play.
 */
export async function partyCandidates(viewerId: string) {
  const [friends, guildMates, coplays, blocked] = await Promise.all([
    friendIds(viewerId),
    db.guildMember.findMany({
      where: { guild: { members: { some: { userId: viewerId } } }, userId: { not: viewerId } },
      select: { userId: true },
    }),
    db.questParticipant.findMany({
      where: { userId: { not: null }, NOT: { userId: viewerId }, quest: { participants: { some: { userId: viewerId } } } },
      select: { userId: true, quest: { select: { playedAt: true } } },
      orderBy: { quest: { playedAt: "desc" } },
      take: 400,
    }),
    blockedIds(viewerId),
  ]);
  const recency = new Map<string, number>();
  for (const c of coplays) if (c.userId && !recency.has(c.userId)) recency.set(c.userId, c.quest.playedAt.getTime());
  const ids = new Set([...friends, ...guildMates.map((g) => g.userId), ...recency.keys()]);
  for (const b of blocked) ids.delete(b);
  const users = await db.user.findMany({
    where: { id: { in: [...ids] }, handle: { not: null } },
    select: { id: true, handle: true, displayName: true, color: true },
  });
  const friendSet = new Set(friends);
  return users
    .map((u) => ({ ...u, isFriend: friendSet.has(u.id), lastPlayed: recency.get(u.id) ?? 0 }))
    .sort((a, b) => b.lastPlayed - a.lastPlayed || Number(b.isFriend) - Number(a.isFriend) || (a.displayName ?? a.handle ?? "").localeCompare(b.displayName ?? b.handle ?? ""));
}

export const displayName = (u: { displayName?: string | null; handle?: string | null; name?: string | null }) =>
  u.displayName || u.handle || u.name || "Player";
