import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { plural, possessive } from "@/lib/format";
import { getViewer } from "@/lib/session";
import { IslandView } from "@/components/island/IslandView";
import { PrivateIsland } from "@/components/island/PrivateIsland";
import { getIsland } from "@/server/queries/island";
import { resolveProfile } from "@/server/queries/profile";
import { displayName } from "@/server/social";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const u = await db.user.findUnique({ where: { handle }, select: { displayName: true, handle: true, privacy: true } });
  if (!u) return { title: "Island" };
  return { title: `${possessive(displayName(u))} island`, robots: u.privacy === "PUBLIC" ? undefined : { index: false } };
}

/** Someone's island, read-only (public when their privacy is public). */
export default async function PublicIsland({ params }: Props) {
  const { handle } = await params;
  const viewer = await getViewer();
  const p = await resolveProfile(handle, viewer);
  if (!p) notFound();
  if (viewer && p.user.id === viewer.id) redirect("/");
  if (!p.canView) return <PrivateIsland name={displayName(p.user)} />;
  const island = await getIsland(p.user.id, viewer?.id ?? null);
  const s = island.stats;
  const tiles = island.tiles.filter((t) => t.kind !== "shelf" && t.kind !== "ghost");
  return (
    <IslandView
      tiles={tiles}
      ariaLabel={island.ariaLabel}
      owner={island.owner}
      title={`${possessive(island.owner.name)} island`}
      subtitle={s ? `${s.className}, level ${s.level}. ${plural(s.gamesExplored, "game")}, ${plural(s.totalPlays, "play")}, h-index ${s.hIndex}.` : ""}
      phoneSubtitle={s ? `${plural(s.gamesExplored, "game")}, ${plural(s.totalPlays, "play")}, h-index ${s.hIndex}` : ""}
      level={null}
      nudges={[]}
      night={null}
      isSelf={false}
      shelfCount={0}
    />
  );
}
