import { after, NextResponse } from "next/server";
import { ImportFormatError } from "@/importers";
import { getViewer } from "@/lib/session";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";
import { processImportJob, queueImport } from "@/server/imports";

export const maxDuration = 300;
const MAX_BYTES = 15 * 1024 * 1024;

/** POST /api/import (multipart "file"): queue a play-history import and start it in the background. */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    await rateLimit("import", viewer.id);
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to import." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 15 MB." }, { status: 413 });
  const text = await file.text();
  try {
    const job = await queueImport(viewer.id, file.name, text);
    after(() => processImportJob(job.id));
    return NextResponse.json({ id: job.id, total: job.total });
  } catch (e) {
    if (e instanceof ImportFormatError) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof Error && e.message.startsWith("That file")) return NextResponse.json({ error: e.message }, { status: 422 });
    throw e;
  }
}
