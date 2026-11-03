import { describe, expect, it } from "vitest";
import {
  canAddToParty,
  canConfirmQuest,
  canDeleteQuest,
  canDisputeQuest,
  canEditGameNight,
  canEditQuest,
  canInteract,
  canJoinGameNight,
  canManageGuild,
  canViewProfile,
  canViewQuest,
  showParticipantName,
  type QuestAccess,
  type Relation,
} from "@/lib/permissions";

const rel = (o: Partial<Relation> = {}): Relation => ({ isSelf: false, isFriend: false, blocked: false, ...o });
const viewer = (id = "v", guildIds: string[] = []) => ({ id, role: "USER" as const, guildIds });
const quest = (o: Partial<QuestAccess> = {}): QuestAccess => ({
  loggedById: "logger",
  loggerPrivacy: "FRIENDS",
  participantUserIds: ["logger", "p2"],
  guildId: null,
  status: "pending",
  source: "live",
  createdAt: new Date(),
  ...o,
});

describe("profiles", () => {
  it("respects privacy and blocks", () => {
    expect(canViewProfile("PUBLIC", rel())).toBe(true);
    expect(canViewProfile("FRIENDS", rel())).toBe(false);
    expect(canViewProfile("FRIENDS", rel({ isFriend: true }))).toBe(true);
    expect(canViewProfile("PRIVATE", rel({ isFriend: true }))).toBe(false);
    expect(canViewProfile("PRIVATE", rel({ isSelf: true }))).toBe(true);
    expect(canViewProfile("PUBLIC", rel({ blocked: true }))).toBe(false);
  });
});

describe("quests", () => {
  it("lets party members, guild members and permitted viewers see a quest", () => {
    expect(canViewQuest(viewer("p2"), quest({ loggerPrivacy: "PRIVATE" }), rel())).toBe(true);
    expect(canViewQuest(viewer("x", ["g1"]), quest({ guildId: "g1", loggerPrivacy: "PRIVATE" }), rel())).toBe(true);
    expect(canViewQuest(viewer("x"), quest({ loggerPrivacy: "FRIENDS" }), rel({ isFriend: true }))).toBe(true);
    expect(canViewQuest(viewer("x"), quest({ loggerPrivacy: "FRIENDS" }), rel())).toBe(false);
    expect(canViewQuest(null, quest({ loggerPrivacy: "PUBLIC" }), rel())).toBe(true);
    expect(canViewQuest(null, quest({ loggerPrivacy: "FRIENDS" }), rel())).toBe(false);
    expect(canViewQuest(viewer("x", ["g1"]), quest({ guildId: "g1" }), rel({ blocked: true }))).toBe(false);
  });
  it("only the logger edits; logger or admin deletes", () => {
    expect(canEditQuest(viewer("logger"), quest())).toBe(true);
    expect(canEditQuest(viewer("p2"), quest())).toBe(false);
    expect(canEditQuest(null, quest())).toBe(false);
    expect(canDeleteQuest({ id: "admin", role: "ADMIN", guildIds: [] }, quest())).toBe(true);
    expect(canDeleteQuest(viewer("p2"), quest())).toBe(false);
  });
  it("another registered party member confirms a pending live quest once", () => {
    expect(canConfirmQuest(viewer("p2"), quest(), false)).toBe(true);
    expect(canConfirmQuest(viewer("p2"), quest(), true)).toBe(false);
    expect(canConfirmQuest(viewer("logger"), quest(), false)).toBe(false);
    expect(canConfirmQuest(viewer("x"), quest(), false)).toBe(false);
    expect(canConfirmQuest(viewer("p2"), quest({ status: "confirmed" }), false)).toBe(false);
    expect(canConfirmQuest(viewer("p2"), quest({ source: "import" }), false)).toBe(false);
  });
  it("disputes while pending or within 48 hours of logging", () => {
    const now = new Date("2026-05-10T12:00:00Z");
    expect(canDisputeQuest(viewer("p2"), quest(), now)).toBe(true);
    expect(canDisputeQuest(viewer("p2"), quest({ status: "confirmed", createdAt: new Date("2026-05-09T12:00:00Z") }), now)).toBe(true);
    expect(canDisputeQuest(viewer("p2"), quest({ status: "confirmed", createdAt: new Date("2026-05-07T12:00:00Z") }), now)).toBe(false);
    expect(canDisputeQuest(viewer("logger"), quest(), now)).toBe(false);
    expect(canDisputeQuest(viewer("p2"), quest({ status: "disputed" }), now)).toBe(false);
  });
  it("blocks stop interaction and party adds", () => {
    expect(canInteract(viewer(), true, rel())).toBe(true);
    expect(canInteract(viewer(), true, rel({ blocked: true }))).toBe(false);
    expect(canInteract(null, true, rel())).toBe(false);
    expect(canAddToParty(rel({ blocked: true }))).toBe(false);
  });
  it("hides private participants from strangers but not from the party", () => {
    expect(showParticipantName("PRIVATE", rel(), false)).toBe(false);
    expect(showParticipantName("PRIVATE", rel(), true)).toBe(true);
    expect(showParticipantName("FRIENDS", rel({ isFriend: true }), false)).toBe(true);
    expect(showParticipantName("PUBLIC", rel({ blocked: true }), true)).toBe(false);
  });
});

describe("guilds and game nights", () => {
  it("owners and admins manage the guild", () => {
    expect(canManageGuild("owner")).toBe(true);
    expect(canManageGuild("admin")).toBe(true);
    expect(canManageGuild("member")).toBe(false);
    expect(canManageGuild(null)).toBe(false);
  });
  it("hosts or guild admins edit nights; guild members or host friends join", () => {
    expect(canEditGameNight("h", { hostId: "h" }, null)).toBe(true);
    expect(canEditGameNight("x", { hostId: "h" }, "admin")).toBe(true);
    expect(canEditGameNight("x", { hostId: "h" }, "member")).toBe(false);
    expect(canJoinGameNight("x", { hostId: "h", guildId: "g" }, { guildRole: "member", isFriendOfHost: false })).toBe(true);
    expect(canJoinGameNight("x", { hostId: "h", guildId: "g" }, { guildRole: null, isFriendOfHost: true })).toBe(false);
    expect(canJoinGameNight("x", { hostId: "h", guildId: null }, { guildRole: null, isFriendOfHost: true })).toBe(true);
    expect(canJoinGameNight("x", { hostId: "h", guildId: null }, { guildRole: null, isFriendOfHost: false })).toBe(false);
    expect(canJoinGameNight(null, { hostId: "h", guildId: null }, { guildRole: null, isFriendOfHost: true })).toBe(false);
  });
});
