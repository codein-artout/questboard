"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { IslandMap, type MapTile } from "@/components/game/IslandMap";
import { ButtonLink } from "@/components/ui/Button";
import { autoMonogram } from "@/game/monogram";
import type { Terrain } from "@/game/config";
import { cn } from "@/lib/cn";

type Status = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  total: number;
  processed: number;
  created: number;
  skipped: number;
  warnings: string[];
  error: string | null;
  tiles: { q: number; r: number; tier: number; plays: number; name: string; short: string | null; mono: string | null; terrain: Terrain }[];
};

export function ImportFlow({ resumeId, next }: { resumeId?: string; next?: string }) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(resumeId ?? null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/import/${jobId}`, { cache: "no-store" });
        if (res.ok) {
          const s = (await res.json()) as Status;
          if (!stop) setStatus(s);
          if (s.status === "done" || s.status === "failed") {
            router.refresh();
            return;
          }
        }
      } catch {
        /* retry */
      }
      if (!stop) setTimeout(tick, 900);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [jobId, router]);

  const upload = async (file: File) => {
    setError(null);
    setBusy(true);
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/import", { method: "POST", body });
    const json = (await res.json()) as { id?: string; error?: string };
    setBusy(false);
    if (!res.ok || !json.id) return setError(json.error ?? "That file couldn’t be imported.");
    setStatus(null);
    setJobId(json.id);
  };

  const tiles: MapTile[] = useMemo(
    () => (status?.tiles ?? []).map((t) => ({ key: `${t.q},${t.r}`, q: t.q, r: t.r, kind: "game" as const, terrain: t.terrain, tier: t.tier, name: t.name, monogram: t.mono ?? t.short ?? autoMonogram(t.name), label: `${t.name}, ${t.plays} plays` })),
    [status?.tiles],
  );
  const pct = status && status.total ? Math.round((status.processed / status.total) * 100) : 0;
  const running = status && (status.status === "queued" || status.status === "running");

  return (
    <div>
      {!jobId || status?.status === "failed" ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) void upload(f);
          }}
          className={cn("mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center", drag ? "border-gold bg-panel-rule" : "border-outline bg-panel")}
        >
          <FileUp size={32} className="text-gold" aria-hidden />
          <span className="font-display text-2xl font-black">{busy ? "Reading your file…" : "Drop your export here, or choose a file"}</span>
          <span className="max-w-md text-sm text-muted">A BG Stats export (.json, from BG Stats: Settings, Export data) or a BoardGameGeek plays CSV (.csv). Importing twice is safe: plays already imported are skipped.</span>
          <input ref={inputRef} type="file" accept=".json,.csv,application/json,text/csv" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      {status?.status === "failed" ? <p role="alert" className="mt-3 text-sm text-danger">The import stopped: {status.error}</p> : null}

      {jobId && status ? (
        <section className="mt-4" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="m-0 font-display text-3xl font-black">{running ? "Your island is building itself" : status.status === "done" ? "Import finished" : "Import"}</h2>
            <span className="text-sm text-muted">
              {status.processed} of {status.total} plays
            </span>
          </div>
          <div role="progressbar" aria-label="Import progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-2 h-2.5 overflow-hidden rounded-full bg-sea-deep">
            <div className="h-full bg-gold transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {status.created} quests added{status.skipped ? `, ${status.skipped} already imported` : ""}. {tiles.length} tiles{running ? " so far" : ""}.
          </p>
          {tiles.length ? <IslandMap tiles={tiles} selectedKey={null} interactive={false} controls={false} ariaLabel={`Your island: ${tiles.length} tiles`} baseSize={56} className="mt-2 h-[380px] rounded-2xl bg-sea" /> : null}
          {status.warnings.length ? (
            <details className="mt-3 rounded-xl bg-panel px-4 py-3 text-sm">
              <summary className="cursor-pointer font-semibold">{status.warnings.length} notes from the file</summary>
              <ul className="mb-0 mt-2 text-muted">
                {status.warnings.slice(0, 20).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {status.status === "done" ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink href={next ?? "/"}>{next ? "Continue" : "See your island"}</ButtonLink>
              <button type="button" onClick={() => { setJobId(null); setStatus(null); }} className="h-11 px-3 text-sm font-bold text-gold">
                Import another file
              </button>
            </div>
          ) : null}
        </section>
      ) : jobId ? (
        <p className="mt-4 text-sm text-muted">Starting…</p>
      ) : null}
      {!jobId && next ? (
        <p className="mt-4 text-sm">
          <Link href={next}>Skip for now</Link>
        </p>
      ) : null}
    </div>
  );
}
