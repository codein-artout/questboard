import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TERRAIN_INFO } from "@/game/config";
import { fmtScore, relativeDay, tzOffsetMinutes } from "@/lib/format";
import { getViewer } from "@/lib/session";
import { BackLink, PageLayout } from "@/components/shell/PageLayout";
import { Panel, PanelHeading, StatGrid } from "@/components/ui/Panel";
import { PlayerDisc } from "@/components/game/PlayerDisc";
import { MiniHex } from "@/components/game/HexTile";
import { PrivateIsland } from "@/components/island/PrivateIsland";
import { getHeadToHead } from "@/server/queries/character";
import { resolveProfile } from "@/server/queries/profile";
import { displayName } from "@/server/social";

export const metadata: Metadata = { title: "Head to head" };

export default async function HeadToHead({ params }: { params: Promise<{ handle: string; other: string }> }) {
  const { handle, other } = await params;
  const viewer = await getViewer();
  const [a, b] = await Promise.all([resolveProfile(handle, viewer), resolveProfile(other, viewer)]);
  if (!a || !b) notFound();
  if (!a.canView || !b.canView) return <PrivateIsland name={displayName(!a.canView ? a.user : b.user)} />;
  const h = await getHeadToHead(a.user.id, b.user.id);
  const tz = viewer ? tzOffsetMinutes(viewer.timezone) : 0;
  const an = viewer?.id === a.user.id ? "You" : displayName(a.user);
  const bn = displayName(b.user);
  return (
    <PageLayout>
      <BackLink href={`/u/${a.user.handle}`}>{an === "You" ? "Your character sheet" : `${an}’s character sheet`}</BackLink>
      <section className="mt-3 flex items-center justify-between gap-4 rounded-2xl bg-panel p-5">
        <div className="flex flex-col items-center gap-2">
          <PlayerDisc player={{ name: an, color: a.user.color }} size={56} />
          <span className="font-bold">{an}</span>
        </div>
        <div className="text-center">
          <h1 className="m-0 font-display text-6xl font-black leading-none">
            {h.wins}–{h.losses}
          </h1>
          <p className="m-0 mt-1 text-sm text-muted">
            {h.meetings} competitive quests{h.draws ? `, ${h.draws} drawn` : ""}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <PlayerDisc player={{ name: bn, color: b.user.color }} size={56} />
          <span className="font-bold">{bn}</span>
        </div>
      </section>
      <StatGrid className="mt-3" size="sm" label="Record" stats={[{ value: h.wins, label: `${an === "You" ? "your" : `${an}’s`} wins` }, { value: h.losses, label: `${bn}’s wins` }, { value: h.meetings ? `${Math.round((h.wins / h.meetings) * 100)}%` : "–", label: "win rate" }]} />
      {h.games.length ? (
        <Panel className="mt-3 py-1.5">
          <PanelHeading>By game</PanelHeading>
          {h.games.map((g) => (
            <Link key={g.slug} href={`/games/${g.slug}`} className="grid grid-cols-[30px_1fr_auto] items-center gap-3 border-t border-panel-rule px-4 py-2 text-text no-underline hover:text-gold-hover">
              <MiniHex terrain={g.terrain} tier={1} size={24} />
              <span className="text-sm font-semibold">
                {g.name} <span className="text-xs text-muted">{TERRAIN_INFO[g.terrain].name}</span>
              </span>
              <span className="font-display text-lg font-extrabold">
                {g.wins}–{g.losses}
                {g.draws ? `–${g.draws}` : ""}
              </span>
            </Link>
          ))}
        </Panel>
      ) : (
        <Panel className="mt-3 p-4 text-sm text-muted">No confirmed competitive quests together yet.</Panel>
      )}
      {h.recent.length ? (
        <Panel className="mt-3 py-1.5">
          <PanelHeading>Recent meetings</PanelHeading>
          {h.recent.map((r) => (
            <Link key={r.id} href={`/quests/${r.id}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-panel-rule px-4 py-2 text-sm text-text no-underline hover:text-gold-hover">
              <span>
                {r.game} <span className="text-xs text-muted">{relativeDay(r.playedAt, new Date(), tz)}</span>
              </span>
              <span className="text-muted">{r.myScore !== null && r.theirScore !== null ? `${fmtScore(r.myScore)}–${fmtScore(r.theirScore)}` : ""}</span>
              <span className={r.result === "win" ? "font-bold text-gold" : r.result === "loss" ? "text-muted" : ""}>{r.result === "win" ? `${an === "You" ? "You" : an} won` : r.result === "loss" ? `${bn} won` : "Draw"}</span>
            </Link>
          ))}
        </Panel>
      ) : null}
    </PageLayout>
  );
}
