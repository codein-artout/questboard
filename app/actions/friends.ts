"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, UserError, type ActionResult } from "@/lib/action";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { requireActionUser } from "@/lib/session";
import { notify } from "@/server/notify";
import { recompute } from "@/server/recompute";
import { blockedIds, displayName } from "@/server/social";

const id = z.string().min(1).max(40);

export async function sendFriendRequestAction(userId: string): Promise<ActionResult<{ status: "pending" | "accepted" }>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const target = id.parse(userId);
    if (target === viewer.id) throw new UserError("That's you.");
    if ((await blockedIds(viewer.id)).has(target)) throw new UserError("You can't add this player.");
    await rateLimit("friendRequest", viewer.id);
    const existing = await db.friendship.findFirst({ where: { OR: [{ requesterId: viewer.id, addresseeId: target }, { requesterId: target, addresseeId: viewer.id }] } });
    if (existing?.status === "accepted") return { status: "accepted" as const };
    if (existing && existing.requesterId === target) {
      await db.friendship.update({ where: { id: existing.id }, data: { status: "accepted", acceptedAt: new Date() } });
      await notify(target, "friend_accepted", { title: `${displayName(viewer)} accepted your friend request`, href: `/u/${viewer.handle}` }, `friend_accepted:${existing.id}`);
      await recompute([viewer.id, target], { notify: false });
      revalidatePath("/", "layout");
      return { status: "accepted" as const };
    }
    if (!existing) {
      const f = await db.friendship.create({ data: { requesterId: viewer.id, addresseeId: target } });
      await notify(target, "friend_request", { title: `${displayName(viewer)} wants to be friends`, href: `/u/${viewer.handle}`, friendshipId: f.id }, `friend_request:${f.id}`);
    }
    revalidatePath("/", "layout");
    return { status: "pending" as const };
  });
}

export async function respondFriendRequestAction(friendshipId: string, accept: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const f = await db.friendship.findUnique({ where: { id: id.parse(friendshipId) } });
    if (!f || f.addresseeId !== viewer.id || f.status !== "pending") throw new UserError("That request is gone.");
    if (accept) {
      await db.friendship.update({ where: { id: f.id }, data: { status: "accepted", acceptedAt: new Date() } });
      await notify(f.requesterId, "friend_accepted", { title: `${displayName(viewer)} accepted your friend request`, href: `/u/${viewer.handle}` }, `friend_accepted:${f.id}`);
      await recompute([viewer.id, f.requesterId], { notify: false });
    } else await db.friendship.delete({ where: { id: f.id } });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function unfriendAction(userId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const target = id.parse(userId);
    await db.friendship.deleteMany({ where: { OR: [{ requesterId: viewer.id, addresseeId: target }, { requesterId: target, addresseeId: viewer.id }] } });
    await recompute([viewer.id, target], { notify: false });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function setDisplayedTitleAction(titleId: string | null): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const t = titleId === null ? null : z.string().min(1).max(80).parse(titleId);
    if (t) {
      const award = await db.titleAward.findUnique({ where: { userId_titleId: { userId: viewer.id, titleId: t } } });
      if (!award) throw new UserError("You haven't earned that title yet.");
    }
    await db.user.update({ where: { id: viewer.id }, data: { displayedTitleId: t } });
    revalidatePath("/", "layout");
    return null;
  });
}
