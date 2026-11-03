/** pnpm jobs:auto-confirm — the local equivalent of the /api/cron/auto-confirm cron route. */
import "./env";
import { autoConfirmDue } from "../server/quests";
import { db } from "../lib/db";

autoConfirmDue()
  .then((r) => console.log(`[auto-confirm] confirmed ${r.confirmed} quests`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
