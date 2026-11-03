import { theGame } from "@/lib/format";
import type { Terrain } from "@/game/config";
import { islandSurroundings } from "@/game/layout";
import { monogramFor } from "@/game/monogram";
import { tierName } from "@/game/tiers";
import { db } from "@/lib/db";
import { nightTitle, plural, relativeDay } from "@/lib/format";
import type { PlayerColorKey } from "@/lib/colors";
import type { MapTile } from "@/components/game/IslandMap";
import { displayName } from "@/server/social";

export type GuildMapTile = MapTile & { slug?: string; plays: number; crownLine: string };

export async function getGuild(slug: string, viewerId: string, tz = 0) {
  const guild = await db.guild.findUnique({
    where: { slug },
    include: {
      members: { include: { user: { select: { id: true, displayName: true, handle: true, color: true, stats: { select: { className: true } } } } }, orderBy: { joinedAt: "asc" } },
      tiles: { include: { game: { select: { id: true, slug: true, name: true, short: true, terrain: true, terrainOverride: true } } } },
      crowns: { include: { holder: { select: { id: true, displayName: true, handle: true, color: true } } } },
      campaigns: { orderBy: { startsAt: "desc" }, include: { standings: { orderBy: { rank: "asc" }, include: { user: { select: { id: true, displayName: true, handle: true, color: true, stats: { select: { className: true } } } } } }, champion: { select: { displayName: true, handle: true } } } },
    },
  });
  if (!guild) return null;
  const me = guild.members.find((m) => m.userId === viewerId);
  if (!me) return { guild, member: false as const };
  const now = new Date();
  const [questCount, nextNight, changes] = await Promise.all([
    db.quest.count({ where: { guildId: guild.id, status: "confirmed" } }),
    db.gameNight.findFirst({
      where: { guildId: guild.id, status: "scheduled", startsAt: { gte: new Date(now.getTime() - 6 * 3600 * 1000) } },
      orderBy: { startsAt: "asc" },
      include: { host: { select: { id: true, displayName: true, handle: true } }, rsvps: { select: { userId: true, status: true } }, proposals: { include: { game: { select: { name: true } }, _count: { select: { votes: true } } } } },
    }),
    db.crownChange.findMany({ where: { guildId: guild.id }, orderBy: { at: "desc" }, take: 8, include: { game: { select: { name: true, slug: true } }, fromUser: { select: { displayName: true, handle: true } }, toUser: { select: { displayName: true, handle: true } } } }),
  ]);
  const crownByGame = new Map(guild.crowns.map((c) => [c.gameId, c]));
  const tiles: GuildMapTile[] = guild.tiles.map((t) => {
    const c = crownByGame.get(t.gameId);
    const terrain = (t.game.terrainOverride ?? t.game.terrain) as Terrain;
    const holderName = c?.holder ? (c.holder.id === viewerId ? "You" : displayName(c.holder)) : null;
    return {
      key: t.gameId,
      q: t.q,
      r: t.r,
      kind: "game",
      terrain,
      tier: t.tier,
      name: t.game.name,
      monogram: monogramFor(t.game.name, t.game.short),
      holder: c?.holder ? { name: displayName(c.holder), color: c.holder.color } : null,
      label: `${t.game.name}, ${tierName(t.tier)}, ${plural(t.plays, "guild play")}${holderName ? `, crown held by ${holderName}` : c?.heldByGuild ? ", crown held by the guild" : ""}`,
      slug: t.game.slug,
      plays: t.plays,
      crownLine: c ? (c.heldByGuild ? `Held by the guild, ${c.recordLabel}.` : holderName ? `${holderName} ${holderName === "You" ? "hold" : "holds"} the crown with ${c.recordLabel}.` : "") : "No crown yet.",
    };
  });
  for (const s of islandSurroundings(tiles, [], guild.id)) {
    if (s.kind === "unexplored") tiles.push({ key: `u:${s.q},${s.r}`, q: s.q, r: s.r, kind: "unexplored", name: "", monogram: "", label: "Unexplored", plays: 0, crownLine: "" });
  }
  const active = guild.campaigns.find((c) => c.startsAt <= now && c.endsAt.getTime() + 86400000 > now.getTime()) ?? null;
  const past = guild.campaigns.filter((c) => c.endsAt.getTime() + 86400000 <= now.getTime() && c.championUserId);
  const weekOf = active ? Math.min(Math.floor((now.getTime() - active.startsAt.getTime()) / (7 * 86400000)) + 1, Math.round((active.endsAt.getTime() - active.startsAt.getTime()) / (7 * 86400000))) : 0;
  const weeks = active ? Math.round((active.endsAt.getTime() - active.startsAt.getTime()) / (7 * 86400000)) : 0;
  const person = (u: { displayName: string | null; handle: string | null; color: PlayerColorKey }) => ({ name: displayName(u), color: u.color });
  const going = nextNight?.rsvps.filter((r) => r.status === "going").length ?? 0;
  const memberIds = guild.members.map((m) => m.userId);
  const unanswered = nextNight ? guild.members.filter((m) => !nextNight.rsvps.some((r) => r.userId === m.userId)).map((m) => displayName(m.user)) : [];
  const top = nextNight ? [...nextNight.proposals].sort((a, b) => b._count.votes - a._count.votes)[0] : undefined;
  return {
    guild,
    member: true as const,
    role: me.role,
    members: guild.members.map((m) => ({ id: m.userId, ...person(m.user), handle: m.user.handle, role: m.role, className: m.user.stats?.className ?? "The Wanderer" })),
    questCount,
    tiles,
    tileCount: guild.tiles.length,
    night: nextNight
      ? {
          id: nextNight.id,
          title: nextNight.title ?? nightTitle(nextNight.startsAt, nextNight.hostId === viewerId ? "yours" : `${displayName(nextNight.host)}’s`, now, tz),
          detail: `${going} going.${unanswered.length === 1 ? ` ${unanswered[0]} hasn’t answered.` : unanswered.length > 1 ? ` ${unanswered.length} haven’t answered.` : ""}${top && top._count.votes ? ` ${top.game.name} leads the vote.` : ""}`,
          myRsvp: nextNight.rsvps.find((r) => r.userId === viewerId)?.status ?? null,
        }
      : null,
    campaign: active
      ? {
          id: active.id,
          name: active.name,
          weekOf,
          weeks,
          finale: relativeDay(active.endsAt, now, tz),
          standings: active.standings.map((s) => ({ rank: s.rank, xp: s.xp, ...person(s.user), handle: s.user.handle, className: (s.user.stats?.className ?? "").replace(/^The /, "") })),
        }
      : null,
    champions: past.map((c) => ({ name: c.name, champion: c.champion ? displayName(c.champion) : "" })),
    crownChanges: changes.map((c) => ({
      id: c.id,
      text: c.fromUser ? `${displayName(c.toUser ?? {})} took ${theGame(c.game.name)} crown from ${displayName(c.fromUser)}` : `${displayName(c.toUser ?? {})} claimed ${theGame(c.game.name)} crown`,
      when: relativeDay(c.at, now, tz),
      slug: c.game.slug,
    })),
    memberIds,
  };
}
