import { readFile } from "node:fs/promises";
import path from "node:path";
import { TERRAIN_INFO, type Terrain } from "@/game/config";
import { hexToPixel, spiral, hexKey, ringOf } from "@/game/hex";
import { BUILDING_PATHS, CROWN_PATH } from "@/components/game/glyphs";

/** Fonts for next/og (Satori reads woff, not woff2). */
export async function ogFonts() {
  const dir = path.join(process.cwd(), "assets", "og-fonts");
  const load = (f: string) => readFile(path.join(dir, f));
  const [a4, a6, a8, b8, b9] = await Promise.all([load("Archivo-400.woff"), load("Archivo-600.woff"), load("Archivo-800.woff"), load("BigShoulders-800.woff"), load("BigShoulders-900.woff")]);
  return [
    { name: "Archivo", data: a4, weight: 400 as const, style: "normal" as const },
    { name: "Archivo", data: a6, weight: 600 as const, style: "normal" as const },
    { name: "Archivo", data: a8, weight: 800 as const, style: "normal" as const },
    { name: "Big Shoulders", data: b8, weight: 800 as const, style: "normal" as const },
    { name: "Big Shoulders", data: b9, weight: 900 as const, style: "normal" as const },
  ];
}

export type OgTile = { q: number; r: number; terrain: Terrain; tier: number; mono?: string; highlight?: boolean; crown?: boolean };

const hexPoints = (w: number, h: number) => `${w / 2},0 ${w},${h * 0.25} ${w},${h * 0.75} ${w / 2},${h} 0,${h * 0.75} 0,${h * 0.25}`;

/**
 * An island drawn with absolutely positioned SVG hexes (side layer + face),
 * centered in a box. Unexplored slots fill out to one ring beyond the edge.
 */
export function OgIsland({ tiles, width, height, maxTile = 64, showText = false }: { tiles: OgTile[]; width: number; height: number; maxTile?: number; showText?: boolean }) {
  const radius = Math.max(1, ...tiles.map((t) => ringOf(t))) + 1;
  // Fit: island spans about (2r+1) tiles wide and 1.5r+1 tall.
  const w = Math.min(maxTile, Math.floor(width / (2 * radius + 1.2)), Math.floor(height / ((2 * radius + 1) * 0.87 + 0.4)));
  const h = Math.round((w * 2) / Math.sqrt(3));
  const depth = Math.round(w * 0.11);
  const occupied = new Map(tiles.map((t) => [hexKey(t), t]));
  const slots = spiral(radius);
  const cx = width / 2;
  const cy = height / 2;
  return (
    <div style={{ position: "relative", width, height, display: "flex" }}>
      {slots.map((s) => {
        const p = hexToPixel(s, w);
        const t = occupied.get(hexKey(s));
        const left = cx + p.x - w / 2;
        const top = cy + p.y - h / 2;
        if (!t) {
          return (
            <svg key={hexKey(s)} width={w} height={h} style={{ position: "absolute", left, top }} viewBox={`0 0 ${w} ${h}`}>
              <polygon points={hexPoints(w - 2, h - 2)} transform="translate(1,1)" fill="rgba(255,255,255,0.05)" />
            </svg>
          );
        }
        const c = TERRAIN_INFO[t.terrain];
        const b = BUILDING_PATHS[t.tier];
        const size = Math.round(w * (0.26 + t.tier * 0.035));
        return (
          <div key={hexKey(s)} style={{ position: "absolute", left: left - 6, top: top - 6, width: w + 12, height: h + depth + 12, display: "flex" }}>
            <svg width={w + 12} height={h + depth + 12} viewBox={`0 0 ${w + 12} ${h + depth + 12}`} style={{ position: "absolute", left: 0, top: 0 }}>
              {t.highlight ? <polygon points={hexPoints(w + 12, h + 12)} fill="#F5C84B" /> : null}
              <polygon points={hexPoints(w - 2, h - 2)} transform={`translate(7,${7 + depth})`} fill={c.side} />
              <polygon points={hexPoints(w - 2, h - 2)} transform="translate(7,7)" fill={c.face} />
              {b ? <path d={b} fill={c.ink} transform={`translate(${6 + w / 2 - size / 2},${6 + h / 2 - size / 2 - (showText && t.mono ? w * 0.08 : 0)}) scale(${size / 24})`} /> : null}
              {t.crown ? <path d={CROWN_PATH} fill="#F5C84B" stroke="#0F2E45" strokeWidth={1.5} transform={`translate(${w - w * 0.2},${h * 0.1}) scale(${(w * 0.24) / 24})`} /> : null}
            </svg>
            {showText && t.mono ? (
              <div style={{ position: "absolute", left: 6, width: w, top: 6 + h / 2 + w * 0.14, display: "flex", justifyContent: "center", fontFamily: "Big Shoulders", fontWeight: 800, fontSize: Math.round(w * 0.17), color: c.ink }}>{t.mono}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export const OG_SIZE = { width: 1200, height: 630 };

/** Fallback card for private or missing content. */
export function OgBrand({ line }: { line: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#0F2E45", color: "#EAF2F7", fontFamily: "Archivo" }}>
      <div style={{ fontFamily: "Big Shoulders", fontWeight: 900, fontSize: 96, color: "#F5C84B" }}>Questboard</div>
      <div style={{ fontSize: 34, fontWeight: 600, marginTop: 16, color: "#9DB7C9" }}>{line}</div>
    </div>
  );
}

export function OgChip({ children, gold = false }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <div style={{ height: 48, padding: "0 20px", borderRadius: 24, display: "flex", alignItems: "center", background: gold ? "#F5C84B" : "#17405E", color: gold ? "#0F2E45" : "#EAF2F7", fontSize: 22, fontWeight: gold ? 800 : 600 }}>{children}</div>
  );
}
