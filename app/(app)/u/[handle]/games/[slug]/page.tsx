import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { TilePage } from "@/components/tile/TilePage";
import { PrivateIsland } from "@/components/island/PrivateIsland";
import { resolveProfile } from "@/server/queries/profile";
import { getTilePage } from "@/server/queries/tile";
import { possessive } from "@/lib/format";
import { displayName } from "@/server/social";

type Props = { params: Promise<{ handle: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, slug } = await params;
  const [u, g] = await Promise.all([db.user.findUnique({ where: { handle }, select: { displayName: true, handle: true, privacy: true } }), db.game.findUnique({ where: { slug }, select: { name: true } })]);
  if (!u || !g) return { title: "Tile" };
  return { title: `${g.name} on ${possessive(displayName(u))} island`, robots: u.privacy === "PUBLIC" ? undefined : { index: false } };
}

/** Someone's tile (public when their island is public). */
export default async function PublicTile({ params }: Props) {
  const { handle, slug } = await params;
  const viewer = await getViewer();
  const p = await resolveProfile(handle, viewer);
  if (!p) notFound();
  if (viewer && p.user.id === viewer.id) redirect(`/games/${slug}`);
  if (!p.canView) return <PrivateIsland name={displayName(p.user)} />;
  const d = await getTilePage(p.user.id, viewer?.id ?? null, slug);
  if (!d) notFound();
  return <TilePage d={d} night={null} isAdmin={false} viewerSignedIn={!!viewer?.onboardedAt} />;
}
