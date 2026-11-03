"use server";

import { z } from "zod";
import { requireActionUser } from "@/lib/session";
import { claimGuest } from "@/server/quests";

/** Returns where to go next; the client navigates (server redirects across route groups are unreliable). */
export async function claimGuestAction(form: FormData): Promise<{ redirectTo: string }> {
  const viewer = await requireActionUser();
  const token = z.string().min(1).max(60).parse(form.get("token"));
  const res = await claimGuest(viewer.id, token);
  return { redirectTo: viewer.onboardedAt ? `/?claimed=${res.quests}` : "/onboarding" };
}
