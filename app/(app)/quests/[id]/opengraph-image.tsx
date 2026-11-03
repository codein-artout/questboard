import { questOg } from "@/server/og";

export const runtime = "nodejs";
export const alt = "A quest on Questboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return questOg(id);
}
