"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { TERRAIN_INFO } from "@/game/config";
import { toggleVoteAction, withdrawProposalAction } from "@/app/actions/nights";
import { cn } from "@/lib/cn";
import type { VoteRow } from "@/server/queries/nights";

/** "What to play?" Top games with bars; everyone gets 3 votes. */
export function VoteCard({ title, votes, voterCount, votesLeft, canVote, limit }: { title: string; votes: VoteRow[]; voterCount: number; votesLeft: number; canVote: boolean; limit?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const max = Math.max(1, ...votes.map((v) => v.votes));
  const rows = limit ? votes.slice(0, limit) : votes;
  return (
    <section aria-label={title} className="rounded-2xl bg-panel px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[15px] font-bold">{title}</h2>
        <span className="text-xs text-muted">{voterCount} voted</span>
      </div>
      {rows.length ? (
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {rows.map((v, i) => (
            <li key={v.proposalId} className="grid grid-cols-[1fr_auto_auto] items-center gap-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{v.name}</div>
                <div aria-hidden className="mt-1 h-1.5 rounded-full bg-sea">
                  <div className="h-1.5 rounded-full" style={{ width: `${(v.votes / max) * 100}%`, background: i === 0 && v.votes > 0 ? "#F5C84B" : TERRAIN_INFO[v.terrain].face }} />
                </div>
              </div>
              <span className="font-display text-lg font-extrabold" aria-label={`${v.votes} votes`}>
                {v.votes}
              </span>
              {canVote ? (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-pressed={v.mine}
                    disabled={pending || (!v.mine && votesLeft <= 0)}
                    onClick={() =>
                      start(async () => {
                        const r = await toggleVoteAction(v.proposalId);
                        setError(r.ok ? null : r.error);
                        router.refresh();
                      })
                    }
                    className={cn("h-9 rounded-full px-3 text-xs font-bold disabled:opacity-40", v.mine ? "bg-gold text-sea" : "border-[1.5px] border-outline text-text")}
                    aria-label={`${v.mine ? "Voted" : "Vote"} for ${v.name}`}
                  >
                    {v.mine ? "Voted" : "Vote"}
                  </button>
                  {v.canWithdraw && !limit ? (
                    <button type="button" aria-label={`Remove ${v.name} from the vote`} onClick={() => start(async () => { await withdrawProposalAction(v.proposalId); router.refresh(); })} className="flex h-9 w-8 items-center justify-center text-muted hover:text-danger">
                      <X size={14} aria-hidden />
                    </button>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-2 text-sm text-muted">Nothing proposed yet.</p>
      )}
      {canVote ? <p className="m-0 mt-3 text-xs text-muted">{votesLeft} of 3 votes left.</p> : null}
      {error ? <p role="alert" className="m-0 mt-2 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
