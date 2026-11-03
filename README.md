# Questboard

A social app for board gamers that is a game in itself. Every board game you've
played is a hex tile on your personal island. Replaying a game builds its tile
up from Outpost to Wonder. Groups compete for crowns on each game, unplayed
games on your shelf float offshore as bounties, and teaching a game to friends
spreads it to their islands.

Desktop-first web app (works at phone width for shared links). The name lives
in one constant, `APP_NAME` in `game/config.ts`.

## Quick start

Requirements: Node 20.11+ (22 recommended), pnpm 10, and PostgreSQL 14+
**binaries** on your machine *or* Docker. No paid services or API keys.

```bash
pnpm install
```

```bash
pnpm db:setup
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

Open http://localhost:3000/signin and use **Development sign-in** to enter as a
seeded player. **Ciao** (`host@questboard.local`) is the heavy host and an admin.

- `pnpm db:setup` copies `.env.example` to `.env` if needed, then makes sure
  Postgres is reachable at `DATABASE_URL`. If nothing listens on the default port
  (54329) it starts a private cluster under `.data/postgres` using your local
  PostgreSQL binaries. Without binaries, run `docker compose up -d db` first.
  It then applies migrations and loads `data/catalog.json` into the database.
- `pnpm db:seed` builds a believable world: 12 players, 3 guilds with active
  campaigns, ~500 quests over 10 months, then runs the full recompute.
- Magic-link emails print to the console and land in `.data/mail/outbox.jsonl`
  unless `RESEND_API_KEY` is set.

The full check, from a clean clone:

```bash
pnpm install && pnpm db:setup && pnpm db:seed && pnpm build && pnpm test && pnpm test:e2e
```

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint`, `pnpm typecheck` | ESLint, TypeScript |
| `pnpm test` | Vitest unit tests (rules engine, catalog, importers, permissions, places, formatting) |
| `pnpm test:e2e` | Playwright end-to-end tests with axe accessibility checks (starts `pnpm start`) |
| `pnpm db:setup` / `db:reset` / `db:start` | Start/migrate the database; `db:reset` drops and recreates the schema |
| `pnpm db:seed` | Demo data (deletes previous `@questboard.local` users) |
| `pnpm game:recompute` | Rebuild **all** derived state from history |
| `pnpm catalog:check` | Validate `data/catalog.json`, report nulls, likely duplicates and terrain distribution |
| `pnpm catalog:sync` | Upsert the catalog into the `Game` table (run by `db:setup`) |
| `pnpm jobs:auto-confirm` | Confirm quests whose 48 hours passed without a dispute (cron route locally) |
| `pnpm jobs:imports` | Process queued or stalled import jobs |
| `pnpm enrich:wikidata` | Optional: fill missing years/player counts/Wikidata ids from Wikidata (needs network) |

## Architecture

```
            ┌────────────────────────── Next.js (App Router) ───────────────────────────┐
 browser ──▶│ server components (pages)        server actions / route handlers          │
            │  app/(app)/**  read via            app/actions/*.ts  (zod + permissions    │
            │  server/queries/*                  + rate limits) ─────────┐               │
            └────────────────────────────────────────────────────────────┼──────────────┘
                                                                         ▼
                 source tables (Prisma/Postgres)               server/quests.ts, imports.ts …
   User · Friendship · Guild · Quest · QuestParticipant ·      write the facts, then call
   Confirmation · ShelfItem · GameNight · Campaign · Game       recompute(affected players)
                         │                                               │
                         ▼                                               ▼
              server/recompute.ts ── loads the connected group ──▶ game/engine.ts computeWorld()
              (advisory lock)          of players (friends,          pure, deterministic fold over
                         ▲             guilds, shared quests)        quests in played order
                         │                                               │
                         └──────── persists derived tables ◀─────────────┘
          Tile (tier, plays, position) · XpLedger · QuestOutcome (reward screen) · Crown ·
          CrownChange · HouseRecord · TaughtBy · TitleAward · PlayerStats · GuildTile ·
          CampaignStanding   ──▶ notifications from the diff (crowns, tier-ups, titles)
```

**Quest → rules engine → tiles, tiers, XP, crowns.** A quest is written as a
fact (`pending`). `recompute()` finds every player whose state could depend on
it (the connected component through friendships, guilds and shared quests),
loads their history and runs `computeWorld()`. The engine folds over quests in
the order they were played:

- **confirmed** and **imported** quests change state (plays → tiers, XP lines,
  crowns, house records, teaching edges, titles, class, nemesis, campaigns);
- **pending** quests are evaluated in *shadow* at their place in the timeline:
  projected rewards for the reward screen, ghost tiles and ghost tier-ups;
- **disputed** quests are ignored.

The output replaces the component's derived rows (tile positions, monogram and
terrain overrides are kept), and notifications are sent for what changed. The
same function rebuilds everything with `pnpm game:recompute`. Nothing ever
increments a counter by hand.

| Folder | Contents |
|---|---|
| `game/` | The rules engine: `config.ts` (every number from GAME.md), `engine.ts`, `layout.ts`, `titles.ts`, `class.ts`, `tiers.ts`, `terrain.ts`, `monogram.ts`, `places.ts`, `hex.ts` |
| `importers/` | BG Stats JSON and BGG plays CSV parsers behind one `Importer` interface, with sample files |
| `server/` | Recompute, quests (create/edit/confirm/dispute/auto-confirm/guest claim), imports, notifications, accounts, OG images, queries |
| `lib/` | Prisma client, Auth.js, `email/` (Resend or console), `storage/` (S3-compatible or local disk), permissions (pure), rate limits, search, validation |
| `components/` | Shared UI (`game/` HexTile, IslandMap, TileCard, TierLadder, CrownCard, PlayerDisc, QuestCard, RewardChip, XPBar; `shell/`; `ui/`) |
| `app/` | Routes, server actions, API routes, OG images |
| `data/catalog.json` | The game catalog |
| `prisma/` | Schema, migrations, seed |
| `tests/` | `unit/` (Vitest) and `e2e/` (Playwright + axe) |

Design specs live in `design/` (`DESIGN.md`, `GAME.md`, mockups). Calls made
where the specs were open to interpretation are in `DECISIONS.md`.

## The catalog

`data/catalog.json` holds 526 games written for this project (no BoardGameGeek
data): all-time greats, modern hits through 2025, party, co-op, two-player,
family and heavy games, plus expansions linked to their base games. Each entry
has a stable slug, name, alternate names, optional monogram, year, player
counts, play time, weight (1–5), category and mechanic tags from a fixed
vocabulary, scoring type (points / win-lose / co-op / ranked / teams) and base
game. Unknown facts are `null`, never guessed. The format and allowed tags are
in `data/CATALOG_FORMAT.md`; `lib/catalog/schema.ts` enforces them with zod.

**Terrain** comes from the tags exactly as GAME.md says (first match: Meadow if
"Cooperative Game"; Marsh if Deduction/Bluffing or Hidden Roles; Reef if Party
Game/Word Game; Tundra if Abstract Strategy or max 2 players; Peaks if
Wargame/Territory Building or Area Majority / Influence; else Forest). The
table is `TERRAIN_RULES` in `game/config.ts`. Admins can override a game's
terrain for everyone; players can override it on their own tile.

**Search** uses Postgres `pg_trgm` (GIN index on name + alternate names) with
word similarity, name similarity and a prefix bonus, so "wingpsan" finds
Wingspan and "TI4" finds Twilight Imperium.

**Extending it:** add entries to `data/catalog.json`, then run `pnpm
catalog:check` (CI runs it too) and `pnpm catalog:sync`. Players can add custom
games while logging; admins promote them into the catalog from `/admin`.
`pnpm enrich:wikidata` fills missing years and player counts from Wikidata
(CC0) where a label matches exactly; it needs network access and is never run
in tests.

## Environment variables

All are documented in `.env.example`. None are required beyond the defaults for local use.

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Postgres (pooled and direct URLs on Neon) |
| `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST` | Auth.js |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Optional Google sign-in |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email via Resend; console + `.data/mail` otherwise |
| `S3_*` | Optional S3-compatible photo storage; `.data/uploads` otherwise |
| `NEXT_PUBLIC_APP_URL` | Public origin for links and OG images |
| `CRON_SECRET` | Protects `/api/cron/*` |
| `ENABLE_DEV_LOGIN` | One-click seeded sign-in and the dev mailbox (never in production) |
| `ADMIN_EMAILS` | Admin accounts |

## Routes to visit

| Route | What |
|---|---|
| `/` | Your island (map and list, search flies to a tile, side panel, nudges, next game night) |
| `/log` (or press **L**) | Log a quest (modal on desktop, full page on phones) |
| `/quests`, `/quests/[id]` | Quest log with filters; quest detail with confirm/dispute, reactions, comments |
| `/quests/[id]/complete` | The reward screen (new land, tier-up, crown taken) |
| `/games/[slug]` | Game tile page: tiers, crowns, records, teaching, house records, history |
| `/shelf` | Shelf of shame, bounties, propose to a game night |
| `/nights/new`, `/nights/[id]` | Game nights: RSVP, propose, 3-vote voting |
| `/guilds`, `/g/[slug]` | Guilds: shared island, crowns, campaigns and standings |
| `/u/[handle]` | Character sheet; `/u/[handle]/island`, `/u/[handle]/vs/[other]`, `/u/[handle]/records` |
| `/import` | Import a BG Stats JSON or BGG plays CSV; the island builds itself |
| `/notifications`, `/settings` | Notification center; profile, privacy, guests, blocks, export, delete |
| `/admin` | Reports, custom-game promotion, terrain overrides (admins) |
| `/dev/components` | Every shared component and state |
| `/invite/[code]`, `/g/join/[code]`, `/claim/[token]` | Invite links (auto-friend), guild invites, guest claiming |

Deployment notes are in `DEPLOY.md`.
