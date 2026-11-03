import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/session";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";
import { searchGames } from "@/lib/search";

const querySchema = z.object({ q: z.string().trim().min(1).max(80), limit: z.coerce.number().int().min(1).max(25).default(10) });

/** GET /api/games/search?q=wingspn — fuzzy catalog search (plus the viewer's own custom games). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ q: url.searchParams.get("q") ?? "", limit: url.searchParams.get("limit") ?? undefined });
  if (!parsed.success) return NextResponse.json({ results: [] });
  const viewer = await getViewer();
  try {
    await rateLimit("search", viewer?.id ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon");
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }
  const hits = await searchGames(parsed.data.q, viewer?.id ?? null, parsed.data.limit);
  return NextResponse.json({
    results: hits.map((h) => ({ id: h.id, slug: h.slug, name: h.name, year: h.year, terrain: h.terrainOverride ?? h.terrain, scoring: h.scoring, maxPlayers: h.maxPlayers, source: h.source, expansion: !!h.baseGameId })),
  });
}
