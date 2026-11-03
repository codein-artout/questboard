import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { tzOffsetMinutes } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { TilePage } from "@/components/tile/TilePage";
import { nextNightFor } from "@/server/queries/island";
import { getTilePage } from "@/server/queries/tile";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const g = await db.game.findUnique({ where: { slug }, select: { name: true } });
  return { title: g?.name ?? "Game" };
}

export default async function GameTile({ params }: Props) {
  const viewer = await requireUser();
  const { slug } = await params;
  const tz = tzOffsetMinutes(viewer.timezone);
  const [d, night] = await Promise.all([getTilePage(viewer.id, viewer.id, slug, tz), nextNightFor(viewer.id, tz)]);
  if (!d) notFound();
  return <TilePage d={d} night={night ? { id: night.id, label: night.title.split(" at ")[0]! } : null} isAdmin={viewer.isAdmin} viewerSignedIn />;
}
