"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { VOTING } from "@/game/config";
import { runAction, UserError, type ActionResult } from "@/lib/action";
import { db } from "@/lib/db";
import { canEditGameNight, canJoinGameNight, type GuildRole } from "@/lib/permissions";
import { requireActionUser, type SessionUser } from "@/lib/session";
import { notify } from "@/server/notify";
import { displayName, friendIds } from "@/server/social";

const id = z.string().min(1).max(40);

async function nightCtx(viewer: SessionUser, nightId: string) {
  const night = await db.gameNight.findUnique({ where: { id: nightId } });
  if (!night) throw new UserError("That game night doesn't exist.");
  const role = night.guildId
    ? ((await db.guildMember.findUnique({ where: { guildId_userId: { guildId: night.guildId, userId: viewer.id } } }))?.role as GuildRole | undefined) ?? null
    : null;
  const isFriendOfHost = (await friendIds(night.hostId)).includes(viewer.id);
  return { night, role, isFriendOfHost };
}

const nightSchema = z.object({
  guildId: id.nullable(),
  title: z.string().trim().max(60).nullable(),
  startsAt: z.coerce.date(),
  location: z.string().trim().min(1, "Where is it?").max(80),
  notes: z.string().trim().max(500).nullable(),
  campaignId: id.nullable(),
});

export async function createNightAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const n = nightSchema.parse(input);
    if (n.startsAt.getTime() < Date.now() - 3600 * 1000) throw new UserError("Pick a time in the future.");
    let members: string[] = [];
    if (n.guildId) {
      const m = await db.guildMember.findUnique({ where: { guildId_userId: { guildId: n.guildId, userId: viewer.id } } });
      if (!m) throw new UserError("You're not in that guild.");
      members = (await db.guildMember.findMany({ where: { guildId: n.guildId }, select: { userId: true } })).map((x) => x.userId);
    } else members = await friendIds(viewer.id);
    let isFinale = false;
    if (n.campaignId) {
      const c = await db.campaign.findUnique({ where: { id: n.campaignId } });
      if (!c || c.guildId !== n.guildId) throw new UserError("That campaign belongs to another guild.");
      isFinale = true;
    }
    const night = await db.gameNight.create({
      data: { hostId: viewer.id, guildId: n.guildId, title: n.title, startsAt: n.startsAt, location: n.location, notes: n.notes, campaignId: n.campaignId, isFinale, rsvps: { create: { userId: viewer.id, status: "going" } } },
    });
    await Promise.all(
      members.filter((u) => u !== viewer.id).map((u) => notify(u, isFinale ? "campaign_finale" : "game_night", { title: isFinale ? `Campaign finale: ${n.title ?? n.location}` : `${displayName(viewer)} is hosting a game night`, body: `${n.startsAt.toUTCString().slice(0, 22)} at ${n.location}`, href: `/nights/${night.id}` }, `night:${night.id}`)),
    );
    revalidatePath("/", "layout");
    return { id: night.id };
  });
}

export async function cancelNightAction(nightId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const { night, role } = await nightCtx(viewer, id.parse(nightId));
    if (!canEditGameNight(viewer.id, night, role)) throw new UserError("Only the host can cancel it.");
    await db.gameNight.update({ where: { id: night.id }, data: { status: "cancelled" } });
    const rsvps = await db.rsvp.findMany({ where: { gameNightId: night.id, status: { in: ["going", "maybe"] } }, select: { userId: true } });
    await Promise.all(rsvps.filter((r) => r.userId !== viewer.id).map((r) => notify(r.userId, "game_night_changed", { title: `${night.title ?? `Game night at ${night.location}`} is cancelled`, href: `/nights/${night.id}` }, `night_cancel:${night.id}`)));
    revalidatePath("/", "layout");
    return null;
  });
}

export async function rsvpAction(nightId: string, status: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const s = z.enum(["going", "maybe", "cant"]).parse(status);
    const ctx = await nightCtx(viewer, id.parse(nightId));
    if (!canJoinGameNight(viewer.id, ctx.night, { guildRole: ctx.role, isFriendOfHost: ctx.isFriendOfHost })) throw new UserError("This game night is for its guild or the host's friends.");
    await db.rsvp.upsert({ where: { gameNightId_userId: { gameNightId: ctx.night.id, userId: viewer.id } }, create: { gameNightId: ctx.night.id, userId: viewer.id, status: s }, update: { status: s } });
    revalidatePath("/", "layout");
    return null;
  });
}

/** Propose a game: from the host's collection, or from your own shelf. */
export async function proposeAction(nightId: string, gameId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const ctx = await nightCtx(viewer, id.parse(nightId));
    if (!canJoinGameNight(viewer.id, ctx.night, { guildRole: ctx.role, isFriendOfHost: ctx.isFriendOfHost })) throw new UserError("You're not part of this game night.");
    if (ctx.night.status !== "scheduled") throw new UserError("This game night is cancelled.");
    const g = id.parse(gameId);
    const owned = await db.shelfItem.findFirst({ where: { gameId: g, userId: { in: [ctx.night.hostId, viewer.id] } } });
    const hostPlayed = await db.tile.findFirst({ where: { gameId: g, userId: ctx.night.hostId, plays: { gt: 0 } } });
    if (!owned && !hostPlayed) throw new UserError("Propose a game from the host's collection or your own shelf.");
    await db.nightProposal.upsert({ where: { gameNightId_gameId: { gameNightId: ctx.night.id, gameId: g } }, create: { gameNightId: ctx.night.id, gameId: g, proposedById: viewer.id }, update: {} });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function withdrawProposalAction(proposalId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const p = await db.nightProposal.findUnique({ where: { id: id.parse(proposalId) }, include: { gameNight: true } });
    if (!p) throw new UserError("That proposal is gone.");
    if (p.proposedById !== viewer.id && p.gameNight.hostId !== viewer.id) throw new UserError("Only whoever proposed it or the host can remove it.");
    await db.nightProposal.delete({ where: { id: p.id } });
    revalidatePath("/", "layout");
    return null;
  });
}

/** Everyone gets 3 votes per night; voting again on the same game takes it back. */
export async function toggleVoteAction(proposalId: string): Promise<ActionResult<{ on: boolean; left: number }>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const p = await db.nightProposal.findUnique({ where: { id: id.parse(proposalId) } });
    if (!p) throw new UserError("That proposal is gone.");
    const ctx = await nightCtx(viewer, p.gameNightId);
    if (!canJoinGameNight(viewer.id, ctx.night, { guildRole: ctx.role, isFriendOfHost: ctx.isFriendOfHost })) throw new UserError("You're not part of this game night.");
    return db.$transaction(async (tx) => {
      const existing = await tx.vote.findUnique({ where: { proposalId_userId: { proposalId: p.id, userId: viewer.id } } });
      if (existing) {
        await tx.vote.delete({ where: { id: existing.id } });
        const used = await tx.vote.count({ where: { gameNightId: p.gameNightId, userId: viewer.id } });
        return { on: false, left: VOTING.votesPerPerson - used };
      }
      const used = await tx.vote.count({ where: { gameNightId: p.gameNightId, userId: viewer.id } });
      if (used >= VOTING.votesPerPerson) throw new UserError(`You've used all ${VOTING.votesPerPerson} votes. Take one back first.`);
      await tx.vote.create({ data: { gameNightId: p.gameNightId, proposalId: p.id, userId: viewer.id } });
      return { on: true, left: VOTING.votesPerPerson - used - 1 };
    }).finally(() => revalidatePath("/", "layout"));
  });
}
