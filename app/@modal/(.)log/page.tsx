import { getViewer } from "@/lib/session";
import { LogModal } from "@/components/log/LogModal";
import { getLogContext } from "@/server/queries/log";

/** Desktop: logging opens as a modal over the current page (intercepted /log). */
export default async function LogModalPage({ searchParams }: { searchParams: Promise<{ game?: string; night?: string; next?: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.onboardedAt) return null;
  const sp = await searchParams;
  const ctx = await getLogContext(viewer, { gameSlug: sp.game, nightId: sp.night });
  return <LogModal ctx={ctx} next={sp.next?.startsWith("/") ? sp.next : undefined} />;
}
