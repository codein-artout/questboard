import { z } from "zod";
import { PLAYER_COLOR_KEYS } from "@/lib/colors";

const RESERVED = new Set(["admin", "api", "me", "settings", "new", "guest", "guests", "questboard", "signin", "signout", "login", "logout", "onboarding", "dev", "invite", "help", "support", "root", "system", "null", "undefined"]);

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "3 to 20 letters, numbers or underscores")
  .refine((h) => !RESERVED.has(h), "That handle is reserved");

export const profileSchema = z.object({
  handle: handleSchema,
  displayName: z.string().trim().min(1, "Add a name").max(30),
  color: z.enum(PLAYER_COLOR_KEYS as [string, ...string[]]),
  timezone: z.string().max(64).optional(),
});

export const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(30),
  color: z.enum(PLAYER_COLOR_KEYS as [string, ...string[]]),
  privacy: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]),
  emailNotifications: z.boolean(),
  timezone: z.string().max(64),
});
