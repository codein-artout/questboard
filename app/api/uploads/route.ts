import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getViewer } from "@/lib/session";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES, sniffImage, storage } from "@/lib/storage";

/** POST /api/uploads (multipart "file") — quest photos. Returns { key }. */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    await rateLimit("upload", viewer.id);
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Images must be under 6 MB." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return NextResponse.json({ error: "Use a JPEG, PNG or WebP image." }, { status: 415 });
  const ext = type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
  const key = `quests/${viewer.id}/${randomUUID()}.${ext}`;
  await storage().put(key, bytes, type);
  return NextResponse.json({ key, url: storage().publicUrl(key) });
}
