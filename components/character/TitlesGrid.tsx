"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setDisplayedTitleAction } from "@/app/actions/friends";
import { cn } from "@/lib/cn";

type T = { id: string; name: string; rule: string; earned: boolean; current: number; target: number; text: string };

export function TitlesGrid({ titles, displayed, canChoose }: { titles: T[]; displayed: string | null; canChoose: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showLocked, setShowLocked] = useState(false);
  const earned = titles.filter((t) => t.earned);
  const locked = titles.filter((t) => !t.earned);
  const shown = [...earned, ...(showLocked ? locked : locked.slice(0, Math.max(4, 8 - earned.length)))];
  return (
    <div>
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 desk:grid-cols-3">
        {shown.map((t) => (
          <li key={t.id} className={cn("rounded-[14px] p-3", t.earned ? "bg-title-bg shadow-[inset_0_0_0_1.5px_#7B5CC4]" : "bg-sea-deep shadow-[inset_0_0_0_1.5px_#1C4462]")}>
            <div className={cn("text-sm font-bold", t.earned ? "text-text" : "text-muted")}>{t.name}</div>
            <div className={cn("mt-0.5 text-xs", t.earned ? "text-title-ink" : "text-[#7E99AC]")}>{t.earned ? t.rule : t.text}</div>
            {!t.earned && t.target > 1 ? (
              <div aria-hidden className="mt-2 h-1 rounded-full bg-sea">
                <div className="h-1 rounded-full bg-title-ink" style={{ width: `${Math.min(100, (t.current / t.target) * 100)}%` }} />
              </div>
            ) : null}
            {canChoose && t.earned ? (
              <button
                type="button"
                disabled={pending}
                aria-pressed={displayed === t.id}
                onClick={() => start(async () => { await setDisplayedTitleAction(displayed === t.id ? null : t.id); router.refresh(); })}
                className={cn("-mx-1 mt-1.5 h-8 rounded-full px-1 text-xs font-semibold underline-offset-2", displayed === t.id ? "text-title-ink" : "text-title-ink/80 underline decoration-dotted hover:text-title-ink")}
              >
                {displayed === t.id ? "Shown by your name" : "Show by my name"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {locked.length > shown.length - earned.length ? (
        <button type="button" onClick={() => setShowLocked(true)} className="mt-2 text-sm font-bold text-gold">
          Show all {titles.length} titles
        </button>
      ) : null}
    </div>
  );
}
