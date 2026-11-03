import type { CSSProperties } from "react";
import type { Terrain } from "@/game/config";
import { cn } from "@/lib/cn";
import { CrownIcon } from "./CrownIcon";
import { PlayerDisc } from "./PlayerDisc";
import type { PlayerColorKey } from "@/lib/colors";
import { BUILDING_SIZE_76 } from "./glyphs";
import { SHELF_COLORS, terrainColors, UNEXPLORED_FACE, type TileKind } from "./terrain";
import { TierBuilding } from "./TierBuilding";

export type HexTileVisual = {
  kind: TileKind;
  terrain?: Terrain;
  /** 0 ghost, 1 Outpost ... 6 Wonder. */
  tier?: number;
  /** Monogram or full name shown under the building. */
  text?: string;
  /** Show the text at all. */
  showText?: boolean;
  /** Text is a full name (wraps to two lines). */
  fullName?: boolean;
  crown?: boolean;
  selected?: boolean;
  pendingTierUp?: boolean;
  /** Guild island: the crown holder's disc under a small crown. */
  holder?: { name: string; color: PlayerColorKey | null } | null;
};

export const tileHeight = (width: number) => Math.round((width * 88) / 76);

/**
 * A pointy-top hex tile: a side layer under a face layer for cardboard depth,
 * the tier building and monogram on the face, a gold crown badge, and a gold
 * halo when selected. Shelf tiles are "?" in panel color; unexplored slots are
 * faint. Purely visual: wrap it in a button or link to make it interactive.
 */
export function HexTile({ width, className, style, ...v }: HexTileVisual & { width: number; className?: string; style?: CSSProperties }) {
  const s = width / 76;
  const h = tileHeight(width);
  const isGame = v.kind === "game" || v.kind === "ghost";
  const colors = isGame && v.terrain ? terrainColors(v.terrain) : null;
  const face =
    v.kind === "unexplored" ? UNEXPLORED_FACE : v.kind === "shelf" ? (v.selected ? SHELF_COLORS.faceSelected : SHELF_COLORS.face) : colors?.face ?? "#17405E";
  const side = isGame ? colors?.side ?? "transparent" : v.kind === "shelf" ? "rgba(0,0,0,0.25)" : "transparent";
  const ink = v.kind === "shelf" ? SHELF_COLORS.ink : colors?.ink ?? "#FFFFFF";
  const tier = v.tier ?? 0;
  const buildingSize = Math.round((BUILDING_SIZE_76[tier] ?? 20) * s * (v.fullName ? 0.8 : 1));
  const fontSize = Math.max(9, Math.round((v.fullName ? 11.5 : 13) * s));
  return (
    <div className={cn("relative", className)} style={{ width, height: h, ...style }} data-kind={v.kind}>
      {v.selected ? <div className="hex absolute bg-gold" style={{ inset: -5 * s }} /> : null}
      {v.kind !== "unexplored" ? (
        <div className="hex absolute" style={{ left: s, right: s, top: 9 * s, height: 86 * s, background: side, opacity: v.kind === "ghost" ? 0.4 : 1 }} />
      ) : null}
      <div
        className="hex absolute flex flex-col items-center justify-center"
        style={{ left: s, right: s, top: 0, height: 86 * s, background: face, gap: 3 * s, opacity: v.kind === "ghost" ? 0.5 : 1 }}
      >
        {v.kind === "shelf" ? (
          <span className="font-display font-black" style={{ color: ink, fontSize: Math.round(26 * s), lineHeight: 1 }} aria-hidden>
            ?
          </span>
        ) : null}
        {isGame && tier > 0 ? <TierBuilding tier={tier} size={buildingSize} color={ink} /> : null}
        {v.kind === "ghost" && tier === 0 ? <TierBuilding tier={1} size={buildingSize} color={ink} /> : null}
        {isGame && v.showText !== false && v.text ? (
          <TileLabel text={v.text} color={ink} fontSize={fontSize} maxWidth={(v.fullName ? 62 : 66) * s} twoLines={!!v.fullName} />
        ) : null}
      </div>
      {v.kind === "ghost" ? (
        <div className="hex absolute" style={{ left: 5 * s, right: 5 * s, top: 4 * s, height: 78 * s, boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.5)", background: "transparent" }} />
      ) : null}
      {v.crown ? <CrownIcon size={Math.round(18 * s)} className="absolute" style={{ right: 4 * s, top: 10 * s }} /> : null}
      {v.holder ? (
        <span className="absolute flex flex-col items-center" style={{ right: 0, top: 4 * s }}>
          <CrownIcon size={Math.round(14 * s)} />
          <PlayerDisc player={v.holder} size={Math.round(20 * s)} edge="#0F2E45" className="-mt-0.5" />
        </span>
      ) : null}
      {v.pendingTierUp ? (
        <svg className="absolute" style={{ left: 6 * s, top: 12 * s }} width={Math.round(16 * s)} height={Math.round(16 * s)} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="11" fill="#0F2E45" />
          <path d="M12 6l5 6h-3v6h-4v-6H7z" fill="#F5C84B" />
        </svg>
      ) : null}
    </div>
  );
}

/** A small decorative hex used in lists and cards. */
export function MiniHex({ terrain, tier, size = 28, kind = "game" }: { terrain?: Terrain; tier?: number; size?: number; kind?: TileKind }) {
  const colors = terrain ? terrainColors(terrain) : null;
  const h = Math.round((size * 32) / 28);
  return (
    <span aria-hidden className="hex inline-flex shrink-0 items-center justify-center" style={{ width: size, height: h, background: kind === "shelf" ? "#0F2E45" : colors?.face ?? "#17405E" }}>
      {kind === "shelf" ? (
        <span className="font-display font-black text-muted" style={{ fontSize: size * 0.55 }}>?</span>
      ) : tier ? (
        <TierBuilding tier={tier} size={Math.round(size * 0.64)} color={colors?.ink ?? "#fff"} />
      ) : null}
    </span>
  );
}

/** A tile with side layer and building, as in the mockups' headers (64, 104, 150px). */
export function TileBadge({ terrain, tier, width, kind = "game", halo = false }: { terrain?: Terrain; tier: number; width: number; kind?: TileKind; halo?: boolean }) {
  const colors = terrain ? terrainColors(terrain) : null;
  const faceH = Math.round((width * 2) / Math.sqrt(3));
  const depth = Math.round(width * 0.105);
  const face = kind === "shelf" ? "#17405E" : colors?.face ?? "#17405E";
  const side = kind === "shelf" ? "#0A2236" : colors?.side ?? "#0A2236";
  const ink = kind === "shelf" ? "#9DB7C9" : colors?.ink ?? "#fff";
  return (
    <div aria-hidden className="relative shrink-0" style={{ width, height: faceH + depth }}>
      {halo ? <div className="hex absolute bg-gold" style={{ left: -8, right: -8, top: -8, height: faceH + 16 }} /> : null}
      <div className="hex absolute inset-x-0" style={{ top: depth, height: faceH, background: side }} />
      <div className="hex absolute inset-x-0 top-0 flex items-center justify-center" style={{ height: faceH, background: face }}>
        {kind === "shelf" ? (
          <span className="font-display font-black" style={{ color: ink, fontSize: width * 0.45 }}>?</span>
        ) : (
          <TierBuilding tier={Math.max(1, tier)} size={Math.round(width * 0.55)} color={ink} />
        )}
      </div>
    </div>
  );
}

/** Wraps a name into at most two lines that fit a width (Big Shoulders is condensed: ~0.47em per char). */
export function wrapLabel(text: string, maxChars: number, twoLines: boolean): string[] {
  const clip = (t: string) => (t.length <= maxChars ? t : `${t.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`);
  if (!twoLines || text.length <= maxChars) return [clip(text)];
  const words = text.split(/\s+/);
  let first = "";
  let i = 0;
  while (i < words.length && `${first} ${words[i]}`.trim().length <= maxChars) first = `${first} ${words[i++]}`.trim();
  if (!first) return [clip(text)];
  const rest = words.slice(i).join(" ");
  return rest ? [first, clip(rest)] : [first];
}

/**
 * The monogram or name on a tile. Drawn as SVG text: it's a decorative
 * duplicate of the tile button's accessible name (which carries the full name,
 * tier and plays), and it keeps the exact terrain ink colors from the design.
 */
function TileLabel({ text, color, fontSize, maxWidth, twoLines }: { text: string; color: string; fontSize: number; maxWidth: number; twoLines: boolean }) {
  const maxChars = Math.max(3, Math.floor(maxWidth / (fontSize * 0.47)));
  const lines = wrapLabel(text, maxChars, twoLines);
  const lineH = fontSize * 1.02;
  const h = Math.ceil(lineH * lines.length + 2);
  return (
    <svg aria-hidden width={maxWidth} height={h} viewBox={`0 0 ${maxWidth} ${h}`} style={{ overflow: "visible" }}>
      {lines.map((l, i) => (
        <text key={i} x={maxWidth / 2} y={lineH * (i + 1) - fontSize * 0.18} textAnchor="middle" fill={color} style={{ fontFamily: "var(--font-big-shoulders), sans-serif", fontWeight: 800, fontSize }}>
          {l}
        </text>
      ))}
    </svg>
  );
}
