import { theGame } from "@/lib/format";
import type { Terrain } from "@/game/config";
import { hexKey, neighbors } from "@/game/hex";
import { tierName, withArticle } from "@/game/tiers";
import type { QuestOutcomePayload } from "@/game/types";
import { db } from "@/lib/db";
import { fmtScore, plural } from "@/lib/format";
import { listNames } from "@/lib/quest-places";
import type { PlayerColorKey } from "@/lib/colors";
import { displayName } from "@/server/social";

export type RewardData = {
  questId: string;
  status: "pending" | "confirmed" | "disputed";
  game: { name: string; slug: string; terrain: Terrain };
  variant: "new-land" | "tier-up" | "crown" | "replay";
  label: string;
  title: string;
  subtitle: string;
  payload: QuestOutcomePayload;
  tile: { q: number; r: number; tier: number; terrain: Terrain };
  neighbors: { dq: number; dr: number; terrain: Terrain; tier: number }[];
  crown: { fromName: string | null; fromColor: PlayerColorKey | null; scope: string } | null;
  me: { name: string; color: PlayerColorKey };
  party: { name: string; color: PlayerColorKey | null; score: number | null; place: number | null; isMe: boolean }[];
  waitingOn: string[];
  autoConfirmAt: string | null;
};

export async function getReward(questId: string, viewerId: string): Promise<RewardData | null> {
  const q = await db.quest.findUnique({
    where: { id: questId },
    include: {
      game: { select: { name: true, slug: true, terrain: true, terrainOverride: true, baseGameId: true } },
      participants: { orderBy: { seat: "asc" }, include: { user: { select: { id: true, displayName: true, handle: true, color: true } }, guest: { select: { name: true } } } },
      outcomes: { where: { userId: viewerId } },
      confirmations: { select: { userId: true, kind: true, resolvedAt: true } },
      guild: { select: { name: true } },
    },
  });
  if (!q || !q.participants.some((p) => p.userId === viewerId)) return null;
  const outcome = q.outcomes[0];
  if (!outcome) return null;
  const p = outcome.payload as unknown as QuestOutcomePayload;
  const [tile, me, allTiles] = await Promise.all([
    db.tile.findUnique({ where: { userId_gameId: { userId: viewerId, gameId: p.tileGameId } }, include: { game: { select: { name: true, slug: true, terrain: true, terrainOverride: true } } } }),
    db.user.findUniqueOrThrow({ where: { id: viewerId }, select: { displayName: true, handle: true, color: true } }),
    db.tile.findMany({ where: { userId: viewerId }, select: { q: true, r: true, tier: true, plays: true, terrainOverride: true, game: { select: { terrain: true, terrainOverride: true } } } }),
  ]);
  const terrain = (tile?.terrainOverride ?? tile?.game.terrainOverride ?? tile?.game.terrain ?? q.game.terrainOverride ?? q.game.terrain) as Terrain;
  const tileName = tile?.game.name ?? q.game.name;
  const at = { q: tile?.q ?? 0, r: tile?.r ?? 0 };
  const byPos = new Map(allTiles.map((t) => [hexKey(t), t]));
  const nbrs = neighbors(at)
    .map((h) => ({ h, t: byPos.get(hexKey(h)) }))
    .filter((x) => x.t && (x.t.plays > 0))
    .map((x) => ({ dq: x.h.q - at.q, dr: x.h.r - at.r, terrain: (x.t!.terrainOverride ?? x.t!.game.terrainOverride ?? x.t!.game.terrain) as Terrain, tier: x.t!.tier }));

  const names = new Map(q.participants.map((x) => [x.userId ?? x.id, x.user ? displayName(x.user) : x.guest?.name ?? "Guest"]));
  const myPart = q.participants.find((x) => x.userId === viewerId)!;
  const winners = q.participants.filter((x) => x.place === 1);
  const second = q.participants.filter((x) => x.place === 2);
  let placeLine = "";
  if (q.coop) placeLine = q.coopWin ? "Won together" : q.coopWin === false ? "Lost together" : "Played together";
  else if (myPart.place === 1) {
    const gap = myPart.score !== null && second[0]?.score !== null && second[0]?.score !== undefined ? myPart.score - second[0].score : null;
    placeLine = winners.length > 1 ? `You tied for 1st with ${listNames(winners.filter((w) => w.userId !== viewerId).map((w) => names.get(w.userId ?? w.id)!))}` : gap !== null && gap > 0 ? `You won by ${fmtScore(gap)}` : "You won";
  } else if (myPart.place) {
    const lead = winners[0];
    const gap = myPart.score !== null && lead?.score !== null && lead?.score !== undefined ? lead.score - myPart.score : null;
    const ord = myPart.place === 2 ? "2nd" : myPart.place === 3 ? "3rd" : `${myPart.place}th`;
    placeLine = `You placed ${ord}${gap !== null && lead ? `, ${fmtScore(gap)} behind ${names.get(lead.userId ?? lead.id)}` : ""}`;
  }

  const crownEv = p.crownsTaken[0] ?? null;
  let variant: RewardData["variant"] = "replay";
  let label = `Quest complete, play ${p.plays}`;
  let title = tileName;
  let subtitle = placeLine;
  if (p.newLand) {
    variant = "new-land";
    label = "Quest complete";
    title = tileName;
  } else if (p.tierUp) {
    variant = "tier-up";
    title = `${tileName} rises`;
    subtitle = p.tierUp.from ? `From ${withArticle(tierName(p.tierUp.from))} to ${withArticle(tierName(p.tierUp.to))}` : `Now ${withArticle(tierName(p.tierUp.to))}`;
  } else if (crownEv) {
    variant = "crown";
    label = "Quest complete";
    title = "Crown taken";
    subtitle = `You took ${theGame(tileName)} crown${crownEv.fromName ? ` from ${crownEv.fromName}` : ""}`;
  }
  let fromColor: PlayerColorKey | null = null;
  if (crownEv?.fromUserId) {
    const u = await db.user.findUnique({ where: { id: crownEv.fromUserId }, select: { color: true } });
    fromColor = u?.color ?? null;
  }
  const responded = new Set(q.confirmations.filter((c) => !c.resolvedAt).map((c) => c.userId));
  const waitingOn = q.participants.filter((x) => x.userId && x.userId !== q.loggedById && !responded.has(x.userId)).map((x) => names.get(x.userId!)!);

  return {
    questId: q.id,
    status: q.status,
    game: { name: tileName, slug: tile?.game.slug ?? q.game.slug, terrain },
    variant,
    label,
    title,
    subtitle,
    payload: p,
    tile: { ...at, tier: Math.max(1, tile?.tier ?? 1), terrain },
    neighbors: nbrs,
    crown: crownEv ? { fromName: crownEv.fromName, fromColor, scope: crownEv.guildId ? `${q.guild?.name ?? "Guild"} crown` : "Friends crown" } : null,
    me: { name: displayName(me), color: me.color },
    party: q.participants.map((x) => ({ name: names.get(x.userId ?? x.id)!, color: x.user?.color ?? null, score: x.score, place: x.place, isMe: x.userId === viewerId })),
    waitingOn,
    autoConfirmAt: q.autoConfirmAt?.toISOString() ?? null,
  };
}

export const tileCountLine = (n: number, terrain: string) => `A ${terrain.toLowerCase()} tile joins your island. That makes ${plural(n, "tile")}.`;
