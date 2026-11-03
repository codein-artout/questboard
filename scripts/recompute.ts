/** pnpm game:recompute — rebuild every piece of derived state from history. */
import { db } from "../lib/db";
import { recompute } from "../server/recompute";

const started = Date.now();
recompute("all", { notify: false })
  .then((r) =>
    console.log(
      `[recompute] ${r.userIds.length} players: ${r.output.tiles.length} tiles, ${r.output.ledger.length} XP entries, ${r.output.crowns.length} crowns, ${r.output.titles.length} titles in ${Date.now() - started} ms`,
    ),
  )
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
