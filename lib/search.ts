import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

export const searchQuerySchema = z.string().trim().min(1).max(80);

export type GameHit = {
  id: string;
  slug: string;
  name: string;
  year: number | null;
  terrain: string;
  terrainOverride: string | null;
  short: string | null;
  scoring: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  baseGameId: string | null;
  source: string;
  score: number;
};

function normalize(q: string): string {
  return q.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Fuzzy game search over the catalog plus the viewer's own custom games, using
 * pg_trgm word similarity (typo tolerant, matches alternate names) with a
 * prefix bonus. Base games rank slightly above their expansions.
 */
export async function searchGames(rawQuery: string, viewerId: string | null, limit = 12): Promise<GameHit[]> {
  const q = normalize(searchQuerySchema.parse(rawQuery));
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const prefix = `${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const visibility = viewerId
    ? Prisma.sql`("source" = 'catalog' OR "createdById" = ${viewerId})`
    : Prisma.sql`"source" = 'catalog'`;
  const [, rows] = await db.$transaction([
    db.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', '0.3', true)`,
    db.$queryRaw<GameHit[]>`
      SELECT "id", "slug", "name", "year", "terrain"::text AS "terrain", "terrainOverride"::text AS "terrainOverride",
             "short", "scoring"::text AS "scoring", "minPlayers", "maxPlayers", "baseGameId", "source"::text AS "source",
             (word_similarity(${q}, "searchText")
               + 0.6 * similarity(${q}, lower("name"))
               + CASE WHEN lower("name") LIKE ${prefix} THEN 0.4 ELSE 0 END
               + CASE WHEN "searchText" LIKE ${like} THEN 0.2 ELSE 0 END
               - CASE WHEN "baseGameId" IS NULL THEN 0 ELSE 0.05 END)::float AS "score"
      FROM "Game"
      WHERE ${visibility} AND (${q} <% "searchText" OR "searchText" LIKE ${like})
      ORDER BY "score" DESC, "name" ASC
      LIMIT ${limit}`,
  ]);
  return rows;
}
