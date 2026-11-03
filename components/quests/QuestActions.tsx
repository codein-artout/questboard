"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmQuestAction, deleteQuestAction, disputeQuestAction, withdrawDisputeAction } from "@/app/actions/quests";
import { Button, buttonClass } from "@/components/ui/Button";

export function ConfirmDispute({ questId, canConfirm, canDispute }: { questId: string; canConfirm: boolean; canDispute: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      else router.refresh();
    });
  return (
    <div className="mt-3">
      {!disputing ? (
        <div className="flex flex-wrap gap-2">
          {canConfirm ? (
            <Button onClick={() => run(() => confirmQuestAction(questId))} disabled={pending}>
              Confirm quest
            </Button>
          ) : null}
          {canDispute ? (
            <Button variant="secondary" onClick={() => setDisputing(true)} disabled={pending}>
              Something’s wrong
            </Button>
          ) : null}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => disputeQuestAction(questId, reason));
          }}
          className="flex flex-col gap-2"
        >
          <label className="flex flex-col gap-1 text-sm font-semibold">
            What’s wrong?
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={300} rows={2} className="rounded-xl bg-sea p-3 text-sm font-normal text-text" placeholder="My score was 84, not 48." />
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={pending || reason.trim().length < 3}>
              Dispute quest
            </Button>
            <Button variant="ghost" onClick={() => setDisputing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {error ? <p role="alert" className="m-0 mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function WithdrawDispute({ questId }: { questId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" className="mt-3" disabled={pending} onClick={() => start(async () => { await withdrawDisputeAction(questId); router.refresh(); })}>
      Withdraw my dispute
    </Button>
  );
}

export function OwnerActions({ questId }: { questId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/quests/${questId}/edit`} className={buttonClass("secondary", "sm")}>
        Edit quest
      </Link>
      {confirming ? (
        <>
          <span className="text-sm text-muted">Delete for everyone?</span>
          <Button variant="danger" size="sm" disabled={pending} onClick={() => start(async () => { const r = await deleteQuestAction(questId); if (r.ok) router.replace("/quests"); })}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep it
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      )}
    </div>
  );
}
