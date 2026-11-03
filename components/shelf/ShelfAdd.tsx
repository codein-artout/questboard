"use client";

import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { addToShelfAction } from "@/app/actions/shelf";
import { MiniHex } from "@/components/game/HexTile";
import type { Terrain } from "@/game/config";

type Hit = { id: string; name: string; year: number | null; terrain: Terrain };

export function ShelfAdd() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [since, setSince] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!q.trim()) return setHits([]);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/games/search?q=${encodeURIComponent(q)}&limit=6`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((j: { results?: Hit[] }) => setHits(j.results ?? []))
        .catch(() => undefined);
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);
  return (
    <section aria-labelledby="add-shelf" className="rounded-2xl bg-panel p-4">
      <h2 id="add-shelf" className="m-0 text-[15px] font-bold">
        Add a game you own
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-full bg-sea-deep px-3.5 text-muted shadow-[inset_0_0_0_1px_#1C4462] focus-within:shadow-[inset_0_0_0_2px_#F5C84B]">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search the catalog</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the catalog" className="min-w-0 flex-1 border-0 bg-transparent text-sm text-text placeholder:text-muted focus:outline-none" />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Owned since
          <input type="month" value={since} onChange={(e) => setSince(e.target.value)} max={new Date().toISOString().slice(0, 7)} className="h-11 rounded-xl bg-sea px-2 text-sm text-text" />
        </label>
      </div>
      {hits.length ? (
        <ul className="m-0 mt-2 list-none overflow-hidden rounded-xl bg-sea p-0">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await addToShelfAction({ gameId: h.id, acquiredAt: since ? `${since}-01` : undefined });
                    setMsg(r.ok ? `${h.name} is on your shelf.` : r.error);
                    setQ("");
                    router.refresh();
                  })
                }
                className="flex w-full items-center gap-3 border-b border-sea-line px-3 py-2 text-left text-sm text-text hover:bg-sea-deep"
              >
                <MiniHex terrain={h.terrain} tier={1} size={22} />
                <span className="flex-1 font-semibold">{h.name}</span>
                <span className="text-xs text-muted">{h.year}</span>
                <Plus size={16} className="text-gold" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {msg ? <p role="status" className="m-0 mt-2 text-sm text-muted">{msg}</p> : null}
    </section>
  );
}
