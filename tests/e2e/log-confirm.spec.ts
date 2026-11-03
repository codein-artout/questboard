import { expect, test } from "@playwright/test";
import { befriend, expectAccessible, newUser } from "./helpers";

test("log a quest, see the reward, find it in the feed, and a friend confirms it", async ({ browser }) => {
  const a = await newUser(browser, "Alma");
  const b = await newUser(browser, "Bruno");
  await befriend(a.page, b.page);

  // Desktop: L opens the log modal over the island.
  await a.page.goto("/");
  await a.page.keyboard.press("l");
  const dialog = a.page.getByRole("dialog", { name: "Log a quest" });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Which game did you play?").fill("cascadai");
  await dialog.getByRole("option", { name: /^Cascadia/ }).first().click();
  await dialog.getByRole("button", { name: "Add a party member or guest" }).click();
  await dialog.getByLabel("Find a friend or type a guest’s name").fill(b.user.name.split(" ")[0]!);
  await dialog.getByRole("button", { name: b.user.name, exact: true }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await dialog.getByLabel(`Score for ${a.user.name}`).fill("88");
  await dialog.getByLabel(`Score for ${b.user.name}`).fill("80");
  await expect(dialog.getByLabel("Place 1")).toBeVisible();
  await expectAccessible(a.page, "log modal");
  await dialog.getByRole("button", { name: "Complete quest" }).click();

  await a.page.waitForURL(/\/complete/);
  await expect(a.page.getByRole("heading", { name: "Cascadia", level: 1 })).toBeVisible();
  await expect(a.page.getByText("Waiting for confirmation")).toBeVisible();
  await expect(a.page.getByText(/New land: Cascadia/).first()).toBeVisible();
  await expect(a.page.getByText(/^\+1[0-9]0 XP$/)).toBeVisible({ timeout: 10_000 });
  await expectAccessible(a.page, "reward screen");
  const questId = a.page.url().match(/quests\/([a-z0-9]+)\/complete/)![1]!;

  await a.page.goto("/quests");
  const card = a.page.getByRole("article").filter({ hasText: "Cascadia" }).first();
  await expect(card).toContainText("Waiting for confirmation");
  await expect(card).toContainText(`${a.user.name} wins by 8`);
  await expectAccessible(a.page, "quest log");

  await b.page.goto("/notifications");
  await expect(b.page.getByText(new RegExp(`logged Cascadia with you`))).toBeVisible();
  await b.page.goto(`/quests/${questId}`);
  await b.page.getByRole("button", { name: "Confirm quest" }).click();
  await expect(b.page.getByRole("heading", { name: "Waiting for confirmation" })).toBeHidden();
  await expectAccessible(b.page, "quest detail");

  await a.page.goto("/quests");
  await expect(a.page.getByRole("article").filter({ hasText: "Cascadia" }).first()).not.toContainText("Waiting for confirmation");
  await a.page.goto("/");
  await expect(a.page.getByRole("button", { name: /^Cascadia, Outpost, 1 play/ })).toBeVisible();
});
