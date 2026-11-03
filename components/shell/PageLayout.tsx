import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Main column plus the 360px side panel. At 1200px+ the panel sits on the
 * right; below that it stacks under the main content in the same column.
 */
export function PageLayout({ children, aside, asideLabel, wideMain = false, className }: { children: React.ReactNode; aside?: React.ReactNode; asideLabel?: string; wideMain?: boolean; className?: string }) {
  return (
    <div className={cn("flex min-h-dvh flex-col wide:flex-row", className)}>
      <main id="main" className="min-w-0 flex-[999_1_560px] px-4 pb-6 pt-5 desk:px-8 desk:pt-6">
        <div className={cn(!wideMain && "max-w-[760px]")}>{children}</div>
      </main>
      {aside ? (
        <aside aria-label={asideLabel} className="flex flex-col gap-3 px-4 pb-8 desk:px-8 wide:w-[360px] wide:shrink-0 wide:border-l wide:border-sea-line wide:px-5 wide:pb-6 wide:pt-6">
          {aside}
        </aside>
      ) : null}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-muted no-underline hover:text-text">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m15 18-6-6 6-6" />
      </svg>
      {children}
    </Link>
  );
}

export function PageTitle({ children, sub, className }: { children: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <header className={className}>
      <h1 className="m-0 font-display text-[34px] font-black leading-none desk:text-[40px]">{children}</h1>
      {sub ? <p className="m-0 mt-1.5 text-sm text-muted">{sub}</p> : null}
    </header>
  );
}
