import type { Terrain } from "@/game/config";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/Button";
import { TileBadge } from "./HexTile";
import { TierLadder } from "./TierLadder";

export type TileCardData = {
  kind: "game" | "ghost" | "shelf" | "unexplored";
  name: string;
  terrain?: Terrain;
  tier: number;
  /** "Citadel, 52 plays" */
  tierLine: string;
  /** "48 more plays to a Wonder." */
  next: string;
  /** Crown holder line, or a call to action for shelf games. */
  crown: string;
  href: string;
  cta: string;
};

/** Selected-tile card: side panel on desktop, compact under the map on phones. */
export function TileCard({ data, layout = "side", className }: { data: TileCardData; layout?: "side" | "compact"; className?: string }) {
  if (layout === "compact") {
    return (
      <section aria-live="polite" aria-label="Selected tile" className={cn("grid grid-cols-[1fr_auto] items-center gap-3 rounded-[14px] bg-panel px-3.5 py-3 shadow-[inset_0_0_0_1.5px_#F5C84B]", className)}>
        <div className="min-w-0">
          <div className="truncate font-display text-2xl font-black leading-[1.05]">{data.name}</div>
          <div className="mt-0.5 text-[13px] text-muted">{[data.tierLine, data.next, data.crown].filter(Boolean).join(" ")}</div>
        </div>
        <ButtonLink href={data.href} size="md" className="px-4 text-sm">
          {data.cta}
        </ButtonLink>
      </section>
    );
  }
  return (
    <section aria-live="polite" aria-label="Selected tile" className={cn("rounded-2xl bg-panel p-[18px] shadow-[inset_0_0_0_1.5px_#F5C84B]", className)}>
      <div className="flex items-center gap-3.5">
        {data.kind === "unexplored" ? (
          <div aria-hidden className="hex h-[69px] w-16 shrink-0 bg-white/5" />
        ) : (
          <TileBadge terrain={data.terrain} tier={data.tier || 1} width={64} kind={data.kind === "shelf" ? "shelf" : "game"} />
        )}
        <div className="min-w-0">
          <h2 className="m-0 font-display text-[30px] font-black leading-none">{data.name}</h2>
          <div className="mt-1 text-sm font-bold">{data.tierLine}</div>
        </div>
      </div>
      {data.terrain && data.kind !== "shelf" ? <TierLadder tier={data.tier} terrain={data.terrain} variant="bars" className="mt-4" /> : <div aria-hidden className="mt-4 grid grid-cols-6 gap-1">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-1.5 rounded-full bg-sea" />)}</div>}
      <div className="mt-2 text-[13px] text-muted">{data.next}</div>
      {data.crown ? <div className="mt-3 border-t border-panel-rule pt-3 text-sm">{data.crown}</div> : null}
      <ButtonLink href={data.href} className="mt-3.5 w-full">
        {data.cta}
      </ButtonLink>
    </section>
  );
}
