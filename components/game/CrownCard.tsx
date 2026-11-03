import { cn } from "@/lib/cn";
import { CrownIcon } from "./CrownIcon";

/** Gold panel: who holds a crown, with what, and the gap to take it. */
export function CrownCard({ scope, headline, detail, layout = "stack", className }: { scope: string; headline: string; detail?: string | null; layout?: "stack" | "row"; className?: string }) {
  return (
    <section aria-label={scope} className={cn("rounded-2xl bg-gold text-sea", layout === "row" ? "flex items-center gap-3 px-4 py-3.5" : "p-[18px]", className)}>
      <CrownIcon size={34} fill="#0F2E45" stroke={null} className="shrink-0" />
      <div className={layout === "row" ? "flex-1" : undefined}>
        <div className={cn("text-[13px] font-semibold", layout === "stack" && "mt-1.5")}>{scope}</div>
        <div className={cn("font-display font-black leading-[1.05]", layout === "row" ? "text-[22px]" : "text-[28px]")}>{headline}</div>
        {detail ? <div className={cn("mt-1", layout === "row" ? "text-[13px]" : "text-sm")}>{detail}</div> : null}
      </div>
    </section>
  );
}
