import Link from "next/link";

export function PrivateIsland({ name }: { name: string }) {
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-[560px] flex-col items-center justify-center px-4 text-center">
      <div aria-hidden className="hex h-[96px] w-[84px] bg-panel" />
      <h1 className="m-0 mt-5 font-display text-4xl font-black">{name}’s island is private</h1>
      <p className="mt-2 text-[15px] text-muted">Only their friends can see it.</p>
      <Link href="/" className="mt-4 text-sm font-bold">
        Back to your island
      </Link>
    </main>
  );
}
