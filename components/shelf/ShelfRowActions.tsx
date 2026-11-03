"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { proposeAction } from "@/app/actions/nights";
import { removeFromShelfAction } from "@/app/actions/shelf";
import { buttonClass } from "@/components/ui/Button";

export function ShelfRowActions({ gameId, slug, nightId, inVote }: { gameId: string; slug: string; nightId: string | null; inVote: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1">
      {nightId ? (
        inVote ? (
          <span className={buttonClass("outline-gold", "md", "pointer-events-none px-3 text-[13px] opacity-80")}>In the vote</span>
        ) : (
          <button type="button" disabled={pending} onClick={() => start(async () => { await proposeAction(nightId, gameId); router.refresh(); })} className={buttonClass("outline-gold", "md", "px-3 text-[13px]")}>
            Propose
          </button>
        )
      ) : (
        <Link href={`/log?game=${slug}`} className={buttonClass("outline-gold", "md", "px-3 text-[13px]")}>
          Log it
        </Link>
      )}
      <details className="relative">
        <summary className="flex h-11 w-9 cursor-pointer list-none items-center justify-center text-lg text-muted hover:text-text" aria-label="More">
          ⋯
        </summary>
        <div className="absolute right-0 top-11 z-10 w-44 rounded-xl bg-sea-deep p-1 shadow-lg">
          <button type="button" disabled={pending} onClick={() => start(async () => { await removeFromShelfAction(gameId); router.refresh(); })} className="w-full rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-panel">
            I don’t own it any more
          </button>
        </div>
      </details>
    </div>
  );
}
