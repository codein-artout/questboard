import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";
import type { ShellViewer } from "@/components/shell/types";
import { displayName } from "@/server/social";

/** Counts shown in the nav: unplayed shelf games and unread notifications. */
export async function shellViewer(viewer: SessionUser): Promise<ShellViewer> {
  const [shelf, unread] = await Promise.all([
    db.shelfItem.findMany({ where: { userId: viewer.id }, select: { gameId: true, game: { select: { baseGameId: true } } } }),
    db.notification.count({ where: { userId: viewer.id, readAt: null } }),
  ]);
  const roots = shelf.map((s) => s.game.baseGameId ?? s.gameId);
  const played = new Set(
    (await db.tile.findMany({ where: { userId: viewer.id, plays: { gt: 0 }, gameId: { in: roots } }, select: { gameId: true } })).map((t) => t.gameId),
  );
  return {
    handle: viewer.handle ?? "",
    name: displayName(viewer),
    color: viewer.color,
    shelfCount: roots.filter((r) => !played.has(r)).length,
    unread,
    isAdmin: viewer.isAdmin,
  };
}
