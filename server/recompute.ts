import { Prisma, type PrismaClient } from "@prisma/client";
import { computeWorld } from "@/game/engine";
import { tierName, withArticle } from "@/game/tiers";
import type { EngineInput, EngineOutput, QuestOutcomePayload } from "@/game/types";
import { db } from "@/lib/db";
import { notify } from "@/server/notify";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Users whose derived state can depend on each other: connected by accepted
 * friendships, shared guilds or shared quests. Recomputing a whole component
 * is exactly as correct as recomputing everyone.
 */
export async function componentOf(seed: string[], tx: Tx = db): Promise<Set<string>> {
  const seen = new Set(seed);
  let frontier = [...seed];
  while (frontier.length) {
    const [friendships, memberships, coplays] = await Promise.all([
      tx.friendship.findMany({
        where: { status: "accepted", OR: [{ requesterId: { in: frontier } }, { addresseeId: { in: frontier } }] },
        select: { requesterId: true, addresseeId: true },
      }),
      tx.guildMember.findMany({
        where: { guild: { members: { some: { userId: { in: frontier } } } } },
        select: { userId: true },
      }),
      tx.questParticipant.findMany({
        where: { userId: { not: null }, quest: { participants: { some: { userId: { in: frontier } } } } },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);
    const next: string[] = [];
    const add = (id: string | null) => {
      if (id && !seen.has(id)) {
        seen.add(id);
        next.push(id);
      }
    };
    for (const f of friendships) {
      add(f.requesterId);
      add(f.addresseeId);
    }
    for (const m of memberships) add(m.userId);
    for (const c of coplays) add(c.userId);
    frontier = next;
  }
  return seen;
}

/** Loads everything the engine needs for a set of users. */
export async function loadEngineInput(userIds: string[] | "all", now = new Date(), tx: Tx = db): Promise<EngineInput> {
  const all = userIds === "all";
  const ids = all ? [] : userIds;
  const userWhere = all ? {} : { id: { in: ids } };
  const users = await tx.user.findMany({ where: userWhere, select: { id: true, displayName: true, handle: true, name: true } });
  const uids = users.map((u) => u.id);
  const quests = await tx.quest.findMany({
    where: all ? {} : { OR: [{ participants: { some: { userId: { in: uids } } } }, { loggedById: { in: uids } }] },
    include: {
      participants: {
        orderBy: { seat: "asc" },
        include: { user: { select: { displayName: true, handle: true } }, guest: { select: { name: true } } },
      },
    },
    orderBy: [{ playedAt: "asc" }, { id: "asc" }],
  });
  // Games used by these quests and their base games.
  const gameIds = new Set(quests.map((q) => q.gameId));
  const shelf = await tx.shelfItem.findMany({ where: all ? {} : { userId: { in: uids } } });
  for (const s of shelf) gameIds.add(s.gameId);
  const games = new Map<string, Awaited<ReturnType<typeof tx.game.findMany>>[number]>();
  let pending = [...gameIds];
  while (pending.length) {
    const rows = await tx.game.findMany({ where: { id: { in: pending } } });
    pending = [];
    for (const g of rows) {
      games.set(g.id, g);
      if (g.baseGameId && !games.has(g.baseGameId)) pending.push(g.baseGameId);
    }
  }
  const [friendships, guildRows, existingTiles] = await Promise.all([
    tx.friendship.findMany({
      where: { status: "accepted", ...(all ? {} : { requesterId: { in: uids }, addresseeId: { in: uids } }) },
      select: { requesterId: true, addresseeId: true },
    }),
    tx.guild.findMany({
      where: all ? {} : { members: { some: { userId: { in: uids } } } },
      include: { members: { select: { userId: true } }, campaigns: { include: { gameNights: { where: { isFinale: true }, select: { id: true } } } } },
    }),
    tx.tile.findMany({ where: all ? {} : { userId: { in: uids } }, select: { userId: true, gameId: true, q: true, r: true, terrainOverride: true } }),
  ]);
  const existingGuildTiles = await tx.guildTile.findMany({ where: { guildId: { in: guildRows.map((g) => g.id) } }, select: { guildId: true, gameId: true, q: true, r: true } });
  const nameOf = (u: { displayName: string | null; handle: string | null; name?: string | null }) => u.displayName || u.handle || u.name || "Player";

  return {
    now,
    users: users.map((u) => ({ id: u.id, name: nameOf(u) })),
    games: [...games.values()].map((g) => ({
      id: g.id,
      name: g.name,
      terrain: g.terrainOverride ?? g.terrain,
      weight: g.weight,
      maxTime: g.maxTime,
      scoring: g.scoring,
      baseGameId: g.baseGameId,
    })),
    quests: quests.map((q) => ({
      id: q.id,
      gameId: q.gameId,
      playedAt: q.playedAt,
      createdAt: q.createdAt,
      localDate: q.localDate,
      tzOffsetMin: q.tzOffsetMin,
      durationMin: q.durationMin,
      status: q.status,
      source: q.source,
      loggedById: q.loggedById,
      hostUserId: q.hostUserId,
      guildId: q.guildId,
      gameNightId: q.gameNightId,
      coop: q.coop,
      coopWin: q.coopWin,
      difficulty: q.difficulty,
      quantity: q.quantity,
      participants: q.participants.map((p) => ({
        userId: p.userId,
        guestId: p.guestId,
        name: p.user ? nameOf(p.user) : p.guest?.name ?? "Guest",
        team: p.team,
        score: p.score,
        midScore: p.midScore,
        place: p.place,
      })),
    })),
    shelf: shelf.map((s) => ({ userId: s.userId, gameId: s.gameId, acquiredAt: s.acquiredAt })),
    friendships: friendships.map((f) => [f.requesterId, f.addresseeId] as [string, string]),
    guilds: guildRows.map((g) => ({ id: g.id, name: g.name, founderId: g.founderId, memberIds: g.members.map((m) => m.userId) })),
    campaigns: guildRows.flatMap((g) =>
      g.campaigns.map((c) => ({ id: c.id, guildId: g.id, name: c.name, startsAt: c.startsAt, endsAt: c.endsAt, finaleNightIds: c.gameNights.map((n) => n.id) })),
    ),
    existingTiles,
    existingGuildTiles,
  };
}

const chunk = <T,>(arr: T[], n = 1000): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

type PersistResult = { output: EngineOutput; userIds: string[] };

async function persist(tx: Prisma.TransactionClient, input: EngineInput, output: EngineOutput, scopeAll: boolean) {
  const uids = input.users.map((u) => u.id);
  const guildIds = input.guilds.map((g) => g.id);
  const campaignIds = input.campaigns.map((c) => c.id);
  const userIn = scopeAll ? {} : { in: uids };

  // Tiles: diff to keep ids, positions and player overrides.
  const oldTiles = await tx.tile.findMany({ where: { userId: userIn } });
  const key = (t: { userId: string; gameId: string }) => `${t.userId}|${t.gameId}`;
  const newByKey = new Map(output.tiles.map((t) => [key(t), t]));
  const removed = oldTiles.filter((t) => !newByKey.has(key(t)));
  if (removed.length) await tx.tile.deleteMany({ where: { id: { in: removed.map((t) => t.id) } } });
  const oldByKey = new Map(oldTiles.map((t) => [key(t), t]));
  for (const t of output.tiles) {
    const prev = oldByKey.get(key(t));
    const data = {
      plays: t.plays,
      pendingPlays: t.pendingPlays,
      tier: t.tier,
      firstPlayedAt: t.firstPlayedAt,
      lastPlayedAt: t.lastPlayedAt,
      bestScore: t.bestScore,
      wins: t.wins,
    };
    if (!prev) continue;
    const changed = (Object.keys(data) as (keyof typeof data)[]).some((k) => String(prev[k] ?? "") !== String(data[k] ?? ""));
    if (changed) await tx.tile.update({ where: { id: prev.id }, data });
  }
  const created = output.tiles.filter((t) => !oldByKey.has(key(t)));
  for (const c of chunk(created)) await tx.tile.createMany({ data: c });

  // Replace-all derived tables for this component.
  await tx.xpLedger.deleteMany({ where: { userId: userIn } });
  for (const c of chunk(output.ledger)) await tx.xpLedger.createMany({ data: c });

  await tx.questOutcome.deleteMany({ where: { userId: userIn } });
  for (const c of chunk(output.outcomes)) {
    await tx.questOutcome.createMany({
      data: c.map((o) => ({ questId: o.questId, userId: o.userId, status: o.status, xp: o.xp, payload: o.payload as unknown as Prisma.InputJsonValue })),
    });
  }

  const scopeKeys = [...guildIds.map((g) => `guild:${g}`), ...uids.map((u) => `friends:${u}`)];
  await tx.crown.deleteMany({ where: scopeAll ? {} : { scopeKey: { in: scopeKeys } } });
  for (const c of chunk(output.crowns)) await tx.crown.createMany({ data: c });

  await tx.crownChange.deleteMany({
    where: scopeAll ? {} : { OR: [{ guildId: { in: guildIds } }, { fromUserId: { in: uids } }, { toUserId: { in: uids } }] },
  });
  for (const c of chunk(output.crownChanges)) await tx.crownChange.createMany({ data: c });

  await tx.houseRecord.deleteMany({ where: { hostUserId: userIn } });
  for (const c of chunk(output.houseRecords)) await tx.houseRecord.createMany({ data: c });

  await tx.taughtBy.deleteMany({ where: scopeAll ? {} : { OR: [{ learnerId: { in: uids } }, { teacherId: { in: uids } }] } });
  for (const c of chunk(output.taughtBy)) await tx.taughtBy.createMany({ data: c, skipDuplicates: true });

  await tx.titleAward.deleteMany({ where: { userId: userIn } });
  for (const c of chunk(output.titles)) await tx.titleAward.createMany({ data: c, skipDuplicates: true });

  await tx.playerStats.deleteMany({ where: { userId: userIn } });
  const knownUsers = new Set(uids);
  for (const c of chunk(output.stats.filter((s) => scopeAll || knownUsers.has(s.userId)))) {
    await tx.playerStats.createMany({
      data: c.map((s) => ({
        ...s,
        terrainPlays: s.terrainPlays as unknown as Prisma.InputJsonValue,
        titleProgress: s.titleProgress as unknown as Prisma.InputJsonValue,
      })),
    });
  }

  await tx.guildTile.deleteMany({ where: scopeAll ? {} : { guildId: { in: guildIds } } });
  for (const c of chunk(output.guildTiles)) await tx.guildTile.createMany({ data: c });

  await tx.campaignStanding.deleteMany({ where: scopeAll ? {} : { campaignId: { in: campaignIds } } });
  for (const c of chunk(output.campaignStandings)) await tx.campaignStanding.createMany({ data: c });
  for (const ch of output.campaignChampions) {
    await tx.campaign.update({ where: { id: ch.campaignId }, data: { championUserId: ch.userId } });
  }
}

type Snapshot = {
  crowns: Map<string, string | null>;
  confirmedOutcomes: Set<string>;
  titles: Set<string>;
};

async function snapshot(tx: Tx, uids: string[] | "all"): Promise<Snapshot> {
  const userIn = uids === "all" ? {} : { in: uids };
  const [crowns, outcomes, titles] = await Promise.all([
    tx.crown.findMany({ where: uids === "all" ? {} : { OR: [{ holderUserId: { in: uids } }, { ownerUserId: { in: uids } }, { guildId: { not: null } }] }, select: { scopeKey: true, gameId: true, holderUserId: true } }),
    tx.questOutcome.findMany({ where: { userId: userIn, status: "confirmed" }, select: { questId: true, userId: true } }),
    tx.titleAward.findMany({ where: { userId: userIn }, select: { userId: true, titleId: true } }),
  ]);
  return {
    crowns: new Map(crowns.map((c) => [`${c.scopeKey}|${c.gameId}`, c.holderUserId])),
    confirmedOutcomes: new Set(outcomes.map((o) => `${o.questId}|${o.userId}`)),
    titles: new Set(titles.map((t) => `${t.userId}|${t.titleId}`)),
  };
}

/** Notifications from what changed between two snapshots (idempotent via dedupe keys). */
async function notifyChanges(before: Snapshot, output: EngineOutput, input: EngineInput) {
  const name = new Map(input.users.map((u) => [u.id, u.name]));
  const gameName = new Map(input.games.map((g) => [g.id, g.name]));
  const slugs = new Map((await db.game.findMany({ where: { id: { in: [...new Set(output.crowns.map((c) => c.gameId).concat(output.outcomes.map((o) => o.payload.tileGameId)))] } }, select: { id: true, slug: true } })).map((g) => [g.id, g.slug]));
  const guildName = new Map(input.guilds.map((g) => [g.id, g.name]));
  const jobs: Promise<unknown>[] = [];

  for (const c of output.crowns) {
    const k = `${c.scopeKey}|${c.gameId}`;
    const prev = before.crowns.get(k);
    if (prev === undefined && !before.crowns.size) continue;
    if (!c.holderUserId || prev === c.holderUserId) continue;
    const isGuild = c.scopeKey.startsWith("guild:");
    // Friends crowns only matter to the island owner.
    if (!isGuild && c.ownerUserId !== c.holderUserId && c.ownerUserId !== prev) continue;
    const game = gameName.get(c.gameId) ?? "a game";
    const where = isGuild ? `${guildName.get(c.guildId!) ?? "guild"} crown` : "friends crown";
    const href = `/games/${slugs.get(c.gameId) ?? ""}`;
    const since = c.since.toISOString();
    jobs.push(
      notify(c.holderUserId, "crown_taken", { title: `You took the ${game} ${where}${prev ? ` from ${name.get(prev) ?? "someone"}` : ""}`, body: `Record: ${c.recordLabel}.`, href }, `crown_taken:${k}:${since}`),
    );
    if (prev) {
      jobs.push(
        notify(prev, "crown_lost", { title: `${name.get(c.holderUserId) ?? "Someone"} took your ${game} ${where}`, body: `New record: ${c.recordLabel}.`, href }, `crown_lost:${k}:${since}`),
      );
    }
  }
  for (const o of output.outcomes) {
    if (o.status !== "confirmed" || before.confirmedOutcomes.has(`${o.questId}|${o.userId}`)) continue;
    const p = o.payload as QuestOutcomePayload;
    if (p.imported || !p.tierUp) continue;
    const game = gameName.get(p.tileGameId) ?? "A game";
    jobs.push(
      notify(o.userId, "tier_up", { title: `${game} rises to ${withArticle(tierName(p.tierUp.to))}`, body: `${p.plays} plays.`, href: `/games/${slugs.get(p.tileGameId) ?? ""}` }, `tier_up:${o.questId}:${o.userId}`),
    );
  }
  const fresh = output.titles.filter((t) => !before.titles.has(`${t.userId}|${t.titleId}`));
  const perUser = new Map<string, typeof fresh>();
  for (const t of fresh) perUser.set(t.userId, [...(perUser.get(t.userId) ?? []), t]);
  for (const [userId, list] of perUser) {
    // A big import can unlock many at once: summarise instead of spamming.
    if (list.length > 3) {
      jobs.push(notify(userId, "title_unlocked", { title: `${list.length} titles unlocked`, body: list.map((t) => t.name).join(", "), href: "/me" }, `titles:${list.map((t) => t.titleId).sort().join(",")}`));
      continue;
    }
    for (const t of list) {
      jobs.push(notify(userId, "title_unlocked", { title: `Title unlocked: ${t.name}`, href: "/me" }, `title:${t.titleId}`));
    }
  }
  await Promise.all(jobs);
}

const RECOMPUTE_LOCK = 4242;

/**
 * Recomputes derived state for the component(s) containing `seedUserIds`
 * (or everyone with "all"), persists it, and sends notifications for changes.
 */
export async function recompute(
  seedUserIds: string[] | "all",
  opts: { notify?: boolean; now?: Date } = {},
): Promise<PersistResult> {
  const now = opts.now ?? new Date();
  const all = seedUserIds === "all";
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RECOMPUTE_LOCK})`;
      const component = all ? "all" : [...(await componentOf(seedUserIds.filter(Boolean), tx))];
      const input = await loadEngineInput(component, now, tx);
      const before = opts.notify === false ? null : await snapshot(tx, all ? "all" : input.users.map((u) => u.id));
      const output = computeWorld(input);
      await persist(tx, input, output, all);
      if (before) {
        // Notifications run after commit so a failure never rolls back game state.
        queueMicrotask(() => void notifyChanges(before, output, input).catch((e) => console.error("[recompute] notify failed", e)));
      }
      return { output, userIds: input.users.map((u) => u.id) };
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
}
