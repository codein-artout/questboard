/** pnpm jobs:imports — process queued or stalled import jobs locally. */
import { db } from "../lib/db";
import { processPendingImports } from "../server/imports";

processPendingImports()
  .then((n) => console.log(`[imports] processed ${n} jobs`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
