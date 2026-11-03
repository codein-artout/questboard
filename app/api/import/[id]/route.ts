import { after, NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { importStatus, processImportJob } from "@/server/imports";

/** GET /api/import/[id]: progress plus the island so far (it builds itself as plays land). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  const status = await importStatus(id, viewer.id);
  if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // If the background worker died (serverless timeout), polling resumes it.
  if (status.status === "queued" || status.status === "running") after(() => processImportJob(id));
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
