import { islandOg } from "@/server/og";

export const runtime = "nodejs";
export const alt = "A Questboard island";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return islandOg(handle);
}
