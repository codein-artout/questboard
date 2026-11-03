"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelNightAction } from "@/app/actions/nights";
import { Button } from "@/components/ui/Button";

export function CancelNight({ nightId }: { nightId: string }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();
  if (!sure) return <Button variant="ghost" onClick={() => setSure(true)}>Cancel game night</Button>;
  return (
    <span className="flex items-center gap-2">
      <span className="text-sm text-muted">Tell everyone it’s off?</span>
      <Button variant="danger" size="sm" disabled={pending} onClick={() => start(async () => { await cancelNightAction(nightId); router.refresh(); })}>
        Cancel it
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setSure(false)}>
        Keep it
      </Button>
    </span>
  );
}
