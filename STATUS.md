# Status

All 19 milestones are implemented. See the table for what each covers and how it was verified.

| # | Milestone | State |
|---|---|---|
| 1 | Scaffold, tokens, fonts, desktop shell, shared components, `/dev/components` | Done |
| 2 | Data model (Prisma, source and derived tables, indexes on every FK and query path, pg_trgm) | Done |
| 3 | Catalog: 526 games, zod validation, `catalog:check`, sync, trigram search, custom games and admin promotion, Wikidata script | Done (Wikidata script can't reach the network here) |
| 4 | Rules engine in `/game` with unit tests; `pnpm game:recompute` | Done |
| 5 | Auth (magic links, Google, dev login), onboarding, import (BG Stats / BGG CSV) as background ImportJob, shelf picker, invite links | Done |
| 6 | Island home: pan/zoom/keyboard map, search fly-to, side panel, Map/List, shelf "?" tiles, ghost tiles, nudges, next game night | Done |
| 7 | Log a quest: desktop modal (L), phone page, search, suggestions, party, live places/ties, modes, notes, photo, drafts | Done |
| 8 | Reward screen: new land, tier-up, crown taken, personal best, XP count-up, level-up, class change, titles, pending state | Done |
| 9 | Confirmations and disputes, 48-hour auto-confirm (cron route + script), guest claiming | Done |
| 10 | Game tile page | Done |
| 11 | Quest log feed (filters, cursor pagination, reactions, comments, reward chips, privacy) and quest detail | Done |
| 12 | Shelf of shame: adds, bounties, propose to a game night | Done |
| 13 | Guilds: shared island with holder discs, game nights (RSVP, 3 votes), campaigns, standings, finale double XP, champions | Done |
| 14 | Character sheet, head-to-head, house records board, displayed titles | Done |
| 15 | Public island/tile/quest pages, OG images, island PNG export | Done |
| 16 | Notification center + optional email | Done |
| 17 | Block, report, rate limits, account deletion, JSON export, admin | Done |
| 18 | Seed: 12 players, 3 guilds, ~500 quests over 10 months; recompute after | Done |
| 19 | Unit tests, Playwright e2e with axe, GitHub Actions CI | See below |

## Verification

- `pnpm lint`, `pnpm typecheck`: clean.
- `pnpm test`: 182 unit tests pass (rules engine, catalog, importers, permissions, places, formatting, validation).
- `pnpm build`: passes.
- `pnpm test:e2e`: five flows (signup → import → island; log → reward → feed → confirm; tier-up and crown change; shelf → propose → vote → log; guest claiming), plus a list/keyboard test, all with axe checks. Results are recorded in the latest commit message.

## Known limits / next steps

- Wikidata enrichment couldn't run here (no network access to query.wikidata.org).
- Recompute works per connected group of players. One huge connected community would recompute in one go; the next step would be incremental updates for the latest quest.
- Uploads use local disk without S3 settings, which doesn't persist on Vercel; set `S3_*` in production.
