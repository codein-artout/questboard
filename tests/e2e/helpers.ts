import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type Page } from "@playwright/test";

let counter = 0;
export const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/** Follows a magic link from the local outbox (console email provider). */
export async function magicLink(page: Page, email: string, next = "/") {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.waitForURL(/\/signin\/check/);
  let link: string | undefined;
  for (let i = 0; i < 20 && !link; i++) {
    const res = await page.request.get(`/api/dev/mailbox?to=${encodeURIComponent(email)}`);
    const json = (await res.json()) as { messages: { text: string }[] };
    link = json.messages.at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
    if (!link) await page.waitForTimeout(250);
  }
  expect(link, "magic link email").toBeTruthy();
  await page.goto(link!);
}

export type TestUser = { email: string; handle: string; name: string };

/** Signs up a brand-new player through magic link and onboarding step 1. */
export async function signUp(page: Page, name: string, next = "/"): Promise<TestUser> {
  const id = uid();
  const user = { email: `e2e-${id}@example.com`, handle: `e2e_${id}`.slice(0, 20), name: `${name} ${id.slice(-3)}` };
  await magicLink(page, user.email, next);
  await page.waitForURL(/\/onboarding/);
  await page.getByLabel("Your name").fill(user.name);
  await page.getByLabel("Handle").fill(user.handle);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/onboarding\/start|\/claim|\/u\//);
  return user;
}

export async function newUser(browser: Browser, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await ctx.newPage();
  const user = await signUp(page, name);
  return { ctx, page, user };
}

/** B opens A's invite link and becomes A's friend. */
export async function befriend(a: Page, b: Page) {
  await a.goto("/settings");
  const invite = await a.getByLabel("Your invite link").inputValue();
  await b.goto(new URL(invite).pathname);
  await b.waitForLoadState("networkidle");
}

/** Logs a quest from the full-page form. Returns the quest id. */
export async function logQuest(page: Page, game: string, party: { name?: string; guest?: string; score?: number }[], opts: { coopWin?: boolean; pickSuggestion?: boolean } = {}) {
  if (!opts.pickSuggestion) {
    await page.goto("/log");
    await discardDraft(page);
    await page.getByPlaceholder("Which game did you play?").fill(game);
    await page.getByRole("option", { name: new RegExp(`^${escape(game)}`) }).first().click();
  }
  for (const p of party) {
    if (!p.name && !p.guest) continue;
    if (!(await page.getByLabel("Find a friend or type a guest’s name").isVisible().catch(() => false))) {
      await page.getByRole("button", { name: "Add a party member or guest" }).click();
    }
    const input = page.getByLabel("Find a friend or type a guest’s name");
    if (p.name) {
      await input.fill(p.name.split(" ")[0]!);
      await page.getByRole("button", { name: p.name, exact: true }).click();
    } else {
      await input.fill(p.guest!);
      await page.getByRole("button", { name: `Add “${p.guest}” as a guest` }).click();
    }
  }
  if (await page.getByRole("button", { name: "Done" }).isVisible().catch(() => false)) await page.getByRole("button", { name: "Done" }).click();
  if (opts.coopWin !== undefined) await page.getByRole("button", { name: opts.coopWin ? "We won" : "We lost" }).click();
  const scores = page.getByLabel(/^Score for /);
  const n = await scores.count();
  for (let i = 0; i < n; i++) {
    const label = (await scores.nth(i).getAttribute("aria-label"))!.replace("Score for ", "");
    const entry = party.find((p) => p.name === label || p.guest === label) ?? (i === 0 ? party.find((p) => !p.name && !p.guest) : undefined);
    if (entry?.score !== undefined) await scores.nth(i).fill(String(entry.score));
  }
  await page.getByRole("button", { name: "Complete quest" }).click();
  await page.waitForURL(/\/quests\/[a-z0-9]+\/complete/);
  return page.url().match(/\/quests\/([a-z0-9]+)\/complete/)![1]!;
}

async function discardDraft(page: Page) {
  await page.waitForTimeout(300);
  const discard = page.getByRole("button", { name: "Discard" });
  if (await discard.isVisible().catch(() => false)) await discard.click();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** axe: no serious or critical WCAG 2 A/AA violations. */
export async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = bad.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n  ")}`).join("\n");
  expect(bad, `${label} accessibility:\n${summary}`).toEqual([]);
}
