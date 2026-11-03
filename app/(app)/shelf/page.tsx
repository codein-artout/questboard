import type { Metadata } from "next";
import Link from "next/link";
import { TERRAIN_INFO, XP, type Terrain } from "@/game/config";
import { shelfBountyXp } from "@/game/engine";
import { db } from "@/lib/db";
import { monthName, plural } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { PageLayout, PageTitle } from "@/components/shell/PageLayout";
import { EmptyState, Panel, PanelHeading } from "@/components/ui/Panel";
import { VoteCard } from "@/components/nights/VoteCard";
import { ShelfAdd } from "@/components/shelf/ShelfAdd";
import { ShelfRowActions } from "@/components/shelf/ShelfRowActions";
import { nextNightFor } from "@/server/queries/island";
import { getNight } from "@/server/queries/nights";

export const metadata: Metadata = { title: "Shelf of shame" };

function ownedSince(d: Date, now: Date) {
  const months = (now.getTime() - d.getTime()) / (30.4375 * 86400000);
  if (months >= 12) return `Owned for ${months >= 24 ? `${Math.floor(months / 12)} years` : "a year"}`;
  return `Owned since ${monthName(d)}${d.getUTCFullYear() !== now.getUTCFullYear() ? ` ${d.getUTCFullYear()}` : ""}`;
}

export default async function Shelf() {
  const viewer = await requireUser();
  const now = new Date();
  const [items, tiles, nextNight, stats] = await Promise.all([
    db.shelfItem.findMany({ where: { userId: viewer.id }, include: { game: { select: { id: true, slug: true, name: true, terrain: true, terrainOverride: true, baseGameId: true } } }, orderBy: { acquiredAt: "asc" } }),
    db.tile.findMany({ where: { userId: viewer.id, plays: { gt: 0 } }, select: { gameId: true } }),
    nextNightFor(viewer.id),
    db.playerStats.findUnique({ where: { userId: viewer.id }, select: { titleProgress: true } }),
  ]);
  const played = new Set(tiles.map((t) => t.gameId));
  const unplayed = items.filter((i) => !played.has(i.game.baseGameId ?? i.gameId));
  const night = nextNight ? await getNight(nextNight.id, viewer.id) : null;
  const inVote = new Set(night?.votes.map((v) => v.gameId) ?? []);
  const cleared = ((stats?.titleProgress as unknown as { id: string; earned: boolean; text: string }[] | null) ?? []).find((t) => t.id === "shelf-cleared");

  return (
    <PageLayout
      asideLabel="Bounties"
      aside={
        <>
          <Panel className="py-1.5">
            <PanelHeading>Bounties</PanelHeading>
            {XP.shelfBounty.map((b, i) => (
              <div key={i} className="flex justify-between border-t border-panel-rule px-4 py-2 text-sm">
                <span>{b.maxMonths === Infinity ? "Owned over a year" : `Owned up to ${b.maxMonths} months`}</span>
                <span className="font-display text-lg font-extrabold text-gold">+{b.xp}</span>
              </div>
            ))}
            <p className="m-0 border-t border-panel-rule px-4 py-2.5 text-xs text-muted">Paid on the first confirmed play. A game needs to sit on the shelf a week first.</p>
          </Panel>
          <Panel className="p-4">
            <div className="text-[13px] text-muted">Title</div>
            <div className="font-display text-xl font-black">Shelf Cleared</div>
            <div className="text-[13px] text-muted">{cleared?.earned ? "Earned. Every game you own has been played." : `Play every game you own (with at least 10 owned). ${plural(items.length, "game")} owned, ${unplayed.length} unplayed.`}</div>
          </Panel>
        </>
      }
    >
      <PageTitle sub={`${plural(unplayed.length, "game")} you own and haven’t played. Each one is an uncharted island with a bounty.`}>Shelf of shame</PageTitle>
      {night && nextNight ? (
        <div className="mt-4">
          <VoteCard title={`${nextNight.title}: what to play?`} votes={night.votes} voterCount={night.voterCount} votesLeft={night.votesLeft} canVote={night.canJoin} limit={3} />
          <p className="m-0 mt-1.5 px-1 text-xs">
            <Link href={`/nights/${nextNight.id}`}>Open the game night</Link>
          </p>
        </div>
      ) : null}
      <section aria-label="Unplayed games" className="mt-3.5 flex flex-col gap-2">
        {unplayed.length ? (
          unplayed.map((i) => {
            const terrain = (i.game.terrainOverride ?? i.game.terrain) as Terrain;
            const tint = TERRAIN_INFO[terrain].face;
            const bounty = shelfBountyXp(i.acquiredAt, now);
            return (
              <div key={i.id} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-[14px] bg-panel px-3 py-2.5">
                <div aria-hidden className="relative h-[46px] w-10">
                  <div className="hex absolute inset-0" style={{ background: tint }} />
                  <div className="hex absolute inset-[3px] flex items-center justify-center bg-panel font-display text-lg font-black" style={{ color: tint }}>
                    ?
                  </div>
                </div>
                <div className="min-w-0">
                  <Link href={`/games/${i.game.slug}`} className="block truncate font-display text-xl font-extrabold leading-[1.05] text-text no-underline hover:text-gold-hover">
                    {i.game.name}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted">
                    {ownedSince(i.acquiredAt, now)}, {bounty ? `+${bounty} XP bounty` : `bounty from next week (+${XP.shelfBounty[0]!.xp} XP)`}
                  </div>
                </div>
                <ShelfRowActions gameId={i.gameId} slug={i.game.slug} nightId={night?.canJoin ? nextNight!.id : null} inVote={inVote.has(i.gameId)} />
              </div>
            );
          })
        ) : (
          <EmptyState title={items.length ? "Shelf cleared" : "Nothing on your shelf"}>{items.length ? "You’ve played every game you own." : "Add the games you own. The ones you haven’t played float offshore with a bounty."}</EmptyState>
        )}
      </section>
      <div className="mt-4">
        <ShelfAdd />
      </div>
      {items.length > unplayed.length ? <p className="mt-3 px-1 text-[13px] text-muted">{plural(items.length - unplayed.length, "owned game")} already played and on your island.</p> : null}
    </PageLayout>
  );
}
