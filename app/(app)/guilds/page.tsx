import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { plural } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { PageLayout, PageTitle } from "@/components/shell/PageLayout";
import { DiscStack } from "@/components/game/PlayerDisc";
import { EmptyState } from "@/components/ui/Panel";
import { CreateGuild } from "@/components/guild/CreateGuild";
import { displayName } from "@/server/social";

export const metadata: Metadata = { title: "Guilds" };

export default async function Guilds({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const viewer = await requireUser();
  const sp = await searchParams;
  const guilds = await db.guild.findMany({
    where: { members: { some: { userId: viewer.id } } },
    include: { members: { include: { user: { select: { displayName: true, handle: true, color: true } } } }, _count: { select: { quests: true } } },
    orderBy: { name: "asc" },
  });
  // Phones: the Guild tab goes straight to your only guild.
  if (guilds.length === 1 && !sp.all) redirect(`/g/${guilds[0]!.slug}`);
  return (
    <PageLayout aside={<CreateGuild />} asideLabel="Start a guild">
      <PageTitle sub="Your groups: shared islands, crowns, game nights and campaigns.">Guilds</PageTitle>
      <div className="mt-4 flex flex-col gap-2.5">
        {guilds.length ? (
          guilds.map((g) => (
            <Link key={g.id} href={`/g/${g.slug}`} className="rounded-2xl bg-panel p-4 text-text no-underline hover:bg-panel-rule hover:text-text">
              <div className="font-display text-[28px] font-black leading-none">{g.name}</div>
              <div className="mt-2.5 flex items-center gap-2.5">
                <DiscStack players={g.members.map((m) => ({ name: displayName(m.user), color: m.user.color }))} size={26} />
                <span className="ml-2 text-sm text-muted">
                  {plural(g.members.length, "member")}, {plural(g._count.quests, "quest")}
                </span>
              </div>
            </Link>
          ))
        ) : (
          <EmptyState title="No guilds yet">Start one for your regular group, or open an invite link from a friend.</EmptyState>
        )}
      </div>
    </PageLayout>
  );
}
