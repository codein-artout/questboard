import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Crown, Flag, MessageCircle, Swords, UserPlus, Calendar, Award, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { relativeDay, tzOffsetMinutes } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { PageLayout, PageTitle } from "@/components/shell/PageLayout";
import { EmptyState } from "@/components/ui/Panel";
import { MarkAllRead, MarkReadOnView } from "@/components/settings/MarkRead";
import { FriendRequestInline } from "@/components/settings/FriendRequestInline";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Notifications" };

const ICONS: Record<string, typeof Bell> = {
  crown_taken: Crown,
  crown_lost: Crown,
  tier_up: Award,
  title_unlocked: Award,
  confirm_request: CheckCircle2,
  quest_confirmed: CheckCircle2,
  quest_disputed: Flag,
  quest_edited: Flag,
  comment: MessageCircle,
  reaction: MessageCircle,
  friend_request: UserPlus,
  friend_accepted: UserPlus,
  game_night: Calendar,
  game_night_changed: Calendar,
  campaign_finale: Swords,
  campaign_champion: Swords,
};

type Data = { title?: string; body?: string; href?: string; friendshipId?: string };

export default async function Notifications() {
  const viewer = await requireUser();
  const tz = tzOffsetMinutes(viewer.timezone);
  const items = await db.notification.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const pendingRequests = new Set(
    (await db.friendship.findMany({ where: { addresseeId: viewer.id, status: "pending" }, select: { id: true } })).map((f) => f.id),
  );
  const unread = items.filter((n) => !n.readAt);
  return (
    <PageLayout>
      <div className="flex items-end justify-between gap-3">
        <PageTitle sub={unread.length ? `${unread.length} new` : "You’re all caught up."}>Notifications</PageTitle>
        {unread.length ? <MarkAllRead /> : null}
      </div>
      <MarkReadOnView ids={unread.map((n) => n.id)} />
      {items.length ? (
        <ul className="m-0 mt-4 list-none overflow-hidden rounded-2xl bg-panel p-0">
          {items.map((n) => {
            const d = n.data as Data;
            const Icon = ICONS[n.type] ?? Bell;
            const inner = (
              <>
                <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", n.type.startsWith("crown") ? "bg-gold text-sea" : "bg-sea text-gold")}>
                  <Icon size={16} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", !n.readAt && "font-bold")}>{d.title}</span>
                  {d.body ? <span className="block text-[13px] text-muted">{d.body}</span> : null}
                  <span className="block text-xs text-muted">{relativeDay(n.createdAt, new Date(), tz)}</span>
                </span>
                {!n.readAt ? <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-gold" aria-label="Unread" /> : null}
              </>
            );
            return (
              <li key={n.id} className="border-b border-panel-rule last:border-0">
                <div className="flex items-start gap-3 px-4 py-3">
                  {d.href ? (
                    <Link href={d.href} className="flex min-w-0 flex-1 items-start gap-3 text-text no-underline hover:text-gold-hover">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-start gap-3">{inner}</div>
                  )}
                  {n.type === "friend_request" && d.friendshipId && pendingRequests.has(d.friendshipId) ? <FriendRequestInline friendshipId={d.friendshipId} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="Nothing yet">Confirmations, crowns, tier-ups, titles and game nights show up here.</EmptyState>
      )}
    </PageLayout>
  );
}
