import { db } from "@/lib/db";
import { canViewProfile, type Privacy } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { relationBetween } from "@/server/social";

/** Finds a player by handle and decides whether the viewer may see their island. */
export async function resolveProfile(handle: string, viewer: SessionUser | null) {
  const user = await db.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { id: true, handle: true, displayName: true, color: true, privacy: true, displayedTitleId: true, timezone: true, createdAt: true, inviteCode: true },
  });
  if (!user) return null;
  const rel = await relationBetween(viewer?.id ?? null, user.id);
  return { user, rel, canView: canViewProfile(user.privacy as Privacy, rel) };
}
