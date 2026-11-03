import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { exportAccount } from "@/server/account";

/** GET /api/export — download all your data as JSON. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const data = await exportAccount(viewer.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="questboard-${viewer.handle ?? "export"}.json"`, "Cache-Control": "private, no-store" },
  });
}
