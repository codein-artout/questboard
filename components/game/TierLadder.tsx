import { TIERS, type Terrain } from "@/game/config";
import { cn } from "@/lib/cn";
import { terrainColors } from "./terrain";
import { TierBuilding } from "./TierBuilding";

/**
 * Six tiers. Done tiers use the terrain color, the current tier is gold and
 * future ones are dim. `bars` is the compact tile-card version.
 */
export function TierLadder({ tier, terrain, variant = "hexes", size = "md", className }: { tier: number; terrain: Terrain; variant?: "hexes" | "bars"; size?: "sm" | "md"; className?: string }) {
  const c = terrainColors(terrain);
  if (variant === "bars") {
    return (
      <div aria-hidden className={cn("grid grid-cols-6 gap-1", className)}>
        {TIERS.map((t) => (
          <div key={t.tier} className="h-1.5 rounded-full" style={{ background: t.tier < tier ? c.face : t.tier === tier ? "#F5C84B" : "#0F2E45" }} />
        ))}
      </div>
    );
  }
  const w = size === "sm" ? 40 : 56;
  return (
    <ol className={cn("m-0 grid list-none grid-cols-6 p-0", size === "sm" ? "gap-0.5" : "gap-2", className)}>
      {TIERS.map((t) => {
        const current = t.tier === tier;
        const done = t.tier <= tier;
        return (
          <li key={t.tier} className="flex flex-col items-center gap-1.5" aria-current={current ? "step" : undefined}>
            <div className="hex flex items-center justify-center" style={{ width: w, height: Math.round(w * 1.143), background: current ? "#F5C84B" : done ? c.face : "#0F2E45" }}>
              <TierBuilding tier={t.tier} size={size === "sm" ? 24 : 32} color={current ? "#0F2E45" : done ? c.ink : "#5F7E93"} />
            </div>
            <span className={cn("font-bold", size === "sm" ? "text-xs" : "text-sm", done ? "text-text" : "text-muted")}>
              {t.name}
              {current ? <span className="sr-only"> (current tier)</span> : null}
            </span>
            <span className={cn("text-muted", size === "sm" ? "text-[11px]" : "text-xs")}>
              {t.plays} {t.plays === 1 ? "play" : "plays"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
