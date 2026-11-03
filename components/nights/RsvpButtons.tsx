"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { rsvpAction } from "@/app/actions/nights";
import { cn } from "@/lib/cn";

export function RsvpButtons({ nightId, current, tone = "panel" }: { nightId: string; current: string | null; tone?: "panel" | "gold" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (s: string) => start(async () => { await rsvpAction(nightId, s); router.refresh(); });
  if (tone === "gold") {
    return (
      <div className="mt-3.5 flex gap-2" role="group" aria-label="Your RSVP">
        <button type="button" aria-pressed={current === "going"} disabled={pending} onClick={() => set("going")} className="h-11 flex-1 rounded-full bg-sea text-[15px] font-bold text-gold hover:text-gold-hover aria-pressed:shadow-[0_0_0_2px_#0F2E45,0_0_0_4px_#F5C84B]">
          {current === "going" ? "You’re in" : "I’m in"}
        </button>
        <button type="button" aria-pressed={current === "cant"} disabled={pending} onClick={() => set("cant")} className="h-11 flex-1 rounded-full border-[1.5px] border-sea text-[15px] font-bold text-sea aria-pressed:bg-sea/10">
          Can’t make it
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Your RSVP">
      {[["going", "Going"], ["maybe", "Maybe"], ["cant", "Can’t"]].map(([v, l]) => (
        <button key={v} type="button" aria-pressed={current === v} disabled={pending} onClick={() => set(v!)} className={cn("h-11 rounded-full px-5 text-[15px] font-bold", current === v ? "bg-gold text-sea" : "border-[1.5px] border-outline text-text")}>
          {l}
        </button>
      ))}
    </div>
  );
}
