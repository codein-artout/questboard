import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectAccessible, signUp } from "./helpers";

test("sign up, import a play history file and watch the island build", async ({ page }) => {
  await signUp(page, "Importer");
  await expect(page.getByRole("heading", { name: "Your island is waiting" })).toBeVisible();
  await expectAccessible(page, "onboarding start");
  await page.getByRole("link", { name: /Import your play history/ }).click();
  await page.waitForURL(/\/import/);
  await expectAccessible(page, "import page");
  await page.locator("input[type=file]").setInputFiles(path.resolve(__dirname, "../../importers/samples/bgstats-sample.json"));
  await expect(page.getByRole("heading", { name: "Import finished" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/23 quests added/)).toBeVisible();
  await expect(page.getByRole("region", { name: /Your island: 6 tiles/ })).toBeVisible();
  // The unknown game waits for confirmation.
  await expect(page.getByText("Grandma's Kitchen Card Game")).toBeVisible();

  await page.getByRole("link", { name: "Continue" }).click();
  await page.waitForURL(/\/onboarding\/shelf/);
  await expect(page.getByRole("heading", { name: "Which of these do you own?" })).toBeVisible();
  await page.getByText("Sky Team", { exact: true }).click();
  await page.getByRole("button", { name: "Save and see your island" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("region", { name: /Your island: 6 game tiles/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sky Team, unplayed, on your shelf" })).toBeVisible();
  await expectAccessible(page, "island");

  // Importing the same file again adds nothing (idempotent).
  await page.goto("/import");
  await page.locator("input[type=file]").setInputFiles(path.resolve(__dirname, "../../importers/samples/bgstats-sample.json"));
  await expect(page.getByRole("heading", { name: "Import finished" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/0 quests added, 23 already imported/)).toBeVisible();
});

test("the list view is an accessible alternative to the map", async ({ page }) => {
  await signUp(page, "Lister");
  await page.goto("/import");
  await page.locator("input[type=file]").setInputFiles(path.resolve(__dirname, "../../importers/samples/bgg-plays-compact.csv"));
  await expect(page.getByRole("heading", { name: "Import finished" })).toBeVisible({ timeout: 60_000 });
  await page.goto("/");
  await page.getByRole("button", { name: "List" }).click();
  const list = page.getByRole("region", { name: /Your games, most played first/ });
  await expect(list.getByRole("link").first()).toBeVisible();
  // Keyboard: arrows move between tiles on the map.
  await page.getByRole("button", { name: "Map" }).click();
  const first = page.locator("[data-tile][tabindex='0']");
  await first.focus();
  const before = await first.getAttribute("data-tile");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const after = await page.locator("[data-tile][aria-pressed='true']").getAttribute("data-tile");
  expect(after).not.toBe(before);
});
