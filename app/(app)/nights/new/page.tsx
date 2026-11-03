import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageLayout, PageTitle } from "@/components/shell/PageLayout";
import { NewNightForm } from "@/components/nights/NewNightForm";

export const metadata: Metadata = { title: "Plan a game night" };

export default async function NewNight({ searchParams }: { searchParams: Promise<{ guild?: string }> }) {
  const viewer = await requireUser();
  const sp = await searchParams;
  const guilds = await db.guild.findMany({ where: { id: { in: viewer.guildIds } }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
  const campaigns = await db.campaign.findMany({ where: { guildId: { in: viewer.guildIds }, endsAt: { gte: new Date() } }, select: { id: true, guildId: true, name: true } });
  return (
    <PageLayout>
      <PageTitle sub="Pick a time and place. Everyone gets three votes on what to play.">Plan a game night</PageTitle>
      <NewNightForm guilds={guilds} defaultGuild={guilds.find((g) => g.slug === sp.guild)?.id} campaigns={campaigns} />
    </PageLayout>
  );
}
