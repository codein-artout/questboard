import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { appUrl } from "@/lib/config";
import { RewardView } from "@/components/reward/RewardView";
import { getReward } from "@/server/queries/reward";
import { PageLayout } from "@/components/shell/PageLayout";
import { Panel, PanelHeading } from "@/components/ui/Panel";
import { PlayerDisc } from "@/components/game/PlayerDisc";
import { fmtScore } from "@/lib/format";
import { ordinal } from "@/game/places";

export const metadata: Metadata = { title: "Quest complete" };

export default async function QuestComplete({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ next?: string }> }) {
  const viewer = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const data = await getReward(id, viewer.id);
  if (!data) {
    // Not in the party (or no outcome yet): show the quest itself.
    const exists = await import("@/lib/db").then(({ db }) => db.quest.findUnique({ where: { id }, select: { id: true } }));
    if (exists) redirect(`/quests/${id}`);
    notFound();
  }
  return (
    <PageLayout
      wideMain
      asideLabel="Party results"
      aside={
        <Panel className="py-1.5">
          <PanelHeading>The party</PanelHeading>
          <ol className="m-0 list-none p-0">
            {data.party.map((p, i) => (
              <li key={i} className="grid grid-cols-[36px_30px_1fr_auto] items-center gap-2 border-t border-panel-rule px-4 py-2">
                <span className={p.place === 1 ? "font-display text-lg font-extrabold text-gold" : "font-display text-lg font-extrabold text-muted"}>{p.place ? ordinal(p.place) : ""}</span>
                <PlayerDisc player={{ name: p.name, color: p.color }} size={28} ring={p.place === 1} edge="#17405E" />
                <span className={p.isMe ? "font-bold" : ""}>{p.isMe ? "You" : p.name}</span>
                <span className="font-display text-xl font-black">{p.score !== null ? fmtScore(p.score) : ""}</span>
              </li>
            ))}
          </ol>
        </Panel>
      }
    >
      <RewardView data={data} next={sp.next?.startsWith("/") ? sp.next : undefined} shareUrl={`${appUrl()}/quests/${id}`} />
    </PageLayout>
  );
}
