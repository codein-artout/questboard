"use client";

import Link from "next/link";
import { Bell, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { IslandMap } from "@/components/game/IslandMap";
import { MiniHex } from "@/components/game/HexTile";
import { TileCard } from "@/components/game/TileCard";
import { TierBuilding } from "@/components/game/TierBuilding";
import { CrownIcon } from "@/components/game/CrownIcon";
import { PlayerDisc } from "@/components/game/PlayerDisc";
import { XPBar } from "@/components/game/XPBar";
import { ButtonLink, Segmented } from "@/components/ui/Button";
import { tierName } from "@/game/tiers";
import { cn } from "@/lib/cn";
import type { PlayerColorKey } from "@/lib/colors";
import type { IslandTile, NextNight, Nudge } from "@/server/queries/island";

type Props = {
  tiles: IslandTile[];
  ariaLabel: string;
  owner: { name: string; handle: string; color: PlayerColorKey };
  title: string;
  subtitle: string;
  phoneSubtitle: string;
  level: { level: number; into: number; forNext: number } | null;
  nudges: Nudge[];
  night: NextNight;
  unread?: number;
  isSelf: boolean;
  shelfCount: number;
  initialSelected?: string | null;
};

function useMedia(query: string, fallback = false) {
  const [match, setMatch] = useState(fallback);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

function NudgeIcon({ n }: { n: Nudge }) {
  if (n.icon === "crown") return <CrownIcon size={18} stroke={null} />;
  if ((n.icon === "tier" || n.icon === "rise") && n.tier) return <TierBuilding tier={n.tier} size={18} color="#F5C84B" />;
  if (n.icon === "shelf") return <span className="font-display text-lg font-black leading-none text-gold">?</span>;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7B5F2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.5 13 17 22l-5-3-5 3 1.5-9" />
    </svg>
  );
}

export function IslandView(p: Props) {
  const wide = useMedia("(min-width: 1200px)", true);
  const desk = useMedia("(min-width: 900px)", true);
  const games = p.tiles.filter((t) => t.kind !== "unexplored");
  const firstGame = useMemo(() => [...p.tiles].filter((t) => t.kind === "game").sort((a, b) => b.plays - a.plays)[0]?.key ?? games[0]?.key ?? null, [p.tiles, games]);
  const [selected, setSelected] = useState<string | null>(p.initialSelected ?? firstGame);
  const [view, setView] = useState<"map" | "list">("map");
  const [query, setQuery] = useState("");
  const [fly, setFly] = useState<{ key: string; n: number } | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [active, setActive] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const byKey = useMemo(() => new Map(p.tiles.map((t) => [t.key, t])), [p.tiles]);
  const sel = selected ? byKey.get(selected) : undefined;

  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    return games
      .filter((t) => norm(t.name).includes(q) || norm(t.monogram).includes(q))
      .sort((a, b) => Number(!norm(a.name).startsWith(q)) - Number(!norm(b.name).startsWith(q)) || b.plays - a.plays)
      .slice(0, 6);
  }, [query, games]);

  const choose = (key: string) => {
    setSelected(key);
    setView("map");
    setFly((f) => ({ key, n: (f?.n ?? 0) + 1 }));
    setQuery("");
    if (desk && !wide) setDrawer(true);
  };

  const onSelect = (key: string) => {
    setSelected(key);
    if (desk && !wide) setDrawer(true);
  };

  const list = [...games].sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name));
  const empty = !p.tiles.some((t) => t.kind === "game" || t.kind === "ghost");

  const sidePanel = (
    <>
      {sel ? <TileCard data={sel.card} /> : null}
      {p.night ? (
        <Link href={p.night.href} className="block rounded-2xl bg-panel p-4 text-text no-underline hover:bg-panel-rule hover:text-text">
          <div className="text-[13px] text-muted">Next quest</div>
          <div className="mt-0.5 font-display text-[22px] font-black leading-[1.1]">{p.night.title}</div>
          <div className="mt-0.5 text-[13px] text-muted">{p.night.detail}</div>
        </Link>
      ) : null}
      {p.nudges.length ? (
        <section className="rounded-2xl bg-panel py-1.5" aria-labelledby="nudges-h">
          <h2 id="nudges-h" className="m-0 px-4 pb-1 pt-2.5 text-sm font-bold">
            Close to something
          </h2>
          {p.nudges.map((n) => (
            <Link key={n.text} href={n.href} className="flex items-center gap-2.5 border-t border-panel-rule px-4 py-2.5 text-sm text-text no-underline hover:text-gold-hover">
              <span className="flex w-[18px] shrink-0 justify-center">
                <NudgeIcon n={n} />
              </span>
              {n.text}
            </Link>
          ))}
        </section>
      ) : null}
    </>
  );

  const searchBox = (
    <div className="relative min-w-0 flex-[0_1_300px]">
      <label className="flex h-11 items-center gap-2.5 rounded-full bg-sea-deep px-3.5 text-sm text-muted shadow-[inset_0_0_0_1px_#1C4462] focus-within:shadow-[inset_0_0_0_2px_#F5C84B]">
        <Search size={18} strokeWidth={2} aria-hidden />
        <span className="sr-only">Find a game on your island</span>
        <input
          ref={searchRef}
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls="island-search-results"
          aria-autocomplete="list"
          aria-activedescendant={matches[active] ? `isr-${active}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && matches[active]) {
              e.preventDefault();
              choose(matches[active]!.key);
            } else if (e.key === "Escape") setQuery("");
          }}
          placeholder={p.isSelf ? "Find a game on your island" : "Find a game on this island"}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-text placeholder:text-muted focus:outline-none"
        />
      </label>
      {matches.length ? (
        <ul id="island-search-results" role="listbox" aria-label="Games on the island" className="absolute inset-x-0 top-12 z-20 m-0 list-none overflow-hidden rounded-2xl bg-panel p-0 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
          {matches.map((m, i) => (
            <li
              key={m.key}
              id={`isr-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(m.key);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-3 border-b border-panel-rule px-3.5 py-2 text-sm last:border-0", i === active && "bg-panel-rule")}
            >
              <MiniHex terrain={m.terrain} tier={m.tier} kind={m.kind === "shelf" ? "shelf" : "game"} size={22} />
              <span className="flex-1 font-semibold">{m.name}</span>
              <span className="text-xs text-muted">{m.kind === "shelf" ? "Shelf" : m.kind === "ghost" ? "Pending" : `${m.plays} plays`}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col wide:flex-row">
      <main id="main" className="flex min-w-0 flex-[999_1_560px] flex-col px-4 pt-5 desk:px-8 desk:pb-6 desk:pt-6">
        {/* Phone header (Main.dc.html) */}
        <header className="flex items-center gap-3 desk:hidden">
          <PlayerDisc player={{ name: p.owner.name, color: p.owner.color }} size={46} className="shadow-[0_0_0_3px_#0F2E45,0_0_0_5px_#F5C84B]" />
          <div className="min-w-0 flex-1">
            <h1 className="m-0 font-display text-[26px] font-black leading-none">{p.title}</h1>
            <p className="m-0 mt-[3px] text-[13px] text-muted">{p.phoneSubtitle}</p>
          </div>
          {p.isSelf ? (
            <Link href="/notifications" aria-label={`Notifications${p.unread ? `, ${p.unread} unread` : ""}`} className="relative flex h-11 w-11 items-center justify-center rounded-full text-text">
              <Bell size={22} strokeWidth={2} aria-hidden />
              {p.unread ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-gold" aria-hidden /> : null}
            </Link>
          ) : null}
        </header>
        {/* Desktop header (DesktopIsland.dc.html) */}
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="hidden min-w-0 flex-[1_1_260px] desk:block">
            <h1 className="m-0 font-display text-[40px] font-black leading-none">{p.title}</h1>
            <p className="m-0 mt-1 text-sm text-muted">{p.subtitle}</p>
          </div>
          <div className="mt-3 flex w-full items-center gap-3 desk:mt-0 desk:w-auto">
            <div className="hidden flex-1 desk:block">{searchBox}</div>
            <Segmented label="View" value={view} onChange={setView} options={[{ value: "map", label: "Map" }, { value: "list", label: "List" }]} />
            <div className="flex-1 desk:hidden">{searchBox}</div>
          </div>
        </div>
        {p.level && desk ? <XPBar className="mt-3.5 max-w-[520px]" into={p.level.into} forNext={p.level.forNext} level={p.level.level} /> : null}

        {empty ? (
          <div className="mt-8 rounded-2xl bg-panel px-5 py-10 text-center">
            <p className="m-0 font-display text-4xl font-black">Your island is waiting</p>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">Import your play history or log your first quest. Every game you play becomes a tile.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/log">Log your first quest</ButtonLink>
              <ButtonLink href="/import" variant="secondary">
                Import your play history
              </ButtonLink>
            </div>
          </div>
        ) : view === "map" ? (
          <>
            <IslandMap
              tiles={p.tiles}
              selectedKey={selected}
              onSelect={onSelect}
              ariaLabel={p.ariaLabel}
              baseSize={desk ? 76 : 50}
              fullNameAt={72}
              flyTo={fly}
              className="mt-2 h-[340px] desk:min-h-[600px] desk:flex-1"
            />
            {!desk && sel ? <TileCard data={{ ...sel.card, cta: sel.kind === "shelf" ? "Propose" : "Open" }} layout="compact" className="mt-1.5" /> : null}
          </>
        ) : (
          <section aria-label={`${p.isSelf ? "Your" : "Their"} games, most played first`} className="mt-3 overflow-hidden rounded-2xl bg-panel">
            <ul className="m-0 list-none p-0">
              {list.map((t) => (
                <li key={t.key}>
                  <Link href={t.card.href} className="grid min-h-11 grid-cols-[30px_1fr_auto] items-center gap-3 border-b border-panel-rule px-3.5 py-2 text-text no-underline hover:bg-panel-rule hover:text-text">
                    <MiniHex terrain={t.terrain} tier={t.tier} kind={t.kind === "shelf" ? "shelf" : "game"} />
                    <span className="text-[15px] font-semibold">
                      {t.name}{" "}
                      <span className="text-xs font-medium text-muted">{t.kind === "shelf" ? "On your shelf" : t.kind === "ghost" ? "Waiting for confirmation" : tierName(t.tier ?? 0)}</span>
                      {t.crown ? <span className="sr-only">, you hold the crown</span> : null}
                    </span>
                    <span className="font-display text-xl font-black">{t.kind === "game" ? t.plays : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Phone nudge card */}
        {!desk && p.isSelf && p.nudges[0] ? (
          <Link href={p.nudges[0].href} className="mt-2 flex items-center gap-3 rounded-[14px] bg-panel px-3.5 py-3 text-text no-underline">
            <NudgeIcon n={p.nudges[0]} />
            <div className="flex-1">
              <div className="text-[15px] font-bold">{p.nudges[0].text}</div>
              {p.shelfCount ? <div className="text-[13px] text-muted">{p.shelfCount} uncharted games wait on your shelf</div> : null}
            </div>
            <ChevronRight size={18} className="text-muted" aria-hidden />
          </Link>
        ) : null}
        {!desk && p.night ? (
          <Link href={p.night.href} className="mt-2 block rounded-[14px] bg-panel px-3.5 py-3 text-text no-underline">
            <div className="text-[13px] text-muted">Next quest</div>
            <div className="font-display text-xl font-black">{p.night.title}</div>
          </Link>
        ) : null}
      </main>

      {wide ? (
        <aside aria-label="Selected tile" className="flex w-[360px] shrink-0 flex-col gap-3 border-l border-sea-line px-5 py-6">
          {sidePanel}
        </aside>
      ) : null}

      {desk && !wide && drawer ? (
        <div role="dialog" aria-modal="false" aria-label="Selected tile" className="fixed inset-y-0 right-0 z-40 flex w-[360px] flex-col gap-3 overflow-y-auto border-l border-sea-line bg-sea px-5 py-6 shadow-[-12px_0_32px_rgba(0,0,0,0.35)]">
          <button type="button" onClick={() => setDrawer(false)} aria-label="Close" className="flex h-11 w-11 items-center justify-center self-end rounded-full text-text hover:bg-panel">
            <X size={22} aria-hidden />
          </button>
          {sidePanel}
        </div>
      ) : null}
    </div>
  );
}
