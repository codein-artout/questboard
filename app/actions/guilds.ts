"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CAMPAIGN } from "@/game/config";
import { runAction, UserError, type ActionResult } from "@/lib/action";
import { slugify } from "@/lib/catalog/schema";
import { db } from "@/lib/db";
import { canManageGuild, type GuildRole } from "@/lib/permissions";
import { requireActionUser } from "@/lib/session";
import { notify } from "@/server/notify";
import { recompute } from "@/server/recompute";
import { displayName } from "@/server/social";

const id = z.string().min(1).max(40);
const guildSchema = z.object({ name: z.string().trim().min(2, "Give it a name").max(40), description: z.string().trim().max(200).nullable() });

async function roleOf(guildId: string, userId: string): Promise<GuildRole | null> {
  const m = await db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId } } });
  return (m?.role as GuildRole | undefined) ?? null;
}

export async function createGuildAction(input: unknown): Promise<ActionResult<{ slug: string }>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const g = guildSchema.parse(input);
    let slug = slugify(g.name) || "guild";
    if (await db.guild.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    await db.guild.create({ data: { slug, name: g.name, description: g.description, founderId: viewer.id, members: { create: { userId: viewer.id, role: "owner" } } } });
    await recompute([viewer.id], { notify: false });
    revalidatePath("/", "layout");
    return { slug };
  });
}

export async function updateGuildAction(guildId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    if (!canManageGuild(await roleOf(id.parse(guildId), viewer.id))) throw new UserError("Only guild admins can change that.");
    const g = guildSchema.parse(input);
    await db.guild.update({ where: { id: guildId }, data: { name: g.name, description: g.description } });
    revalidatePath("/", "layout");
    return null;
  });
}

/** /g/join/[code] joins a guild. */
export async function joinGuildByCode(code: string): Promise<{ slug: string } | null> {
  const viewer = await requireActionUser();
  const guild = await db.guild.findUnique({ where: { inviteCode: z.string().min(1).max(60).parse(code) }, include: { members: { select: { userId: true } } } });
  if (!guild) return null;
  if (!guild.members.some((m) => m.userId === viewer.id)) {
    await db.guildMember.create({ data: { guildId: guild.id, userId: viewer.id, role: "member" } });
    await Promise.all(guild.members.map((m) => notify(m.userId, "guild_joined", { title: `${displayName(viewer)} joined ${guild.name}`, href: `/g/${guild.slug}` }, `guild_joined:${guild.id}:${viewer.id}`)));
    await recompute([viewer.id], { notify: false });
  }
  return { slug: guild.slug };
}

export async function leaveGuildAction(guildId: string): Promise<ActionResult<null>> {
  const res = await runAction(async () => {
    const viewer = await requireActionUser();
    const gid = id.parse(guildId);
    const role = await roleOf(gid, viewer.id);
    if (!role) throw new UserError("You're not in that guild.");
    if (role === "owner") {
      const next = await db.guildMember.findFirst({ where: { guildId: gid, NOT: { userId: viewer.id } }, orderBy: [{ role: "asc" }, { joinedAt: "asc" }] });
      if (next) await db.guildMember.update({ where: { id: next.id }, data: { role: "owner" } });
    }
    await db.guildMember.delete({ where: { guildId_userId: { guildId: gid, userId: viewer.id } } });
    if (!(await db.guildMember.count({ where: { guildId: gid } }))) await db.guild.delete({ where: { id: gid } });
    await recompute([viewer.id], { notify: false });
    return null;
  });
  if (res.ok) redirect("/guilds");
  return res;
}

export async function removeMemberAction(guildId: string, userId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const gid = id.parse(guildId);
    if (!canManageGuild(await roleOf(gid, viewer.id))) throw new UserError("Only guild admins can remove members.");
    const target = await roleOf(gid, id.parse(userId));
    if (target === "owner") throw new UserError("The owner can't be removed.");
    await db.guildMember.delete({ where: { guildId_userId: { guildId: gid, userId } } });
    await recompute([viewer.id, userId], { notify: false });
    revalidatePath(`/g`, "layout");
    return null;
  });
}

const campaignSchema = z.object({
  guildId: id,
  name: z.string().trim().min(2).max(40),
  startsAt: z.coerce.date(),
  weeks: z.number().int().min(1).max(52).default(CAMPAIGN.defaultWeeks),
  finaleLocation: z.string().trim().min(1).max(80),
});

/** A campaign is a season; it ends with a finale night worth double XP. */
export async function createCampaignAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireActionUser();
    const c = campaignSchema.parse(input);
    if (!canManageGuild(await roleOf(c.guildId, viewer.id))) throw new UserError("Only guild admins can start a campaign.");
    const overlapping = await db.campaign.findFirst({ where: { guildId: c.guildId, endsAt: { gte: c.startsAt } } });
    if (overlapping) throw new UserError(`${overlapping.name} is still running.`);
    const endsAt = new Date(c.startsAt.getTime() + c.weeks * 7 * 86400000);
    endsAt.setUTCHours(19, 0, 0, 0);
    const campaign = await db.campaign.create({ data: { guildId: c.guildId, name: c.name, startsAt: c.startsAt, endsAt, createdById: viewer.id } });
    await db.gameNight.create({ data: { hostId: viewer.id, guildId: c.guildId, campaignId: campaign.id, isFinale: true, title: `${c.name} finale`, startsAt: endsAt, location: c.finaleLocation } });
    const members = await db.guildMember.findMany({ where: { guildId: c.guildId }, select: { userId: true } });
    await Promise.all(members.filter((m) => m.userId !== viewer.id).map((m) => notify(m.userId, "campaign_finale", { title: `${c.name} has started`, body: `${c.weeks} weeks. The finale night is worth double XP.`, href: `/g` }, `campaign_start:${campaign.id}`)));
    await recompute([viewer.id], { notify: false });
    revalidatePath("/", "layout");
    return { id: campaign.id };
  });
}
