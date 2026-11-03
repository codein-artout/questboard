import { db } from "@/lib/db";
import { recompute } from "@/server/recompute";

/**
 * Deletes an account. Quests that included other people stay for them, with
 * this player replaced by an anonymous guest; quests only they played go away.
 * Everyone affected is recomputed.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const parts = await db.questParticipant.findMany({ where: { userId }, select: { id: true, questId: true, quest: { select: { participants: { select: { userId: true } } } } } });
  const coPlayers = new Set<string>();
  const soloQuests: string[] = [];
  const shared: string[] = [];
  for (const p of parts) {
    const others = p.quest.participants.map((x) => x.userId).filter((u): u is string => !!u && u !== userId);
    if (others.length) {
      shared.push(p.id);
      for (const o of others) coPlayers.add(o);
    } else soloQuests.push(p.questId);
  }
  const friends = await db.friendship.findMany({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] }, select: { requesterId: true, addresseeId: true } });
  for (const f of friends) coPlayers.add(f.requesterId === userId ? f.addresseeId : f.requesterId);
  coPlayers.delete(userId);
  await db.$transaction(async (tx) => {
    if (shared.length) {
      const ghost = await tx.guest.create({ data: { ownerId: null, name: "Former player" } });
      await tx.questParticipant.updateMany({ where: { id: { in: shared } }, data: { userId: null, guestId: ghost.id } });
    }
    if (soloQuests.length) await tx.quest.deleteMany({ where: { id: { in: soloQuests } } });
    await tx.quest.updateMany({ where: { hostUserId: userId }, data: { hostUserId: null } });
    await tx.user.delete({ where: { id: userId } });
  });
  if (coPlayers.size) await recompute([...coPlayers], { notify: false });
}

/** Everything we hold about a player, as JSON (GDPR-style export). */
export async function exportAccount(userId: string) {
  const [user, participations, logged, shelf, friendships, memberships, comments, reactions, titles, stats, tiles, notifications, guests] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, handle: true, displayName: true, color: true, privacy: true, timezone: true, emailNotifications: true, createdAt: true, displayedTitleId: true } }),
    db.questParticipant.findMany({ where: { userId }, include: { quest: { include: { game: { select: { name: true, slug: true } }, participants: { select: { score: true, place: true, team: true, user: { select: { handle: true } }, guest: { select: { name: true } } } } } } } }),
    db.quest.count({ where: { loggedById: userId } }),
    db.shelfItem.findMany({ where: { userId }, include: { game: { select: { name: true, slug: true } } } }),
    db.friendship.findMany({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] }, include: { requester: { select: { handle: true } }, addressee: { select: { handle: true } } } }),
    db.guildMember.findMany({ where: { userId }, include: { guild: { select: { name: true, slug: true } } } }),
    db.comment.findMany({ where: { userId }, select: { questId: true, body: true, createdAt: true } }),
    db.reaction.findMany({ where: { userId }, select: { questId: true, kind: true, createdAt: true } }),
    db.titleAward.findMany({ where: { userId }, select: { titleId: true, name: true, earnedAt: true } }),
    db.playerStats.findUnique({ where: { userId } }),
    db.tile.findMany({ where: { userId }, include: { game: { select: { name: true, slug: true } } } }),
    db.notification.findMany({ where: { userId }, select: { type: true, data: true, createdAt: true, readAt: true } }),
    db.guest.findMany({ where: { ownerId: userId }, select: { name: true, claimedAt: true } }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile: user,
    stats,
    tiles: tiles.map((t) => ({ game: t.game.name, slug: t.game.slug, q: t.q, r: t.r, plays: t.plays, tier: t.tier, monogramOverride: t.monogramOverride, terrainOverride: t.terrainOverride })),
    quests: participations.map((p) => ({
      id: p.questId,
      game: p.quest.game.name,
      playedAt: p.quest.playedAt,
      status: p.quest.status,
      source: p.quest.source,
      durationMin: p.quest.durationMin,
      location: p.quest.location,
      notes: p.quest.notes,
      you: { score: p.score, place: p.place, team: p.team },
      party: p.quest.participants.map((x) => ({ player: x.user?.handle ?? x.guest?.name ?? "guest", score: x.score, place: x.place, team: x.team })),
    })),
    questsLogged: logged,
    shelf: shelf.map((s) => ({ game: s.game.name, slug: s.game.slug, acquiredAt: s.acquiredAt })),
    friends: friendships.map((f) => ({ with: f.requesterId === userId ? f.addressee.handle : f.requester.handle, status: f.status })),
    guilds: memberships.map((m) => ({ guild: m.guild.name, role: m.role, joinedAt: m.joinedAt })),
    guests,
    titles,
    comments,
    reactions,
    notifications,
  };
}
