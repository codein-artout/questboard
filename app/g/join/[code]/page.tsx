import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { joinGuildByCode } from "@/app/actions/guilds";

export default async function JoinGuild({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/signin?next=${encodeURIComponent(`/g/join/${code}`)}`);
  const res = await joinGuildByCode(code);
  if (!res) notFound();
  redirect(viewer.onboardedAt ? `/g/${res.slug}` : "/onboarding");
}
