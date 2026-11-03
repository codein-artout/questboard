"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Route modal: centered 560px dialog on desktop, full screen on phones.
 * Escape or the backdrop closes it (router.back()). Focus is kept inside.
 */
export function RouteModal({ children, label }: { children: (close: () => void) => React.ReactNode; label: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const close = () => router.back();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        router.back();
      }
      if (e.key === "Tab" && el) {
        const items = el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [router]);
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[rgba(5,18,28,0.72)] desk:items-center desk:p-6" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className="flex max-h-dvh w-full flex-col overflow-hidden bg-sea desk:max-h-[92dvh] desk:w-[560px] desk:rounded-3xl desk:shadow-[0_24px_64px_rgba(0,0,0,0.5)] desk:ring-1 desk:ring-sea-line">
        <div className="flex-1 overflow-y-auto">{children(close)}</div>
      </div>
    </div>
  );
}
