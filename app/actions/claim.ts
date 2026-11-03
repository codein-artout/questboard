"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActionUser } from "@/lib/session";
import { claimGuest } from "@/server/quests";

export async function claimGuestAction(form: FormData) {
  const viewer = await requireActionUser();
  const token = z.string().min(1).max(60).parse(form.get("token"));
  const res = await claimGuest(viewer.id, token);
  redirect(viewer.onboardedAt ? `/?claimed=${res.quests}` : "/onboarding");
}
