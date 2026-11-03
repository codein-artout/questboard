import { expect, test } from "@playwright/test";
import { befriend, logQuest, newUser } from "./helpers";

test("a tile rises to a Village on its 5th play and a crown changes hands", async ({ browser }) => {
  test.setTimeout(240_000);
  const a = await newUser(browser, "Cass");
  const b = await newUser(browser, "Dov");
  await befriend(a.page, b.page);
  const me = (score: number) => ({ score });

  for (let i = 0; i < 4; i++) {
    const id = await logQuest(a.page, "Cascadia", [me(50 + i), { name: b.user.name, score: 40 }]);
    await b.page.goto(`/quests/${id}`);
    await b.page.getByRole("button", { name: "Confirm quest" }).click();
    await expect(b.page.getByRole("button", { name: "Confirm quest" })).toBeHidden();
  }
  // A holds the friends crown with 53.
  await a.page.goto("/games/cascadia");
  await expect(a.page.getByRole("region", { name: "Friends crown" })).toContainText("You hold it with 53");

  // Fifth play: Cascadia rises to a Village; Dov's 70 beats the record.
  const fifth = await logQuest(a.page, "Cascadia", [me(45), { name: b.user.name, score: 70 }]);
  await expect(a.page.getByRole("heading", { name: "Cascadia rises" })).toBeVisible();
  await expect(a.page.getByText("From an Outpost to a Village")).toBeVisible();
  await expect(a.page.getByText("Reached a Village")).toBeVisible({ timeout: 10_000 });

  await b.page.goto(`/quests/${fifth}`);
  await b.page.getByRole("button", { name: "Confirm quest" }).click();
  await expect(b.page.getByRole("button", { name: "Confirm quest" })).toBeHidden();
  await b.page.goto(`/quests/${fifth}/complete`);
  await expect(b.page.getByText(new RegExp(`You took the Cascadia crown from ${a.user.name}`)).first()).toBeVisible();
  await expect(b.page.getByText("Took a crown")).toBeVisible({ timeout: 10_000 });

  await a.page.goto("/notifications");
  await expect(a.page.getByText(new RegExp(`took your Cascadia`))).toBeVisible();
  await a.page.goto("/games/cascadia");
  await expect(a.page.getByText("Village, 5 plays.")).toBeVisible();
  await expect(a.page.getByRole("region", { name: "Friends crown" })).toContainText(`${b.user.name} holds it with 70`);
});
