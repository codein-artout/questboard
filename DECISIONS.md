# Decisions

Calls made while building v1 without anyone to ask. Each one is small enough to revisit.

## Platform
- **Next.js 15.5 (App Router) + React 19, Prisma 6.19, Auth.js v5 (next-auth 5.0.0-beta.30), Tailwind 4.** Next 16 and Prisma 7 exist, but these versions are mature and well understood; upgrading is mechanical.
- **PostgreSQL: a real local server, not PGlite.** `pnpm db:setup` starts a private cluster under `.data/postgres` on port 54329 using the PostgreSQL binaries on the machine (as the `postgres` user when run as root), or tells you to `docker compose up -d db`. CI uses a Postgres service container. Fuzzy search uses `pg_trgm`, which Neon supports.
- **Fonts via `next/font/local`** with the variable woff2 files from Fontsource committed in `app/fonts`, so builds work offline. OG images use static woff files in `assets/og-fonts` because Satori can't read woff2.
- **JWT sessions** (Auth.js) with the Prisma adapter for users, accounts and magic-link tokens. Every request re-loads the user from the database, so deleted accounts are signed out immediately.

## Game rules (interpretations of GAME.md)
- **Island layout.** Candidates are free slots touching the island, no further out than one ring beyond the innermost ring with room ("ring by ring"). Among them: most same-terrain neighbours, then smallest ring, then a stable hash.
- **Took a crown (40 XP)** is paid only when you take a crown from another player or group, not for claiming a vacant one (otherwise every first play in a new guild pays crown XP). Claimed crowns are still yours and show on the reward screen. At most one crown bonus per quest. Relevant crowns: the quest's guild crown and your own friends crown.
- **Crown ties** keep the incumbent. Points crowns: higher single score strictly beats; win-rate crowns compare rate, then wins.
- **Friends crown** is per island owner: the best record among the owner and their friends, stored for games on the owner's island.
- **Co-op friends crowns** go to the group (exact set of registered players) with the most wins at the highest difficulty, considering groups made only of the owner and their friends. Guild co-op crowns are "held by the guild".
- **Taught XP** goes to every party member who had played the game before (the literal reading of GAME.md), 20 per registered first-time learner, max 3 learners. The TaughtBy edge goes to one teacher: host first, then most plays, then earliest first play. Nobody teaches on a game's first play at the table.
- **Shelf bounty** needs the game to have been on the shelf at least 7 days ("owned for a while"; stops add-then-log farming).
- **Personal best** needs an earlier scored play to beat.
- **Nemesis**: among opponents met 5+ times in competitive quests in the last 90 days, the one closest to 50/50 (decided games only), ties to more meetings.
- **Class hybrid**: the top two terrains' shares are within 10 percentage points. Window: last 12 months, or all time when the window has fewer than 30 plays.
- **XP modifiers** apply in this order: raid (doubles showed-up), grinding (half from the 4th play of a game that day), imported (half), campaign finale (double), daily cap (13th quest of a day earns 0). Each shows as its own line.
- **Imported quests** count only for the importer (tiles, tiers, records, stats, 50% XP). They never count toward crowns, campaigns, teaching, head-to-head or titles involving other people.
- **Guild quests** are quests tagged with a guild (the log form preselects one when the party shares a guild). Guild crowns, campaigns and the Founder title use them; guild tiles need 3+ members present.
- **Campaign finale**: quests attached to the finale game night, or guild quests on the finale date, earn double XP for the level and the standings.
- **Night Owl**: quest end (start + duration) in local time between 00:00 and 05:00.
- **Kingmaker** needs 3+ players and a points game won by exactly 1 point or less (not a tie).
- **Titles**: 28 fixed titles plus one champion title per won campaign. "Social" titles never count imported plays.
