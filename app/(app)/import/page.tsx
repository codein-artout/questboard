import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { relativeDay } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { PageLayout, PageTitle } from "@/components/shell/PageLayout";
import { Panel, PanelHeading } from "@/components/ui/Panel";
import { ImportFlow } from "@/components/import/ImportFlow";
import { ConfirmGame } from "@/components/import/ConfirmGame";

export const metadata: Metadata = { title: "Import your play history" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const viewer = await requireUser();
  const sp = await searchParams;
  const [jobs, unconfirmed] = await Promise.all([
    db.importJob.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, fileName: true, status: true, created: true, skipped: true, total: true, processed: true, createdAt: true } }),
    db.game.findMany({ where: { createdById: viewer.id, needsConfirmation: true }, select: { id: true, name: true, slug: true, _count: { select: { quests: true } } }, orderBy: { name: "asc" } }),
  ]);
  const active = jobs.find((j) => j.status === "queued" || j.status === "running");
  return (
    <PageLayout
      asideLabel="Past imports"
      aside={
        <>
          {unconfirmed.length ? (
            <Panel className="py-1.5">
              <PanelHeading aside={`${unconfirmed.length}`}>Games to check</PanelHeading>
              <p className="m-0 px-4 pb-2 text-xs text-muted">These weren’t in the catalog, so they were added as your own games.</p>
              {unconfirmed.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-2 border-t border-panel-rule px-4 py-2 text-sm">
                  <Link href={`/games/${g.slug}`} className="min-w-0 truncate font-semibold text-text no-underline hover:text-gold-hover">
                    {g.name}
                  </Link>
                  <ConfirmGame id={g.id} />
                </div>
              ))}
            </Panel>
          ) : null}
          {jobs.length ? (
            <Panel className="py-1.5">
              <PanelHeading>Past imports</PanelHeading>
              {jobs.map((j) => (
                <div key={j.id} className="border-t border-panel-rule px-4 py-2 text-sm">
                  <div className="truncate font-semibold">{j.fileName}</div>
                  <div className="text-xs text-muted">
                    {relativeDay(j.createdAt)}: {j.status === "done" ? `${j.created} added, ${j.skipped} skipped` : j.status === "failed" ? "failed" : `${j.processed} of ${j.total}`}
                  </div>
                </div>
              ))}
            </Panel>
          ) : null}
        </>
      }
    >
      <PageTitle sub="Imported plays build your island, tiers, records and stats. They count toward level XP at half, and never toward crowns or campaigns, since nobody confirmed them.">Import your play history</PageTitle>
      <ImportFlow resumeId={active?.id} next={sp.next?.startsWith("/") ? sp.next : undefined} />
    </PageLayout>
  );
}
