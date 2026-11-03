"use client";

import { useState } from "react";
import { IslandMap, type MapTile } from "@/components/game/IslandMap";
import { Segmented } from "@/components/ui/Button";
import { MiniHex } from "@/components/game/HexTile";
import { TERRAINS } from "@/game/config";
import { autoMonogram } from "@/game/monogram";
import { islandSurroundings, placeTiles } from "@/game/layout";

const NAMES = ["Cascadia", "Wingspan", "The Crew", "Azul", "Codenames", "Terraforming Mars", "Catan", "Everdell", "Root", "Spirit Island", "Wavelength", "Hive", "Blood on the Clocktower", "Pandemic", "Ark Nova", "Twilight Imperium"];
const TERR = ["forest", "forest", "meadow", "tundra", "reef", "forest", "peaks", "forest", "peaks", "meadow", "reef", "tundra", "marsh", "meadow", "forest", "peaks"] as const;
const PLAYS = [52, 31, 27, 22, 18, 11, 12, 8, 7, 9, 5, 4, 3, 6, 1, 2];

function demoTiles(): MapTile[] {
  const pos = placeTiles([], NAMES.map((n, i) => ({ id: n, terrain: TERR[i]! })), "demo");
  const tiles: MapTile[] = NAMES.map((n, i) => {
    const p = PLAYS[i]!;
    const tier = p >= 100 ? 6 : p >= 50 ? 5 : p >= 25 ? 4 : p >= 10 ? 3 : p >= 5 ? 2 : 1;
    const h = pos.get(n)!;
    return { key: n, ...h, kind: i === 14 ? "ghost" : "game", terrain: TERR[i], tier: i === 14 ? 0 : tier, name: n, monogram: autoMonogram(n), crown: i === 1 || i === 8, pendingTierUp: i === 10, label: `${n}, ${p} plays` };
  });
  for (const s of islandSurroundings([...pos.values()], ["Sky Team", "Arcs", "Heat"], "demo")) {
    if (s.kind === "shelf") tiles.push({ key: `shelf:${s.id}`, q: s.q, r: s.r, kind: "shelf", name: s.id, monogram: "?", label: `${s.id}, unplayed, on your shelf` });
    else tiles.push({ key: `u:${s.q},${s.r}`, q: s.q, r: s.r, kind: "unexplored", name: "", monogram: "", label: "Unexplored" });
  }
  return tiles;
}

export function IslandDemo() {
  const [tiles] = useState(demoTiles);
  const [sel, setSel] = useState<string | null>("Cascadia");
  const [view, setView] = useState<"map" | "list">("map");
  return (
    <div>
      <div className="flex items-center gap-3">
        <Segmented label="View" value={view} onChange={setView} options={[{ value: "map", label: "Map" }, { value: "list", label: "List" }]} />
        <span className="text-sm text-muted">Selected: {sel ?? "none"} (drag to pan, wheel to zoom, arrows to move)</span>
      </div>
      {view === "map" ? (
        <IslandMap tiles={tiles} selectedKey={sel} onSelect={setSel} ariaLabel="Demo island: 16 game tiles" className="mt-3 h-[520px] rounded-2xl bg-sea" />
      ) : (
        <ul className="mt-3 overflow-hidden rounded-2xl bg-panel">
          {tiles.filter((t) => t.kind === "game").map((t) => (
            <li key={t.key} className="grid grid-cols-[30px_1fr] items-center gap-3 border-b border-panel-rule px-3.5 py-2">
              <MiniHex terrain={t.terrain} tier={t.tier} />
              {t.name}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">Terrains: {TERRAINS.join(", ")}</p>
    </div>
  );
}
