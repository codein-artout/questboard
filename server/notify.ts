import { Prisma } from "@prisma/client";
import { APP_NAME } from "@/game/config";
import { db } from "@/lib/db";
import { emailHtml, sendEmail } from "@/lib/email";

export type NotificationType =
  | "confirm_request"
  | "quest_confirmed"
  | "quest_disputed"
  | "quest_edited"
  | "crown_taken"
  | "crown_lost"
  | "tier_up"
  | "title_unlocked"
  | "game_night"
  | "game_night_changed"
  | "campaign_finale"
  | "campaign_champion"
  | "friend_request"
  | "friend_accepted"
  | "guild_joined"
  | "comment"
  | "reaction"
  | "guest_claimed"
  | "import_done";

/** Types that may also go out by email (when the player allows email). */
const EMAIL_TYPES = new Set<NotificationType>([
  "confirm_request",
  "quest_disputed",
  "crown_taken",
  "crown_lost",
  "tier_up",
  "title_unlocked",
  "game_night",
  "campaign_finale",
]);

export type NotificationData = { title: string; body?: string; href?: string } & Record<string, unknown>;

/**
 * Creates an in-app notification (once per dedupe key) and, for the types
 * above, an email if the player allows it. Returns true when it was new.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  data: NotificationData,
  dedupeKey?: string,
): Promise<boolean> {
  try {
    const n = await db.notification.create({
      data: { userId, type, data: data as Prisma.InputJsonValue, dedupeKey: dedupeKey ?? null },
    });
    if (EMAIL_TYPES.has(type)) void emailFor(n.id, userId, data);
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
    throw err;
  }
}

async function emailFor(notificationId: string, userId: string, data: NotificationData) {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, emailNotifications: true } });
    if (!user?.email || !user.emailNotifications) return;
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const url = data.href ? new URL(data.href, base).toString() : base;
    await sendEmail({
      to: user.email,
      subject: `${data.title} · ${APP_NAME}`,
      text: `${data.title}\n${data.body ?? ""}\n\n${url}\n\nTurn off email in Settings.`,
      html: emailHtml(data.title, data.body ?? "", { label: "Open Questboard", url }),
      tag: "notification",
    });
    await db.notification.update({ where: { id: notificationId }, data: { emailedAt: new Date() } });
  } catch (err) {
    console.error("[notify] email failed", err);
  }
}
