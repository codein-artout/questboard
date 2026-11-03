import { storage } from "@/lib/storage";

/** Serves uploaded files from the configured storage (local disk in development). */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = key.join("/");
  if (!/^quests\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(path)) return new Response("Not found", { status: 404 });
  const obj = await storage().get(path);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(new Blob([obj.body as BlobPart], { type: obj.contentType }), {
    headers: { "Content-Type": obj.contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
