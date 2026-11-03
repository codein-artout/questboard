"use client";

import { useRouter } from "next/navigation";
import { Camera, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { TERRAIN_INFO, TERRAINS, type ScoringType, type Terrain } from "@/game/config";
import { ordinal } from "@/game/places";
import { createCustomGameAction, createQuestAction, saveDraftAction, updateQuestAction, clearDraftAction } from "@/app/actions/quests";
import { TileBadge, MiniHex } from "@/components/game/HexTile";
import { PlayerDisc } from "@/components/game/PlayerDisc";
import { Button, Segmented } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { PlayerColorKey } from "@/lib/colors";
import { computePlaces } from "@/lib/quest-places";
import type { LogContext, LogGame } from "@/server/queries/log";

export type Row = {
  key: string;
  userId: string | null;
  guestId: string | null;
  guestName: string | null;
  name: string;
  color: PlayerColorKey | null;
  score: number | null;
  midScore: number | null;
  won: boolean;
  rank: number | null;
  team: string | null;
};

export type FormState = {
  game: LogGame | null;
  mode: ScoringType;
  when: string;
  where: string; // "me" | userId | "other"
  location: string;
  duration: string;
  rows: Row[];
  coopWin: boolean | null;
  difficulty: string;
  guildId: string;
  nightId: string;
  notes: string;
  markOwned: boolean;
  showMid: boolean;
  photoKey: string | null;
  savedAt: number;
};

const MODE_LABEL: Record<ScoringType, string> = {
  points: "highest score wins",
  win_lose: "pick the winner",
  coop: "co-op, win or lose together",
  ranked: "finishing order",
  teams: "team against team",
};
const TEAMS = ["Red", "Blue", "Green", "Gold"];
const LS_KEY = "questboard:draft";

const field = "rounded-xl bg-panel px-3 py-2 text-xs text-muted flex flex-col gap-0.5";
const inputBare = "w-full border-0 bg-transparent p-0 text-sm font-semibold text-text placeholder:text-muted focus:outline-none";

function nowLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function rowFor(p: { id: string; name: string; color: PlayerColorKey | null }): Row {
  return { key: `u:${p.id}`, userId: p.id, guestId: null, guestName: null, name: p.name, color: p.color, score: null, midScore: null, won: false, rank: null, team: null };
}

function initialState(ctx: LogContext, preset?: Partial<FormState>): FormState {
  const nightRows = ctx.night ? ctx.people.filter((p) => ctx.night!.attendeeIds.includes(p.id)).map(rowFor) : [];
  return {
    game: ctx.preset,
    mode: ctx.preset?.scoring ?? "points",
    when: nowLocal(),
    where: ctx.night ? (ctx.night.hostId === ctx.me.id ? "me" : ctx.night.hostId) : "me",
    location: "",
    duration: "",
    rows: [rowFor(ctx.me), ...nightRows.filter((r) => r.userId !== ctx.me.id)],
    coopWin: null,
    difficulty: "",
    guildId: ctx.night?.guildId ?? "",
    nightId: ctx.night?.id ?? "",
    notes: "",
    markOwned: false,
    showMid: false,
    photoKey: null,
    savedAt: Date.now(),
    ...preset,
  };
}

export function LogQuestForm({
  ctx,
  editId,
  initial,
  onClose,
  next,
}: {
  ctx: LogContext;
  editId?: string;
  initial?: Partial<FormState>;
  onClose?: () => void;
  next?: string;
}) {
  const router = useRouter();
  const formId = useId();
  const [s, setS] = useState<FormState>(() => initialState(ctx, initial));
  const [restored, setRestored] = useState(false);
  const [picking, setPicking] = useState(!s.game);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const loaded = useRef(false);

  // Restore an unsent draft (newest of local and server copies).
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    if (editId || ctx.preset || initial) return;
    let local: FormState | null = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) local = JSON.parse(raw) as FormState;
    } catch {
      local = null;
    }
    const server = ctx.draft as FormState | null;
    const pick = [local, server].filter((d): d is FormState => !!d && !!d.game).sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))[0];
    if (pick && Date.now() - (pick.savedAt ?? 0) < 3 * 86400000) {
      setS({ ...initialState(ctx), ...pick });
      setPicking(false);
      setRestored(true);
    }
  }, [ctx, editId, initial]);

  // Autosave: localStorage immediately, the server after a pause.
  useEffect(() => {
    if (editId || !loaded.current || !s.game) return;
    const data = { ...s, savedAt: Date.now() };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {
      /* storage full or blocked */
    }
    const t = setTimeout(() => void saveDraftAction(data), 1500);
    return () => clearTimeout(t);
  }, [s, editId]);

  const update = useCallback((patch: Partial<FormState>) => setS((prev) => ({ ...prev, ...patch })), []);
  const updateRow = (key: string, patch: Partial<Row>) => setS((prev) => ({ ...prev, rows: prev.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  const places = useMemo(
    () => computePlaces(s.mode, s.rows.map((r) => ({ key: r.key, score: r.score, team: r.team, won: r.won, rank: r.rank }))),
    [s.mode, s.rows],
  );
  const placeCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of places.values()) m.set(p, (m.get(p) ?? 0) + 1);
    return m;
  }, [places]);

  // Suggest a guild when the party shares one.
  useEffect(() => {
    if (s.guildId || editId) return;
    const ids = s.rows.map((r) => r.userId).filter(Boolean);
    const shared = ctx.guilds.find((g) => ids.filter((id) => g.memberIds.includes(id!)).length >= 2);
    if (shared && ids.length >= 2) update({ guildId: shared.id });
  }, [s.rows, s.guildId, ctx.guilds, update, editId]);

  const chooseGame = (g: LogGame) => {
    update({ game: g, mode: g.scoring, coopWin: null });
    setPicking(false);
  };

  const discard = async () => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
    await clearDraftAction();
    setS(initialState(ctx));
    setPicking(true);
    setRestored(false);
  };

  const submit = async () => {
    if (!s.game) {
      setError("Pick a game first.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const when = new Date(s.when);
    const localDate = s.when.slice(0, 10);
    const host = s.where === "other" ? null : s.where === "me" ? ctx.me.id : s.where;
    const hostName = host === ctx.me.id ? ctx.me.name : s.rows.find((r) => r.userId === host)?.name;
    const payload = {
      gameId: s.game.id,
      playedAt: when.toISOString(),
      localDate,
      tzOffsetMin: -when.getTimezoneOffset(),
      durationMin: s.duration ? Math.max(1, Math.round(Number(s.duration))) : null,
      location: s.where === "other" ? s.location.trim() || null : hostName ? `${hostName}’s place` : null,
      hostUserId: host && s.rows.some((r) => r.userId === host) ? host : null,
      guildId: s.guildId || null,
      gameNightId: s.nightId || null,
      mode: s.mode,
      coopWin: s.mode === "coop" ? s.coopWin : null,
      difficulty: s.mode === "coop" && s.difficulty ? Number(s.difficulty) : null,
      notes: s.notes.trim() || null,
      photoKey: s.photoKey,
      markOwned: s.markOwned,
      participants: s.rows.map((r) => ({
        userId: r.userId,
        guestId: r.guestId,
        guestName: r.userId ? null : r.guestName ?? r.name,
        team: s.mode === "teams" ? r.team : null,
        score: s.mode === "coop" ? null : r.score,
        midScore: s.showMid ? r.midScore : null,
        won: r.won,
        rank: s.mode === "ranked" ? r.rank : null,
      })),
    };
    const res = editId ? await updateQuestAction(editId, payload) : await createQuestAction(payload);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
    router.replace(editId ? `/quests/${res.data.id}` : `/quests/${res.data.id}/complete${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    router.refresh();
  };

  const t = s.game ? TERRAIN_INFO[s.game.terrain] : null;

  return (
    <div className="flex min-h-full flex-col">
      <header className="grid grid-cols-[44px_1fr_44px] items-center px-3 pb-1 pt-3">
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-text hover:bg-panel">
            <X size={22} aria-hidden />
          </button>
        ) : (
          <span />
        )}
        <h1 id={`${formId}-title`} className="m-0 text-center text-[17px] font-bold">
          {editId ? "Edit quest" : "Log a quest"}
        </h1>
        <span />
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {restored ? (
          <p className="mt-1 flex items-center justify-between rounded-xl bg-sea-deep px-3 py-2 text-[13px] text-muted">
            Draft restored.
            <button type="button" onClick={discard} className="font-bold text-gold hover:text-gold-hover">
              Discard
            </button>
          </p>
        ) : null}

        {picking || !s.game ? (
          <GamePicker ctx={ctx} onPick={chooseGame} onCancel={s.game ? () => setPicking(false) : undefined} />
        ) : (
          <section className="mt-1.5 flex items-center gap-3.5 rounded-2xl bg-panel p-3.5">
            <TileBadge terrain={s.game.terrain} tier={1} width={48} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[26px] font-extrabold leading-none">{s.game.name}</div>
              <label className="mt-1 flex items-center gap-1 text-[13px] text-muted">
                <span>{t?.name} quest,</span>
                <select
                  value={s.mode}
                  onChange={(e) => update({ mode: e.target.value as ScoringType })}
                  aria-label="How this game is scored"
                  className="min-w-0 border-0 bg-transparent p-0 text-[13px] text-muted underline decoration-dotted underline-offset-2 focus:outline-none"
                >
                  {(Object.keys(MODE_LABEL) as ScoringType[]).map((m) => (
                    <option key={m} value={m} className="bg-panel">
                      {MODE_LABEL[m]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" onClick={() => setPicking(true)} className="h-11 px-2.5 text-sm font-bold text-gold hover:text-gold-hover">
              Change
            </button>
          </section>
        )}

        {s.game && !picking ? (
          <>
            <section className="mt-2 grid grid-cols-3 gap-2">
              <label className={field}>
                When
                <input type="datetime-local" value={s.when} max={nowLocal()} onChange={(e) => update({ when: e.target.value })} className={inputBare} />
              </label>
              <label className={field}>
                Where
                <select value={s.where} onChange={(e) => update({ where: e.target.value })} className={cn(inputBare, "appearance-none")}>
                  <option value="me" className="bg-panel">
                    My place
                  </option>
                  {s.rows
                    .filter((r) => r.userId && r.userId !== ctx.me.id)
                    .map((r) => (
                      <option key={r.key} value={r.userId!} className="bg-panel">
                        {r.name}’s place
                      </option>
                    ))}
                  <option value="other" className="bg-panel">
                    Somewhere else
                  </option>
                </select>
              </label>
              <label className={field}>
                Length (min)
                <input type="number" inputMode="numeric" min={1} max={6000} placeholder="48" value={s.duration} onChange={(e) => update({ duration: e.target.value })} className={inputBare} />
              </label>
            </section>
            {s.where === "other" ? (
              <label className={cn(field, "mt-2")}>
                Place
                <input value={s.location} maxLength={80} onChange={(e) => update({ location: e.target.value })} placeholder="The game café" className={inputBare} />
              </label>
            ) : null}

            <h2 className="mb-2 ml-1 mt-[18px] text-[15px] font-bold">Your party</h2>
            {s.mode === "coop" ? (
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <Segmented
                  label="Result"
                  value={s.coopWin === null ? "" : s.coopWin ? "won" : "lost"}
                  onChange={(v) => update({ coopWin: v === "won" })}
                  options={[
                    { value: "won", label: "We won" },
                    { value: "lost", label: "We lost" },
                  ]}
                />
                <label className="flex items-center gap-2 text-[13px] text-muted">
                  Difficulty
                  <input type="number" min={0} max={50} value={s.difficulty} onChange={(e) => update({ difficulty: e.target.value })} className="h-9 w-16 rounded-lg bg-panel px-2 text-sm font-semibold text-text focus:outline-none" placeholder="–" />
                </label>
              </div>
            ) : null}
            <div className="overflow-hidden rounded-2xl bg-panel">
              {s.rows.map((r) => {
                const place = places.get(r.key);
                const tied = place !== undefined && (placeCounts.get(place) ?? 0) > 1;
                const first = place === 1;
                return (
                  <div key={r.key} className="grid grid-cols-[40px_32px_1fr_auto] items-center gap-2 border-b border-panel-rule py-2 pl-3.5 pr-2">
                    <span className={cn("font-display text-lg font-extrabold", first ? "text-gold" : "text-muted")} aria-label={place ? `Place ${place}${tied ? ", tied" : ""}` : "No place"}>
                      {s.mode === "coop" ? "" : place ? `${tied ? "=" : ""}${ordinal(place)}` : "–"}
                    </span>
                    <PlayerDisc player={{ name: r.name, color: r.color }} size={30} ring={first && s.mode !== "coop"} edge="#17405E" />
                    <span className="min-w-0 truncate text-base font-semibold">
                      {r.name}
                      {!r.userId ? <span className="ml-1.5 text-xs font-medium text-muted">guest</span> : null}
                    </span>
                    <div className="flex items-center gap-1">
                      <RowControls mode={s.mode} row={r} count={s.rows.length} showMid={s.showMid} onChange={(patch) => updateRow(r.key, patch)} onWinTeam={(team) => setS((prev) => ({ ...prev, rows: prev.rows.map((x) => ({ ...x, won: x.team === team })) }))} />
                      {r.userId !== ctx.me.id ? (
                        <button type="button" aria-label={`Remove ${r.name}`} onClick={() => update({ rows: s.rows.filter((x) => x.key !== r.key) })} className="flex h-11 w-9 items-center justify-center text-muted hover:text-danger">
                          <Trash2 size={16} aria-hidden />
                        </button>
                      ) : (
                        <span className="w-9" />
                      )}
                    </div>
                  </div>
                );
              })}
              <AddPlayer ctx={ctx} rows={s.rows} onAdd={(row) => update({ rows: [...s.rows, row] })} max={s.game.maxPlayers} />
            </div>
            <p className="mx-1 mt-2.5 text-[13px] text-muted">
              {s.mode === "points"
                ? "Places update as you score. XP is shared out when you complete the quest."
                : s.mode === "coop"
                  ? "Everyone wins or loses together. XP is shared out when you complete the quest."
                  : "Places update as you go. XP is shared out when you complete the quest."}
            </p>
            {s.mode === "points" ? (
              <label className="mx-1 mt-2 flex items-center gap-2 text-[13px] text-muted">
                <input type="checkbox" checked={s.showMid} onChange={(e) => update({ showMid: e.target.checked })} className="h-4 w-4 accent-[#F5C84B]" />
                Add midpoint scores (for the comeback record)
              </label>
            ) : null}

            <details className="mt-4 rounded-2xl bg-panel px-4 py-3">
              <summary className="cursor-pointer text-[15px] font-bold">More: guild, notes, photo</summary>
              <div className="mt-3 flex flex-col gap-3">
                {ctx.guilds.length ? (
                  <label className="flex flex-col gap-1 text-[13px] text-muted">
                    Guild
                    <select value={s.guildId} onChange={(e) => update({ guildId: e.target.value })} className="h-10 rounded-lg bg-sea px-2 text-sm font-semibold text-text">
                      <option value="">No guild</option>
                      {ctx.guilds.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {ctx.night ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!s.nightId} onChange={(e) => update({ nightId: e.target.checked ? ctx.night!.id : "" })} className="h-4 w-4 accent-[#F5C84B]" />
                    Part of {ctx.night.title}
                  </label>
                ) : null}
                <label className="flex flex-col gap-1 text-[13px] text-muted">
                  Notes
                  <textarea value={s.notes} maxLength={1000} rows={3} onChange={(e) => update({ notes: e.target.value })} className="rounded-lg bg-sea p-2 text-sm text-text" placeholder="Mission 23, first time with the expansion…" />
                </label>
                <PhotoField photoKey={s.photoKey} onChange={(photoKey) => update({ photoKey })} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={s.markOwned} onChange={(e) => update({ markOwned: e.target.checked })} className="h-4 w-4 accent-[#F5C84B]" />I own this game
                </label>
              </div>
            </details>
          </>
        ) : null}
      </div>

      {s.game && !picking ? (
        <div className="sticky bottom-0 border-t border-sea-line bg-sea-deep px-4 pb-7 pt-3 desk:pb-4">
          {error ? (
            <p role="alert" className="m-0 mb-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button size="lg" className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? "Saving…" : editId ? "Save changes" : "Complete quest"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RowControls({ mode, row, count, showMid, onChange, onWinTeam }: { mode: ScoringType; row: Row; count: number; showMid: boolean; onChange: (p: Partial<Row>) => void; onWinTeam: (team: string) => void }) {
  if (mode === "coop") return null;
  if (mode === "win_lose") {
    return (
      <button type="button" aria-pressed={row.won} onClick={() => onChange({ won: !row.won })} className={cn("h-9 rounded-full px-3 text-[13px] font-bold", row.won ? "bg-gold text-sea" : "border-[1.5px] border-outline text-text")}>
        {row.won ? "Winner" : "Won?"}
      </button>
    );
  }
  if (mode === "ranked") {
    return (
      <select aria-label={`Finishing place for ${row.name}`} value={row.rank ?? ""} onChange={(e) => onChange({ rank: e.target.value ? Number(e.target.value) : null })} className="h-10 rounded-lg bg-sea px-2 text-sm font-semibold text-text">
        <option value="">Place</option>
        {Array.from({ length: count }, (_, i) => (
          <option key={i} value={i + 1}>
            {ordinal(i + 1)}
          </option>
        ))}
      </select>
    );
  }
  if (mode === "teams") {
    return (
      <div className="flex items-center gap-1">
        <select aria-label={`Team for ${row.name}`} value={row.team ?? ""} onChange={(e) => onChange({ team: e.target.value || null })} className="h-10 rounded-lg bg-sea px-2 text-sm font-semibold text-text">
          <option value="">Team</option>
          {TEAMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {row.team ? (
          <button type="button" aria-pressed={row.won} onClick={() => onWinTeam(row.team!)} className={cn("h-9 rounded-full px-2.5 text-xs font-bold", row.won ? "bg-gold text-sea" : "border-[1.5px] border-outline text-text")}>
            {row.won ? "Won" : "Won?"}
          </button>
        ) : null}
      </div>
    );
  }
  const step = (d: number) => onChange({ score: Math.max(-100000, (row.score ?? 0) + d) });
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-0.5">
        <button type="button" aria-label={`Lower ${row.name}’s score`} onClick={() => step(-1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-sea text-text hover:bg-sea-deep">
          <Minus size={18} strokeWidth={2.5} aria-hidden />
        </button>
        <input
          type="number"
          inputMode="decimal"
          aria-label={`Score for ${row.name}`}
          value={row.score ?? ""}
          placeholder="–"
          onChange={(e) => onChange({ score: e.target.value === "" ? null : Number(e.target.value) })}
          className="w-14 border-0 bg-transparent text-center font-display text-[26px] font-black text-text focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button type="button" aria-label={`Raise ${row.name}’s score`} onClick={() => step(1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-sea text-text hover:bg-sea-deep">
          <Plus size={18} strokeWidth={2.5} aria-hidden />
        </button>
      </div>
      {showMid ? (
        <label className="mt-1 flex items-center gap-1 text-[11px] text-muted">
          Midpoint
          <input type="number" aria-label={`Midpoint score for ${row.name}`} value={row.midScore ?? ""} onChange={(e) => onChange({ midScore: e.target.value === "" ? null : Number(e.target.value) })} className="h-7 w-14 rounded bg-sea px-1 text-center text-xs text-text" />
        </label>
      ) : null}
    </div>
  );
}

type Hit = LogGame & { year?: number | null; expansion?: boolean };

function GamePicker({ ctx, onPick, onCancel }: { ctx: LogContext; onPick: (g: LogGame) => void; onCancel?: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const ctl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/games/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        const json = (await res.json()) as { results?: Hit[] };
        setHits(json.results ?? []);
        setActive(0);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  if (custom) return <CustomGameForm initialName={q} onCreated={onPick} onCancel={() => setCustom(false)} />;

  return (
    <section className="mt-1.5" aria-label="Pick a game">
      <label className="flex h-12 items-center gap-2.5 rounded-full bg-sea-deep px-4 text-muted shadow-[inset_0_0_0_1px_#1C4462] focus-within:shadow-[inset_0_0_0_2px_#F5C84B]">
        <Search size={18} aria-hidden />
        <span className="sr-only">Search games</span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && hits[active]) {
              e.preventDefault();
              onPick(hits[active]!);
            }
          }}
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="game-results"
          aria-activedescendant={hits[active] ? `gr-${active}` : undefined}
          placeholder="Which game did you play?"
          className="min-w-0 flex-1 border-0 bg-transparent text-base font-medium text-text placeholder:text-muted focus:outline-none"
        />
        {onCancel ? (
          <button type="button" onClick={onCancel} className="text-sm font-bold text-gold">
            Cancel
          </button>
        ) : null}
      </label>
      {q.trim() ? (
        <ul id="game-results" role="listbox" aria-label="Games" aria-busy={loading} className="m-0 mt-2 list-none overflow-hidden rounded-2xl bg-panel p-0">
          {hits.map((h, i) => (
            <li key={h.id} id={`gr-${i}`} role="option" aria-selected={i === active}>
              <button type="button" onClick={() => onPick(h)} onMouseEnter={() => setActive(i)} className={cn("flex w-full items-center gap-3 border-b border-panel-rule px-3.5 py-2.5 text-left text-text", i === active && "bg-panel-rule")}>
                <MiniHex terrain={h.terrain} tier={1} size={24} />
                <span className="flex-1">
                  <span className="text-[15px] font-semibold">{h.name}</span>
                  <span className="ml-2 text-xs text-muted">
                    {[h.year, h.expansion ? "expansion" : null, h.source === "custom" ? "your game" : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!loading && !hits.length ? <li className="px-4 py-3 text-sm text-muted">No games match “{q}”.</li> : null}
          <li>
            <button type="button" onClick={() => setCustom(true)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-gold hover:text-gold-hover">
              <Plus size={16} aria-hidden /> Add “{q.trim()}” as your own game
            </button>
          </li>
        </ul>
      ) : (
        ctx.suggestions.map((group) => (
          <div key={group.label} className="mt-4">
            <h2 className="mb-2 ml-1 text-[13px] font-semibold text-muted">{group.label}</h2>
            <div className="flex flex-wrap gap-2">
              {group.games.map((g) => (
                <button key={g.id} type="button" onClick={() => onPick(g)} className="flex h-11 items-center gap-2 rounded-full bg-panel pl-2 pr-4 text-sm font-semibold text-text hover:bg-panel-rule">
                  <MiniHex terrain={g.terrain} tier={1} size={22} />
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function CustomGameForm({ initialName, onCreated, onCancel }: { initialName: string; onCreated: (g: LogGame) => void; onCancel: () => void }) {
  const [name, setName] = useState(initialName);
  const [minP, setMinP] = useState("");
  const [maxP, setMaxP] = useState("");
  const [time, setTime] = useState("");
  const [terrain, setTerrain] = useState<Terrain>("forest");
  const [scoring, setScoring] = useState<ScoringType>("points");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const num = (v: string) => (v ? Number(v) : null);
  const save = async () => {
    setBusy(true);
    const res = await createCustomGameAction({ name, minPlayers: num(minP), maxPlayers: num(maxP), minTime: num(time), maxTime: num(time), terrain, scoring, tags: [] });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onCreated({ id: res.data.id, slug: res.data.slug, name: res.data.name, terrain: res.data.terrain as Terrain, scoring: res.data.scoring as ScoringType, maxPlayers: num(maxP), source: "custom" });
  };
  const small = "h-10 rounded-lg bg-sea px-2 text-sm font-semibold text-text w-full";
  return (
    <section className="mt-2 rounded-2xl bg-panel p-4" aria-label="Add your own game">
      <h2 className="m-0 text-[15px] font-bold">Add your own game</h2>
      <p className="m-0 mt-1 text-[13px] text-muted">Only you see it until an admin adds it to the catalog.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="col-span-3 flex flex-col gap-1 text-[13px] text-muted">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={small} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Min players
          <input type="number" min={1} value={minP} onChange={(e) => setMinP(e.target.value)} className={small} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Max players
          <input type="number" min={1} value={maxP} onChange={(e) => setMaxP(e.target.value)} className={small} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Minutes
          <input type="number" min={1} value={time} onChange={(e) => setTime(e.target.value)} className={small} />
        </label>
        <label className="col-span-3 flex flex-col gap-1 text-[13px] text-muted desk:col-span-2">
          Terrain
          <select value={terrain} onChange={(e) => setTerrain(e.target.value as Terrain)} className={small}>
            {TERRAINS.map((t) => (
              <option key={t} value={t}>
                {TERRAIN_INFO[t].name}: {TERRAIN_INFO[t].genre}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-3 flex flex-col gap-1 text-[13px] text-muted desk:col-span-1">
          Scoring
          <select value={scoring} onChange={(e) => setScoring(e.target.value as ScoringType)} className={small}>
            {(Object.keys(MODE_LABEL) as ScoringType[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert" className="m-0 mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button onClick={save} disabled={busy || name.trim().length < 2}>
          Add game
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Back
        </Button>
      </div>
    </section>
  );
}

function AddPlayer({ ctx, rows, onAdd, max }: { ctx: LogContext; rows: Row[]; onAdd: (r: Row) => void; max: number | null }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inParty = new Set(rows.map((r) => r.userId ?? `g:${r.guestId ?? r.guestName}`));
  const norm = q.trim().toLowerCase();
  const people = ctx.people.filter((p) => !inParty.has(p.id) && (!norm || p.name.toLowerCase().includes(norm))).slice(0, 8);
  const guests = ctx.guests.filter((g) => !inParty.has(`g:${g.id}`) && (!norm || g.name.toLowerCase().includes(norm))).slice(0, 4);
  const full = max !== null && rows.length >= max;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex h-[52px] w-full items-center justify-center gap-2 text-[15px] font-bold text-gold hover:text-gold-hover">
        <Plus size={18} strokeWidth={2.5} aria-hidden />
        Add a party member or guest
        {full ? <span className="text-xs font-medium text-muted">(more than the box says)</span> : null}
      </button>
    );
  }
  const addGuest = (name: string, id: string | null) => {
    onAdd({ key: `g:${id ?? name}:${Date.now()}`, userId: null, guestId: id, guestName: name, name, color: null, score: null, midScore: null, won: false, rank: null, team: null });
    setQ("");
  };
  return (
    <div className="p-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (people[0]) {
                onAdd(rowFor(people[0]));
                setQ("");
              } else if (q.trim()) addGuest(q.trim(), null);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          aria-label="Find a friend or type a guest’s name"
          placeholder="Friend or guest name"
          className="h-11 min-w-0 flex-1 rounded-xl bg-sea px-3 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-gold"
        />
        <button type="button" onClick={() => setOpen(false)} className="h-11 px-2 text-sm font-bold text-gold">
          Done
        </button>
      </div>
      <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
        {people.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => { onAdd(rowFor(p)); setQ(""); }} className="flex h-10 items-center gap-2 rounded-full bg-sea pl-1.5 pr-3.5 text-sm font-semibold text-text hover:bg-sea-deep">
              <PlayerDisc player={{ name: p.name, color: p.color }} size={26} />
              {p.name}
            </button>
          </li>
        ))}
        {guests.map((g) => (
          <li key={g.id}>
            <button type="button" onClick={() => addGuest(g.name, g.id)} className="flex h-10 items-center gap-2 rounded-full border border-outline pl-1.5 pr-3.5 text-sm font-semibold text-text">
              <PlayerDisc player={{ name: g.name }} size={26} />
              {g.name} <span className="text-xs text-muted">guest</span>
            </button>
          </li>
        ))}
        {q.trim() && !people.some((p) => p.name.toLowerCase() === norm) ? (
          <li>
            <button type="button" onClick={() => addGuest(q.trim(), null)} className="flex h-10 items-center gap-1.5 rounded-full border border-dashed border-outline px-3.5 text-sm font-semibold text-gold">
              <Plus size={14} aria-hidden /> Add “{q.trim()}” as a guest
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function PhotoField({ photoKey, onChange }: { photoKey: string | null; onChange: (k: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <span className="text-[13px] text-muted">Photo</span>
      {photoKey ? (
        <div className="mt-1 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/uploads/${photoKey}`} alt="Quest photo preview" className="h-16 w-16 rounded-lg object-cover" />
          <button type="button" onClick={() => onChange(null)} className="text-sm font-bold text-gold">
            Remove
          </button>
        </div>
      ) : (
        <label className="mt-1 flex h-11 w-fit cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-outline px-4 text-sm font-bold text-text">
          <Camera size={16} aria-hidden />
          {busy ? "Uploading…" : "Add a photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError(null);
              const body = new FormData();
              body.set("file", file);
              const res = await fetch("/api/uploads", { method: "POST", body });
              const json = (await res.json()) as { key?: string; error?: string };
              setBusy(false);
              if (!res.ok || !json.key) setError(json.error ?? "Upload failed");
              else onChange(json.key);
            }}
          />
        </label>
      )}
      {error ? <p role="alert" className="m-0 mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
