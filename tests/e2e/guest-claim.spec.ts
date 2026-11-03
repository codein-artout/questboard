import { expect, test } from "@playwright/test";
import { logQuest, magicLink, newUser, uid } from "./helpers";

test("a guest claims their account and their history backfills", async ({ browser }) => {
  const a = await newUser(browser, "Gita");
  const guestName = `Gus${uid().slice(-4)}`;
  const questId = await logQuest(a.page, "Azul", [{ score: 60 }, { guest: guestName, score: 72 }]);
  await a.page.goto(`/quests/${questId}`);
  const href = await a.page.getByRole("link", { name: "Claim link" }).getAttribute("href");
  expect(href).toMatch(/^\/claim\//);

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const c = await ctx.newPage();
  const email = `e2e-claim-${uid()}@example.com`;
  await magicLink(c, email, href!);
  await c.waitForURL(/\/claim\//);
  await expect(c.getByRole("heading", { name: `Are you ${guestName}?` })).toBeVisible();
  await c.getByRole("button", { name: "Claim my quests" }).click();
  await c.waitForURL(/\/onboarding/);
  await c.getByLabel("Your name").fill(guestName);
  await c.getByLabel("Handle").fill(`claim_${uid()}`.slice(0, 20));
  await c.getByRole("button", { name: "Continue" }).click();
  await c.waitForURL(/\/onboarding\/start/);

  await c.goto("/");
  await expect(c.getByRole("button", { name: /^Azul, waiting for confirmation/ })).toBeVisible();
  await c.goto(`/quests/${questId}`);
  await expect(c.locator("#main").getByRole("link", { name: guestName })).toBeVisible();
  // The quest is now waiting on the claimer's confirmation like any party member.
  await expect(c.getByRole("button", { name: "Confirm quest" })).toBeVisible();

  await a.page.goto(`/quests/${questId}`);
  await expect(a.page.getByRole("link", { name: "Claim link" })).toHaveCount(0);
});
