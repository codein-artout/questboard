"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { promoteGameAction, removeCommentAction, resolveReportAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";

export function ReportButtons({ id, commentId }: { id: string; commentId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  return (
    <span className="flex flex-wrap gap-1.5">
      {commentId ? <Button size="sm" variant="danger" disabled={pending} onClick={() => run(async () => { await removeCommentAction(commentId); await resolveReportAction(id, "resolved"); })}>Remove comment</Button> : null}
      <Button size="sm" disabled={pending} onClick={() => run(() => resolveReportAction(id, "resolved"))}>Resolved</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => resolveReportAction(id, "dismissed"))}>Dismiss</Button>
    </span>
  );
}

export function PromoteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button size="sm" disabled={pending} onClick={() => start(async () => { await promoteGameAction(id); router.refresh(); })}>Add to catalog</Button>;
}
