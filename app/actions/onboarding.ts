"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActionUser } from "@/lib/session";
import { profileSchema } from "@/lib/validation/profile";
import type { PlayerColor } from "@prisma/client";

export type ProfileState = { error?: string; field?: string } | null;

export async function saveProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const viewer = await requireActionUser();
  const parsed = profileSchema.safeParse({
    handle: form.get("handle"),
    displayName: form.get("displayName"),
    color: form.get("color"),
    timezone: form.get("timezone") || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check the form", field: String(issue?.path[0] ?? "") };
  }
  const taken = await db.user.findFirst({ where: { handle: parsed.data.handle, NOT: { id: viewer.id } }, select: { id: true } });
  if (taken) return { error: "That handle is taken", field: "handle" };
  let tz = "UTC";
  try {
    if (parsed.data.timezone) {
      new Intl.DateTimeFormat("en-US", { timeZone: parsed.data.timezone });
      tz = parsed.data.timezone;
    }
  } catch {
    tz = "UTC";
  }
  const first = !viewer.onboardedAt;
  await db.user.update({
    where: { id: viewer.id },
    data: { handle: parsed.data.handle, displayName: parsed.data.displayName, color: parsed.data.color as PlayerColor, timezone: tz, onboardedAt: viewer.onboardedAt ?? new Date() },
  });
  redirect(first ? "/onboarding/start" : "/");
}

const shelfSchema = z.object({ gameIds: z.array(z.string().min(1).max(40)).max(200) });

export async function saveOnboardingShelf(form: FormData) {
  const viewer = await requireActionUser();
  const { gameIds } = shelfSchema.parse({ gameIds: form.getAll("gameId").map(String) });
  const valid = await db.game.findMany({ where: { id: { in: gameIds }, source: "catalog" }, select: { id: true } });
  if (valid.length) {
    await db.shelfItem.createMany({
      data: valid.map((g) => ({ userId: viewer.id, gameId: g.id, source: "onboarding" as const })),
      skipDuplicates: true,
    });
    const { recompute } = await import("@/server/recompute");
    await recompute([viewer.id], { notify: false });
  }
  redirect("/");
}
