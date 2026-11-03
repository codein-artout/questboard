import type { Terrain } from "@/game/config";
import { TERRAIN_INFO } from "@/game/config";
import { spreadFromEdges } from "@/game/engine";
import { monogramFor } from "@/game/monogram";
import { ordinal } from "@/game/places";
import { nextTier, tierName, withArticle } from "@/game/tiers";
import { db } from "@/lib/db";
import { dayPhrase, duration, fmtScore, inMonth, plural, relativeDay } from "@/lib/format";
import type { PlayerColorKey } from "@/lib/colors";
import { displayName } from "@/server/social";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const words = (n: number) => (Number.isInteger(n) && n >= 0 && n <= 10 ? WORDS[n]! : fmtScore(n));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type CrownView = { scope: string; headline: string; detail: string | null };
export type Person = { name: string; color: PlayerColorKey | null; handle: string | null };

export async function getTilePage(ownerId: string, viewerId: string | null, slug: string, tz = 0) {
  const game = await db.game.findUnique({
    where: { slug },
    include: { baseGame: { select: { slug: true, name: true } }, expansions: { select: { slug: true, name: true }, orderBy: { name: "asc" } } },
  });
  if (!game) return null;
  if (game.source === "custom" && game.createdById !== ownerId && game.createdById !== viewerId) {
    const played = await db.questParticipant.findFirst({ where: { userId: ownerId, quest: { gameId: game.id } }, select: { id: true } });
    if (!played) return null;
  }
  const tileGameId = game.baseGameId ?? game.id;
  const tileGame = game.baseGame ? await db.game.findUnique({ where: { id: tileGameId } }) : game;
  if (!tileGame) return null;
  const relatedIds = [tileGameId, ...(await db.game.findMany({ where: { baseGameId: tileGameId }, select: { id: true } })).map((g) => g.id)];
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { id: true, displayName: true, handle: true, memberships: { select: { guild: { select: { id: true, name: true } } } } } });
  const isSelf = ownerId === viewerId;
  const you = isSelf ? "You" : displayName(owner);
  const yours = isSelf ? "Your" : `${displayName(owner)}’s`;

  const [tile, crowns, taughtEdges, houseRecords, parts, shelfItem] = await Promise.all([
    db.tile.findUnique({ where: { userId_gameId: { userId: ownerId, gameId: tileGameId } } }),
    db.crown.findMany({
      where: { gameId: tileGameId, OR: [{ scopeKey: `friends:${ownerId}` }, { guildId: { in: owner.memberships.map((m) => m.guild.id) } }] },
      include: { holder: { select: { id: true, displayName: true, handle: true } }, guild: { select: { name: true } } },
    }),
    db.taughtBy.findMany({ where: { gameId: tileGameId }, include: { learner: { select: { id: true, displayName: true, handle: true, color: true } }, teacher: { select: { id: true, displayName: true, handle: true, color: true } } } }),
    db.houseRecord.findMany({ where: { hostUserId: ownerId, gameId: tileGameId } }),
    db.questParticipant.findMany({
      where: { userId: ownerId, quest: { gameId: { in: relatedIds }, status: { in: ["confirmed", "pending"] } } },
      include: {
        quest: {
          include: {
            participants: { orderBy: { seat: "asc" }, include: { user: { select: { id: true, displayName: true, handle: true, color: true } }, guest: { select: { name: true } } } },
          },
        },
      },
      orderBy: { quest: { playedAt: "desc" } },
    }),
    db.shelfItem.findFirst({ where: { userId: ownerId, gameId: { in: relatedIds } } }),
  ]);

  const terrain = (tile?.terrainOverride ?? tileGame.terrainOverride ?? tileGame.terrain) as Terrain;
  const plays = tile?.plays ?? 0;
  const nt = nextTier(plays);
  const confirmed = parts.filter((p) => p.quest.status === "confirmed");
  const scored = confirmed.filter((p) => p.score !== null && !p.quest.coop);
  const avg = scored.length ? scored.reduce((n, p) => n + p.score!, 0) / scored.length : null;
  const winsN = confirmed.filter((p) => (p.quest.coop ? p.quest.coopWin === true : p.place === 1)).length;
  const hosted = confirmed.filter((p) => p.quest.hostUserId === ownerId).length;

  // Crown cards: guild crowns first, then the friends crown.
  const best = tile?.bestScore ?? null;
  const crownViews: CrownView[] = crowns
    .sort((a, b) => Number(!a.guildId) - Number(!b.guildId))
    .map((c) => {
      const scope = c.guildId ? `${c.guild?.name ?? "Guild"} crown` : "Friends crown";
      if (c.heldByGuild) return { scope, headline: "Held by the guild", detail: `${cap(c.recordLabel)}.` };
      if (c.holderGroup.length) return { scope, headline: c.holderGroup.includes(ownerId) ? `${isSelf ? "Your" : `${displayName(owner)}’s`} group holds it` : "A group holds it", detail: `${cap(c.recordLabel)}.` };
      const holderIsOwner = c.holderUserId === ownerId;
      const holder = holderIsOwner ? you : displayName(c.holder ?? {});
      const verb = holder === "You" ? "hold" : "holds";
      const points = tileGame.scoring === "points";
      const headline = `${holder} ${verb} it ${points ? "with" : "at"} ${c.recordLabel.replace(" wins", "")}`;
      let detail: string | null = null;
      if (!holderIsOwner && points && best !== null) {
        const gap = c.recordValue - best;
        detail = `${yours} best is ${fmtScore(best)}. ${cap(words(Math.ceil(gap)))} ${Math.ceil(gap) === 1 ? "point" : "points"} to take it.`;
      } else if (!holderIsOwner && !points && plays > 0) {
        const rate = plays ? Math.round(((tile?.wins ?? 0) / plays) * 100) : 0;
        detail = plays >= 5 ? `${yours} win rate is ${rate}%.` : `${cap(words(5 - plays))} more ${5 - plays === 1 ? "play" : "plays"} to qualify.`;
      } else if (holderIsOwner) detail = c.guildId ? `Since ${dayPhrase(c.since, new Date(), tz)}.` : null;
      return { scope, headline, detail };
    });

  // Teaching.
  const taughtBy = taughtEdges.find((e) => e.learnerId === ownerId);
  const myLearners = taughtEdges.filter((e) => e.teacherId === ownerId);
  const spread = spreadFromEdges(taughtEdges, ownerId);
  const person = (u: { displayName: string | null; handle: string | null; color?: PlayerColorKey | null }): Person => ({ name: displayName(u), color: u.color ?? null, handle: u.handle });

  const recordLabels: Record<string, string> = {
    highest_score: "Highest score",
    lowest_winning_score: "Lowest winning score",
    fastest: "Fastest game",
    longest: "Longest game",
    comeback: "Biggest comeback",
    largest_party: "Largest party",
  };
  const order = ["highest_score", "lowest_winning_score", "fastest", "longest", "comeback", "largest_party"];
  const records = houseRecords
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((r) => ({
      what: recordLabels[r.kind] ?? r.kind,
      who: r.kind === "fastest" || r.kind === "longest" ? `${r.detail ?? r.holderName}, ${inMonth(r.achievedAt)}` : r.kind === "comeback" ? `${r.holderName}, ${r.detail ?? ""}` : r.kind === "largest_party" ? inMonth(r.achievedAt).replace(/^in/, "In") : `${r.holderName}, ${inMonth(r.achievedAt)}`,
      value: r.kind === "fastest" || r.kind === "longest" ? duration(r.value) : r.kind === "comeback" ? `+${r.value}` : fmtScore(r.value),
      questId: r.questId,
    }));

  const history = parts.slice(0, 12).map((p) => {
    const q = p.quest;
    const winners = q.participants.filter((x) => x.place === 1);
    const nameOf = (x: (typeof q.participants)[number]) => (x.userId === ownerId ? (isSelf ? "You" : displayName(owner)) : x.user ? displayName(x.user) : x.guest?.name ?? "Guest");
    return {
      questId: q.id,
      when: relativeDay(q.playedAt, new Date(), tz),
      party: q.participants.map((x) => ({ name: x.user ? displayName(x.user) : x.guest?.name ?? "Guest", color: x.user?.color ?? null })),
      winner: q.coop ? (q.coopWin ? "Everyone" : "Nobody") : winners.length ? winners.map(nameOf).join(", ") : "–",
      score: p.score !== null ? fmtScore(p.score) : "",
      place: q.coop ? (q.coopWin ? "Won" : "Lost") : p.place ? ordinal(p.place) : "",
      pending: q.status === "pending",
    };
  });

  const facts: string[] = [];
  if (tileGame.year) facts.push(String(tileGame.year));
  if (tileGame.minPlayers && tileGame.maxPlayers) facts.push(tileGame.minPlayers === tileGame.maxPlayers ? plural(tileGame.minPlayers, "player") : `${tileGame.minPlayers} to ${tileGame.maxPlayers} players`);
  if (tileGame.minTime && tileGame.maxTime) facts.push(tileGame.minTime === tileGame.maxTime ? `${tileGame.minTime} minutes` : `${tileGame.minTime} to ${tileGame.maxTime} minutes`);
  if (tileGame.weight) facts.push(`weight ${tileGame.weight.toFixed(1)}`);

  return {
    owner: { id: owner.id, name: displayName(owner), handle: owner.handle },
    isSelf,
    game: {
      id: tileGame.id,
      slug: tileGame.slug,
      name: tileGame.name,
      terrain,
      globalTerrain: (tileGame.terrainOverride ?? tileGame.terrain) as Terrain,
      derivedTerrain: tileGame.terrain as Terrain,
      terrainOverride: tileGame.terrainOverride as Terrain | null,
      scoring: tileGame.scoring,
      categories: tileGame.categories,
      mechanics: tileGame.mechanics,
      altNames: tileGame.altNames,
      source: tileGame.source,
      expansions: game.baseGame ? [] : game.expansions,
      viewedExpansion: game.baseGame ? { name: game.name } : null,
      monogram: monogramFor(tileGame.name, tileGame.short, tile?.monogramOverride),
      monogramOverride: tile?.monogramOverride ?? null,
      tileTerrainOverride: (tile?.terrainOverride as Terrain | null) ?? null,
    },
    tile: tile ? { plays, pending: tile.pendingPlays, tier: tile.tier } : null,
    tierLine: plays ? `${tierName(tile!.tier)}, ${plural(plays, "play")}.${nt ? ` ${nt.playsNeeded} more for ${withArticle(nt.tier.name)}.` : " A Wonder. Nothing left to build."}` : tile?.pendingPlays ? "Waiting for confirmation." : "Not on this island yet.",
    factsLine: `${TERRAIN_INFO[terrain].name} region.${facts.length ? ` ${facts.join(", ")}.` : ""}`,
    records: { best, avg, winRate: confirmed.length ? Math.round((winsN / confirmed.length) * 100) : null, hosted },
    crowns: crownViews,
    taughtBy: taughtBy ? person(taughtBy.teacher) : null,
    learners: myLearners.map((e) => person(e.learner)),
    spread,
    houseRecords: records,
    history,
    onShelf: !!shelfItem && plays === 0,
  };
}
