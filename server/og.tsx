import { ImageResponse } from "next/og";
import type { Terrain } from "@/game/config";
import { TERRAIN_INFO } from "@/game/config";
import { monogramFor } from "@/game/monogram";
import { tierName } from "@/game/tiers";
import type { QuestOutcomePayload } from "@/game/types";
import { db } from "@/lib/db";
import { plural, possessive } from "@/lib/format";
import { OG_SIZE, OgBrand, OgChip, OgIsland, ogFonts, type OgTile } from "@/lib/og";
import { outcomeLine } from "@/lib/quest-places";
import { displayName } from "@/server/social";

async function islandTiles(userId: string, highlight?: string): Promise<OgTile[]> {
  const tiles = await db.tile.findMany({ where: { userId, plays: { gt: 0 } }, include: { game: { select: { name: true, short: true, terrain: true, terrainOverride: true } } } });
  return tiles.map((t) => ({
    q: t.q,
    r: t.r,
    terrain: (t.terrainOverride ?? t.game.terrainOverride ?? t.game.terrain) as Terrain,
    tier: t.tier,
    mono: monogramFor(t.game.name, t.game.short, t.monogramOverride),
    highlight: t.gameId === highlight,
  }));
}

const frame = (left: React.ReactNode, text: React.ReactNode, chips: React.ReactNode) => (
  <div style={{ width: "100%", height: "100%", display: "flex", background: "#0F2E45", color: "#EAF2F7", fontFamily: "Archivo" }}>
    <div style={{ position: "absolute", left: 40, top: 70, width: 500, height: 480, display: "flex" }}>{left}</div>
    <div style={{ position: "absolute", left: 600, right: 64, top: 64, bottom: 64, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ fontFamily: "Big Shoulders", fontWeight: 900, fontSize: 34, color: "#F5C84B" }}>Questboard</div>
      {text}
      {chips}
    </div>
  </div>
);

async function respond(node: React.ReactElement) {
  return new ImageResponse(node, { ...OG_SIZE, fonts: await ogFonts() });
}

/** Public-only: everything else gets a neutral brand card. */
async function publicUser(handle: string) {
  const u = await db.user.findUnique({ where: { handle }, select: { id: true, displayName: true, handle: true, privacy: true, stats: true } });
  return u && u.privacy === "PUBLIC" ? u : null;
}

export async function islandOg(handle: string) {
  const u = await publicUser(handle);
  if (!u) return respond(<OgBrand line="Every game you play is a tile on your island." />);
  const tiles = await islandTiles(u.id);
  const s = u.stats;
  return respond(
    frame(
      <OgIsland tiles={tiles} width={500} height={480} />,
      <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, fontWeight: 600, color: "#9DB7C9" }}>{s?.className ?? "A new island"}</div>
          <div style={{ fontFamily: "Big Shoulders", fontWeight: 900, fontSize: 104, lineHeight: 0.92, marginTop: 8 }}>{`${possessive(displayName(u))} island`}</div>
          <div style={{ fontSize: 30, fontWeight: 600, marginTop: 18 }}>{s ? `${plural(s.gamesExplored, "game")}, ${plural(s.totalPlays, "play")}, h-index ${s.hIndex}` : ""}</div>
      </div>,
      <div style={{ display: "flex", gap: 12 }}>
          <OgChip gold>{`Level ${s?.level ?? 1}`}</OgChip>
          {s?.crownsHeld ? <OgChip>{plural(s.crownsHeld, "crown")}</OgChip> : null}
      </div>,
    ),
  );
}

export async function tileOg(handle: string, slug: string) {
  const u = await publicUser(handle);
  const game = await db.game.findUnique({ where: { slug }, select: { id: true, name: true, baseGameId: true } });
  if (!u || !game) return respond(<OgBrand line="Every game you play is a tile on your island." />);
  const tileGameId = game.baseGameId ?? game.id;
  const tile = await db.tile.findUnique({ where: { userId_gameId: { userId: u.id, gameId: tileGameId } }, include: { game: { select: { name: true, terrain: true, terrainOverride: true } } } });
  const tiles = await islandTiles(u.id, tileGameId);
  const terrain = (tile?.terrainOverride ?? tile?.game.terrainOverride ?? tile?.game.terrain ?? "forest") as Terrain;
  return respond(
    frame(
      <OgIsland tiles={tiles} width={500} height={480} />,
      <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, fontWeight: 600, color: "#9DB7C9" }}>{`On ${possessive(displayName(u))} island`}</div>
          <div style={{ fontFamily: "Big Shoulders", fontWeight: 900, fontSize: 112, lineHeight: 0.92, marginTop: 8 }}>{tile?.game.name ?? game.name}</div>
          <div style={{ fontSize: 30, fontWeight: 600, marginTop: 18 }}>{tile ? `${tierName(tile.tier)}, ${plural(tile.plays, "play")}` : "Not played yet"}</div>
      </div>,
      <div style={{ display: "flex", gap: 12 }}>
          <OgChip>{`${TERRAIN_INFO[terrain].name} region`}</OgChip>
      </div>,
    ),
  );
}

export async function questOg(questId: string) {
  const q = await db.quest.findUnique({
    where: { id: questId },
    include: {
      game: { select: { name: true, scoring: true, baseGameId: true, id: true } },
      loggedBy: { select: { id: true, privacy: true, displayName: true, handle: true } },
      participants: { orderBy: { seat: "asc" }, include: { user: { select: { displayName: true, handle: true, privacy: true } }, guest: { select: { name: true } } } },
      outcomes: true,
    },
  });
  if (!q || q.loggedBy?.privacy !== "PUBLIC") return respond(<OgBrand line="A quest on Questboard." />);
  const nameOf = (p: (typeof q.participants)[number]) => (p.user ? (p.user.privacy === "PRIVATE" ? "A player" : displayName(p.user)) : p.guest?.name ?? "Guest");
  const line = outcomeLine(q.coop ? "coop" : q.game.scoring, q.participants.map((p) => ({ name: nameOf(p), score: p.score, place: p.place, team: p.team })), q.coopWin);
  const logger = q.loggedBy;
  const mine = q.outcomes.find((o) => o.userId === logger.id);
  const payload = mine?.payload as unknown as QuestOutcomePayload | undefined;
  const tiles = await islandTiles(logger.id, q.game.baseGameId ?? q.game.id);
  const loggerPart = q.participants.find((p) => p.userId === logger.id);
  const second = !q.coop && loggerPart?.place && loggerPart.place > 1 ? ` ${displayName(logger)} takes ${loggerPart.place === 2 ? "2nd" : loggerPart.place === 3 ? "3rd" : `${loggerPart.place}th`}.` : "";
  return respond(
    frame(
      <OgIsland tiles={tiles} width={500} height={480} />,
      <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, fontWeight: 600, color: "#9DB7C9" }}>{q.status === "confirmed" ? "Quest complete" : "Quest logged"}</div>
          <div style={{ fontFamily: "Big Shoulders", fontWeight: 900, fontSize: q.game.name.length > 16 ? 84 : 112, lineHeight: 0.92, marginTop: 8 }}>{q.game.name}</div>
          <div style={{ fontSize: 30, fontWeight: 600, marginTop: 18 }}>{`${line}.${second}`}</div>
      </div>,
      <div style={{ display: "flex", gap: 12 }}>
          {mine ? <OgChip gold>{`+${mine.xp} XP`}</OgChip> : null}
          {payload?.newLand ? <OgChip>{`Tile ${payload.newLand.tileCount}: ${TERRAIN_INFO[payload.newLand.terrain].name}`}</OgChip> : payload?.tierUp ? <OgChip>{`Rises to ${tierName(payload.tierUp.to)}`}</OgChip> : null}
      </div>,
    ),
  );
}

/** Full-island PNG export for the signed-in player. */
export async function islandExport(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true, handle: true, stats: true } });
  const tiles = await islandTiles(userId);
  const s = u.stats;
  const W = 1600;
  const H = 1200;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0F2E45", color: "#EAF2F7", fontFamily: "Archivo", padding: 56 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Big Shoulders", fontWeight: 900, fontSize: 80, lineHeight: 1 }}>{`${possessive(displayName(u))} island`}</div>
            <div style={{ fontSize: 28, color: "#9DB7C9", marginTop: 8 }}>{s ? `${s.className}, level ${s.level}. ${plural(s.gamesExplored, "game")}, ${plural(s.totalPlays, "play")}, h-index ${s.hIndex}.` : ""}</div>
          </div>
          <div style={{ fontFamily: "Big Shoulders", fontWeight: 900, fontSize: 40, color: "#F5C84B" }}>Questboard</div>
        </div>
        <div style={{ display: "flex", flex: 1, marginTop: 24 }}>
          <OgIsland tiles={tiles} width={W - 112} height={H - 260} maxTile={110} showText />
        </div>
      </div>
    ),
    { width: W, height: H, fonts: await ogFonts(), headers: { "Content-Disposition": `attachment; filename="${u.handle ?? "my"}-island.png"`, "Cache-Control": "private, no-store" } },
  );
}
