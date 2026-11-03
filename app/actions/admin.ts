"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, UserError, type ActionResult } from "@/lib/action";
import { slugify, searchTextFor } from "@/lib/catalog/schema";
import { db } from "@/lib/db";
import { requireActionUser } from "@/lib/session";

async function requireAdmin() {
  const viewer = await requireActionUser();
  if (!viewer.isAdmin) throw new UserError("Admins only.");
  return viewer;
}

export async function resolveReportAction(reportId: string, status: "resolved" | "dismissed"): Promise<ActionResult<null>> {
  return runAction(async () => {
    const admin = await requireAdmin();
    await db.report.update({ where: { id: z.string().min(1).max(40).parse(reportId) }, data: { status: z.enum(["resolved", "dismissed"]).parse(status), resolvedById: admin.id, resolvedAt: new Date() } });
    revalidatePath("/admin");
    return null;
  });
}

/** Moves a custom game into the shared catalog (everyone can find and log it). */
export async function promoteGameAction(gameId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await requireAdmin();
    const g = await db.game.findUnique({ where: { id: z.string().min(1).max(40).parse(gameId) } });
    if (!g || g.source !== "custom") throw new UserError("That isn't a custom game.");
    let slug = slugify(g.name);
    if (await db.game.findFirst({ where: { slug, NOT: { id: g.id } } })) slug = g.slug;
    await db.game.update({ where: { id: g.id }, data: { source: "catalog", slug, needsConfirmation: false, searchText: searchTextFor(g.name, g.altNames) } });
    revalidatePath("/admin");
    return null;
  });
}

/** Deletes a content item from a report (comment) as a moderation action. */
export async function removeCommentAction(commentId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await requireAdmin();
    await db.comment.deleteMany({ where: { id: z.string().min(1).max(40).parse(commentId) } });
    revalidatePath("/admin");
    return null;
  });
}
