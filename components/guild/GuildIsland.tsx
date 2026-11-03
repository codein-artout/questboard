"use client";

import Link from "next/link";
import { useState } from "react";
import { IslandMap } from "@/components/game/IslandMap";
import type { GuildMapTile } from "@/server/queries/guild";

export function GuildIsland({ tiles, label }: { tiles: GuildMapTile[]; label: string }) {
  const first = tiles.filter((t) => t.kind === "game").sort((a, b) => b.plays - a.plays)[0]?.key ?? null;
  const [sel, setSel] = useState<string | null>(first);
  const t = tiles.find((x) => x.key === sel);
  if (!tiles.some((x) => x.kind === "game")) {
    return <p className="mt-3 rounded-2xl bg-panel p-4 text-sm text-muted">The guild island grows when three or more members play a game together in a guild quest.</p>;
  }
  return (
    <div>
      <IslandMap tiles={tiles} selectedKey={sel} onSelect={setSel} ariaLabel={label} baseSize={60} fullNameAt={72} className="mt-2 h-[300px] desk:h-[360px]" />
      {t && t.kind === "game" ? (
        <div aria-live="polite" className="mt-1.5 flex items-center justify-between gap-3 rounded-[14px] bg-panel px-3.5 py-3">
          <div className="min-w-0">
            <div className="truncate font-display text-xl font-black">{t.name}</div>
            <div className="text-[13px] text-muted">
              {t.plays} guild plays. {t.crownLine}
            </div>
          </div>
          <Link href={`/games/${t.slug}`} className="shrink-0 text-sm font-bold">
            Open
          </Link>
        </div>
      ) : null}
    </div>
  );
}
