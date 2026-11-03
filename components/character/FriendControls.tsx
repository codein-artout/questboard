"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { respondFriendRequestAction, sendFriendRequestAction, unfriendAction } from "@/app/actions/friends";
import { blockUserAction } from "@/app/actions/safety";
import { Button } from "@/components/ui/Button";

export function FriendControls({ userId, name, state, requestId }: { userId: string; name: string; state: "none" | "friends" | "sent" | "received"; requestId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? null : r.error ?? "Something went wrong"); router.refresh(); });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === "none" ? <Button size="sm" disabled={pending} onClick={() => run(() => sendFriendRequestAction(userId))}>Add friend</Button> : null}
      {state === "sent" ? <span className="text-sm text-muted">Friend request sent</span> : null}
      {state === "received" && requestId ? (
        <>
          <Button size="sm" disabled={pending} onClick={() => run(() => respondFriendRequestAction(requestId, true))}>Accept friend request</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => respondFriendRequestAction(requestId, false))}>Decline</Button>
        </>
      ) : null}
      {state === "friends" ? <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => unfriendAction(userId))}>Unfriend</Button> : null}
      {confirmBlock ? (
        <>
          <span className="text-sm text-muted">Block {name}? You’ll stop seeing each other.</span>
          <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => blockUserAction(userId))}>Block</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmBlock(false)}>Cancel</Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setConfirmBlock(true)}>Block</Button>
      )}
      {msg ? <p role="alert" className="m-0 w-full text-sm text-danger">{msg}</p> : null}
    </div>
  );
}
