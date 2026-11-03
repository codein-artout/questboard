import { Prisma, type ScoringType } from "@prisma/client";
import { parseImportFile, playHash, type ImportedPlay } from "@/importers";
import { deriveTerrain } from "@/game/terrain";
import { normalizeName, searchTextFor, slugify } from "@/lib/catalog/schema";
import { db } from "@/lib/db";
import { computePlaces } from "@/lib/quest-places";
import { notify } from "@/server/notify";
import { recompute } from "@/server/recompute";
import { friendIds } from "@/server/social";

const CHUNK = 15;
const MAX_PLAYS = 20000;
const LOCK_MS = 2 * 60 * 1000;

/** Parses an uploaded file and queues an ImportJob. Throws ImportFormatError on bad files. */
export async function queueImport(userId: string, fileName: string, text: string) {
  const parsed = parseImportFile(fileName, text);
  if (!parsed.plays.length) throw new Error("That file has no plays in it.");
  const plays = parsed.plays.slice(0, MAX_PLAYS);
  const warnings = [...parsed.warnings, ...(parsed.plays.length > MAX_PLAYS ? [`Only the first ${MAX_PLAYS} plays were imported.`] : [])];
  return db.importJob.create({
    data: { userId, format: parsed.importer, fileName: fileName.slice(0, 120), total: plays.length, warnings: warnings.slice(0, 50), payload: plays as unknown as Prisma.InputJsonValue },
  });
}

type Matchers = {
  game: (play: ImportedPlay) => Promise<string>;
  person: (name: string) => string | null;
};

async function buildMatchers(userId: string): Promise<Matchers> {
  const me = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true, handle: true, name: true } });
  const friends = await db.user.findMany({ where: { id: { in: await friendIds(userId) } }, select: { id: true, displayName: true, handle: true } });
  const people = new Map<string, string>();
  for (const f of friends) {
    if (f.displayName) people.set(normalizeName(f.displayName), f.id);
    if (f.handle) people.set(normalizeName(f.handle), f.id);
  }
  const myNames = new Set([me.displayName, me.handle, me.name].filter(Boolean).map((n) => normalizeName(n!)));
  const catalog = await db.game.findMany({ where: { OR: [{ source: "catalog" }, { createdById: userId }] }, select: { id: true, name: true, altNames: true, year: true } });
  const byName = new Map<string, { id: string; year: number | null }[]>();
  for (const g of catalog) {
    for (const n of [g.name, ...g.altNames]) {
      const k = normalizeName(n);
      byName.set(k, [...(byName.get(k) ?? []), { id: g.id, year: g.year }]);
    }
  }
  const gameCache = new Map<string, string>();
  return {
    person: (name) => {
      const k = normalizeName(name);
      if (myNames.has(k)) return userId;
      return people.get(k) ?? null;
    },
    game: async (play) => {
      const key = `${normalizeName(play.gameName)}|${play.gameYear ?? ""}`;
      const cached = gameCache.get(key);
      if (cached) return cached;
      let id: string | undefined;
      const exact = byName.get(normalizeName(play.gameName));
      if (exact?.length) id = (exact.find((g) => play.gameYear && g.year === play.gameYear) ?? exact[0])!.id;
      if (!id) {
        // Fuzzy match by name (pg_trgm), checking the year when both sides have one.
        const q = play.gameName.toLowerCase().slice(0, 80);
        const rows = await db.$queryRaw<{ id: string; year: number | null; sim: number }[]>`
          SELECT "id", "year", similarity(lower("name"), ${q})::float AS "sim" FROM "Game"
          WHERE ("source" = 'catalog' OR "createdById" = ${userId}) AND lower("name") % ${q}
          ORDER BY "sim" DESC LIMIT 3`;
        const best = rows.find((r) => r.sim >= 0.6 && (!play.gameYear || !r.year || Math.abs(r.year - play.gameYear) <= 1));
        id = best?.id;
      }
      if (!id) {
        // Unknown game: a custom game for the player to confirm later.
        const existing = await db.game.findFirst({ where: { createdById: userId, name: { equals: play.gameName, mode: "insensitive" } }, select: { id: true } });
        if (existing) id = existing.id;
        else {
          let slug = `${slugify(play.gameName) || "game"}-${userId.slice(-6)}`;
          if (await db.game.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
          const scoring: ScoringType = play.cooperative ? "coop" : play.players.some((p) => p.score !== null) ? "points" : "win_lose";
          const created = await db.game.create({
            data: {
              slug,
              name: play.gameName.slice(0, 80),
              year: play.gameYear,
              terrain: deriveTerrain({ categories: [], mechanics: play.cooperative ? ["Cooperative Game"] : [], maxPlayers: null }),
              scoring,
              source: "custom",
              createdById: userId,
              needsConfirmation: true,
              searchText: searchTextFor(play.gameName, []),
            },
          });
          id = created.id;
        }
      }
      gameCache.set(key, id);
      return id;
    },
  };
}

async function importPlay(userId: string, jobId: string, play: ImportedPlay, m: Matchers, guests: Map<string, string>): Promise<boolean> {
  const sourceKey = play.sourceId ? `src:${play.sourceId}` : `hash:${playHash(play)}`;
  const exists = await db.quest.findUnique({ where: { loggedById_sourceKey: { loggedById: userId, sourceKey } }, select: { id: true } });
  if (exists) return false;
  const gameId = await m.game(play);
  const game = await db.game.findUniqueOrThrow({ where: { id: gameId }, select: { scoring: true } });
  const mode: ScoringType = play.cooperative ? "coop" : game.scoring === "coop" ? "points" : game.scoring;
  // Map players: me, friends by name, everyone else as the importer's guests.
  const seen = new Set<string>();
  const rows: { userId: string | null; guestName: string | null; score: number | null; won: boolean; rank: number | null; team: string | null }[] = [];
  for (const p of play.players) {
    const uid = p.isMe ? userId : m.person(p.name);
    if (uid && seen.has(uid)) continue;
    if (uid) seen.add(uid);
    rows.push({ userId: uid, guestName: uid ? null : p.name.slice(0, 40) || "Guest", score: p.score, won: p.winner, rank: p.rank, team: p.team });
  }
  if (!seen.has(userId)) rows.unshift({ userId, guestName: null, score: null, won: false, rank: null, team: null });
  const places = computePlaces(
    mode === "coop" ? "coop" : mode,
    rows.map((r, i) => ({ key: String(i), score: r.score, team: r.team, won: r.won, rank: r.rank })),
  );
  // Where the source records a winner but no scores, trust the winner flags.
  const anyPlace = places.size > 0;
  const participants = [];
  for (const [i, r] of rows.entries()) {
    let guestId: string | null = null;
    if (!r.userId && r.guestName) {
      const k = normalizeName(r.guestName);
      guestId = guests.get(k) ?? null;
      if (!guestId) {
        const g = (await db.guest.findFirst({ where: { ownerId: userId, name: { equals: r.guestName, mode: "insensitive" }, claimedById: null } })) ?? (await db.guest.create({ data: { ownerId: userId, name: r.guestName } }));
        guestId = g.id;
        guests.set(k, g.id);
      }
    }
    participants.push({ userId: r.userId, guestId, score: r.score, team: r.team, place: anyPlace ? places.get(String(i)) ?? null : r.won ? 1 : null, seat: i });
  }
  const playedAt = new Date(play.playedAt.endsWith("Z") ? play.playedAt : `${play.playedAt}Z`);
  await db.quest.create({
    data: {
      gameId,
      loggedById: userId,
      playedAt: Number.isNaN(playedAt.getTime()) ? new Date(`${play.localDate}T12:00:00Z`) : playedAt,
      localDate: play.localDate,
      durationMin: play.durationMin,
      location: play.location?.slice(0, 80) ?? null,
      coop: mode === "coop",
      coopWin: mode === "coop" ? play.coopWin : null,
      notes: play.notes?.slice(0, 1000) ?? null,
      status: "confirmed",
      source: "import",
      importJobId: jobId,
      sourceKey,
      quantity: Math.max(1, Math.min(play.quantity, 50)),
      confirmedAt: new Date(),
      participants: { create: participants },
    },
  });
  return true;
}

/**
 * Processes a queued import in chunks, recomputing the island after each one so
 * it visibly builds itself. Safe to call repeatedly (locks, resumes, idempotent).
 */
export async function processImportJob(jobId: string): Promise<void> {
  const now = new Date();
  const claimed = await db.importJob.updateMany({
    where: { id: jobId, status: { in: ["queued", "running"] }, OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(now.getTime() - LOCK_MS) } }] },
    data: { status: "running", lockedAt: now, startedAt: now },
  });
  if (!claimed.count) return;
  const job = await db.importJob.findUniqueOrThrow({ where: { id: jobId } });
  const plays = (job.payload as unknown as ImportedPlay[] | null) ?? [];
  const m = await buildMatchers(job.userId);
  const guests = new Map<string, string>();
  let { processed, created, skipped } = job;
  try {
    // Chronological order so tiles are placed the way they were first played.
    const ordered = plays.map((p, i) => ({ p, i })).sort((a, b) => a.p.playedAt.localeCompare(b.p.playedAt) || a.i - b.i);
    for (let start = processed; start < ordered.length; start += CHUNK) {
      for (const { p } of ordered.slice(start, start + CHUNK)) {
        try {
          if (await importPlay(job.userId, job.id, p, m, guests)) created++;
          else skipped++;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") skipped++;
          else throw err;
        }
      }
      processed = Math.min(ordered.length, start + CHUNK);
      await recompute([job.userId], { notify: false });
      await db.importJob.update({ where: { id: job.id }, data: { processed, created, skipped, lockedAt: new Date() } });
    }
    await db.importJob.update({ where: { id: job.id }, data: { status: "done", finishedAt: new Date(), payload: Prisma.DbNull, lockedAt: null } });
    await recompute([job.userId]);
    const custom = await db.game.count({ where: { createdById: job.userId, needsConfirmation: true } });
    await notify(job.userId, "import_done", { title: `Import finished: ${created} quests added`, body: `${skipped ? `${skipped} already imported. ` : ""}${custom ? `${custom} games weren’t in the catalog; check them on the import page.` : ""}`, href: "/import" }, `import_done:${job.id}`);
  } catch (err) {
    console.error("[import] failed", err);
    await db.importJob.update({ where: { id: job.id }, data: { status: "failed", error: err instanceof Error ? err.message.slice(0, 500) : "Import failed", processed, created, skipped, lockedAt: null } });
  }
}

/** Picks up queued or stalled jobs (cron and `pnpm jobs:imports`). */
export async function processPendingImports(): Promise<number> {
  const jobs = await db.importJob.findMany({
    where: { status: { in: ["queued", "running"] }, OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - LOCK_MS) } }] },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true },
  });
  for (const j of jobs) await processImportJob(j.id);
  return jobs.length;
}

export async function importStatus(jobId: string, userId: string) {
  const job = await db.importJob.findFirst({ where: { id: jobId, userId }, select: { id: true, status: true, total: true, processed: true, created: true, skipped: true, warnings: true, error: true, fileName: true, format: true } });
  if (!job) return null;
  const tiles = await db.tile.findMany({ where: { userId, plays: { gt: 0 } }, select: { q: true, r: true, tier: true, plays: true, monogramOverride: true, terrainOverride: true, game: { select: { name: true, short: true, terrain: true, terrainOverride: true } } } });
  return {
    ...job,
    tiles: tiles.map((t) => ({ q: t.q, r: t.r, tier: t.tier, plays: t.plays, name: t.game.name, short: t.game.short, mono: t.monogramOverride, terrain: t.terrainOverride ?? t.game.terrainOverride ?? t.game.terrain })),
  };
}

