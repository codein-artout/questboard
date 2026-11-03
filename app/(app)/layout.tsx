import Link from "next/link";
import { APP_NAME } from "@/game/config";
import { getViewer } from "@/lib/session";
import { LogShortcut } from "@/components/shell/LogShortcut";
import { NavRail } from "@/components/shell/NavRail";
import { TabBar } from "@/components/shell/TabBar";
import { shellViewer } from "@/server/shell";

/**
 * The app shell: nav rail on desktop, tab bar on phones. Signed-out visitors
 * (on public islands, tiles and quests) get a slim header instead.
 */
export default async function AppLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer?.onboardedAt || !viewer.handle) {
    return (
      <div className="min-h-dvh">
        <header className="flex h-16 items-center justify-between border-b border-sea-line bg-sea-deep px-4 desk:px-8">
          <Link href="/" className="font-display text-[26px] font-black text-gold no-underline">
            {APP_NAME}
          </Link>
          <Link href={viewer ? "/onboarding" : "/signin"} className="inline-flex h-10 items-center rounded-full bg-gold px-4 text-sm font-extrabold text-sea no-underline hover:bg-gold-hover hover:text-sea">
            {viewer ? "Finish setting up" : "Sign in"}
          </Link>
        </header>
        {children}
      </div>
    );
  }
  const shell = await shellViewer(viewer);
  return (
    <div className="min-h-dvh desk:flex">
      <NavRail viewer={shell} />
      <div className="min-w-0 flex-1 pb-[96px] desk:pb-0">{children}</div>
      <TabBar />
      <LogShortcut />
      {modal}
    </div>
  );
}
