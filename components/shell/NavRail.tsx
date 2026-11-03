"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Settings, Shield } from "lucide-react";
import { APP_NAME } from "@/game/config";
import { cn } from "@/lib/cn";
import { PlayerDisc } from "@/components/game/PlayerDisc";
import { GuildIcon, IslandIcon, LogHexIcon, QuestsIcon, ShelfIcon } from "./icons";
import type { ShellViewer } from "./types";

export function isActive(pathname: string, href: string, handle?: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/games/");
  if (href === "/guilds") return pathname.startsWith("/guilds") || pathname.startsWith("/g/");
  if (handle && href === `/u/${handle}`) return pathname.startsWith(`/u/${handle}`) || pathname === "/me";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const item = "flex h-11 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-[15px] no-underline transition-colors";

export function NavRail({ viewer }: { viewer: ShellViewer }) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Island", icon: (a: boolean) => <IslandIcon active={a} /> },
    { href: "/quests", label: "Quests", icon: () => <QuestsIcon /> },
    { href: "/shelf", label: "Shelf of shame", icon: () => <ShelfIcon />, badge: viewer.shelfCount },
    { href: "/guilds", label: "Guilds", icon: () => <GuildIcon /> },
  ];
  return (
    <nav aria-label="Main" className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-sea-line bg-sea-deep px-4 py-6 desk:flex">
      <Link href="/" className="px-2.5 pb-[22px] font-display text-[30px] font-black leading-none text-gold no-underline hover:text-gold-hover">
        {APP_NAME}
      </Link>
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={cn(item, active ? "bg-panel font-bold text-text hover:text-text" : "font-semibold text-muted hover:text-text")}>
            {l.icon(active)}
            {l.label}
            {l.badge ? (
              <span className="ml-auto rounded-[10px] bg-muted px-[7px] py-px text-xs font-bold text-sea">
                {l.badge}
                <span className="sr-only"> unplayed</span>
              </span>
            ) : null}
          </Link>
        );
      })}
      {(() => {
        const href = `/u/${viewer.handle}`;
        const active = isActive(pathname, href, viewer.handle);
        return (
          <Link href={href} aria-current={active ? "page" : undefined} className={cn(item, active ? "bg-panel font-bold text-text hover:text-text" : "font-semibold text-muted hover:text-text")}>
            <PlayerDisc player={{ name: viewer.name, color: viewer.color }} size={22} />
            <span className="truncate">{viewer.name}</span>
          </Link>
        );
      })()}
      <Link href="/log" scroll={false} className="mt-[18px] flex h-[52px] items-center justify-center gap-2.5 rounded-full bg-gold text-base font-extrabold text-sea no-underline hover:bg-gold-hover hover:text-sea">
        <LogHexIcon />
        Log a quest
      </Link>
      <div className="mt-2 text-center text-xs text-muted" aria-hidden>
        Shortcut: L
      </div>
      <div className="mt-auto flex flex-col gap-1 pt-6">
        <Link href="/notifications" aria-current={pathname === "/notifications" ? "page" : undefined} className={cn(item, "h-10 text-sm", pathname === "/notifications" ? "bg-panel text-text" : "font-semibold text-muted hover:text-text")}>
          <Bell size={18} strokeWidth={2} aria-hidden />
          Notifications
          {viewer.unread ? (
            <span className="ml-auto rounded-[10px] bg-gold px-[7px] py-px text-xs font-bold text-sea">
              {viewer.unread}
              <span className="sr-only"> unread</span>
            </span>
          ) : null}
        </Link>
        <Link href="/settings" aria-current={pathname.startsWith("/settings") ? "page" : undefined} className={cn(item, "h-10 text-sm", pathname.startsWith("/settings") ? "bg-panel text-text" : "font-semibold text-muted hover:text-text")}>
          <Settings size={18} strokeWidth={2} aria-hidden />
          Settings
        </Link>
        {viewer.isAdmin ? (
          <Link href="/admin" className={cn(item, "h-10 text-sm font-semibold text-muted hover:text-text")}>
            <Shield size={18} strokeWidth={2} aria-hidden />
            Admin
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
