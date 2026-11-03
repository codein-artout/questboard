"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { respondFriendRequestAction } from "@/app/actions/friends";
import { Button } from "@/components/ui/Button";

export function FriendRequestInline({ friendshipId }: { friendshipId: string }) {
  const router = useRouter();
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <span className="text-xs text-muted">{done}</span>;
  const go = (accept: boolean) => start(async () => { const r = await respondFriendRequestAction(friendshipId, accept); setDone(r.ok ? (accept ? "Friends now" : "Declined") : r.error); router.refresh(); });
  return (
    <span className="flex gap-1.5">
      <Button size="sm" disabled={pending} onClick={() => go(true)}>Accept</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => go(false)}>Decline</Button>
    </span>
  );
}
