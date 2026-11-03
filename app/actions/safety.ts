"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, UserError, type ActionResult } from "@/lib/action";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { requireActionUser } from "@/lib/session";
import { recompute } from "@/server/recompute";

const reportSchema = z.object({
  targetType: z.enum(["user", "quest", "comment", "game"]),
  targetId: z.string().min(1).max(40),
  reason: z.enum(["spam", "harassment", "fake", "inappropriate", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export async function reportAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const r = reportSchema.parse(input);
    await rateLimit("report", viewer.id);
    const exists =
      r.targetType === "user"
        ? await db.user.findUnique({ where: { id: r.targetId }, select: { id: true } })
        : r.targetType === "quest"
          ? await db.quest.findUnique({ where: { id: r.targetId }, select: { id: true } })
          : r.targetType === "comment"
            ? await db.comment.findUnique({ where: { id: r.targetId }, select: { id: true } })
            : await db.game.findUnique({ where: { id: r.targetId }, select: { id: true } });
    if (!exists) throw new UserError("That no longer exists.");
    await db.report.create({ data: { reporterId: viewer.id, targetType: r.targetType, targetId: r.targetId, reason: r.reason, details: r.details || null } });
    return null;
  });
}

const userIdSchema = z.string().min(1).max(40);

/** Blocking removes any friendship both ways, hides each other's content and stops party adds. */
export async function blockUserAction(userId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const id = userIdSchema.parse(userId);
    if (id === viewer.id) throw new UserError("You can't block yourself.");
    await db.$transaction([
      db.block.upsert({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: id } }, create: { blockerId: viewer.id, blockedId: id }, update: {} }),
      db.friendship.deleteMany({ where: { OR: [{ requesterId: viewer.id, addresseeId: id }, { requesterId: id, addresseeId: viewer.id }] } }),
    ]);
    await recompute([viewer.id, id], { notify: false });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function unblockUserAction(userId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    await db.block.deleteMany({ where: { blockerId: viewer.id, blockedId: userIdSchema.parse(userId) } });
    revalidatePath("/settings");
    return null;
  });
}
