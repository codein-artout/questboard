import { cn } from "@/lib/cn";

/** Level progress. `gain` shows newly earned XP as a lighter segment after the old fill. */
export function XPBar({ into, forNext, gain = 0, level, thick = false, label = true, className }: { into: number; forNext: number; gain?: number; level: number; thick?: boolean; label?: boolean; className?: string }) {
  const before = Math.max(0, into - gain);
  const pctBefore = Math.min(100, (before / forNext) * 100);
  const pctGain = Math.min(100 - pctBefore, (Math.min(gain, into) / forNext) * 100);
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label={`Level ${level} progress`}
        aria-valuemin={0}
        aria-valuemax={forNext}
        aria-valuenow={into}
        className={cn("flex overflow-hidden rounded-full bg-sea-deep", thick ? "h-2.5" : "h-2")}
      >
        <div className={gain ? "bg-gold-deep" : "bg-gold"} style={{ width: `${pctBefore}%` }} />
        {gain ? <div className="bg-gold-hover" style={{ width: `${pctGain}%` }} /> : null}
      </div>
      {label ? (
        <div className="mt-1.5 text-xs text-muted">
          {into.toLocaleString("en-US")} of {forNext.toLocaleString("en-US")} XP to level {level + 1}
        </div>
      ) : null}
    </div>
  );
}
