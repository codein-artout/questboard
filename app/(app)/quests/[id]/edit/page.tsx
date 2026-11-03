import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { LogQuestForm, type FormState } from "@/components/log/LogQuestForm";
import { getLogContext, getQuestForEdit } from "@/server/queries/log";
import { displayName } from "@/server/social";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Edit quest" };

export default async function EditQuest({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireUser();
  const { id } = await params;
  const found = await getQuestForEdit(viewer.id, id);
  if (!found) notFound();
  const { quest, game } = found;
  const ctx = await getLogContext(viewer, {});
  const users = await db.user.findMany({ where: { id: { in: quest.participants.map((p) => p.userId).filter((x): x is string => !!x) } }, select: { id: true, displayName: true, handle: true, color: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  const when = new Date(quest.playedAt.getTime() + quest.tzOffsetMin * 60000).toISOString().slice(0, 16);
  const initial: Partial<FormState> = {
    game,
    mode: quest.coop ? "coop" : quest.teams ? "teams" : game.scoring,
    when,
    where: quest.hostUserId ? (quest.hostUserId === viewer.id ? "me" : quest.hostUserId) : "other",
    location: quest.hostUserId ? "" : quest.location ?? "",
    duration: quest.durationMin ? String(quest.durationMin) : "",
    coopWin: quest.coopWin,
    difficulty: quest.difficulty !== null ? String(quest.difficulty) : "",
    guildId: quest.guildId ?? "",
    nightId: quest.gameNightId ?? "",
    notes: quest.notes ?? "",
    photoKey: quest.photoKey,
    showMid: quest.participants.some((p) => p.midScore !== null),
    rows: quest.participants.map((p) => {
      const u = p.userId ? byId.get(p.userId) : undefined;
      return {
        key: p.id,
        userId: p.userId,
        guestId: p.guestId,
        guestName: p.guest?.name ?? null,
        name: u ? displayName(u) : p.guest?.name ?? "Guest",
        color: u?.color ?? null,
        score: p.score,
        midScore: p.midScore,
        won: p.place === 1,
        rank: game.scoring === "ranked" ? p.place : null,
        team: p.team,
      };
    }),
  };
  return (
    <main id="main" className="mx-auto min-h-dvh max-w-[560px]">
      <LogQuestForm ctx={ctx} editId={quest.id} initial={initial} />
    </main>
  );
}
