"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TERRAINS } from "@/game/config";
import { runAction, UserError, type ActionResult } from "@/lib/action";
import { db } from "@/lib/db";
import { requireActionUser } from "@/lib/session";
import { recompute } from "@/server/recompute";

const tileSchema = z.object({
  gameId: z.string().min(1).max(40),
  monogram: z.string().trim().max(12).nullable(),
  terrain: z.enum(TERRAINS).nullable(),
});

/** A player can rename their tile's monogram and move it to another terrain. */
export async function updateTileAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const t = tileSchema.parse(input);
    const tile = await db.tile.findUnique({ where: { userId_gameId: { userId: viewer.id, gameId: t.gameId } } });
    if (!tile) throw new UserError("That game isn't on your island yet.");
    await db.tile.update({ where: { id: tile.id }, data: { monogramOverride: t.monogram || null, terrainOverride: t.terrain } });
    await recompute([viewer.id], { notify: false });
    revalidatePath("/", "layout");
    return null;
  });
}

const adminTerrainSchema = z.object({ gameId: z.string().min(1).max(40), terrain: z.enum(TERRAINS).nullable() });

/** Admins can override a game's terrain for everyone. */
export async function adminSetTerrainAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    if (!viewer.isAdmin) throw new UserError("Admins only.");
    const t = adminTerrainSchema.parse(input);
    await db.game.update({ where: { id: t.gameId }, data: { terrainOverride: t.terrain } });
    const players = await db.tile.findMany({ where: { gameId: t.gameId }, select: { userId: true }, distinct: ["userId"] });
    if (players.length) await recompute(players.map((p) => p.userId), { notify: false });
    revalidatePath("/", "layout");
    return null;
  });
}
