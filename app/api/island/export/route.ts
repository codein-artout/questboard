import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { islandExport } from "@/server/og";

export const runtime = "nodejs";

/** GET /api/island/export — your island as a PNG download. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return islandExport(viewer.id);
}
