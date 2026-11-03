import { Prisma } from "@prisma/client";
import { CONFIRMATION } from "@/game/config";
import { NotFoundError, UserError } from "@/lib/action";
import { db } from "@/lib/db";
import { canConfirmQuest, canDeleteQuest, canDisputeQuest, canEditQuest, type QuestAccess, type Viewer } from "@/lib/permissions";
import { computePlaces } from "@/lib/quest-places";
import { rateLimit } from "@/lib/rate-limit";
import { questInputSchema, type QuestInput } from "@/lib/validation/quest";
import { notify } from "@/server/notify";
import { recompute } from "@/server/recompute";
import { blockedIds, displayName, partyCandidates } from "@/server/social";

const HOURS = 3600 * 1000;

async function questAccess(questId: string) {
  const q = await db.quest.findUnique({
    where: { id: questId },
    include: {
      participants: { select: { userId: true } },
      loggedBy: { select: { privacy: true } },
      confirmations: true,
      game: { select: { name: true, slug: true } },
    },
  });
  if (!q) throw new NotFoundError("That quest doesn't exist.");
  const access: QuestAccess = {
    loggedById: q.loggedById,
    loggerPrivacy: q.loggedBy?.privacy ?? "PRIVATE",
    participantUserIds: q.participants.map((p) => p.userId).filter((x): x is string => !!x),
    guildId: q.guildId,
    status: q.status,
    source: q.source,
    createdAt: q.createdAt,
  };
  return { q, access };
}

/** Validates the party: everyone registered must be someone the logger can add. */
async function checkParty(viewerId: string, input: QuestInput) {
  const userIds = input.participants.map((p) => p.userId).filter((x): x is string => !!x);
  if (!userIds.includes(viewerId)) throw new UserError("Add yourself to the party.");
  const others = userIds.filter((u) => u !== viewerId);
  if (!others.length) return;
  const [allowed, blocked] = await Promise.all([partyCandidates(viewerId), blockedIds(viewerId)]);
  const ok = new Set(allowed.map((u) => u.id));
  for (const u of others) {
    if (blocked.has(u) || !ok.has(u)) throw new UserError("You can only add friends, guild mates and people you've played with.");
  }
}

async function checkRefs(viewerId: string, input: QuestInput) {
  const game = await db.game.findUnique({ where: { id: input.gameId }, select: { id: true, source: true, createdById: true, scoring: true } });
  if (!game || (game.source === "custom" && game.createdById !== viewerId)) {
    // Custom games are usable by their creator and by anyone who already played them.
    const played = game && (await db.questParticipant.findFirst({ where: { userId: viewerId, quest: { gameId: game.id } }, select: { id: true } }));
    if (!played) throw new UserError("Pick a game from the catalog or your own games.");
  }
  if (input.guildId) {
    const member = await db.guildMember.findUnique({ where: { guildId_userId: { guildId: input.guildId, userId: viewerId } } });
    if (!member) throw new UserError("You're not in that guild.");
  }
  if (input.gameNightId) {
    const night = await db.gameNight.findUnique({ where: { id: input.gameNightId }, select: { guildId: true, hostId: true } });
    if (!night) throw new UserError("That game night doesn't exist.");
    if (night.guildId && night.guildId !== input.guildId) throw new UserError("That game night belongs to another guild.");
  }
  return game!;
}

/** Guest rows: reuse the logger's guest with the same name, or create one. */
async function resolveGuests(tx: Prisma.TransactionClient, viewerId: string, input: QuestInput) {
  const out: (string | null)[] = [];
  for (const p of input.participants) {
    if (p.userId) {
      out.push(null);
      continue;
    }
    if (p.guestId) {
      const g = await tx.guest.findFirst({ where: { id: p.guestId, ownerId: viewerId } });
      if (g) {
        out.push(g.id);
        continue;
      }
    }
    const name = p.guestName!.trim();
    const existing = await tx.guest.findFirst({ where: { ownerId: viewerId, name: { equals: name, mode: "insensitive" }, claimedById: null } });
    out.push(existing?.id ?? (await tx.guest.create({ data: { ownerId: viewerId, name } })).id);
  }
  return out;
}

function participantRows(input: QuestInput, guestIds: (string | null)[]) {
  const places = computePlaces(
    input.mode,
    input.participants.map((p, i) => ({ key: String(i), score: p.score, team: p.team, won: p.won, rank: p.rank })),
  );
  return input.participants.map((p, i) => ({
    userId: p.userId,
    guestId: guestIds[i] ?? null,
    team: p.team,
    score: p.score,
    midScore: p.midScore,
    place: places.get(String(i)) ?? null,
    seat: i,
  }));
}

export async function createQuest(viewerId: string, raw: unknown): Promise<{ id: string }> {
  const input = questInputSchema.parse(raw);
  await rateLimit("logQuest", viewerId);
  await checkParty(viewerId, input);
  await checkRefs(viewerId, input);
  const now = new Date();
  const quest = await db.$transaction(async (tx) => {
    const guestIds = await resolveGuests(tx, viewerId, input);
    const q = await tx.quest.create({
      data: {
        gameId: input.gameId,
        loggedById: viewerId,
        guildId: input.guildId,
        gameNightId: input.gameNightId,
        hostUserId: input.hostUserId,
        location: input.location,
        playedAt: input.playedAt,
        localDate: input.localDate,
        tzOffsetMin: input.tzOffsetMin,
        durationMin: input.durationMin,
        coop: input.mode === "coop",
        coopWin: input.mode === "coop" ? input.coopWin : null,
        difficulty: input.difficulty,
        teams: input.mode === "teams",
        notes: input.notes,
        photoKey: input.photoKey,
        status: "pending",
        autoConfirmAt: new Date(now.getTime() + CONFIRMATION.autoConfirmHours * HOURS),
        participants: { create: participantRows(input, guestIds) },
      },
    });
    if (input.markOwned) {
      await tx.shelfItem.upsert({
        where: { userId_gameId: { userId: viewerId, gameId: input.gameId } },
        create: { userId: viewerId, gameId: input.gameId, source: "logged", acquiredAt: input.playedAt },
        update: {},
      });
    }
    await tx.questDraft.deleteMany({ where: { userId: viewerId } });
    return q;
  });
  const others = input.participants.map((p) => p.userId).filter((u): u is string => !!u && u !== viewerId);
  await recompute([viewerId, ...others]);
  const [logger, game] = await Promise.all([
    db.user.findUnique({ where: { id: viewerId }, select: { displayName: true, handle: true } }),
    db.game.findUnique({ where: { id: input.gameId }, select: { name: true } }),
  ]);
  await Promise.all(
    others.map((u) =>
      notify(u, "confirm_request", { title: `${displayName(logger ?? {})} logged ${game?.name ?? "a quest"} with you`, body: "Confirm it so it counts. It confirms itself in 48 hours if nobody disputes it.", href: `/quests/${quest.id}` }, `confirm_request:${quest.id}`),
    ),
  );
  return { id: quest.id };
}

export async function updateQuest(viewerId: string, questId: string, raw: unknown): Promise<{ id: string }> {
  const input = questInputSchema.parse(raw);
  const { q, access } = await questAccess(questId);
  if (!canEditQuest({ id: viewerId, role: "USER", guildIds: [] }, access)) throw new UserError("Only the person who logged a quest can edit it.");
  await checkParty(viewerId, input);
  await checkRefs(viewerId, input);
  const before = await db.questParticipant.findMany({ where: { questId }, orderBy: { seat: "asc" } });
  const now = new Date();
  await db.$transaction(async (tx) => {
    const guestIds = await resolveGuests(tx, viewerId, input);
    const rows = participantRows(input, guestIds);
    const scoresChanged =
      before.length !== rows.length ||
      rows.some((r, i) => {
        const b = before[i];
        return !b || b.userId !== r.userId || b.guestId !== r.guestId || b.score !== r.score || b.place !== r.place || b.team !== r.team;
      }) ||
      q.coopWin !== (input.mode === "coop" ? input.coopWin : null) ||
      q.gameId !== input.gameId;
    // Editing a confirmed quest's scores sends it back for confirmation (GAME.md anti-cheat).
    const backToPending = scoresChanged && q.status !== "pending";
    await tx.questParticipant.deleteMany({ where: { questId } });
    await tx.quest.update({
      where: { id: questId },
      data: {
        gameId: input.gameId,
        guildId: input.guildId,
        gameNightId: input.gameNightId,
        hostUserId: input.hostUserId,
        location: input.location,
        playedAt: input.playedAt,
        localDate: input.localDate,
        tzOffsetMin: input.tzOffsetMin,
        durationMin: input.durationMin,
        coop: input.mode === "coop",
        coopWin: input.mode === "coop" ? input.coopWin : null,
        difficulty: input.difficulty,
        teams: input.mode === "teams",
        notes: input.notes,
        photoKey: input.photoKey,
        editedAt: now,
        ...(scoresChanged
          ? { status: "pending", confirmedAt: null, disputedAt: null, autoConfirmAt: new Date(now.getTime() + CONFIRMATION.autoConfirmHours * HOURS) }
          : {}),
        participants: { create: rows },
      },
    });
    if (scoresChanged) {
      await tx.confirmation.updateMany({ where: { questId, resolvedAt: null }, data: { resolvedAt: now } });
      await tx.confirmation.deleteMany({ where: { questId, kind: "confirm" } });
    }
    return backToPending;
  });
  const users = [...new Set([...before.map((p) => p.userId), ...input.participants.map((p) => p.userId)].filter((u): u is string => !!u))];
  await recompute(users);
  const others = input.participants.map((p) => p.userId).filter((u): u is string => !!u && u !== viewerId);
  await Promise.all(
    others.map((u) => notify(u, "quest_edited", { title: `${q.game.name} was edited`, body: "Check the scores and confirm it again.", href: `/quests/${questId}` }, `quest_edited:${questId}:${now.getTime()}`)),
  );
  return { id: questId };
}

export async function confirmQuest(viewer: Viewer & {}, questId: string) {
  const { q, access } = await questAccess(questId);
  const responded = q.confirmations.some((c) => c.userId === viewer.id && !c.resolvedAt);
  if (!canConfirmQuest(viewer, access, responded)) throw new UserError("You can't confirm this quest.");
  const now = new Date();
  await db.$transaction([
    db.confirmation.upsert({
      where: { questId_userId: { questId, userId: viewer.id } },
      create: { questId, userId: viewer.id, kind: "confirm" },
      update: { kind: "confirm", reason: null, resolvedAt: null, createdAt: now },
    }),
    db.quest.update({ where: { id: questId }, data: { status: "confirmed", confirmedAt: now } }),
  ]);
  await recompute(access.participantUserIds);
  if (q.loggedById) {
    const me = await db.user.findUnique({ where: { id: viewer.id }, select: { displayName: true, handle: true } });
    await notify(q.loggedById, "quest_confirmed", { title: `${displayName(me ?? {})} confirmed ${q.game.name}`, href: `/quests/${questId}` }, `quest_confirmed:${questId}`);
  }
}

export async function disputeQuest(viewer: Viewer & {}, questId: string, reason: string) {
  const { q, access } = await questAccess(questId);
  if (!canDisputeQuest(viewer, access, new Date())) throw new UserError("You can't dispute this quest.");
  const now = new Date();
  await db.$transaction([
    db.confirmation.upsert({
      where: { questId_userId: { questId, userId: viewer.id } },
      create: { questId, userId: viewer.id, kind: "dispute", reason },
      update: { kind: "dispute", reason, resolvedAt: null, createdAt: now },
    }),
    db.quest.update({ where: { id: questId }, data: { status: "disputed", disputedAt: now, confirmedAt: null } }),
  ]);
  await recompute(access.participantUserIds);
  if (q.loggedById) {
    const me = await db.user.findUnique({ where: { id: viewer.id }, select: { displayName: true, handle: true } });
    await notify(q.loggedById, "quest_disputed", { title: `${displayName(me ?? {})} disputed ${q.game.name}`, body: `"${reason}" Edit the quest to fix it, and it goes back for confirmation.`, href: `/quests/${questId}` }, `quest_disputed:${questId}:${now.getTime()}`);
  }
}

/** The person who disputed withdraws: back to pending with a fresh 48-hour window. */
export async function withdrawDispute(viewerId: string, questId: string) {
  const { access } = await questAccess(questId);
  const mine = await db.confirmation.findUnique({ where: { questId_userId: { questId, userId: viewerId } } });
  if (!mine || mine.kind !== "dispute" || mine.resolvedAt) throw new UserError("You haven't disputed this quest.");
  const now = new Date();
  const otherOpen = await db.confirmation.count({ where: { questId, kind: "dispute", resolvedAt: null, NOT: { userId: viewerId } } });
  await db.$transaction([
    db.confirmation.update({ where: { id: mine.id }, data: { resolvedAt: now } }),
    ...(otherOpen
      ? []
      : [db.quest.update({ where: { id: questId }, data: { status: "pending", disputedAt: null, autoConfirmAt: new Date(now.getTime() + CONFIRMATION.autoConfirmHours * HOURS) } })]),
  ]);
  await recompute(access.participantUserIds);
}

export async function deleteQuest(viewer: Viewer & {}, questId: string) {
  const { q, access } = await questAccess(questId);
  if (!canDeleteQuest(viewer, access)) throw new UserError("Only the person who logged a quest can delete it.");
  await db.quest.delete({ where: { id: questId } });
  if (q.photoKey) {
    const { storage } = await import("@/lib/storage");
    await storage().delete(q.photoKey);
  }
  await recompute([...access.participantUserIds, ...(q.loggedById ? [q.loggedById] : [])]);
}

/**
 * Confirms pending quests whose 48 hours have passed with no open dispute.
 * Run by the cron route and `pnpm jobs:auto-confirm`.
 */
export async function autoConfirmDue(now = new Date()): Promise<{ confirmed: number }> {
  const due = await db.quest.findMany({
    where: { status: "pending", source: "live", autoConfirmAt: { lte: now }, confirmations: { none: { kind: "dispute", resolvedAt: null } } },
    select: { id: true, participants: { select: { userId: true } } },
    take: 500,
  });
  if (!due.length) return { confirmed: 0 };
  await db.quest.updateMany({ where: { id: { in: due.map((d) => d.id) }, status: "pending" }, data: { status: "confirmed", confirmedAt: now } });
  const users = [...new Set(due.flatMap((d) => d.participants.map((p) => p.userId)).filter((u): u is string => !!u))];
  await recompute(users, { now });
  return { confirmed: due.length };
}

/**
 * Claims a guest: every participation of that guest (and of the owner's other
 * guests with the same name) becomes the claimer's, then history recomputes.
 */
export async function claimGuest(viewerId: string, token: string): Promise<{ quests: number; ownerId: string | null }> {
  const guest = await db.guest.findUnique({ where: { claimToken: token }, include: { participations: { select: { questId: true } } } });
  if (!guest) throw new NotFoundError("That claim link isn't valid.");
  if (guest.claimedById && guest.claimedById !== viewerId) throw new UserError("Someone already claimed this guest.");
  if (guest.ownerId === viewerId) throw new UserError("You can't claim your own guest.");
  if (guest.ownerId && (await blockedIds(viewerId)).has(guest.ownerId)) throw new UserError("You can't claim this guest.");
  const siblings = await db.guest.findMany({
    where: { ownerId: guest.ownerId, name: { equals: guest.name, mode: "insensitive" }, claimedById: null },
    select: { id: true },
  });
  const guestIds = [...new Set([guest.id, ...siblings.map((s) => s.id)])];
  const parts = await db.questParticipant.findMany({ where: { guestId: { in: guestIds } }, select: { id: true, questId: true } });
  // If the claimer was already in one of those quests as themselves, skip it to keep (quest, user) unique.
  const already = new Set((await db.questParticipant.findMany({ where: { userId: viewerId, questId: { in: parts.map((p) => p.questId) } }, select: { questId: true } })).map((p) => p.questId));
  const now = new Date();
  await db.$transaction([
    ...parts.filter((p) => !already.has(p.questId)).map((p) => db.questParticipant.update({ where: { id: p.id }, data: { userId: viewerId } })),
    db.guest.updateMany({ where: { id: { in: guestIds } }, data: { claimedById: viewerId, claimedAt: now } }),
  ]);
  // Claiming makes you friends with whoever invited you.
  if (guest.ownerId) {
    await db.friendship.upsert({
      where: { requesterId_addresseeId: { requesterId: guest.ownerId, addresseeId: viewerId } },
      create: { requesterId: guest.ownerId, addresseeId: viewerId, status: "accepted", acceptedAt: now },
      update: { status: "accepted", acceptedAt: now },
    });
  }
  await recompute([viewerId, ...(guest.ownerId ? [guest.ownerId] : [])]);
  if (guest.ownerId) {
    const me = await db.user.findUnique({ where: { id: viewerId }, select: { displayName: true, handle: true } });
    await notify(guest.ownerId, "guest_claimed", { title: `${displayName(me ?? {})} claimed guest ${guest.name}`, body: `${parts.length} quests moved to their island.`, href: `/u/${me?.handle ?? ""}` }, `guest_claimed:${guest.id}`);
  }
  return { quests: parts.length - already.size, ownerId: guest.ownerId };
}
