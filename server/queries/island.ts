import type { Terrain } from "@/game/config";
import { shelfBountyXp } from "@/game/engine";
import { islandSurroundings } from "@/game/layout";
import { monogramFor } from "@/game/monogram";
import { nextTier, tierName, withArticle } from "@/game/tiers";
import type { QuestOutcomePayload } from "@/game/types";
import { db } from "@/lib/db";
import { fmtScore, nightTitle, plural } from "@/lib/format";
import type { MapTile } from "@/components/game/IslandMap";
import type { TileCardData } from "@/components/game/TileCard";
import { displayName } from "@/server/social";

export type IslandTile = MapTile & { slug?: string; plays: number; card: TileCardData };
export type Nudge = { icon: "tier" | "crown" | "rise" | "title" | "shelf"; tier?: number; text: string; href: string };
export type NextNight = { id: string; title: string; detail: string; href: string } | null;

/** Upcoming game night the viewer is part of (hosting, guild member, invited friend, or RSVP'd). */
export async function nextNightFor(userId: string, tz = 0): Promise<(NextNight & { topGames: string[]; guildId: string | null }) | null> {
  const now = new Date();
  const night = await db.gameNight.findFirst({
    where: {
      status: "scheduled",
      startsAt: { gte: new Date(now.getTime() - 6 * 3600 * 1000) },
      OR: [{ hostId: userId }, { guild: { members: { some: { userId } } } }, { rsvps: { some: { userId } } }],
    },
    orderBy: { startsAt: "asc" },
    include: {
      host: { select: { id: true, displayName: true, handle: true } },
      rsvps: { select: { status: true } },
      proposals: { include: { game: { select: { name: true } }, _count: { select: { votes: true } } } },
    },
  });
  if (!night) return null;
  const going = night.rsvps.filter((r) => r.status === "going").length;
  const ranked = [...night.proposals].sort((a, b) => b._count.votes - a._count.votes || a.createdAt.getTime() - b.createdAt.getTime());
  const top = ranked[0];
  const where = night.hostId === userId ? "yours" : night.location || `${displayName(night.host)}’s`;
  const detail = [`${plural(going, "person", "people")} going.`, top && top._count.votes > 0 ? `${top.game.name} leads the vote.` : ranked.length ? "Vote on what to play." : "Propose what to play."]
    .filter(Boolean)
    .join(" ")
    .replace(/^1 person going/, "1 going")
    .replace(/(\d+) people going/, "$1 going");
  return {
    id: night.id,
    title: night.title || nightTitle(night.startsAt, where, now, tz),
    detail,
    href: `/nights/${night.id}`,
    topGames: ranked.filter((p) => p._count.votes > 0).slice(0, 3).map((p) => p.game.name),
    guildId: night.guildId,
  };
}

export async function getIsland(ownerId: string, viewerId: string | null) {
  const isSelf = ownerId === viewerId;
  const owner = await db.user.findUniqueOrThrow({
    where: { id: ownerId },
    select: { id: true, handle: true, displayName: true, color: true, timezone: true, privacy: true, memberships: { select: { guildId: true } } },
  });
  const guildIds = owner.memberships.map((m) => m.guildId);
  const [stats, tiles, shelf, crowns, recentOutcomes] = await Promise.all([
    db.playerStats.findUnique({ where: { userId: ownerId } }),
    db.tile.findMany({ where: { userId: ownerId }, include: { game: { select: { id: true, slug: true, name: true, short: true, scoring: true, terrain: true, terrainOverride: true } } } }),
    db.shelfItem.findMany({ where: { userId: ownerId }, include: { game: { select: { id: true, slug: true, name: true, baseGameId: true, terrain: true, terrainOverride: true } } }, orderBy: { acquiredAt: "asc" } }),
    db.crown.findMany({
      where: { OR: [{ scopeKey: `friends:${ownerId}` }, { holderUserId: ownerId, guildId: { in: guildIds } }] },
      include: { holder: { select: { id: true, displayName: true, handle: true } }, guild: { select: { name: true } } },
    }),
    isSelf
      ? db.questOutcome.findMany({ where: { userId: ownerId, status: "confirmed", quest: { playedAt: { gte: new Date(Date.now() - 14 * 86400000) } } }, select: { payload: true, quest: { select: { playedAt: true } } }, orderBy: { quest: { playedAt: "desc" } }, take: 30 })
      : Promise.resolve([]),
  ]);
  const name = displayName(owner);
  const you = (id: string | null) => (id === viewerId ? "You" : null);
  const friendsCrown = new Map(crowns.filter((c) => c.scopeKey === `friends:${ownerId}`).map((c) => [c.gameId, c]));
  const heldByOwner = new Set(crowns.filter((c) => c.holderUserId === ownerId || c.holderGroup.includes(ownerId)).map((c) => c.gameId));

  const out: IslandTile[] = [];
  for (const t of tiles) {
    const terrain = (t.terrainOverride ?? t.game.terrainOverride ?? t.game.terrain) as Terrain;
    const nt = nextTier(t.plays);
    const ghost = t.plays === 0;
    const pendingTierUp = !ghost && t.pendingPlays > 0 && nextTier(t.plays) !== null && t.plays + t.pendingPlays >= (nt?.tier.plays ?? Infinity);
    const c = friendsCrown.get(t.gameId);
    let crownLine = "No crown on this game yet.";
    if (c) {
      const holder = c.holderUserId ? (you(c.holderUserId) ?? displayName(c.holder ?? {})) : null;
      if (c.holderGroup.length) crownLine = c.holderGroup.includes(viewerId ?? "") ? `Your group holds the friends crown, ${c.recordLabel}.` : `A group holds the friends crown, ${c.recordLabel}.`;
      else if (holder) {
        const verb = holder === "You" ? "hold" : "holds";
        const scoreGame = t.game.scoring === "points";
        crownLine = `${holder} ${verb} the friends crown ${scoreGame ? "with" : ","} ${c.recordLabel}.`.replace(" ,", ",");
        if (holder !== "You" && isSelf && scoreGame && t.bestScore !== null) crownLine += ` Your best is ${fmtScore(t.bestScore)}.`;
      }
    } else if (t.game.scoring !== "points" && t.game.scoring !== "coop") crownLine = "No crown yet. Win rate needs 5 plays each.";
    const tierLine = ghost
      ? "Waiting for confirmation"
      : `${tierName(t.tier)}, ${plural(t.plays, "play")}${t.pendingPlays ? ` (+${t.pendingPlays} waiting)` : ""}`;
    const label = ghost ? `${t.game.name}, waiting for confirmation` : `${t.game.name}, ${tierName(t.tier)}, ${plural(t.plays, "play")}${heldByOwner.has(t.gameId) ? ", crown" : ""}`;
    const href = isSelf ? `/games/${t.game.slug}` : `/u/${owner.handle}/games/${t.game.slug}`;
    out.push({
      key: t.gameId,
      q: t.q,
      r: t.r,
      kind: ghost ? "ghost" : "game",
      terrain,
      tier: t.tier,
      name: t.game.name,
      monogram: monogramFor(t.game.name, t.game.short, t.monogramOverride),
      crown: heldByOwner.has(t.gameId),
      pendingTierUp,
      label,
      slug: t.game.slug,
      plays: t.plays,
      card: {
        kind: ghost ? "ghost" : "game",
        name: t.game.name,
        terrain,
        tier: t.tier,
        tierLine,
        next: ghost ? "It lands on the island once the quest is confirmed." : nt ? `${plural(nt.playsNeeded, "more play")} to ${withArticle(nt.tier.name)}.` : "A Wonder. Nothing left to build.",
        crown: crownLine,
        href,
        cta: `Open ${t.game.name}`,
      },
    });
  }

  // Shelf "?" tiles: owned, never played.
  const playedRoots = new Set(tiles.filter((t) => t.plays > 0 || t.pendingPlays > 0).map((t) => t.gameId));
  const shelfGames = shelf.filter((s) => !playedRoots.has(s.game.baseGameId ?? s.gameId));
  const night = isSelf ? await nextNightFor(ownerId) : null;
  const surroundings = islandSurroundings(
    out.map((t) => ({ q: t.q, r: t.r })),
    shelfGames.map((s) => s.gameId),
    ownerId,
  );
  const shelfById = new Map(shelfGames.map((s) => [s.gameId, s]));
  for (const s of surroundings) {
    if (s.kind === "shelf") {
      const item = shelfById.get(s.id)!;
      const bounty = Math.max(shelfBountyXp(item.acquiredAt, new Date()), 80);
      const nightWord = night?.title.split(" at ")[0];
      out.push({
        key: `shelf:${item.gameId}`,
        q: s.q,
        r: s.r,
        kind: "shelf",
        name: item.game.name,
        monogram: "?",
        label: `${item.game.name}, unplayed, on your shelf`,
        plays: 0,
        card: {
          kind: "shelf",
          name: item.game.name,
          tier: 0,
          tierLine: "On your shelf, never played",
          next: `First play earns a bounty of ${bounty} XP${shelfBountyXp(item.acquiredAt, new Date()) ? "" : " or more"}.`,
          crown: isSelf ? (night ? `Propose it for ${nightWord}’s vote.` : "Play it to settle new land.") : "",
          href: isSelf ? (night ? `/nights/${night.id}?propose=${item.gameId}` : `/log?game=${item.game.slug}`) : `/u/${owner.handle}`,
          cta: isSelf ? (night ? `Propose for ${nightWord}` : `Log ${item.game.name}`) : "See profile",
        },
      });
    } else {
      out.push({
        key: `u:${s.q},${s.r}`,
        q: s.q,
        r: s.r,
        kind: "unexplored",
        name: "Unexplored",
        monogram: "",
        label: "Unexplored",
        plays: 0,
        card: { kind: "unexplored", name: "Unexplored", tier: 0, tierLine: "Room to grow", next: "Play a new game and it lands next to games like it.", crown: "", href: "/shelf", cta: "See your shelf" },
      });
    }
  }

  // Nudges ("Close to something").
  const nudges: Nudge[] = [];
  if (isSelf) {
    const close = tiles
      .filter((t) => t.plays > 0)
      .map((t) => ({ t, nt: nextTier(t.plays) }))
      .filter((x) => x.nt && x.nt.playsNeeded <= Math.max(3, Math.ceil(x.nt.tier.plays * 0.15)))
      .sort((a, b) => a.nt!.playsNeeded - b.nt!.playsNeeded || b.t.plays - a.t.plays);
    for (const x of close.slice(0, 2)) {
      nudges.push({ icon: "tier", tier: x.nt!.tier.tier, text: `${x.t.game.name} is ${plural(x.nt!.playsNeeded, "play")} from ${withArticle(x.nt!.tier.name)}`, href: `/games/${x.t.game.slug}` });
    }
    const crownGaps = tiles
      .map((t) => ({ t, c: friendsCrown.get(t.gameId) }))
      .filter((x) => x.c && x.c.holderUserId && x.c.holderUserId !== ownerId && x.t.game.scoring === "points" && x.t.bestScore !== null)
      .map((x) => ({ ...x, gap: x.c!.recordValue - x.t.bestScore! }))
      .filter((x) => x.gap > 0)
      .sort((a, b) => a.gap / a.c!.recordValue - b.gap / b.c!.recordValue);
    const g = crownGaps[0];
    if (g) nudges.push({ icon: "crown", text: `${plural(Math.ceil(g.gap), "point")} from ${displayName(g.c!.holder ?? {})}’s ${g.t.game.name} crown`.replace(/^(\w)/, (m) => m.toUpperCase()), href: `/games/${g.t.game.slug}` });
    const rose = recentOutcomes.map((o) => o.payload as unknown as QuestOutcomePayload).find((p) => p.tierUp && !p.imported);
    if (rose?.tierUp) {
      const t = tiles.find((x) => x.gameId === rose.tileGameId);
      if (t) nudges.push({ icon: "rise", tier: rose.tierUp.to, text: `${t.game.name} just became ${withArticle(tierName(rose.tierUp.to))}`, href: `/games/${t.game.slug}` });
    }
    const progress = (stats?.titleProgress as unknown as { id: string; name: string; earned: boolean; current: number; target: number; text: string }[] | undefined) ?? [];
    const near = progress.filter((p) => !p.earned && p.target > 1 && p.current / p.target >= 0.6).sort((a, b) => b.current / b.target - a.current / a.target)[0];
    if (near && nudges.length < 4) nudges.push({ icon: "title", text: `${near.name}: ${near.text}`, href: `/u/${owner.handle}` });
    if (shelfGames.length && nudges.length < 4) nudges.push({ icon: "shelf", text: `${plural(shelfGames.length, "uncharted game")} wait on your shelf`, href: "/shelf" });
  }

  const gameTiles = out.filter((t) => t.kind === "game");
  const top = [...gameTiles].sort((a, b) => b.plays - a.plays).slice(0, 3).map((t) => t.name);
  return {
    owner: { id: owner.id, handle: owner.handle ?? "", name, color: owner.color, privacy: owner.privacy },
    stats,
    tiles: out,
    nudges,
    night,
    shelfCount: shelfGames.length,
    ariaLabel: `${isSelf ? "Your" : `${name}’s`} island: ${plural(gameTiles.length, "game tile")}${top.length ? `. Most played: ${top.join(", ")}` : ""}. Use the arrow keys to move between tiles.`,
  };
}
