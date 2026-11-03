"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, UserError, type ActionResult } from "@/lib/action";
import { db } from "@/lib/db";
import { requireActionUser } from "@/lib/session";
import { recompute } from "@/server/recompute";

const addSchema = z.object({
  gameId: z.string().min(1).max(40),
  acquiredAt: z.coerce.date().refine((d) => d.getTime() <= Date.now() + 86400000, "That date is in the future").optional(),
});

export async function addToShelfAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const s = addSchema.parse(input);
    const game = await db.game.findUnique({ where: { id: s.gameId }, select: { id: true, source: true, createdById: true } });
    if (!game || (game.source === "custom" && game.createdById !== viewer.id)) throw new UserError("Pick a game from the catalog.");
    await db.shelfItem.upsert({
      where: { userId_gameId: { userId: viewer.id, gameId: s.gameId } },
      create: { userId: viewer.id, gameId: s.gameId, acquiredAt: s.acquiredAt ?? new Date(), source: "manual" },
      update: s.acquiredAt ? { acquiredAt: s.acquiredAt } : {},
    });
    await recompute([viewer.id], { notify: false });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function removeFromShelfAction(gameId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    await db.shelfItem.deleteMany({ where: { userId: viewer.id, gameId: z.string().min(1).max(40).parse(gameId) } });
    await recompute([viewer.id], { notify: false });
    revalidatePath("/", "layout");
    return null;
  });
}
