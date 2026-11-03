import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { clockTime, nightTitle, tzOffsetMinutes } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { BackLink, PageLayout, PageTitle } from "@/components/shell/PageLayout";
import { ButtonLink } from "@/components/ui/Button";
import { Panel, PanelHeading } from "@/components/ui/Panel";
import { DiscStack } from "@/components/game/PlayerDisc";
import { VoteCard } from "@/components/nights/VoteCard";
import { RsvpButtons } from "@/components/nights/RsvpButtons";
import { ProposeForm } from "@/components/nights/ProposeForm";
import { CancelNight } from "@/components/nights/CancelNight";
import { getNight, proposable } from "@/server/queries/nights";

export const metadata: Metadata = { title: "Game night" };

export default async function NightPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ propose?: string }> }) {
  const viewer = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const d = await getNight(id, viewer.id);
  if (!d || (!d.canJoin && d.night.hostId !== viewer.id)) notFound();
  const tz = tzOffsetMinutes(viewer.timezone);
  const n = d.night;
  const title = n.title ?? nightTitle(n.startsAt, d.hostName, new Date(), tz);
  const games = await proposable(n.hostId, viewer.id);
  const past = n.startsAt.getTime() < Date.now() - 6 * 3600 * 1000;
  return (
    <PageLayout
      asideLabel="Who’s coming"
      aside={
        <Panel className="py-1.5">
          <PanelHeading>Who’s coming</PanelHeading>
          {(
            [
              ["Going", d.going],
              ["Maybe", d.maybe],
              ["Can’t", d.cant],
            ] as const
          ).map(([label, people]) => (
            <div key={label} className="flex items-center justify-between gap-3 border-t border-panel-rule px-4 py-2.5">
              <span className="text-sm">
                {label} <span className="text-muted">{people.length}</span>
              </span>
              {people.length ? <DiscStack players={people} size={26} edge="#17405E" /> : null}
            </div>
          ))}
        </Panel>
      }
    >
      {n.guild ? <BackLink href={`/g/${n.guild.slug}`}>{n.guild.name}</BackLink> : <BackLink href="/">Your island</BackLink>}
      <PageTitle sub={`${clockTime(n.startsAt, tz)}, ${n.location}. Hosted by ${d.hostName === "yours" ? "you" : d.hostName.replace(/’s$/, "")}.${n.isFinale && n.campaign ? ` ${n.campaign.name} finale: double XP.` : ""}`}>
        {n.status === "cancelled" ? `Cancelled: ${title}` : title}
      </PageTitle>
      {n.notes ? <p className="mt-2 text-sm">{n.notes}</p> : null}
      {n.status === "scheduled" && !past ? (
        <div className="mt-4">
          <RsvpButtons nightId={n.id} current={d.myRsvp} />
        </div>
      ) : null}
      <div className="mt-4">
        <VoteCard title="What to play?" votes={d.votes} voterCount={d.voterCount} votesLeft={d.votesLeft} canVote={d.canJoin && n.status === "scheduled"} />
      </div>
      {n.status === "scheduled" ? (
        <Panel className="mt-3 p-4">
          <ProposeForm nightId={n.id} games={games} preselect={sp.propose} />
          <p className="m-0 mt-2 text-xs text-muted">From the host’s collection or your own shelf.</p>
        </Panel>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ButtonLink href={`/log?night=${n.id}`} scroll={false}>
          Log a quest from tonight
        </ButtonLink>
        {d.canEdit && n.status === "scheduled" ? <CancelNight nightId={n.id} /> : null}
      </div>
      {n.quests.length ? (
        <Panel className="mt-4 py-1.5">
          <PanelHeading>Quests that night</PanelHeading>
          {n.quests.map((q) => (
            <Link key={q.id} href={`/quests/${q.id}`} className="block border-t border-panel-rule px-4 py-2.5 text-sm text-text no-underline hover:text-gold-hover">
              {q.game.name}
            </Link>
          ))}
        </Panel>
      ) : null}
    </PageLayout>
  );
}
