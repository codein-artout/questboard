/**
 * node scripts/screenshots.mjs [baseUrl] — screenshots of every main route at
 * 1440, 1024 and 390 px as a seeded player (dev sign-in), into screenshots/.
 * Used for the visual comparison against design/screens.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = new URL("../screenshots/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const login = await browser.newContext();
const p = await login.newPage();
await p.goto(`${base}/signin`);
await p.locator('form:has(input[value="host@questboard.local"]) button').click();
await p.waitForURL((u) => !u.pathname.startsWith("/signin"));
const state = await login.storageState();
const quest = await p.evaluate(async () => {
  const r = await fetch("/quests");
  const html = await r.text();
  return html.match(/\/quests\/([a-z0-9]{20,})"/)?.[1];
});
const nightRes = await p.goto(`${base}/`);
const night = (await p.content()).match(/\/nights\/([a-z0-9]{20,})/)?.[1];
void nightRes;
await login.close();

const routes = [
  ["island", "/"],
  ["quests", "/quests"],
  ["quest", `/quests/${quest}`],
  ["reward", `/quests/${quest}/complete`],
  ["log", "/log"],
  ["tile", "/games/cascadia"],
  ["shelf", "/shelf"],
  ["guild", "/g/thursday-crew"],
  ["guilds", "/guilds?all=1"],
  ["night", `/nights/${night}`],
  ["character", "/u/ciao"],
  ["h2h", "/u/ciao/vs/priya"],
  ["records", "/u/ciao/records"],
  ["public-island", "/u/priya/island"],
  ["notifications", "/notifications"],
  ["settings", "/settings"],
  ["import", "/import"],
  ["admin", "/admin"],
  ["components", "/dev/components"],
];
for (const width of [1440, 1024, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 960 }, storageState: state, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const [name, path] of routes) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}${name}-${width}.png`, fullPage: name !== "island" });
  }
  await ctx.close();
}
// Signed-out pages
const anon = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const a = await anon.newPage();
for (const [name, path] of [["landing", "/"], ["signin", "/signin"]]) {
  await a.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await a.screenshot({ path: `${out}${name}-1440.png` });
}
await browser.close();
console.log(`screenshots in ${out}`);
