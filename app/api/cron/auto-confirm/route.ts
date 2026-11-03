import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { autoConfirmDue } from "@/server/quests";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Confirms quests whose 48-hour window passed without a dispute. Scheduled in vercel.json. */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await autoConfirmDue();
  return NextResponse.json(result);
}
