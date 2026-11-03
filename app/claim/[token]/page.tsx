import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { APP_NAME } from "@/game/config";
import { db } from "@/lib/db";
import { plural } from "@/lib/format";
import { getViewer } from "@/lib/session";
import { claimGuestAction } from "@/app/actions/claim";
import { Button } from "@/components/ui/Button";
import { displayName } from "@/server/social";

export const metadata: Metadata = { title: "Claim your quests" };

/** /claim/[token]: a guest turns their past quests into their own island. */
export default async function Claim({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const guest = await db.guest.findUnique({ where: { claimToken: token }, include: { owner: { select: { displayName: true, handle: true } }, _count: { select: { participations: true } } } });
  if (!guest) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect(`/signin?next=${encodeURIComponent(`/claim/${token}`)}`);
  const owner = guest.owner ? displayName(guest.owner) : "A friend";
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-4 py-10">
      <Link href="/" className="font-display text-[30px] font-black text-gold no-underline">
        {APP_NAME}
      </Link>
      {guest.claimedById ? (
        <>
          <h1 className="m-0 mt-8 font-display text-5xl font-black leading-none">Already claimed</h1>
          <p className="mt-3 text-[15px] text-muted">These quests already belong to someone’s island.</p>
        </>
      ) : (
        <>
          <h1 className="m-0 mt-8 font-display text-5xl font-black leading-none">Are you {guest.name}?</h1>
          <p className="mt-3 text-[15px] text-muted">
            {owner} logged {plural(guest._count.participations, "quest")} with a guest called {guest.name}. Claim them and they move to your island: tiles, records and XP, all counted from the start.
          </p>
          <form action={claimGuestAction} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <Button type="submit" size="lg">
              Claim my quests
            </Button>
          </form>
        </>
      )}
    </main>
  );
}
