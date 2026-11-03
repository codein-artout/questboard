import type { Metadata } from "next";
import Link from "next/link";
import { Upload } from "lucide-react";
import { requireUser } from "@/lib/session";
import { LogHexIcon } from "@/components/shell/icons";

export const metadata: Metadata = { title: "Your island is waiting" };

export default async function Start() {
  await requireUser();
  return (
    <div>
      <p className="m-0 text-[15px] font-bold text-gold">Step 2 of 3</p>
      <h1 className="m-0 mt-1 font-display text-5xl font-black leading-none">Your island is waiting</h1>
      <p className="mt-3 text-[15px] text-muted">Import your play history or log your first quest.</p>
      <div className="mt-6 grid gap-3">
        <Link href="/import?next=/onboarding/shelf" className="flex items-center gap-4 rounded-2xl bg-panel p-5 text-text no-underline shadow-[inset_0_0_0_1.5px_#F5C84B] hover:bg-panel-rule hover:text-text">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold text-sea">
            <Upload size={22} strokeWidth={2.2} aria-hidden />
          </span>
          <span>
            <span className="block font-display text-2xl font-black">Import your play history</span>
            <span className="block text-sm text-muted">Upload a BG Stats export or a BoardGameGeek plays CSV. Your island builds itself.</span>
          </span>
        </Link>
        <Link href="/log?next=/onboarding/shelf" className="flex items-center gap-4 rounded-2xl bg-panel p-5 text-text no-underline hover:bg-panel-rule hover:text-text">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold">
            <LogHexIcon />
          </span>
          <span>
            <span className="block font-display text-2xl font-black">Log your first quest</span>
            <span className="block text-sm text-muted">The last game you played. It takes under 30 seconds.</span>
          </span>
        </Link>
      </div>
      <p className="mt-6 text-sm">
        <Link href="/onboarding/shelf">Skip for now</Link>
      </p>
    </div>
  );
}
