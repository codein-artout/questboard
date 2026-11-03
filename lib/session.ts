import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type SessionUser = User & { isAdmin: boolean; guildIds: string[] };

const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** The signed-in user, re-read from the database on every request (deleted users are signed out). */
export const getViewer = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id }, include: { memberships: { select: { guildId: true } } } });
  if (!user) return null;
  const { memberships, ...rest } = user;
  const isAdmin = rest.role === "ADMIN" || (!!rest.email && adminEmails().includes(rest.email.toLowerCase()));
  return { ...rest, isAdmin, guildIds: memberships.map((m) => m.guildId) };
});

/** For pages: signed in and onboarded, or redirect. */
export async function requireUser(): Promise<SessionUser> {
  const viewer = await getViewer();
  if (!viewer) redirect("/signin");
  if (!viewer.handle || !viewer.onboardedAt) redirect("/onboarding");
  return viewer;
}

/** For server actions: throws instead of redirecting. */
export async function requireActionUser(): Promise<SessionUser> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthError("Sign in first.");
  return viewer;
}

export class AuthError extends Error {
  constructor(message = "You can't do that.") {
    super(message);
    this.name = "AuthError";
  }
}

export const toViewer = (u: SessionUser | null) => (u ? { id: u.id, role: u.isAdmin ? ("ADMIN" as const) : ("USER" as const), guildIds: u.guildIds } : null);
