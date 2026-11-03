import Link from "next/link";
import { APP_NAME } from "@/game/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 pt-6 desk:px-10">
        <Link href="/" className="font-display text-[30px] font-black text-gold no-underline">
          {APP_NAME}
        </Link>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-4 py-10">
        {children}
      </main>
    </div>
  );
}
