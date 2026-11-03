import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

export default async function Me() {
  const viewer = await requireUser();
  redirect(`/u/${viewer.handle}`);
}
