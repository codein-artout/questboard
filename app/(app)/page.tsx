import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { plural } from "@/lib/format";
import { possessive } from "@/lib/format";
import { db } from "@/lib/db";
import { IslandView } from "@/components/island/IslandView";
import { getIsland } from "@/server/queries/island";
import { Landing } from "@/components/island/Landing";

export const metadata: Metadata = { title: "Your island" };

export default async function Home({ searchParams }: { searchParams: Promise<{ tile?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return <Landing />;
  if (!viewer.handle || !viewer.onboardedAt) redirect("/onboarding");
  const sp = await searchParams;
  const [island, unread] = await Promise.all([getIsland(viewer.id, viewer.id), db.notification.count({ where: { userId: viewer.id, readAt: null } })]);
  const s = island.stats;
  const games = s?.gamesExplored ?? 0;
  const plays = s?.totalPlays ?? 0;
  const initial = sp.tile ? island.tiles.find((t) => t.slug === sp.tile)?.key ?? null : null;
  return (
    <IslandView
      tiles={island.tiles}
      ariaLabel={island.ariaLabel}
      owner={island.owner}
      title={`${possessive(island.owner.name)} island`}
      subtitle={s ? `${s.className}, level ${s.level}. ${plural(games, "game")}, ${plural(plays, "play")}, h-index ${s.hIndex}.` : "A fresh island."}
      phoneSubtitle={`${plural(games, "game")}, ${plural(plays, "play")}, h-index ${s?.hIndex ?? 0}`}
      level={s ? { level: s.level, into: s.xpIntoLevel, forNext: s.xpForNext } : { level: 1, into: 0, forNext: 500 }}
      nudges={island.nudges}
      night={island.night}
      unread={unread}
      isSelf
      shelfCount={island.shelfCount}
      initialSelected={initial}
    />
  );
}
