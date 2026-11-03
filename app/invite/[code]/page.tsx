import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { blockedIds } from "@/server/social";
import { notify } from "@/server/notify";

/** /invite/[code]: whoever opens a player's invite link becomes their friend (after signing in). */
export default async function Invite({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/signin?next=${encodeURIComponent(`/invite/${code}`)}`);
  const inviter = await db.user.findUnique({ where: { inviteCode: code }, select: { id: true, handle: true, displayName: true } });
  if (inviter && inviter.id !== viewer.id && !(await blockedIds(viewer.id)).has(inviter.id)) {
    const existing = await db.friendship.findFirst({
      where: { OR: [{ requesterId: inviter.id, addresseeId: viewer.id }, { requesterId: viewer.id, addresseeId: inviter.id }] },
    });
    const now = new Date();
    if (existing) {
      if (existing.status !== "accepted") await db.friendship.update({ where: { id: existing.id }, data: { status: "accepted", acceptedAt: now } });
    } else {
      await db.friendship.create({ data: { requesterId: inviter.id, addresseeId: viewer.id, status: "accepted", acceptedAt: now } });
    }
    await notify(inviter.id, "friend_accepted", { title: `${viewer.displayName ?? viewer.handle ?? "Someone"} joined from your invite`, href: viewer.handle ? `/u/${viewer.handle}` : "/" }, `invite:${viewer.id}`);
    const { recompute } = await import("@/server/recompute");
    await recompute([viewer.id, inviter.id], { notify: false });
  }
  redirect(viewer.onboardedAt ? (inviter?.handle ? `/u/${inviter.handle}` : "/") : "/onboarding");
}
