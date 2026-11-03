import { Prisma } from "@prisma/client";
import type { Terrain } from "@/game/config";
import { tierName, withArticle } from "@/game/tiers";
import type { QuestOutcomePayload } from "@/game/types";
import { db } from "@/lib/db";
import { duration, feedWhen, plural } from "@/lib/format";
import { showParticipantName, type Privacy } from "@/lib/permissions";
import { outcomeLine } from "@/lib/quest-places";
import type { QuestCardData } from "@/components/game/QuestCard";
import type { RewardTone } from "@/components/game/RewardChip";
import { blockedIds, displayName, friendIds } from "@/server/social";

export type FeedFilter = { kind: "friends" } | { kind: "guild"; guildId: string } | { kind: "mine" } | { kind: "user"; userId: string } | { kind: "game"; gameIds: string[]; userId: string };

export const questInclude = {
  game: { select: { id: true, name: true, slug: true, terrain: true, terrainOverride: true, scoring: true, baseGameId: true } },
  guild: { select: { id: true, name: true, slug: true } },
  host: { select: { id: true, displayName: true, handle: true } },
  loggedBy: { select: { id: true, privacy: true, displayName: true, handle: true } },
  participants: {
    orderBy: { seat: "asc" as const },
    include: { user: { select: { id: true, displayName: true, handle: true, color: true, privacy: true } }, guest: { select: { name: true } } },
  },
  outcomes: { select: { userId: true, xp: true, status: true, payload: true } },
  reactions: { select: { kind: true, userId: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.QuestInclude;

export type QuestWithAll = Prisma.QuestGetPayload<{ include: typeof questInclude }>;

/**
 * Where-clause for quests the viewer may see: their own, their guilds',
 * public loggers', and friends-only loggers who are friends. Blocked loggers
 * are excluded. Privacy is enforced in every feed query through this.
 */
export async function visibleQuestWhere(viewerId: string | null, guildIds: string[]): Promise<Prisma.QuestWhereInput> {
  if (!viewerId) return { loggedBy: { privacy: "PUBLIC" } };
  const [friends, blocked] = await Promise.all([friendIds(viewerId), blockedIds(viewerId)]);
  return {
    AND: [
      {
        OR: [
          { participants: { some: { userId: viewerId } } },
          ...(guildIds.length ? [{ guildId: { in: guildIds } }] : []),
          { loggedBy: { privacy: "PUBLIC" } },
          { loggedBy: { privacy: "FRIENDS", id: { in: friends } } },
        ],
      },
      ...(blocked.size ? [{ NOT: { loggedById: { in: [...blocked] } } }] : []),
    ],
  };
}

export type Cursor = { at: Date; id: string };
export const encodeCursor = (c: Cursor) => `${c.at.getTime()}_${c.id}`;
export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  const m = /^(\d{10,15})_([a-z0-9]{10,40})$/i.exec(raw);
  return m ? { at: new Date(Number(m[1])), id: m[2]! } : null;
}

export async function feedQuests(viewer: { id: string; guildIds: string[] } | null, filter: FeedFilter, cursor: Cursor | null, take = 20) {
  const visible = await visibleQuestWhere(viewer?.id ?? null, viewer?.guildIds ?? []);
  let scope: Prisma.QuestWhereInput = {};
  if (filter.kind === "friends" && viewer) {
    const friends = await friendIds(viewer.id);
    scope = { participants: { some: { userId: { in: [viewer.id, ...friends] } } } };
  } else if (filter.kind === "guild") scope = { guildId: filter.guildId };
  else if (filter.kind === "mine" && viewer) scope = { participants: { some: { userId: viewer.id } } };
  else if (filter.kind === "user") scope = { participants: { some: { userId: filter.userId } } };
  else if (filter.kind === "game") scope = { gameId: { in: filter.gameIds }, participants: { some: { userId: filter.userId } } };
  const where: Prisma.QuestWhereInput = {
    AND: [visible, scope, ...(cursor ? [{ OR: [{ playedAt: { lt: cursor.at } }, { playedAt: cursor.at, id: { lt: cursor.id } }] }] : [])],
  };
  const rows = await db.quest.findMany({ where, include: questInclude, orderBy: [{ playedAt: "desc" }, { id: "desc" }], take: take + 1 });
  const page = rows.slice(0, take);
  const last = page.at(-1);
  return { quests: page, next: rows.length > take && last ? encodeCursor({ at: last.playedAt, id: last.id }) : null };
}

/** Names shown to the viewer: private players become "A player" unless the viewer shares the quest. */
async function nameResolver(viewerId: string | null, quests: QuestWithAll[]) {
  const friends = viewerId ? new Set(await friendIds(viewerId)) : new Set<string>();
  const blocked = viewerId ? await blockedIds(viewerId) : new Set<string>();
  return (q: QuestWithAll, p: QuestWithAll["participants"][number]) => {
    if (!p.user) return p.guest?.name ?? "Guest";
    const inQuest = !!viewerId && q.participants.some((x) => x.userId === viewerId);
    const rel = { isSelf: p.user.id === viewerId, isFriend: friends.has(p.user.id), blocked: blocked.has(p.user.id) };
    return showParticipantName(p.user.privacy as Privacy, rel, inQuest) ? displayName(p.user) : "A player";
  };
}

export type CardWithSocial = QuestCardData & {
  reactions: { kind: string; count: number; mine: boolean }[];
  comments: number;
  photoKey: string | null;
};

/** Reward chips per GAME.md: XP, new land, tier-ups, crowns, titles. */
function chipsFor(q: QuestWithAll, viewerId: string | null, nameOf: (userId: string) => string): { tone: RewardTone; label: string }[] {
  const chips: { tone: RewardTone; label: string }[] = [];
  const outcomes = q.outcomes.map((o) => ({ ...o, p: o.payload as unknown as QuestOutcomePayload }));
  const mine = outcomes.find((o) => o.userId === viewerId);
  const gameName = q.game.name;
  if (mine) {
    const allSame = q.coop && outcomes.length > 1 && outcomes.every((o) => o.xp === mine.xp);
    chips.push({ tone: "gold", label: `+${mine.xp} XP${allSame ? " each" : mine.p.raid ? " raid" : ""}` });
  } else if (outcomes.length) {
    const top = [...outcomes].sort((a, b) => b.xp - a.xp)[0]!;
    const allSame = outcomes.every((o) => o.xp === top.xp);
    chips.push({ tone: "gold", label: allSame && outcomes.length > 1 ? `+${top.xp} XP each` : `Up to +${top.xp} XP${top.p.raid ? " raid" : ""}` });
  }
  const ordered = mine ? [mine, ...outcomes.filter((o) => o !== mine)] : outcomes;
  for (const o of ordered) {
    const you = o.userId === viewerId;
    const who = you ? "" : `${nameOf(o.userId)}: `;
    if (o.p.newLand) chips.push({ tone: "plain", label: you ? `New land: ${gameName}` : `New land for ${nameOf(o.userId)}` });
    if (o.p.tierUp) chips.push({ tone: "plain", label: `${who}${gameName} rises to ${withArticle(tierName(o.p.tierUp.to))}` });
    for (const c of o.p.crownsTaken) chips.push({ tone: "rare", label: you ? `Took the ${gameName} crown${c.fromName ? ` from ${c.fromName}` : ""}` : `${nameOf(o.userId)} took the crown` });
    for (const t of o.p.titles) chips.push({ tone: "title", label: you ? `Title: ${t.name}` : `${nameOf(o.userId)} earned ${t.name}` });
  }
  return chips.slice(0, 5);
}

export async function toCards(quests: QuestWithAll[], viewerId: string | null, tz = 0): Promise<CardWithSocial[]> {
  const resolve = await nameResolver(viewerId, quests);
  const now = new Date();
  return quests.map((q) => {
    const names = new Map(q.participants.map((p) => [p.userId ?? p.id, resolve(q, p)]));
    const party = q.participants.map((p) => ({ name: names.get(p.userId ?? p.id)!, color: p.user?.color ?? null, winner: !q.coop && p.place === 1 }));
    const others = party.filter((_, i) => q.participants[i]!.userId !== viewerId).map((p) => p.name);
    const metaBits: string[] = [];
    const raid = q.outcomes.some((o) => (o.payload as unknown as QuestOutcomePayload).raid);
    if (q.guild) metaBits.push(q.location ? `${q.guild.name} at ${q.location.replace(/ place$/, "")}` : q.guild.name);
    else if (raid) metaBits.push(`Raid with ${others.slice(0, 3).join(", ")}${others.length > 3 ? "…" : ""}`);
    else if (q.location) metaBits.push(q.location);
    else if (others.length) metaBits.push(`With ${others.slice(0, 3).join(", ")}`);
    if (q.durationMin) metaBits.push(duration(q.durationMin));
    if (q.source === "import") metaBits.push("imported");
    const outcome = outcomeLine(
      q.coop ? "coop" : (q.game.scoring as Parameters<typeof outcomeLine>[0]),
      q.participants.map((p) => ({ name: names.get(p.userId ?? p.id)!, score: p.score, place: p.place, team: p.team })),
      q.coopWin,
    );
    const counts = new Map<string, { count: number; mine: boolean }>();
    for (const r of q.reactions) {
      const c = counts.get(r.kind) ?? { count: 0, mine: false };
      c.count++;
      if (r.userId === viewerId) c.mine = true;
      counts.set(r.kind, c);
    }
    return {
      id: q.id,
      gameName: q.game.name,
      terrain: (q.game.terrainOverride ?? q.game.terrain) as Terrain,
      when: feedWhen(q.playedAt, now, tz),
      meta: metaBits.join(", "),
      party,
      outcome,
      rewards: q.status === "disputed" ? [] : chipsFor(q, viewerId, (u) => names.get(u) ?? "Someone"),
      status: q.status,
      imported: q.source === "import",
      reactions: [...counts].map(([kind, v]) => ({ kind, ...v })),
      comments: q._count.comments,
      photoKey: q.photoKey,
    };
  });
}

export const playsLabel = (n: number) => plural(n, "play");
