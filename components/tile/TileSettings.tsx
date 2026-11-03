"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TERRAIN_INFO, TERRAINS, type Terrain } from "@/game/config";
import { adminSetTerrainAction, updateTileAction } from "@/app/actions/tiles";
import { Button } from "@/components/ui/Button";

export function TileSettings({ gameId, monogram, monogramOverride, terrain, globalTerrain, isAdmin, gameTerrainOverride, isOnIsland }: { gameId: string; monogram: string; monogramOverride: string | null; terrain: Terrain | null; globalTerrain: Terrain; isAdmin: boolean; gameTerrainOverride: Terrain | null; isOnIsland: boolean }) {
  const router = useRouter();
  const [mono, setMono] = useState(monogramOverride ?? "");
  const [ter, setTer] = useState<string>(terrain ?? "");
  const [adminTer, setAdminTer] = useState<string>(gameTerrainOverride ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <details className="mt-3 rounded-2xl bg-panel px-5 py-4">
      <summary className="cursor-pointer text-[15px] font-bold">Tile settings</summary>
      {isOnIsland ? (
        <form
          className="mt-3 grid gap-3 desk:grid-cols-[1fr_1fr_auto] desk:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await updateTileAction({ gameId, monogram: mono || null, terrain: ter || null });
              setMsg(r.ok ? "Saved." : r.error);
              router.refresh();
            });
          }}
        >
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            Monogram (auto: {monogram})
            <input value={mono} onChange={(e) => setMono(e.target.value)} maxLength={12} placeholder={monogram} className="h-10 rounded-lg bg-sea px-3 text-sm font-semibold text-text" />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            Terrain on your island
            <select value={ter} onChange={(e) => setTer(e.target.value)} className="h-10 rounded-lg bg-sea px-2 text-sm font-semibold text-text">
              <option value="">Default ({TERRAIN_INFO[globalTerrain].name})</option>
              {TERRAINS.map((t) => (
                <option key={t} value={t}>
                  {TERRAIN_INFO[t].name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </form>
      ) : (
        <p className="m-0 mt-2 text-sm text-muted">Play it once to customise its tile.</p>
      )}
      {isAdmin ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-panel-rule pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await adminSetTerrainAction({ gameId, terrain: adminTer || null });
              setMsg(r.ok ? "Terrain updated for everyone." : r.error);
              router.refresh();
            });
          }}
        >
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            Admin: terrain for everyone
            <select value={adminTer} onChange={(e) => setAdminTer(e.target.value)} className="h-10 rounded-lg bg-sea px-2 text-sm font-semibold text-text">
              <option value="">From tags</option>
              {TERRAINS.map((t) => (
                <option key={t} value={t}>
                  {TERRAIN_INFO[t].name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary" disabled={pending}>
            Apply
          </Button>
        </form>
      ) : null}
      {msg ? <p role="status" className="m-0 mt-2 text-sm text-muted">{msg}</p> : null}
    </details>
  );
}
