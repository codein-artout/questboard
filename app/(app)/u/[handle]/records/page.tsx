import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { duration, fmtScore, inMonth, possessive } from "@/lib/format";
import { getViewer } from "@/lib/session";
import { BackLink, PageLayout, PageTitle } from "@/components/shell/PageLayout";
import { EmptyState, Panel, PanelHeading } from "@/components/ui/Panel";
import { PrivateIsland } from "@/components/island/PrivateIsland";
import { resolveProfile } from "@/server/queries/profile";
import { displayName } from "@/server/social";

export const metadata: Metadata = { title: "House records" };

const LABEL: Record<string, string> = { highest_score: "Highest score", lowest_winning_score: "Lowest winning score", fastest: "Fastest game", longest: "Longest game", comeback: "Biggest comeback", largest_party: "Largest party" };
const ORDER = Object.keys(LABEL);

/** The records board for a host's place: every game played there and its records. */
export default async function RecordsBoard({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const viewer = await getViewer();
  const p = await resolveProfile(handle, viewer);
  if (!p) notFound();
  if (!p.canView) return <PrivateIsland name={displayName(p.user)} />;
  const records = await db.houseRecord.findMany({ where: { hostUserId: p.user.id }, include: { game: { select: { name: true, slug: true } } }, orderBy: [{ game: { name: "asc" } }] });
  const byGame = new Map<string, { name: string; slug: string; rows: typeof records }>();
  for (const r of records) {
    const g = byGame.get(r.gameId) ?? { name: r.game.name, slug: r.game.slug, rows: [] };
    g.rows.push(r);
    byGame.set(r.gameId, g);
  }
  const self = viewer?.id === p.user.id;
  const name = displayName(p.user);
  const value = (r: (typeof records)[number]) => (r.kind === "fastest" || r.kind === "longest" ? duration(r.value) : r.kind === "comeback" ? `+${r.value}` : fmtScore(r.value));
  return (
    <PageLayout wideMain>
      <BackLink href={`/u/${p.user.handle}`}>{self ? "Your character sheet" : `${possessive(name)} character sheet`}</BackLink>
      <PageTitle sub={`${byGame.size} games played at ${self ? "your" : possessive(name)} place. Records from confirmed quests.`}>House records at {self ? "your" : possessive(name)} place</PageTitle>
      {byGame.size ? (
        <div className="mt-4 grid gap-3 desk:grid-cols-2 wide:grid-cols-3">
          {[...byGame.values()].map((g) => (
            <Panel key={g.slug} className="py-1.5">
              <PanelHeading>
                <Link href={`/games/${g.slug}`} className="text-text no-underline hover:text-gold-hover">
                  {g.name}
                </Link>
              </PanelHeading>
              {g.rows
                .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
                .map((r) => (
                  <Link key={r.id} href={`/quests/${r.questId}`} className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-panel-rule px-4 py-2 text-text no-underline hover:bg-panel-rule hover:text-text">
                    <div>
                      <div className="text-sm font-semibold">{LABEL[r.kind]}</div>
                      <div className="text-xs text-muted">
                        {r.kind === "fastest" || r.kind === "longest" || r.kind === "largest_party" ? (r.detail ?? "") : r.holderName}
                        {r.kind === "comeback" && r.detail ? `, ${r.detail}` : ""}, {inMonth(r.achievedAt)}
                      </div>
                    </div>
                    <span className="font-display text-xl font-black">{value(r)}</span>
                  </Link>
                ))}
            </Panel>
          ))}
        </div>
      ) : (
        <EmptyState title="No house records yet">Quests logged at this place set records here.</EmptyState>
      )}
    </PageLayout>
  );
}
