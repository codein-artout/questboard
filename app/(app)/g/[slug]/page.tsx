import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { plural, tzOffsetMinutes } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { canManageGuild } from "@/lib/permissions";
import { PageLayout } from "@/components/shell/PageLayout";
import { ButtonLink } from "@/components/ui/Button";
import { Panel, PanelHeading } from "@/components/ui/Panel";
import { DiscStack, PlayerDisc } from "@/components/game/PlayerDisc";
import { QuestCard } from "@/components/game/QuestCard";
import { RsvpButtons } from "@/components/nights/RsvpButtons";
import { Reactions } from "@/components/quests/Reactions";
import { GuildIsland } from "@/components/guild/GuildIsland";
import { CopyLink, LeaveGuild, MemberRemove, StartCampaign } from "@/components/guild/GuildAdmin";
import { getGuild } from "@/server/queries/guild";
import { feedQuests, toCards } from "@/server/queries/quests";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const g = await db.guild.findUnique({ where: { slug }, select: { name: true } });
  return { title: g?.name ?? "Guild" };
}

export default async function GuildPage({ params }: Props) {
  const viewer = await requireUser();
  const { slug } = await params;
  const tz = tzOffsetMinutes(viewer.timezone);
  const d = await getGuild(slug, viewer.id, tz);
  if (!d) notFound();
  if (!d.member) {
    return (
      <PageLayout>
        <h1 className="m-0 font-display text-4xl font-black">{d.guild.name}</h1>
        <p className="mt-2 text-muted">This guild is for members. Ask someone in it for an invite link.</p>
      </PageLayout>
    );
  }
  const { quests } = await feedQuests(viewer, { kind: "guild", guildId: d.guild.id }, null, 6);
  const cards = await toCards(quests, viewer.id, tz);
  const admin = canManageGuild(d.role);
  const standings = d.campaign ? (
    <section aria-label="Campaign standings" className="rounded-2xl bg-panel py-1">
      <div className="flex items-baseline justify-between px-4 pb-1.5 pt-3">
        <h2 className="m-0 text-[15px] font-bold">
          {d.campaign.name}, week {d.campaign.weekOf} of {d.campaign.weeks}
        </h2>
        <span className="text-xs text-muted">Campaign XP</span>
      </div>
      {d.campaign.standings.length ? (
        <ol className="m-0 list-none p-0">
          {d.campaign.standings.slice(0, 8).map((s) => (
            <li key={s.handle} className="grid grid-cols-[22px_30px_1fr_auto] items-center gap-2.5 border-t border-panel-rule px-4 py-2">
              <span className={s.rank === 1 ? "font-display text-lg font-extrabold text-gold" : "font-display text-lg font-extrabold text-muted"}>{s.rank}</span>
              <PlayerDisc player={s} size={28} />
              <span className="min-w-0 truncate text-[15px] font-semibold">
                {s.name} <span className="text-xs font-medium text-muted">{s.className}</span>
              </span>
              <span className="font-display text-xl font-black">{s.xp}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 border-t border-panel-rule px-4 py-3 text-sm text-muted">No campaign quests yet.</p>
      )}
      <p className="m-0 border-t border-panel-rule px-4 py-2.5 text-xs text-muted">Finale {d.campaign.finale.toLowerCase().startsWith("last") ? d.campaign.finale : `on ${d.campaign.finale}`}: double XP. The winner earns a permanent champion title.</p>
    </section>
  ) : null;

  return (
    <PageLayout
      asideLabel="Guild"
      aside={
        <>
          {standings}
          <Panel className="py-1.5">
            <PanelHeading aside={plural(d.members.length, "member")}>Members</PanelHeading>
            <ul className="m-0 list-none p-0">
              {d.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 border-t border-panel-rule px-4 py-2">
                  <PlayerDisc player={m} size={26} />
                  <Link href={`/u/${m.handle}`} className="flex-1 truncate text-sm font-semibold text-text no-underline hover:text-gold-hover">
                    {m.name}
                  </Link>
                  <span className="text-xs text-muted">{m.role === "member" ? m.className.replace(/^The /, "") : m.role}</span>
                  {admin && m.role !== "owner" && m.id !== viewer.id ? <MemberRemove guildId={d.guild.id} userId={m.id} name={m.name} /> : null}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="flex flex-col gap-2 p-4">
            <h2 className="m-0 text-[15px] font-bold">Invite to {d.guild.name}</h2>
            <CopyLink url={`${appUrl()}/g/join/${d.guild.inviteCode}`} label="Guild invite link" />
            <div className="mt-2 flex flex-wrap gap-2">
              {admin && !d.campaign ? <StartCampaign guildId={d.guild.id} /> : null}
              <LeaveGuild guildId={d.guild.id} />
            </div>
          </Panel>
          {d.champions.length ? (
            <Panel className="py-1.5">
              <PanelHeading>Champions</PanelHeading>
              {d.champions.map((c) => (
                <div key={c.name} className="flex justify-between border-t border-panel-rule px-4 py-2 text-sm">
                  <span>{c.name}</span>
                  <span className="font-bold text-title-ink">{c.champion}</span>
                </div>
              ))}
            </Panel>
          ) : null}
        </>
      }
    >
      <section>
        <div className="text-sm text-muted">Guild</div>
        <h1 className="m-0 mt-0.5 font-display text-[40px] font-black leading-none">{d.guild.name}</h1>
        {d.guild.description ? <p className="m-0 mt-1 text-sm text-muted">{d.guild.description}</p> : null}
        <div className="mt-3 flex items-center gap-2.5">
          <DiscStack players={d.members} size={30} edge="#0F2E45" />
          <span className="ml-2 text-sm text-muted">
            {plural(d.members.length, "member")}, {plural(d.questCount, "quest")} together
          </span>
        </div>
      </section>
      <GuildIsland tiles={d.tiles} label={`Shared guild island, ${plural(d.tileCount, "tile")}. Each tile shows who holds its crown.`} />
      {d.night ? (
        <section className="mt-3 rounded-2xl bg-gold p-4 text-sea">
          <div className="text-[13px] font-semibold">Next quest</div>
          <Link href={`/nights/${d.night.id}`} className="mt-0.5 block font-display text-[26px] font-black leading-[1.05] text-sea no-underline hover:text-sea">
            {d.night.title}
          </Link>
          <div className="mt-1 text-sm">{d.night.detail}</div>
          <RsvpButtons nightId={d.night.id} current={d.night.myRsvp} tone="gold" />
        </section>
      ) : (
        <Panel className="mt-3 flex items-center justify-between gap-3 p-4">
          <span className="text-sm text-muted">No game night planned.</span>
          <ButtonLink href={`/nights/new?guild=${d.guild.slug}`} size="sm">
            Plan one
          </ButtonLink>
        </Panel>
      )}
      {d.crownChanges.length ? (
        <Panel className="mt-3 py-1.5">
          <PanelHeading>Crowns changing hands</PanelHeading>
          {d.crownChanges.map((c) => (
            <Link key={c.id} href={`/games/${c.slug}`} className="flex justify-between gap-3 border-t border-panel-rule px-4 py-2.5 text-sm text-text no-underline hover:text-gold-hover">
              <span>{c.text}</span>
              <span className="shrink-0 text-xs text-muted">{c.when}</span>
            </Link>
          ))}
        </Panel>
      ) : null}
      <h2 className="mb-2 ml-1 mt-5 text-[15px] font-bold">Guild quests</h2>
      <div className="flex flex-col gap-2.5">
        {cards.map((c) => (
          <QuestCard key={c.id} quest={c} headingLevel={3} footer={<Reactions questId={c.id} reactions={c.reactions} comments={c.comments} canReact />} />
        ))}
        <Link href={`/quests?f=g:${d.guild.slug}`} className="px-1 text-sm font-bold">
          All guild quests
        </Link>
      </div>
    </PageLayout>
  );
}
