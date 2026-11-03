import { tileOg } from "@/server/og";

export const runtime = "nodejs";
export const alt = "A game tile on a Questboard island";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ handle: string; slug: string }> }) {
  const { handle, slug } = await params;
  return tileOg(handle, slug);
}
