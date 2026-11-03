"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PlayerColor, Privacy } from "@prisma/client";
import { runAction, UserError, type ActionResult } from "@/lib/action";
import { db } from "@/lib/db";
import { signOut } from "@/lib/auth";
import { requireActionUser } from "@/lib/session";
import { settingsSchema } from "@/lib/validation/profile";
import { deleteAccount } from "@/server/account";

export async function saveSettingsAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const s = settingsSchema.parse(input);
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: s.timezone });
    } catch {
      throw new UserError("Unknown time zone.");
    }
    await db.user.update({ where: { id: viewer.id }, data: { displayName: s.displayName, color: s.color as PlayerColor, privacy: s.privacy as Privacy, emailNotifications: s.emailNotifications, timezone: s.timezone } });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const list = ids ? z.array(z.string().min(1).max(40)).max(200).parse(ids) : undefined;
    await db.notification.updateMany({ where: { userId: viewer.id, readAt: null, ...(list ? { id: { in: list } } : {}) }, data: { readAt: new Date() } });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function deleteAccountAction(confirmHandle: string): Promise<ActionResult<null>> {
  const res = await runAction(async () => {
    const viewer = await requireActionUser();
    if (z.string().trim().toLowerCase().parse(confirmHandle) !== viewer.handle) throw new UserError("Type your handle to confirm.");
    await deleteAccount(viewer.id);
    return null;
  });
  if (res.ok) await signOut({ redirectTo: "/" });
  return res;
}
