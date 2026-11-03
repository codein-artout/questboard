import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Set up your island" };

export default async function Onboarding() {
  const viewer = await getViewer();
  if (!viewer) redirect("/signin?next=/onboarding");
  const suggested = (viewer.email?.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
  return (
    <div>
      <p className="m-0 text-[15px] font-bold text-gold">Step 1 of 3</p>
      <h1 className="m-0 mt-1 font-display text-5xl font-black leading-none">Pick your colors</h1>
      <p className="mb-6 mt-3 text-[15px] text-muted">Choose a handle and the color you always play.</p>
      <ProfileForm initial={{ handle: viewer.handle ?? (suggested.length >= 3 ? suggested : ""), displayName: viewer.displayName ?? viewer.name ?? "", color: viewer.color }} />
    </div>
  );
}
