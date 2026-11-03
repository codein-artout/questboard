"use client";

import Link from "next/link";
import { animate, motion, useReducedMotion } from "framer-motion";
import { Clock, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { TERRAIN_INFO } from "@/game/config";
import { hexToPixel } from "@/game/hex";
import { TierBuilding } from "@/components/game/TierBuilding";
import { CrownIcon } from "@/components/game/CrownIcon";
import { PlayerDisc } from "@/components/game/PlayerDisc";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { theGame } from "@/lib/format";
import type { RewardData } from "@/server/queries/reward";

function Tile({ terrain, tier, width, halo, crown, ghost, building }: { terrain: keyof typeof TERRAIN_INFO; tier: number; width: number; halo?: boolean; crown?: boolean; ghost?: boolean; building?: React.ReactNode }) {
  const t = TERRAIN_INFO[terrain];
  const h = Math.round((width * 2) / Math.sqrt(3));
  const depth = Math.round(width * 0.09);
  return (
    <div className="relative" style={{ width, height: h + depth, opacity: ghost ? 0.6 : 1 }}>
      {halo ? <div className="hex absolute bg-gold" style={{ left: -8, right: -8, top: -8, height: h + 16 }} /> : null}
      <div className="hex absolute inset-x-0" style={{ top: depth, height: h, background: t.side }} />
      <div className="hex absolute inset-x-0 top-0 flex items-center justify-center overflow-hidden" style={{ height: h, background: t.face }}>
        {building ?? <TierBuilding tier={tier} size={Math.round(width * 0.55)} color={t.ink} />}
      </div>
      {ghost ? <div className="hex absolute" style={{ left: 6, right: 6, top: 5, height: h - 10, boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.6)" }} /> : null}
      {crown ? <CrownIcon size={Math.round(width * 0.26)} className="absolute" style={{ right: -2, top: 6 }} /> : null}
    </div>
  );
}

function useCountUp(target: number, run: boolean, reduced: boolean) {
  const [v, setV] = useState(reduced ? target : 0);
  useEffect(() => {
    if (!run) return;
    if (reduced) {
      setV(target);
      return;
    }
    const c = animate(0, target, { duration: 0.6, ease: "easeOut", onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [target, run, reduced]);
  return v;
}

export function RewardView({ data, next, shareUrl }: { data: RewardData; next?: string; shareUrl: string }) {
  const reduced = !!useReducedMotion();
  const p = data.payload;
  const t = TERRAIN_INFO[data.tile.terrain];
  const pending = data.status !== "confirmed";
  const lines = p.lines.filter((l) => l.amount !== 0);
  const [shown, setShown] = useState(reduced ? lines.length : 0);
  const [barDone, setBarDone] = useState(reduced);
  const [copied, setCopied] = useState(false);
  const linesDone = shown >= lines.length;
  const total = useCountUp(p.xp, linesDone, reduced);

  useEffect(() => {
    if (reduced || shown >= lines.length) return;
    const timer = setTimeout(() => setShown((s) => s + 1), shown === 0 ? 900 : 380);
    return () => clearTimeout(timer);
  }, [shown, lines.length, reduced]);
  useEffect(() => {
    if (!linesDone || reduced) return;
    const timer = setTimeout(() => setBarDone(true), 700);
    return () => clearTimeout(timer);
  }, [linesDone, reduced]);

  const levelUp = p.level.after > p.level.before;
  const beforePct = levelUp ? 0 : Math.min(100, (p.level.xpIntoBefore / p.level.xpForNext) * 100);
  const afterPct = Math.min(100, (p.level.xpIntoLevel / p.level.xpForNext) * 100);

  const share = async () => {
    const url = shareUrl;
    try {
      if (navigator.share) await navigator.share({ title: `${data.game.name} on Questboard`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      /* cancelled */
    }
  };

  const hero = (() => {
    if (data.variant === "new-land") {
      return (
        <section aria-label={`A ${t.name.toLowerCase()} tile joins your island`} className="relative mx-auto mt-2.5 h-[228px] w-full max-w-[390px]">
          {data.neighbors.map((n, i) => {
            const pos = hexToPixel({ q: n.dq * 1.55, r: n.dr * 1.55 }, 72);
            return (
              <motion.div
                key={i}
                aria-hidden
                className="hex absolute"
                style={{ left: `calc(50% + ${pos.x - 36}px)`, top: 110 + pos.y - 41, width: 72, height: 83, background: TERRAIN_INFO[n.terrain].face }}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 0.35 }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
              />
            );
          })}
          <motion.div
            aria-hidden
            className="absolute"
            style={{ left: "calc(50% - 64px)", top: 36 }}
            initial={reduced ? false : { y: 260, scale: 0.55, rotate: -8, opacity: 0 }}
            animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 210, damping: 13, mass: 0.9, delay: 0.25 }}
          >
            <Tile terrain={data.tile.terrain} tier={1} width={128} halo={!pending} ghost={pending} />
          </motion.div>
        </section>
      );
    }
    if (data.variant === "tier-up" && p.tierUp) {
      return (
        <section aria-label={`${data.game.name} tile goes from ${p.tierUp.from} to ${p.tierUp.to}`} className="mt-2 flex h-[200px] items-center justify-center gap-[18px]">
          <div aria-hidden className="opacity-55">
            <Tile terrain={data.tile.terrain} tier={Math.max(1, p.tierUp.from)} width={70} />
          </div>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9DB7C9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
          <motion.div aria-hidden className="relative" initial={reduced ? false : { scale: 0.96 }} animate={{ scale: [0.96, 1.04, 1] }} transition={{ duration: 0.8, delay: 1.1 }}>
            <Tile
              terrain={data.tile.terrain}
              tier={p.tierUp.to}
              width={132}
              halo={!pending}
              ghost={pending}
              crown={p.crownsTaken.length > 0}
              building={
                <div className="relative h-[76px] w-[76px]">
                  <motion.div className="absolute inset-0" initial={reduced ? { opacity: 0 } : { y: 0, opacity: 1 }} animate={{ y: 60, opacity: 0 }} transition={{ duration: 0.5, delay: 0.5, ease: "easeIn" }}>
                    <TierBuilding tier={Math.max(1, p.tierUp.from)} size={76} color={t.ink} />
                  </motion.div>
                  <motion.div className="absolute inset-0" initial={reduced ? false : { y: 70, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14, delay: 1.0 }}>
                    <TierBuilding tier={p.tierUp.to} size={76} color={t.ink} />
                  </motion.div>
                </div>
              }
            />
            {!reduced && !pending ? (
              <motion.div className="hex pointer-events-none absolute bg-gold" style={{ left: -8, right: -8, top: -8, height: Math.round((132 * 2) / Math.sqrt(3)) + 16 }} initial={{ opacity: 0, scale: 1 }} animate={{ opacity: [0, 0.55, 0], scale: [1, 1.18, 1.25] }} transition={{ duration: 0.9, delay: 1.2 }} />
            ) : null}
          </motion.div>
        </section>
      );
    }
    if (data.variant === "crown" && data.crown) {
      return (
        <section aria-label={data.subtitle} className="relative mx-auto mt-4 flex h-[180px] w-full max-w-[320px] items-center justify-between px-6">
          <div className="flex flex-col items-center gap-2">
            <PlayerDisc player={{ name: data.crown.fromName ?? "?", color: data.crown.fromColor }} size={68} />
            <span className="text-sm text-muted">{data.crown.fromName ?? "Nobody"}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <PlayerDisc player={{ name: data.me.name, color: data.me.color }} size={68} className="shadow-[0_0_0_3px_#0F2E45,0_0_0_6px_#F5C84B]" />
            <span className="text-sm font-bold">You</span>
          </div>
          <motion.div aria-hidden className="absolute top-[22px]" initial={reduced ? { left: "calc(100% - 82px)" } : { left: 38, y: 0 }} animate={{ left: "calc(100% - 82px)", y: [0, -36, 0] }} transition={{ duration: 1.1, delay: 0.5, ease: "easeInOut" }}>
            <CrownIcon size={44} />
          </motion.div>
        </section>
      );
    }
    return (
      <section aria-hidden className="mt-4 flex h-[190px] items-center justify-center">
        <Tile terrain={data.tile.terrain} tier={data.tile.tier} width={128} crown={p.crownsTaken.length > 0} ghost={pending} />
      </section>
    );
  })();

  return (
    <div className="mx-auto w-full max-w-[560px] pb-6">
      {pending ? (
        <div role="status" className="mx-4 mt-4 flex items-start gap-3 rounded-2xl bg-panel px-4 py-3 shadow-[inset_0_0_0_1.5px_#2D5878]">
          <Clock size={20} className="mt-0.5 shrink-0 text-gold" aria-hidden />
          <div className="text-sm">
            <div className="font-bold">{data.status === "disputed" ? "Disputed" : "Waiting for confirmation"}</div>
            <div className="text-muted">
              {data.status === "disputed"
                ? "Nothing counts until the dispute is resolved."
                : data.waitingOn.length
                  ? `These rewards land when ${data.waitingOn.length === 1 ? data.waitingOn[0] : `${data.waitingOn.slice(0, -1).join(", ")} or ${data.waitingOn.at(-1)}`} confirms, or in 48 hours if nobody disputes it.`
                  : "These rewards land in 48 hours if nobody disputes the quest."}
            </div>
          </div>
        </div>
      ) : null}
      <header className="px-5 pt-7 text-center">
        <div className="text-[15px] font-bold text-gold">{data.label}</div>
        <h1 className="m-0 mt-1 font-display text-[50px] font-black leading-none desk:text-[56px]">{data.title}</h1>
        {data.subtitle ? <p className="m-0 mt-1.5 text-[15px] text-muted">{data.subtitle}</p> : null}
      </header>

      {hero}

      {data.variant === "new-land" && p.newLand ? (
        <p className="m-0 text-center text-[15px] font-semibold">
          New land: {data.game.name}. A {t.name.toLowerCase()} tile joins your island. That makes {p.newLand.tileCount}.
        </p>
      ) : null}

      {(p.crownsTaken.length && data.variant !== "crown") || p.personalBest || p.crownsClaimed.length ? (
        <section className="mx-4 mt-2 grid grid-cols-2 gap-2">
          {p.crownsTaken.length && data.variant !== "crown" ? (
            <div className="rounded-[14px] bg-gold px-3.5 py-3 text-sea">
              <div className="text-[13px] font-semibold">Crown taken</div>
              <div className="mt-0.5 text-sm font-bold leading-tight">
                You took {theGame(data.game.name)} crown{p.crownsTaken[0]!.fromName ? ` from ${p.crownsTaken[0]!.fromName}` : ""}
              </div>
            </div>
          ) : !p.crownsTaken.length && p.crownsClaimed.length ? (
            <div className="rounded-[14px] bg-gold px-3.5 py-3 text-sea">
              <div className="text-[13px] font-semibold">New crown</div>
              <div className="mt-0.5 text-sm font-bold leading-tight">You hold {theGame(data.game.name)} crown with {p.crownsClaimed[0]!.record}</div>
            </div>
          ) : null}
          {p.personalBest ? (
            <div className="rounded-[14px] bg-panel px-3.5 py-3">
              <div className="text-[13px] text-muted">Personal best</div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-display text-[30px] font-black leading-none">{p.personalBest.score}</span>
                <span className="text-[13px] text-muted">was {p.personalBest.previous}</span>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-label="XP earned" className="mx-4 mt-2 rounded-2xl bg-panel px-4 pb-3.5 pt-1.5">
        <ul className="m-0 list-none p-0">
          {lines.map((l, i) => (
            <motion.li
              key={`${l.source}-${i}`}
              className="flex h-[38px] items-center justify-between border-b border-panel-rule"
              initial={false}
              animate={{ opacity: i < shown ? 1 : 0, x: i < shown ? 0 : -8 }}
              transition={{ duration: reduced ? 0 : 0.25 }}
              aria-hidden={i >= shown}
            >
              <span className="text-[15px]">{l.label}</span>
              <span className={cn("font-display text-xl font-extrabold", l.amount > 0 ? "text-gold" : "text-muted")}>
                {l.amount > 0 ? `+${l.amount}` : `−${Math.abs(l.amount)}`}
              </span>
            </motion.li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-[13px] text-muted">
            Level {p.level.after}, {p.level.xpIntoLevel.toLocaleString("en-US")} of {p.level.xpForNext.toLocaleString("en-US")} XP{pending ? " (projected)" : ""}
          </span>
          <span className="whitespace-nowrap font-display text-2xl font-black" aria-live="polite">
            +{total} XP
          </span>
        </div>
        <div aria-hidden className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-sea-deep">
          <div className="bg-gold-deep" style={{ width: `${barDone ? Math.min(beforePct, afterPct) : beforePct}%` }} />
          <motion.div className="bg-gold-hover" initial={false} animate={{ width: barDone ? `${Math.max(0, afterPct - Math.min(beforePct, afterPct))}%` : "0%" }} transition={{ duration: reduced ? 0 : 0.8, ease: "easeOut" }} />
        </div>
      </section>

      {levelUp && barDone ? (
        <motion.section initial={reduced ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-4 mt-2.5 flex items-center gap-3 rounded-2xl bg-gold px-4 py-3 text-sea">
          <span className="font-display text-4xl font-black leading-none">{p.level.after}</span>
          <div>
            <div className="text-[15px] font-bold">Level up</div>
            <div className="text-[13px]">You reached level {p.level.after}.</div>
          </div>
        </motion.section>
      ) : null}

      {p.classChange && barDone ? (
        <motion.section initial={reduced ? false : { y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mx-4 mt-2.5 rounded-2xl bg-panel px-4 py-3">
          <div className="text-[13px] text-muted">Your class changed</div>
          <div className="font-display text-2xl font-black">
            {p.classChange.fromKey === "none" ? p.classChange.toName : `${p.classChange.fromName} → ${p.classChange.toName}`}
          </div>
        </motion.section>
      ) : null}

      {p.titles.map((title) => (
        <motion.section key={title.id} initial={reduced ? false : { y: 8, opacity: 0 }} animate={{ y: barDone ? 0 : 8, opacity: barDone ? 1 : 0 }} className="mx-4 mt-2.5 flex items-center gap-3 rounded-2xl bg-title-bg px-4 py-3">
          <TitleIcon />
          <div>
            <div className="text-[15px] font-bold">Title unlocked: {title.name}</div>
            <div className="text-[13px] text-title-ink">Show it next to your name from your character sheet.</div>
          </div>
        </motion.section>
      ))}
      {!p.titles.length && p.nearTitle ? (
        <section className="mx-4 mt-2.5 flex items-center gap-3 rounded-2xl bg-title-bg px-4 py-3">
          <TitleIcon />
          <div>
            <div className="text-[15px] font-bold">{p.nearTitle.name}</div>
            <div className="text-[13px] text-title-ink">{p.nearTitle.text}</div>
          </div>
        </section>
      ) : null}

      <div className="mx-4 mt-6 grid grid-cols-2 gap-2.5">
        <button type="button" onClick={share} className={buttonClass("secondary", "lg", "w-full")}>
          <Share2 size={18} aria-hidden />
          {copied ? "Link copied" : "Share"}
        </button>
        <Link href={next ?? (data.variant === "new-land" ? `/?tile=${data.game.slug}` : `/games/${data.game.slug}`)} className={buttonClass("primary", "lg", "w-full")}>
          {next ? "Continue" : data.variant === "new-land" ? "See your island" : "See the tile"}
        </Link>
      </div>
      <p className="mt-3 text-center text-sm">
        <Link href={`/quests/${data.questId}`}>Quest details</Link>
      </p>
    </div>
  );
}

function TitleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C7B5F2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.5 13 17 22l-5-3-5 3 1.5-9" />
    </svg>
  );
}
