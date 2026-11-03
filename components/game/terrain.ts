import { TERRAIN_INFO, type Terrain } from "@/game/config";

export type TileKind = "game" | "ghost" | "shelf" | "unexplored";

export function terrainColors(terrain: Terrain) {
  const t = TERRAIN_INFO[terrain];
  return { face: t.face, side: t.side, ink: t.ink, name: t.name };
}

export const SHELF_COLORS = { face: "#17405E", faceSelected: "#23506F", side: "transparent", ink: "#9DB7C9" };
export const UNEXPLORED_FACE = "rgba(255,255,255,0.05)";
