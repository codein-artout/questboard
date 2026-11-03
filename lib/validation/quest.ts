import { z } from "zod";
import { SCORING_TYPES } from "@/game/config";

const id = z.string().min(1).max(40);
const score = z.number().finite().min(-100000).max(100000).nullable();

export const participantInputSchema = z
  .object({
    userId: id.nullable(),
    guestId: id.nullable(),
    guestName: z.string().trim().min(1).max(40).nullable(),
    team: z.string().trim().min(1).max(24).nullable(),
    score,
    midScore: score,
    won: z.boolean(),
    rank: z.number().int().min(1).max(100).nullable(),
  })
  .refine((p) => !!p.userId || !!p.guestId || !!p.guestName, { message: "Each party member needs a player or a guest name" });

export const questInputSchema = z
  .object({
    gameId: id,
    playedAt: z.coerce.date().refine((d) => d.getTime() <= Date.now() + 36 * 3600 * 1000, "Quests can't be in the future"),
    localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tzOffsetMin: z.number().int().min(-840).max(840),
    durationMin: z.number().int().min(1).max(6000).nullable(),
    location: z.string().trim().max(80).nullable(),
    hostUserId: id.nullable(),
    guildId: id.nullable(),
    gameNightId: id.nullable(),
    mode: z.enum(SCORING_TYPES),
    coopWin: z.boolean().nullable(),
    difficulty: z.number().int().min(0).max(50).nullable(),
    notes: z.string().trim().max(1000).nullable(),
    photoKey: z.string().regex(/^quests\/[a-zA-Z0-9/_.-]+$/).nullable(),
    markOwned: z.boolean(),
    participants: z.array(participantInputSchema).min(1).max(30),
  })
  .superRefine((q, ctx) => {
    const ids = q.participants.map((p) => p.userId).filter(Boolean);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Someone is in the party twice", path: ["participants"] });
    if (q.mode === "coop" && q.coopWin === null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Did the party win or lose?", path: ["coopWin"] });
    if (q.hostUserId && !ids.includes(q.hostUserId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The host must be in the party", path: ["hostUserId"] });
  });

export type QuestInput = z.infer<typeof questInputSchema>;
export type ParticipantInput = z.infer<typeof participantInputSchema>;

export const disputeSchema = z.object({ questId: id, reason: z.string().trim().min(3).max(300) });
export const questIdSchema = z.object({ questId: id });
