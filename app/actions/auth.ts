"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { AuthError as NextAuthError } from "next-auth";
import { devLoginEnabled, signIn, signOut } from "@/lib/auth";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address"), next: z.string().startsWith("/").max(300).optional() });

export type SignInState = { error?: string } | null;

export async function signInWithEmail(_prev: SignInState, form: FormData): Promise<SignInState> {
  const parsed = emailSchema.safeParse({ email: form.get("email"), next: form.get("next") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address" };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  try {
    await rateLimit("signIn", `ip:${ip}`);
    await rateLimit("signIn", `email:${parsed.data.email}`);
  } catch (e) {
    if (e instanceof RateLimitError) return { error: e.message };
    throw e;
  }
  await signIn("email", { email: parsed.data.email, redirectTo: parsed.data.next ?? "/" });
  return null;
}

export async function signInWithGoogle(form: FormData) {
  const next = String(form.get("next") || "/");
  await signIn("google", { redirectTo: next.startsWith("/") ? next : "/" });
}

export async function devSignIn(form: FormData) {
  if (!devLoginEnabled()) throw new Error("Development login is off.");
  const email = z.string().email().parse(form.get("email"));
  const next = String(form.get("next") || "/");
  try {
    await signIn("dev", { email, redirectTo: next.startsWith("/") ? next : "/" });
  } catch (e) {
    if (e instanceof NextAuthError) throw new Error("Sign-in failed.");
    throw e;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}
