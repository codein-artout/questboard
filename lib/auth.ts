import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { EmailConfig } from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { APP_NAME } from "@/game/config";
import { db } from "@/lib/db";
import { emailHtml, sendEmail } from "@/lib/email";

export const devLoginEnabled = () => process.env.ENABLE_DEV_LOGIN === "true" && process.env.VERCEL_ENV !== "production";
export const googleEnabled = () => !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

/** Magic-link provider that sends through lib/email (Resend or the console). */
const magicLink: EmailConfig = {
  id: "email",
  type: "email",
  name: "Email",
  maxAge: 60 * 60 * 24,
  options: {},
  normalizeIdentifier: (identifier) => identifier.trim().toLowerCase(),
  async sendVerificationRequest({ identifier, url }) {
    await sendEmail({
      to: identifier,
      subject: `Sign in to ${APP_NAME}`,
      text: `Sign in to ${APP_NAME}:\n${url}\n\nThis link works once and expires in 24 hours. If you didn't ask for it, ignore this email.`,
      html: emailHtml(`Sign in to ${APP_NAME}`, "This link works once and expires in 24 hours.", { label: "Sign in", url }),
      tag: "magic-link",
    });
  },
};

const providers: NextAuthConfig["providers"] = [magicLink];
if (googleEnabled()) providers.push(Google({ allowDangerousEmailAccountLinking: false }));
if (devLoginEnabled()) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Development login",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(raw) {
        if (!devLoginEnabled()) return null;
        const parsed = z.object({ email: z.string().email() }).safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const user = (await db.user.findUnique({ where: { email } })) ?? (await db.user.create({ data: { email, emailVerified: new Date() } }));
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 60 },
  trustHost: true,
  providers,
  pages: { signIn: "/signin", verifyRequest: "/signin/check", error: "/signin" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});
