"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { confirmImportedGameAction } from "@/app/actions/shelf";
import { Button } from "@/components/ui/Button";

export function ConfirmGame({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { await confirmImportedGameAction(id); router.refresh(); })}>Looks right</Button>;
}
