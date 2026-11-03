"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { GuildIcon, IslandIcon, QuestsIcon, ShelfIcon } from "./icons";
import { isActive } from "./NavRail";

const tab = "flex min-h-11 flex-col items-center gap-1 text-[11px] no-underline";

/** Phone bottom bar with the gold hex Log button (below 900px). */
export function TabBar() {
  const pathname = usePathname();
  // The log form has its own bottom bar (LogPlay.dc.html).
  if (pathname === "/log" || /^\/quests\/[^/]+\/edit$/.test(pathname)) return null;
  const links = [
    { href: "/", label: "Island", icon: <IslandIcon size={22} active={false} /> },
    { href: "/quests", label: "Quests", icon: <QuestsIcon size={22} /> },
    null,
    { href: "/shelf", label: "Shelf", icon: <ShelfIcon size={22} /> },
    { href: "/guilds", label: "Guild", icon: <GuildIcon size={22} /> },
  ];
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid h-[84px] grid-cols-5 items-start border-t border-sea-line bg-sea-deep pt-2 desk:hidden">
      {links.map((l) =>
        l === null ? (
          <Link key="log" href="/log" aria-label="Log a quest" className="hex -mt-[26px] flex h-[62px] w-[62px] items-center justify-center justify-self-center bg-gold text-sea hover:bg-gold-hover hover:text-sea">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </Link>
        ) : (
          <Link key={l.href} href={l.href} aria-current={isActive(pathname, l.href) ? "page" : undefined} className={cn(tab, isActive(pathname, l.href) ? "font-bold text-gold hover:text-gold" : "font-semibold text-muted hover:text-text")}>
            {l.icon}
            {l.label}
          </Link>
        ),
      )}
    </nav>
  );
}
