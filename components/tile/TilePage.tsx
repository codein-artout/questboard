import Link from "next/link";
import { TileBadge } from "@/components/game/HexTile";
import { TierLadder } from "@/components/game/TierLadder";
import { CrownCard } from "@/components/game/CrownCard";
import { DiscStack, PlayerDisc } from "@/components/game/PlayerDisc";
import { BackLink, PageLayout } from "@/components/shell/PageLayout";
import { ButtonLink } from "@/components/ui/Button";
import { Panel, PanelHeading, StatGrid } from "@/components/ui/Panel";
import { fmtScore, plural } from "@/lib/format";
import type { getTilePage } from "@/server/queries/tile";
import { TileSettings } from "./TileSettings";

type Data = NonNullable<Awaited<ReturnType<typeof getTilePage>>>;

export function TilePage({ d, night, isAdmin, viewerSignedIn }: { d: Data; night: { id: string; label: string } | null; isAdmin: boolean; viewerSignedIn: boolean }) {
  const s = d.isSelf;
  const tier = d.tile?.tier ?? 0;
  const crownCards = (layout: "stack" | "row") =>
    d.crowns.length ? (
      d.crowns.map((c) => <CrownCard key={c.scope} scope={c.scope} headline={c.headline} detail={c.detail} layout={layout} />)
    ) : (
      <CrownCard layout={layout} scope="Crown" headline="No crown yet" detail={d.game.scoring === "points" ? "Log a scored quest with a friend to set the record." : d.game.scoring === "coop" ? "Win it together to claim it." : "Win rate needs 5 plays each."} />
    );
  const aside = (
    <>
      <div className="hidden flex-col gap-3 wide:flex">{crownCards("stack")}</div>
      {d.taughtBy ? (
        <Panel className="flex items-center gap-3 p-4">
          <PlayerDisc player={d.taughtBy} size={30} />
          <div className="text-[15px] font-bold">Taught by {d.taughtBy.name}</div>
        </Panel>
      ) : null}
      {d.learners.length ? (
        <Panel className="p-4">
          <h2 className="m-0 text-[15px] font-bold">
            {s ? "You" : d.owner.name} taught it to {plural(d.learners.length, "person", "people")}
          </h2>
          <p className="mb-3 mt-0.5 text-[13px] text-muted">
            {d.spread.total > d.spread.direct ? `It spread from them to ${plural(d.spread.total - d.spread.direct, "more island")}.` : "It hasn’t spread further yet."}
          </p>
          <DiscStack players={d.learners} size={30} edge="#17405E" max={12} />
        </Panel>
      ) : null}
      {d.houseRecords.length ? (
        <Panel className="py-1.5">
          <PanelHeading>House records at {s ? "your" : `${d.owner.name}’s`} place</PanelHeading>
          {d.houseRecords.map((r) => (
            <Link key={r.what} href={`/quests/${r.questId}`} className="grid grid-cols-[1fr_auto] items-center gap-2.5 border-t border-panel-rule px-4 py-2.5 text-text no-underline hover:bg-panel-rule hover:text-text">
              <div>
                <div className="text-sm font-semibold">{r.what}</div>
                <div className="text-xs text-muted">{r.who}</div>
              </div>
              <span className="font-display text-[22px] font-black">{r.value}</span>
            </Link>
          ))}
        </Panel>
      ) : null}
    </>
  );

  return (
    <PageLayout aside={aside} asideLabel="Crown and records">
      {viewerSignedIn ? <BackLink href={s ? `/?tile=${d.game.slug}` : `/u/${d.owner.handle}/island`}>{s ? "Your island" : `${d.owner.name}’s island`}</BackLink> : null}
      <section className="mt-2 flex flex-wrap items-center gap-5 desk:gap-7">
        <div className="hidden desk:block">
          <TileBadge terrain={d.game.terrain} tier={Math.max(1, tier)} width={150} kind={d.tile ? "game" : "shelf"} />
        </div>
        <div className="desk:hidden">
          <TileBadge terrain={d.game.terrain} tier={Math.max(1, tier)} width={104} kind={d.tile ? "game" : "shelf"} />
        </div>
        <div className="min-w-0 flex-[1_1_300px]">
          <h1 className="m-0 font-display text-[44px] font-black leading-[0.95] desk:text-[72px] desk:leading-[0.9]">{d.game.name}</h1>
          <p className="m-0 mt-2.5 text-[15px] font-bold desk:text-lg">{d.tierLine}</p>
          <p className="m-0 mt-1 text-[13px] text-muted desk:text-sm">{d.factsLine}</p>
          {d.game.viewedExpansion ? <p className="m-0 mt-1 text-[13px] text-muted">Plays of {d.game.viewedExpansion.name} count toward this tile.</p> : null}
          {s ? (
            <div className="mt-4 flex flex-wrap gap-2.5">
              <ButtonLink href={`/log?game=${d.game.slug}`} scroll={false}>
                Log {d.game.name.length > 18 ? "a" : `a ${d.game.name}`} quest
              </ButtonLink>
              {night ? (
                <ButtonLink href={`/nights/${night.id}?propose=${d.game.id}`} variant="secondary">
                  Propose for {night.label}
                </ButtonLink>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <Panel className="mt-7 px-2.5 py-3.5 desk:px-5 desk:py-[18px]" aria-label="Tiers">
        <div className="hidden desk:block">
          <TierLadder tier={tier} terrain={d.game.terrain} />
        </div>
        <div className="desk:hidden">
          <TierLadder tier={tier} terrain={d.game.terrain} size="sm" />
        </div>
      </Panel>

      {/* Below 1200px the crown sits right under the tiers, as in TileDetail.dc.html. */}
      <div className="mt-2.5 flex flex-col gap-2.5 wide:hidden">{crownCards("row")}</div>

      {d.tile && d.tile.plays > 0 ? (
        <StatGrid
          className="mt-3"
          colsClass="grid-cols-2 desk:grid-cols-4"
          label={s ? "Your records" : "Records"}
          stats={[
            { value: d.records.best !== null ? fmtScore(d.records.best) : "–", label: "personal best" },
            { value: d.records.avg !== null ? fmtScore(Math.round(d.records.avg)) : "–", label: "average score" },
            { value: d.records.winRate !== null ? `${d.records.winRate}%` : "–", label: "wins" },
            { value: d.records.hosted, label: s ? "hosted by you" : "hosted" },
          ]}
        />
      ) : null}

      {d.history.length ? (
        <section aria-labelledby="recent-h" className="mt-3 overflow-hidden rounded-2xl bg-panel">
          <h2 id="recent-h" className="m-0 px-5 pb-2 pt-4 text-base font-bold">
            Recent quests
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th scope="col" className="px-5 py-2 font-semibold">When</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Party</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Winner</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">{s ? "You" : d.owner.name}</th>
                  <th scope="col" className="py-2 pl-2 pr-5 text-right font-semibold">Place</th>
                </tr>
              </thead>
              <tbody>
                {d.history.map((h) => (
                  <tr key={h.questId} className="border-t border-panel-rule">
                    <td className="px-5 py-2.5">
                      <Link href={`/quests/${h.questId}`} className="text-text no-underline hover:text-gold-hover">
                        {h.when}
                      </Link>
                      {h.pending ? <span className="ml-1.5 text-xs text-muted">pending</span> : null}
                    </td>
                    <td className="px-2 py-2.5">
                      <DiscStack players={h.party} size={24} />
                    </td>
                    <td className="px-2 py-2.5">{h.winner}</td>
                    <td className="px-2 py-2.5 text-right font-display text-lg font-extrabold">{h.score}</td>
                    <td className="py-2.5 pl-2 pr-5 text-right text-muted">{h.place}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <Panel className="mt-3 p-5 text-sm text-muted">{d.onShelf ? "On the shelf, never played. Its first play pays a bounty." : "No quests yet."}</Panel>
      )}

      <Panel className="mt-3 p-5">
        <h2 className="m-0 text-base font-bold">About the game</h2>
        <dl className="m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {d.game.categories.length ? (
            <>
              <dt className="text-muted">Categories</dt>
              <dd className="m-0">{d.game.categories.join(", ")}</dd>
            </>
          ) : null}
          {d.game.mechanics.length ? (
            <>
              <dt className="text-muted">Mechanics</dt>
              <dd className="m-0">{d.game.mechanics.join(", ")}</dd>
            </>
          ) : null}
          {d.game.altNames.length ? (
            <>
              <dt className="text-muted">Also known as</dt>
              <dd className="m-0">{d.game.altNames.join(", ")}</dd>
            </>
          ) : null}
          {d.game.expansions.length ? (
            <>
              <dt className="text-muted">Expansions</dt>
              <dd className="m-0">{d.game.expansions.map((e) => e.name).join(", ")}</dd>
            </>
          ) : null}
          <dt className="text-muted">Scoring</dt>
          <dd className="m-0">{{ points: "Highest score wins", win_lose: "Win or lose", coop: "Co-op", ranked: "Finishing order", teams: "Teams" }[d.game.scoring]}</dd>
          {d.game.source === "custom" ? (
            <>
              <dt className="text-muted">Source</dt>
              <dd className="m-0">Custom game</dd>
            </>
          ) : null}
        </dl>
      </Panel>

      {s ? (
        <TileSettings
          gameId={d.game.id}
          monogram={d.game.monogram}
          monogramOverride={d.game.monogramOverride}
          terrain={d.game.tileTerrainOverride}
          globalTerrain={d.game.globalTerrain}
          isAdmin={isAdmin}
          gameTerrainOverride={d.game.terrainOverride}
          isOnIsland={!!d.tile}
        />
      ) : null}
    </PageLayout>
  );
}
