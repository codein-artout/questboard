"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { markNotificationsReadAction } from "@/app/actions/account";
import { Button } from "@/components/ui/Button";

/** Marks what's on screen as read after a moment, so the count in the nav clears. */
export function MarkReadOnView({ ids }: { ids: string[] }) {
  const router = useRouter();
  useEffect(() => {
    if (!ids.length) return;
    const t = setTimeout(async () => {
      await markNotificationsReadAction(ids);
      router.refresh();
    }, 1500);
    return () => clearTimeout(t);
  }, [ids, router]);
  return null;
}

export function MarkAllRead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => { await markNotificationsReadAction(); router.refresh(); })}>
      Mark all read
    </Button>
  );
}
