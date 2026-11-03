import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { LogQuestForm } from "@/components/log/LogQuestForm";
import { getLogContext } from "@/server/queries/log";

export const metadata: Metadata = { title: "Log a quest" };

/** Full page on phones (and on a direct visit). */
export default async function LogPage({ searchParams }: { searchParams: Promise<{ game?: string; night?: string; next?: string }> }) {
  const viewer = await requireUser();
  const sp = await searchParams;
  const ctx = await getLogContext(viewer, { gameSlug: sp.game, nightId: sp.night });
  return (
    <main id="main" className="mx-auto min-h-dvh max-w-[560px]">
      <LogQuestForm ctx={ctx} next={sp.next?.startsWith("/") ? sp.next : undefined} />
    </main>
  );
}
