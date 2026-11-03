"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Terrain } from "@/game/config";
import { hexToPixel } from "@/game/hex";
import { cn } from "@/lib/cn";
import { HexTile, tileHeight } from "./HexTile";
import type { TileKind } from "./terrain";

export type MapTile = {
  key: string;
  q: number;
  r: number;
  kind: TileKind;
  terrain?: Terrain;
  tier?: number;
  name: string;
  monogram: string;
  crown?: boolean;
  pendingTierUp?: boolean;
  holder?: { name: string; color: import("@/lib/colors").PlayerColorKey | null } | null;
  /** Accessible label, e.g. "Cascadia, Citadel, 52 plays". */
  label: string;
};

type Props = {
  tiles: MapTile[];
  selectedKey: string | null;
  onSelect?: (key: string) => void;
  ariaLabel: string;
  /** Tile width at zoom 1. */
  baseSize?: number;
  /** Tile width at which monograms become full names. */
  fullNameAt?: number;
  /** Increment `n` to fly the camera to `key`. */
  flyTo?: { key: string; n: number } | null;
  className?: string;
  interactive?: boolean;
  minZoom?: number;
  maxZoom?: number;
  controls?: boolean;
};

const DIRS: Record<string, number> = { ArrowRight: 0, ArrowDown: 90, ArrowLeft: 180, ArrowUp: 270 };

/**
 * The island: hex tiles positioned by axial coordinates, with pan (drag), zoom
 * (wheel, pinch, + and - buttons), arrow-key navigation between tiles and
 * selection on click or Enter. Unexplored slots are decorative.
 */
export function IslandMap({
  tiles,
  selectedKey,
  onSelect,
  ariaLabel,
  baseSize = 76,
  fullNameAt = 72,
  flyTo,
  className,
  interactive = true,
  minZoom = 0.45,
  maxZoom = 2.2,
  controls = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [userMoved, setUserMoved] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean; pinchDist?: number; pinchZoom?: number } | null>(null);
  const suppressClick = useRef(false);

  const positioned = useMemo(
    () =>
      tiles.map((t) => {
        const p = hexToPixel(t, baseSize);
        return { ...t, x: p.x, y: p.y };
      }),
    [tiles, baseSize],
  );
  const byKey = useMemo(() => new Map(positioned.map((t) => [t.key, t])), [positioned]);
  const focusable = useMemo(() => positioned.filter((t) => t.kind !== "unexplored"), [positioned]);
  const h = tileHeight(baseSize);

  const bounds = useMemo(() => {
    const pts = positioned.length ? positioned : [{ x: 0, y: 0 }];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { minX: Math.min(...xs) - baseSize / 2, maxX: Math.max(...xs) + baseSize / 2, minY: Math.min(...ys) - h / 2, maxY: Math.max(...ys) + h / 2 + 10 };
  }, [positioned, baseSize, h]);

  const clampZoom = useCallback((z: number) => Math.min(maxZoom, Math.max(minZoom, z)), [minZoom, maxZoom]);

  const fit = useCallback(() => {
    if (!size.w || !size.h) return;
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    const z = clampZoom(Math.min(1, (size.w - 24) / bw, (size.h - 24) / bh));
    setZoom(z);
    setPan({ x: -((bounds.minX + bounds.maxX) / 2) * z, y: -((bounds.minY + bounds.maxY) / 2) * z });
  }, [bounds, size, clampZoom]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!userMoved) fit();
  }, [fit, userMoved]);

  const centerOn = useCallback(
    (key: string, minZ?: number) => {
      const t = byKey.get(key);
      if (!t) return;
      const z = minZ ? clampZoom(Math.max(zoom, minZ)) : zoom;
      setZoom(z);
      setPan({ x: -t.x * z, y: -t.y * z });
      setUserMoved(true);
    },
    [byKey, zoom, clampZoom],
  );

  useEffect(() => {
    if (flyTo) centerOn(flyTo.key, fullNameAt / baseSize);
    // Only when a new fly request arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.n]);

  // Keep the selected tile in view when it changes from the keyboard.
  const ensureVisible = useCallback(
    (key: string) => {
      const t = byKey.get(key);
      if (!t || !size.w) return;
      const sx = t.x * zoom + pan.x;
      const sy = t.y * zoom + pan.y;
      const mx = size.w / 2 - baseSize * zoom;
      const my = size.h / 2 - h * zoom;
      if (Math.abs(sx) > mx || Math.abs(sy) > my) centerOn(key);
    },
    [byKey, zoom, pan, size, baseSize, h, centerOn],
  );

  const zoomAround = useCallback(
    (factor: number, cx = 0, cy = 0) => {
      setZoom((z) => {
        const nz = clampZoom(z * factor);
        setPan((p) => ({ x: cx - ((cx - p.x) * nz) / z, y: cy - ((cy - p.y) * nz) / z }));
        return nz;
      });
      setUserMoved(true);
    },
    [clampZoom],
  );

  // Wheel zoom needs a non-passive listener to prevent page scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      zoomAround(Math.exp(-e.deltaY * 0.0015), cx, cy);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAround, interactive]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive || (e.pointerType === "mouse" && e.button !== 0)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    suppressClick.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current = { startX: 0, startY: 0, panX: pan.x, panY: pan.y, moved: true, pinchDist: Math.hypot(a.x - b.x, a.y - b.y), pinchZoom: zoom };
    } else {
      gesture.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false };
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && g.pinchDist && g.pinchZoom) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(clampZoom((g.pinchZoom * d) / g.pinchDist));
      setUserMoved(true);
      return;
    }
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) > 5) {
      g.moved = true;
      setDragging(true);
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    }
    if (g.moved) {
      setPan({ x: g.panX + dx, y: g.panY + dy });
      setUserMoved(true);
    }
  };
  const endPointer = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current?.moved) suppressClick.current = true;
    if (pointers.current.size === 0) {
      gesture.current = null;
      setDragging(false);
    }
  };

  const select = (key: string) => {
    onSelect?.(key);
  };

  const onTileKey = (e: KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomAround(1.25);
      return;
    }
    if (e.key === "-") {
      e.preventDefault();
      zoomAround(0.8);
      return;
    }
    const angle = DIRS[e.key];
    if (angle === undefined) return;
    e.preventDefault();
    const from = byKey.get(key);
    if (!from) return;
    const rad = (angle * Math.PI) / 180;
    let best: { key: string; score: number } | null = null;
    for (const t of focusable) {
      if (t.key === key) continue;
      const dx = t.x - from.x;
      const dy = t.y - from.y;
      const dist = Math.hypot(dx, dy);
      const cos = (dx * Math.cos(rad) + dy * Math.sin(rad)) / dist;
      if (cos < 0.45) continue; // within ~63 degrees of the direction
      const score = dist * (2 - cos);
      if (!best || score < best.score) best = { key: t.key, score };
    }
    if (best) {
      select(best.key);
      tileRefs.current.get(best.key)?.focus({ preventScroll: true });
      ensureVisible(best.key);
    }
  };

  const effective = baseSize * zoom;
  const showFull = effective >= fullNameAt;
  const tabKey = selectedKey && byKey.get(selectedKey)?.kind !== "unexplored" ? selectedKey : focusable[0]?.key;

  return (
    <section
      aria-label={ariaLabel}
      className={cn("relative overflow-hidden", interactive && (dragging ? "cursor-grabbing" : "cursor-grab"), className)}
      style={{ touchAction: interactive ? "none" : undefined }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
            suppressClick.current = false;
          }
        }}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            transition: dragging ? "none" : "transform 320ms cubic-bezier(.2,.7,.2,1)",
            willChange: "transform",
          }}
        >
          {positioned.map((t) => {
            const style = { position: "absolute" as const, left: t.x - baseSize / 2, top: t.y - h / 2 };
            const visual = (
              <HexTile
                width={baseSize}
                kind={t.kind}
                terrain={t.terrain}
                tier={t.tier}
                text={showFull ? t.name : t.monogram}
                fullName={showFull}
                crown={t.crown}
                pendingTierUp={t.pendingTierUp}
                holder={t.holder}
                selected={t.key === selectedKey}
              />
            );
            if (t.kind === "unexplored" || !interactive) {
              return (
                <div key={t.key} aria-hidden style={style}>
                  {visual}
                </div>
              );
            }
            // The visual tile sits beside an empty button that carries the
            // accessible name, so the decorative label never competes with it.
            return (
              <div key={t.key} style={style}>
                <div aria-hidden>{visual}</div>
                <button
                  ref={(el) => {
                    if (el) tileRefs.current.set(t.key, el);
                    else tileRefs.current.delete(t.key);
                  }}
                  type="button"
                  data-tile={t.key}
                  aria-label={t.label}
                  aria-pressed={t.key === selectedKey}
                  tabIndex={t.key === tabKey ? 0 : -1}
                  onClick={() => select(t.key)}
                  onKeyDown={(e) => onTileKey(e, t.key)}
                  className="hex absolute inset-0 block cursor-pointer border-0 bg-transparent p-0 focus-visible:bg-white/15 focus-visible:outline-none"
                  style={{ height: (86 * baseSize) / 76 }}
                />
              </div>
            );
          })}
        </div>
      </div>
      {controls && interactive ? (
        <div className="absolute bottom-2 right-0 flex flex-col gap-1.5">
          <button type="button" aria-label="Zoom in" onClick={() => zoomAround(1.25)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-panel text-text hover:bg-panel-rule">
            <Plus size={22} strokeWidth={2.5} aria-hidden />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomAround(0.8)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-panel text-text hover:bg-panel-rule">
            <Minus size={22} strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Fit the whole island"
            onClick={() => {
              setUserMoved(false);
              fit();
            }}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-panel text-text hover:bg-panel-rule"
          >
            <Maximize2 size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      ) : null}
    </section>
  );
}
