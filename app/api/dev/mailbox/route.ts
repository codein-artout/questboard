import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { devLoginEnabled } from "@/lib/auth";

/**
 * GET /api/dev/mailbox?to=email — the latest console-provider emails for an
 * address (used by end-to-end tests to follow magic links). Only when
 * ENABLE_DEV_LOGIN is on and Resend isn't configured.
 */
export async function GET(req: Request) {
  if (!devLoginEnabled() || process.env.RESEND_API_KEY) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const to = new URL(req.url).searchParams.get("to")?.toLowerCase();
  if (!to) return NextResponse.json({ messages: [] });
  const raw = await readFile(path.join(process.cwd(), ".data", "mail", "outbox.jsonl"), "utf8").catch(() => "");
  const messages = raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { to: string; subject: string; text: string; at: string })
    .filter((m) => m.to.toLowerCase() === to)
    .slice(-10);
  return NextResponse.json({ messages });
}
