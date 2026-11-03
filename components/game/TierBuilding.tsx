import { BUILDING_PATHS } from "./glyphs";

/** The filled building glyph for a tier (1 Outpost ... 6 Wonder). */
export function TierBuilding({ tier, size, color, className, title }: { tier: number; size: number; color: string; className?: string; title?: string }) {
  const d = BUILDING_PATHS[tier];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      <path d={d} fill={color} />
    </svg>
  );
}
