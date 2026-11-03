import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { APP_NAME } from "@/game/config";

export type EmailMessage = { to: string; subject: string; text: string; html?: string; tag?: string };

/** Anything that can deliver an email. */
export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Development provider: prints the email and appends it to .data/mail/outbox.jsonl. */
export const consoleProvider: EmailProvider = {
  name: "console",
  async send(message) {
    const dir = path.join(process.cwd(), ".data", "mail");
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "outbox.jsonl"), `${JSON.stringify({ ...message, at: new Date().toISOString() })}\n`);
    if (process.env.NODE_ENV !== "test") {
      console.log(`\n[email] to=${message.to} subject="${message.subject}"\n${message.text}\n`);
    }
  },
};

/** Resend over its HTTP API (no SDK needed). */
export function resendProvider(apiKey: string, from: string): EmailProvider {
  return {
    name: "resend",
    async send(message) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html, tags: message.tag ? [{ name: "type", value: message.tag }] : undefined }),
      });
      if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
    },
  };
}

export function emailProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY;
  return key ? resendProvider(key, process.env.EMAIL_FROM || `${APP_NAME} <onboarding@resend.dev>`) : consoleProvider;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  await emailProvider().send(message);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A plain, on-brand HTML wrapper for transactional email. */
export function emailHtml(heading: string, body: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#0F2E45;font-family:Arial,sans-serif;color:#EAF2F7">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<div style="font-size:24px;font-weight:900;color:#F5C84B">${esc(APP_NAME)}</div>
<h1 style="font-size:22px;margin:24px 0 8px">${esc(heading)}</h1>
<p style="font-size:15px;line-height:1.5;color:#EAF2F7">${esc(body)}</p>
${cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#F5C84B;color:#0F2E45;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:22px">${esc(cta.label)}</a></p>` : ""}
<p style="font-size:12px;color:#9DB7C9">You can turn off email in your account settings.</p>
</div></body></html>`;
}
