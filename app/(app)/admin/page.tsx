import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TERRAIN_INFO, type Terrain } from "@/game/config";
import { db } from "@/lib/db";
import { relativeDay } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { PageLayout, PageTitle } from "@/components/shell/PageLayout";
import { Panel, PanelHeading } from "@/components/ui/Panel";
import { PromoteButton, ReportButtons } from "@/components/admin/AdminButtons";
import { displayName } from "@/server/social";

export const metadata: Metadata = { title: "Admin" };

export default async function Admin() {
  const viewer = await requireUser();
  if (!viewer.isAdmin) notFound();
  const [reports, customs, overrides] = await Promise.all([
    db.report.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 50, include: { reporter: { select: { displayName: true, handle: true } } } }),
    db.game.findMany({ where: { source: "custom" }, orderBy: { createdAt: "desc" }, take: 50, include: { createdBy: { select: { displayName: true, handle: true } }, _count: { select: { quests: true } } } }),
    db.game.findMany({ where: { terrainOverride: { not: null } }, select: { name: true, slug: true, terrain: true, terrainOverride: true } }),
  ]);
  const commentIds = reports.filter((r) => r.targetType === "comment").map((r) => r.targetId);
  const comments = new Map((await db.comment.findMany({ where: { id: { in: commentIds } }, select: { id: true, body: true, questId: true } })).map((c) => [c.id, c]));
  const href = (t: string, id: string) => (t === "quest" ? `/quests/${id}` : t === "comment" ? `/quests/${comments.get(id)?.questId ?? ""}` : null);
  return (
    <PageLayout wideMain>
      <PageTitle sub="Reports, custom games and terrain overrides.">Admin</PageTitle>
      <Panel className="mt-4 py-1.5">
        <PanelHeading aside={`${reports.length} open`}>Reports</PanelHeading>
        {reports.length ? (
          reports.map((r) => (
            <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-panel-rule px-4 py-3">
              <div className="min-w-0 text-sm">
                <div className="font-semibold">
                  {r.reason} · {r.targetType}{" "}
                  {href(r.targetType, r.targetId) ? <Link href={href(r.targetType, r.targetId)!}>open</Link> : <span className="text-muted">{r.targetId}</span>}
                </div>
                {r.targetType === "comment" && comments.get(r.targetId) ? <div className="text-muted">“{comments.get(r.targetId)!.body}”</div> : null}
                {r.details ? <div className="text-muted">{r.details}</div> : null}
                <div className="text-xs text-muted">
                  by {r.reporter ? displayName(r.reporter) : "deleted user"}, {relativeDay(r.createdAt)}
                </div>
              </div>
              <ReportButtons id={r.id} commentId={r.targetType === "comment" && comments.has(r.targetId) ? r.targetId : undefined} />
            </div>
          ))
        ) : (
          <p className="m-0 border-t border-panel-rule px-4 py-3 text-sm text-muted">No open reports.</p>
        )}
      </Panel>
      <Panel className="mt-3 py-1.5">
        <PanelHeading aside={`${customs.length}`}>Custom games</PanelHeading>
        {customs.length ? (
          customs.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-panel-rule px-4 py-2.5 text-sm">
              <span>
                <span className="font-semibold">{g.name}</span> <span className="text-muted">{TERRAIN_INFO[g.terrain as Terrain].name}, {g._count.quests} quests, by {g.createdBy ? displayName(g.createdBy) : "someone"}</span>
              </span>
              <PromoteButton id={g.id} />
            </div>
          ))
        ) : (
          <p className="m-0 border-t border-panel-rule px-4 py-3 text-sm text-muted">No custom games.</p>
        )}
      </Panel>
      <Panel className="mt-3 py-1.5">
        <PanelHeading>Terrain overrides</PanelHeading>
        {overrides.length ? (
          overrides.map((g) => (
            <Link key={g.slug} href={`/games/${g.slug}`} className="block border-t border-panel-rule px-4 py-2.5 text-sm text-text no-underline hover:text-gold-hover">
              {g.name}: {TERRAIN_INFO[g.terrain as Terrain].name} → {TERRAIN_INFO[g.terrainOverride as Terrain].name}
            </Link>
          ))
        ) : (
          <p className="m-0 border-t border-panel-rule px-4 py-3 text-sm text-muted">None. Set one from a game’s tile settings.</p>
        )}
      </Panel>
    </PageLayout>
  );
}
