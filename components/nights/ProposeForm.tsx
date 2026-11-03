"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { proposeAction } from "@/app/actions/nights";
import { Button } from "@/components/ui/Button";

export function ProposeForm({ nightId, games, preselect }: { nightId: string; games: { id: string; name: string; mine: boolean }[]; preselect?: string }) {
  const router = useRouter();
  const [gameId, setGameId] = useState(preselect && games.some((g) => g.id === preselect) ? preselect : "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!gameId) return;
        start(async () => {
          const r = await proposeAction(nightId, gameId);
          setMsg(r.ok ? "Added to the vote." : r.error);
          if (r.ok) setGameId("");
          router.refresh();
        });
      }}
    >
      <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[13px] text-muted">
        Propose a game
        <select value={gameId} onChange={(e) => setGameId(e.target.value)} className="h-11 rounded-xl bg-sea px-3 text-sm font-semibold text-text">
          <option value="">Choose from the collections…</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
              {g.mine ? " (your shelf)" : ""}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={pending || !gameId}>
        Propose
      </Button>
      {msg ? <p role="status" className="m-0 w-full text-sm text-muted">{msg}</p> : null}
    </form>
  );
}
