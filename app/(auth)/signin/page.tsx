import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { devSignIn, signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { PlayerDisc } from "@/components/game/PlayerDisc";
import { devLoginEnabled, googleEnabled } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = sp.next?.startsWith("/") ? sp.next : undefined;
  if (await getViewer()) redirect(next ?? "/");
  const dev = devLoginEnabled()
    ? await db.user.findMany({ where: { handle: { not: null }, email: { not: null } }, orderBy: { createdAt: "asc" }, take: 12, select: { email: true, handle: true, displayName: true, color: true } })
    : [];
  return (
    <div>
      <h1 className="m-0 font-display text-5xl font-black leading-none">Your island is waiting</h1>
      <p className="mt-3 text-[15px] text-muted">Every board game you play becomes a tile. Sign in with a link sent to your email. No password.</p>
      {sp.error ? (
        <p role="alert" className="mt-3 rounded-xl bg-panel px-4 py-3 text-sm text-danger">
          That sign-in link didn’t work. It may have expired or been used already. Ask for a new one.
        </p>
      ) : null}
      <div className="mt-6">
        <SignInForm next={next} />
      </div>
      {googleEnabled() ? (
        <form action={signInWithGoogle} className="mt-3">
          <input type="hidden" name="next" value={next ?? "/"} />
          <Button type="submit" variant="secondary" size="lg" className="w-full">
            Continue with Google
          </Button>
        </form>
      ) : null}
      {dev.length ? (
        <section className="mt-10 rounded-2xl bg-panel p-4" aria-labelledby="dev-login">
          <h2 id="dev-login" className="m-0 text-[15px] font-bold">
            Development sign-in
          </h2>
          <p className="m-0 mt-1 text-[13px] text-muted">Seeded players, one click. Shown only when ENABLE_DEV_LOGIN is on.</p>
          <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-2 p-0">
            {dev.map((u) => (
              <li key={u.email}>
                <form action={devSignIn}>
                  <input type="hidden" name="email" value={u.email!} />
                  <input type="hidden" name="next" value={next ?? "/"} />
                  <button type="submit" className="flex h-11 w-full items-center gap-2.5 rounded-xl bg-sea px-3 text-left text-sm font-semibold text-text hover:bg-sea-deep">
                    <PlayerDisc player={{ name: u.displayName ?? u.handle ?? "?", color: u.color }} size={24} />
                    <span className="truncate">{u.displayName ?? u.handle}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
