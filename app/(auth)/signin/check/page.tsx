import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmail() {
  return (
    <div>
      <h1 className="m-0 font-display text-5xl font-black leading-none">Check your email</h1>
      <p className="mt-3 text-[15px] text-muted">We sent you a sign-in link. It works once and expires in 24 hours.</p>
      <p className="mt-6 text-sm">
        <Link href="/signin">Use a different email</Link>
      </p>
    </div>
  );
}
