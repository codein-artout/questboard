import { db } from "@/lib/db";
import { RATE_LIMITS } from "@/game/config";

export class RateLimitError extends Error {
  constructor(public retryAfterSec: number) {
    super(`Too many requests. Try again in ${Math.max(1, Math.ceil(retryAfterSec / 60))} min.`);
    this.name = "RateLimitError";
  }
}

/** Fixed-window counter stored in Postgres, so it works across serverless instances. */
export async function rateLimit(bucket: keyof typeof RATE_LIMITS, subject: string): Promise<void> {
  const { limit, windowSec } = RATE_LIMITS[bucket];
  const key = `${bucket}:${subject}`;
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  if (row && row.count > limit) throw new RateLimitError((row.resetAt.getTime() - Date.now()) / 1000);
}
