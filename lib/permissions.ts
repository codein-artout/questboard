/**
 * Pure authorization rules. Every server action and page asks these functions;
 * they take plain data so they can be unit tested without a database.
 */
import { CONFIRMATION } from "@/game/config";

export type Privacy = "PUBLIC" | "FRIENDS" | "PRIVATE";

export type Relation = {
  isSelf: boolean;
  isFriend: boolean;
  /** Either side has blocked the other. */
  blocked: boolean;
};

export type QuestAccess = {
  loggedById: string | null;
  loggerPrivacy: Privacy;
  participantUserIds: string[];
  guildId: string | null;
  status: "pending" | "confirmed" | "disputed";
  source: "live" | "import";
  createdAt: Date;
};

export type Viewer = { id: string; role: "USER" | "ADMIN"; guildIds: string[] } | null;

export function canViewProfile(privacy: Privacy, rel: Relation): boolean {
  if (rel.isSelf) return true;
  if (rel.blocked) return false;
  if (privacy === "PUBLIC") return true;
  if (privacy === "FRIENDS") return rel.isFriend;
  return false;
}

/** Quest visibility: party members always; guild quests to guild members; otherwise the logger's privacy. */
export function canViewQuest(viewer: Viewer, q: QuestAccess, relToLogger: Relation): boolean {
  if (viewer && q.participantUserIds.includes(viewer.id)) return true;
  if (relToLogger.blocked) return false;
  if (viewer && q.guildId && viewer.guildIds.includes(q.guildId)) return true;
  return canViewProfile(q.loggerPrivacy, relToLogger);
}

export function canEditQuest(viewer: Viewer, q: QuestAccess): boolean {
  return !!viewer && q.loggedById === viewer.id;
}

export function canDeleteQuest(viewer: Viewer, q: QuestAccess): boolean {
  return !!viewer && (q.loggedById === viewer.id || viewer.role === "ADMIN");
}

/** Another registered party member can confirm a pending quest. */
export function canConfirmQuest(viewer: Viewer, q: QuestAccess, alreadyResponded: boolean): boolean {
  return (
    !!viewer &&
    q.source === "live" &&
    q.status === "pending" &&
    q.loggedById !== viewer.id &&
    q.participantUserIds.includes(viewer.id) &&
    !alreadyResponded
  );
}

/**
 * A registered party member (not the logger) can dispute while the quest is
 * pending, or within the confirmation window after it confirmed.
 */
export function canDisputeQuest(viewer: Viewer, q: QuestAccess, now: Date): boolean {
  if (!viewer || q.source !== "live" || q.loggedById === viewer.id || !q.participantUserIds.includes(viewer.id)) return false;
  if (q.status === "pending") return true;
  if (q.status === "confirmed") return now.getTime() - q.createdAt.getTime() <= CONFIRMATION.autoConfirmHours * 3600 * 1000;
  return false;
}

export function canInteract(viewer: Viewer, canView: boolean, relToLogger: Relation): boolean {
  return !!viewer && canView && !relToLogger.blocked;
}

/** Whether a participant's name is shown to this viewer, or replaced by "A player". */
export function showParticipantName(participantPrivacy: Privacy, rel: Relation, viewerInQuest: boolean): boolean {
  if (rel.isSelf || viewerInQuest) return !rel.blocked || rel.isSelf;
  return canViewProfile(participantPrivacy, rel);
}

export type GuildRole = "owner" | "admin" | "member";
export const canManageGuild = (role: GuildRole | null) => role === "owner" || role === "admin";
export const canPostInGuild = (role: GuildRole | null) => role !== null;

export function canEditGameNight(viewerId: string | null, night: { hostId: string }, guildRole: GuildRole | null): boolean {
  return !!viewerId && (night.hostId === viewerId || canManageGuild(guildRole));
}

/** Who may RSVP and vote: guild members for guild nights; the host and their friends otherwise. */
export function canJoinGameNight(viewerId: string | null, night: { hostId: string; guildId: string | null }, ctx: { guildRole: GuildRole | null; isFriendOfHost: boolean }): boolean {
  if (!viewerId) return false;
  if (night.guildId) return ctx.guildRole !== null;
  return night.hostId === viewerId || ctx.isFriendOfHost;
}

export const isAdmin = (viewer: Viewer) => viewer?.role === "ADMIN";

/** Can add someone to a quest party: not blocked either way. */
export const canAddToParty = (rel: Relation) => !rel.blocked;
