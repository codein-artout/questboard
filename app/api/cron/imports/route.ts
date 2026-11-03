import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { processPendingImports } from "@/server/imports";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Picks up queued or stalled import jobs. Scheduled in vercel.json. */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ processed: await processPendingImports() });
}
