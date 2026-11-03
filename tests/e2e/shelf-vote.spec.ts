import { expect, test } from "@playwright/test";
import { befriend, expectAccessible, logQuest, newUser } from "./helpers";

test("shelf game proposed to a game night, voted on, then logged with a bounty", async ({ browser }) => {
  const a = await newUser(browser, "Esme");
  const b = await newUser(browser, "Finn");
  await befriend(a.page, b.page);

  // Add Sky Team to the shelf, owned since last month.
  await a.page.goto("/shelf");
  const last = new Date();
  last.setDate(1);
  last.setMonth(last.getMonth() - 1);
  await a.page.getByLabel("Owned since").fill(last.toISOString().slice(0, 7));
  await a.page.getByPlaceholder("Search the catalog").fill("Sky Team");
  await a.page.getByRole("button", { name: /^Sky Team/ }).first().click();
  await expect(a.page.getByRole("link", { name: "Sky Team" })).toBeVisible();
  await expectAccessible(a.page, "shelf");

  // Plan a game night in two hours (local time).
  await a.page.goto("/nights/new");
  const at = new Date(Date.now() + 2 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  await a.page.getByLabel("Date").fill(`${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`);
  await a.page.getByLabel("Time").fill(`${pad(at.getHours())}:${pad(at.getMinutes())}`);
  await a.page.getByLabel("Name (optional)").fill("E2E night");
  await a.page.getByRole("button", { name: "Plan game night" }).click();
  await a.page.waitForURL(/\/nights\/[a-z0-9]+$/);
  const nightUrl = new URL(a.page.url()).pathname;

  // Propose from the shelf, then vote.
  await a.page.goto("/shelf");
  await a.page.getByRole("button", { name: "Propose" }).first().click();
  await expect(a.page.getByText("In the vote")).toBeVisible();
  await a.page.getByRole("button", { name: "Vote for Sky Team" }).click();
  await expect(a.page.getByRole("button", { name: "Take back your vote for Sky Team" })).toBeVisible();

  await b.page.goto(nightUrl);
  await b.page.getByRole("button", { name: "Going" }).click();
  await b.page.getByRole("button", { name: "Vote for Sky Team" }).click();
  await expect(b.page.getByLabel("2 votes")).toBeVisible();
  await expectAccessible(b.page, "game night");

  // Log from tonight: the vote leads the suggestions.
  await a.page.goto(nightUrl);
  await a.page.getByRole("link", { name: "Log a quest from tonight" }).click();
  await expect(a.page.getByText(/From the E2E night vote/)).toBeVisible();
  await a.page.getByRole("button", { name: "Sky Team" }).first().click();
  await logQuest(a.page, "Sky Team", [{}, { name: b.user.name }], { coopWin: true, pickSuggestion: true });
  await expect(a.page.getByText("Shelf bounty")).toBeVisible({ timeout: 10_000 });
  await expect(a.page.getByText(/New land: Sky Team/).first()).toBeVisible();
});
