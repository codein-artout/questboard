import { TERRAIN_ICON_PATHS } from "./glyphs";

export function TerrainIcon({ terrain, size = 18, color }: { terrain: string; size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d={TERRAIN_ICON_PATHS[terrain] ?? TERRAIN_ICON_PATHS.forest} fill={color} fillRule="evenodd" />
    </svg>
  );
}
