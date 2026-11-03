"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { TERRAINS } from "@/game/config";
import { runAction, UserError, type ActionResult } from "@/lib/action";
import { searchTextFor, slugify } from "@/lib/catalog/schema";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { requireActionUser, toViewer } from "@/lib/session";
import { disputeSchema, questIdSchema } from "@/lib/validation/quest";
import { canInteract, canViewQuest } from "@/lib/permissions";
import { notify } from "@/server/notify";
import { confirmQuest, createQuest, deleteQuest, disputeQuest, updateQuest, withdrawDispute } from "@/server/quests";
import { displayName, relationBetween } from "@/server/social";

export async function createQuestAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const res = await createQuest(viewer.id, input);
    revalidatePath("/", "layout");
    return res;
  });
}

export async function updateQuestAction(questId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const res = await updateQuest(viewer.id, z.string().min(1).max(40).parse(questId), input);
    revalidatePath("/", "layout");
    return res;
  });
}

export async function confirmQuestAction(questId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    await confirmQuest(toViewer(viewer)!, questIdSchema.parse({ questId }).questId);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function disputeQuestAction(questId: string, reason: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const input = disputeSchema.parse({ questId, reason });
    await disputeQuest(toViewer(viewer)!, input.questId, input.reason);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function withdrawDisputeAction(questId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    await withdrawDispute(viewer.id, questIdSchema.parse({ questId }).questId);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function deleteQuestAction(questId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    await deleteQuest(toViewer(viewer)!, questIdSchema.parse({ questId }).questId);
    revalidatePath("/", "layout");
    return null;
  });
}

/** Autosaved draft of the log form (one per user). */
export async function saveDraftAction(data: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const json = z.record(z.unknown()).parse(data);
    if (JSON.stringify(json).length > 20000) throw new UserError("Draft too large.");
    await db.questDraft.upsert({
      where: { userId: viewer.id },
      create: { userId: viewer.id, data: json as Prisma.InputJsonValue },
      update: { data: json as Prisma.InputJsonValue },
    });
    return null;
  });
}

export async function clearDraftAction(): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    await db.questDraft.deleteMany({ where: { userId: viewer.id } });
    return null;
  });
}

const customGameSchema = z.object({
  name: z.string().trim().min(2).max(80),
  minPlayers: z.number().int().min(1).max(100).nullable(),
  maxPlayers: z.number().int().min(1).max(100).nullable(),
  minTime: z.number().int().min(1).max(6000).nullable(),
  maxTime: z.number().int().min(1).max(6000).nullable(),
  terrain: z.enum(TERRAINS),
  scoring: z.enum(["points", "win_lose", "coop", "ranked", "teams"]),
  tags: z.array(z.string().trim().min(1).max(40)).max(8),
});

export type CustomGameResult = { id: string; slug: string; name: string; terrain: string; scoring: string };

/** Users can add games that aren't in the catalog. Admins can promote them later. */
export async function createCustomGameAction(input: unknown): Promise<ActionResult<CustomGameResult>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    await rateLimit("logQuest", `custom:${viewer.id}`);
    const g = customGameSchema.parse(input);
    if (g.minPlayers && g.maxPlayers && g.minPlayers > g.maxPlayers) throw new UserError("Minimum players is more than maximum.");
    const mine = await db.game.findFirst({ where: { createdById: viewer.id, name: { equals: g.name, mode: "insensitive" } } });
    if (mine) return { id: mine.id, slug: mine.slug, name: mine.name, terrain: mine.terrain, scoring: mine.scoring };
    let slug = `${slugify(g.name)}-${viewer.handle ?? "custom"}`.slice(0, 80);
    if (await db.game.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    const created = await db.game.create({
      data: {
        slug,
        name: g.name,
        minPlayers: g.minPlayers,
        maxPlayers: g.maxPlayers,
        minTime: g.minTime,
        maxTime: g.maxTime,
        terrain: g.terrain,
        scoring: g.scoring,
        categories: g.tags,
        source: "custom",
        createdById: viewer.id,
        searchText: searchTextFor(g.name, []),
      },
    });
    return { id: created.id, slug: created.slug, name: created.name, terrain: created.terrain, scoring: created.scoring };
  });
}

const REACTIONS = ["cheer", "gg", "wow", "ouch"] as const;

async function loadVisibleQuest(viewerId: string, questId: string) {
  const viewer = await requireActionUser();
  const q = await db.quest.findUnique({ where: { id: questId }, include: { participants: { select: { userId: true } }, loggedBy: { select: { id: true, privacy: true } }, game: { select: { name: true } } } });
  if (!q) throw new UserError("That quest doesn't exist.");
  const rel = q.loggedById ? await relationBetween(viewerId, q.loggedById) : { isSelf: false, isFriend: false, blocked: false };
  const access = { loggedById: q.loggedById, loggerPrivacy: q.loggedBy?.privacy ?? "PRIVATE", participantUserIds: q.participants.map((p) => p.userId).filter((x): x is string => !!x), guildId: q.guildId, status: q.status, source: q.source, createdAt: q.createdAt } as const;
  const v = toViewer(viewer);
  if (!canInteract(v, canViewQuest(v, access, rel), rel)) throw new UserError("You can't react to this quest.");
  return q;
}

export async function toggleReactionAction(questId: string, kind: string): Promise<ActionResult<{ on: boolean }>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const k = z.enum(REACTIONS).parse(kind);
    const id = questIdSchema.parse({ questId }).questId;
    await rateLimit("reaction", viewer.id);
    const q = await loadVisibleQuest(viewer.id, id);
    const existing = await db.reaction.findUnique({ where: { questId_userId_kind: { questId: id, userId: viewer.id, kind: k } } });
    if (existing) {
      await db.reaction.delete({ where: { id: existing.id } });
      return { on: false };
    }
    await db.reaction.create({ data: { questId: id, userId: viewer.id, kind: k } });
    if (q.loggedById && q.loggedById !== viewer.id) {
      await notify(q.loggedById, "reaction", { title: `${displayName(viewer)} reacted to your ${q.game.name} quest`, href: `/quests/${id}` }, `reaction:${id}:${viewer.id}`);
    }
    return { on: true };
  });
}

const commentSchema = z.object({ questId: z.string().min(1).max(40), body: z.string().trim().min(1, "Write something first").max(500) });

export async function addCommentAction(questId: string, body: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const input = commentSchema.parse({ questId, body });
    await rateLimit("comment", viewer.id);
    const q = await loadVisibleQuest(viewer.id, input.questId);
    const c = await db.comment.create({ data: { questId: input.questId, userId: viewer.id, body: input.body } });
    const recipients = new Set([q.loggedById, ...q.participants.map((p) => p.userId)].filter((x): x is string => !!x && x !== viewer.id));
    await Promise.all([...recipients].map((u) => notify(u, "comment", { title: `${displayName(viewer)} commented on ${q.game.name}`, body: input.body.slice(0, 120), href: `/quests/${input.questId}` }, `comment:${c.id}`)));
    revalidatePath(`/quests/${input.questId}`);
    return { id: c.id };
  });
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const c = await db.comment.findUnique({ where: { id: z.string().min(1).max(40).parse(commentId) }, include: { quest: { select: { loggedById: true, id: true } } } });
    if (!c) throw new UserError("That comment is gone.");
    if (c.userId !== viewer.id && c.quest.loggedById !== viewer.id && !viewer.isAdmin) throw new UserError("You can't delete that comment.");
    await db.comment.delete({ where: { id: c.id } });
    revalidatePath(`/quests/${c.quest.id}`);
    return null;
  });
}
