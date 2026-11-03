import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { tzOffsetMinutes } from "@/lib/format";
import { PageLayout, PageTitle } from "@/components/shell/PageLayout";
import { PillLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Panel";
import { QuestCard } from "@/components/game/QuestCard";
import { Reactions } from "@/components/quests/Reactions";
import { decodeCursor, feedQuests, toCards, type FeedFilter } from "@/server/queries/quests";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Quest log" };

export default async function QuestLog({ searchParams }: { searchParams: Promise<{ f?: string; cursor?: string }> }) {
  const viewer = await requireUser();
  const sp = await searchParams;
  const guilds = await db.guild.findMany({ where: { id: { in: viewer.guildIds } }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
  const f = sp.f ?? "friends";
  const guild = guilds.find((g) => `g:${g.slug}` === f);
  const filter: FeedFilter = guild ? { kind: "guild", guildId: guild.id } : f === "mine" ? { kind: "mine" } : { kind: "friends" };
  const { quests, next } = await feedQuests(viewer, filter, decodeCursor(sp.cursor));
  const cards = await toCards(quests, viewer.id, tzOffsetMinutes(viewer.timezone));
  const href = (key: string) => (key === "friends" ? "/quests" : `/quests?f=${encodeURIComponent(key)}`);
  return (
    <PageLayout>
      <PageTitle>Quest log</PageTitle>
      <nav aria-label="Filter quests" className="no-scrollbar -mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4 pb-3.5">
        <PillLink href={href("friends")} active={!guild && f !== "mine"}>
          Friends
        </PillLink>
        {guilds.map((g) => (
          <PillLink key={g.id} href={href(`g:${g.slug}`)} active={guild?.id === g.id}>
            {g.name}
          </PillLink>
        ))}
        <PillLink href={href("mine")} active={f === "mine"}>
          Mine
        </PillLink>
      </nav>
      {cards.length ? (
        <div className="flex flex-col gap-2.5">
          {cards.map((c) => (
            <QuestCard key={c.id} quest={c} footer={<Reactions questId={c.id} reactions={c.reactions} comments={c.comments} canReact />} />
          ))}
        </div>
      ) : (
        <EmptyState title="No quests yet" action={<ButtonLink href="/log">Log a quest</ButtonLink>}>
          {f === "mine" ? "Quests you play show up here." : "Quests you and your friends play show up here. Invite friends from Settings."}
        </EmptyState>
      )}
      {next ? (
        <div className="mt-4 flex justify-center">
          <Link href={`${href(f)}${href(f).includes("?") ? "&" : "?"}cursor=${next}`} className="inline-flex h-11 items-center rounded-full border-[1.5px] border-outline px-5 text-[15px] font-bold text-text no-underline hover:border-muted hover:text-text">
            Older quests
          </Link>
        </div>
      ) : null}
    </PageLayout>
  );
}
