"use client";

import Link from "next/link";
import { Frown, Handshake, MessageCircle, PartyPopper, Sparkles } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toggleReactionAction } from "@/app/actions/quests";
import { cn } from "@/lib/cn";

export const REACTION_META = {
  cheer: { label: "Cheer", Icon: PartyPopper },
  gg: { label: "Good game", Icon: Handshake },
  wow: { label: "Wow", Icon: Sparkles },
  ouch: { label: "Ouch", Icon: Frown },
} as const;
type Kind = keyof typeof REACTION_META;

export function Reactions({ questId, reactions, comments, canReact, showComments = true }: { questId: string; reactions: { kind: string; count: number; mine: boolean }[]; comments: number; canReact: boolean; showComments?: boolean }) {
  const [pending, start] = useTransition();
  const [state, toggle] = useOptimistic(reactions, (cur, kind: string) => {
    const has = cur.find((r) => r.kind === kind);
    if (!has) return [...cur, { kind, count: 1, mine: true }];
    return cur.map((r) => (r.kind === kind ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r)).filter((r) => r.count > 0);
  });
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-panel-rule pt-2.5">
      {(Object.keys(REACTION_META) as Kind[]).map((k) => {
        const r = state.find((x) => x.kind === k);
        const { Icon, label } = REACTION_META[k];
        if (!canReact && !r) return null;
        return (
          <button
            key={k}
            type="button"
            disabled={!canReact || pending}
            aria-pressed={!!r?.mine}
            aria-label={`${label}${r ? `, ${r.count}` : ""}`}
            onClick={() =>
              start(async () => {
                toggle(k);
                await toggleReactionAction(questId, k);
              })
            }
            className={cn("flex h-9 min-w-11 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-bold", r?.mine ? "bg-gold text-sea" : "bg-sea text-muted hover:text-text", !canReact && "cursor-default")}
          >
            <Icon size={16} strokeWidth={2} aria-hidden />
            {r ? r.count : null}
          </button>
        );
      })}
      {showComments ? (
        <Link href={`/quests/${questId}#comments`} className="ml-auto flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold text-muted no-underline hover:text-text">
          <MessageCircle size={16} aria-hidden />
          {comments ? `${comments}` : "Comment"}
          <span className="sr-only"> comments</span>
        </Link>
      ) : null}
    </div>
  );
}
