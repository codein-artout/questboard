# Questboard game rules (v1)

The game is driven entirely by real board-game plays. Logging must stay under 30 seconds: every rule here runs **after** a quest is saved, and nothing asks the player for extra input.

Put every number in `game/config.ts`. Write the rules engine as pure, deterministic functions (history in, state and rewards out), with exhaustive unit tests. All derived state (tiles, tiers, XP, crowns, titles, records) can be recomputed from history (`pnpm game:recompute`). Never hand-edit counters.

## Core model

- **Quest**: one logged play of one game. The people who played are the **party**, including guests.
- **Tile**: one per distinct game a player has played (expansions count toward their base game). A player's island is their set of tiles.
- **Tier**: a tile's level, set by that player's play count of the game:

| Tier | Plays | Board-gamer name |
|---|---|---|
| Outpost | 1 | |
| Village | 5 | nickel |
| Town | 10 | dime |
| Keep | 25 | quarter |
| Citadel | 50 | |
| Wonder | 100 | dollar |

- **Confirmation**: a quest counts toward XP, crowns and campaigns only after one other registered party member confirms it, or 48 hours pass with no dispute. A pending quest shows on the island as a ghost tile or ghost tier-up.

## Terrain (a game's genre)

The terrain is derived from the catalog's category and mechanic tags (use the standard board-game vocabulary: "Cooperative Game", "Deduction", "Party Game", etc.), checking in this order and taking the first match:
1. **Meadow**: has the "Cooperative Game" mechanic.
2. **Marsh**: the "Deduction" or "Bluffing" category, or the "Hidden Roles" mechanic.
3. **Reef**: the "Party Game" or "Word Game" category.
4. **Tundra**: the "Abstract Strategy" category, or maximum players is 2.
5. **Peaks**: the "Wargame" or "Territory Building" category, or the "Area Majority / Influence" mechanic.
6. **Forest**: everything else (euros, engine builders, tableau).

Put the mapping table in config. A player can override the terrain on their own tile, and an admin can override it for a game globally.

## Island layout

- Tiles fill outward ring by ring around the center. New tiles go to the free slot adjacent to the most tiles of the same terrain, so regions form. Break ties by ring distance, then by a stable hash.
- The island's radius grows as needed. Always show one ring of unexplored slots beyond the outermost tile.
- Shelf games (owned, never played) sit as "?" tiles on the outermost ring.
- A tile's position is fixed once placed. Recompute keeps existing positions and only places new tiles.

## XP (per player, per confirmed quest)

| Source | XP |
|---|---|
| Showed up | 40 |
| Place | 1st 30, 2nd 20, 3rd 10. Co-op win: 30 each. Co-op loss: 10 each. |
| New land (first time playing this game) | 40 |
| Tier-up on this quest | Village 20, Town 30, Keep 50, Citadel 80, Wonder 150 |
| Took a crown | 40 |
| Personal best score | 20 |
| Taught: someone in the party played this game for the first time, and you'd played it before | 20 per learner, at most 3 per quest |
| Shelf bounty: first play of a game you've owned for a while | 80 for up to 3 months owned, 100 up to 6, 120 up to 12, 150 beyond |
| Rivalry (quest includes your nemesis) | 20 |
| Hosting (quest at your place) | 10 |
| Raid (catalog weight ≥ 3.5 on a 1–5 scale, or play time ≥ 180 min) | ×2 on showed-up XP |

- Ties share the higher place's XP.
- **Grinding cap:** from the 4th play of the same game in one day, award half XP.
- At most 12 quests a day count toward XP.
- Levels need `500 + 250 × (level − 1)` XP each.

## Crowns

- Crowns are scoped to a **guild**: each game has at most one crown per guild. There's also a global "friends crown" across your friends list, shown on your personal island.
- The holder is whoever has the best record on that game, judged by the game's scoring type:
  - **Points games:** highest single confirmed score.
  - **Win-lose and ranked games:** best win rate with at least 5 plays, tie broken by most wins.
  - **Co-op games:** the crown belongs to the group with the most wins at the highest difficulty, shown as "held by the guild".
- When a crown changes hands, both players get notified, and the change appears in the guild feed.

## House records

A host's place is a **landmark** on their island. For every game played there, keep records: highest score, lowest winning score, fastest game, longest game, biggest comeback (most positions gained from the midpoint, when scores are entered at the midpoint), and largest party. Show them on the game tile page as "House records at your place", and as a records board on the host's profile.

## Teaching lineage

- When a party member plays a game for the first time with someone who'd played it before, record a **TaughtBy** edge. If several experienced players were present, pick the host first, then whoever has the most plays.
- On the learner's tile: "Taught by Ciao".
- On the teacher's tile: "You taught it to N people", plus spread, which is how many islands it reached through the people you taught (the full descendant count).
- Titles: **Evangelist** (taught one game to 10 people) and **Missionary** (one game spread to 25 islands).
- Guests count as learners once they claim their account.

## Shelf of shame

- A player's shelf comes from their collection (manual adds, or a collection file import), plus games marked owned when logging. A shelf game is an owned game with zero plays.
- The bounty grows with time owned (see the XP table).
- **Propose**: add a shelf game to an upcoming game night's vote.
- Title: **Shelf Cleared** (owned games with zero plays drops to 0 while you own at least 10 games).

## Game nights and voting

- A game night has a date, a host, a place and a guild (optional), plus RSVPs (going, maybe, can't).
- **What to play:** members propose games from the host's shelf or collection, and everyone gets 3 votes. The top games show on the night's card. When the night happens, the "log a quest" flow suggests those games first.

## Class

A player's class comes from the terrain distribution of their plays over the last 12 months (all time if they have fewer than 30 plays). It uses the top terrain, or a hybrid when the top two are within 10%:

| Main terrain | Class |
|---|---|
| Forest | The Architect |
| Peaks | The Warlord |
| Meadow | The Warden |
| Marsh | The Oracle |
| Reef | The Trickster |
| Tundra | The Strategist |

There are 15 hand-named hybrids in config (e.g. Forest + Peaks is "The Conqueror"). When a player's class changes, show it on the reward screen.

## Headline stats

h-index (n games played at least n times each), games explored, total plays, wonders and citadels, crowns held, and people taught.

## Titles

Ship at least 25. Each has an id, name, rule and progress text. Include: Bridesmaid (five 2nd places in a row), Kingmaker (last place in a game won by 1 point or less), Survived the Galaxy (a raid of 300 min or more), Cartographer (every terrain), Polyglot (25 games), Centurion (any game at Wonder), Dime Bag (10 games at Town or higher), Evangelist, Missionary, Shelf Cleared, Crown Collector (5 crowns held at once), Usurper (took 3 crowns in a month), Night Owl (10 quests ending after midnight), Comeback (won after 3 straight losses in the same game), Underdog (beat someone with a 70%+ head-to-head record against you), Host with the Most (50 quests hosted), and Founder (started a guild that reached 10 quests). Players choose one title to display next to their name.

## Nemesis

Your nemesis is the person you've played most in competitive quests over the last 90 days (at least 5 meetings), choosing whoever is closest to a 50/50 record. Their head-to-head is shown on your character sheet.

## Guilds and campaigns

- A guild is a group. It has a shared island (one tile per game the guild has played together with at least 3 members present, with tiers counted by guild plays), crowns, game nights and campaigns.
- A **campaign** is a season (default 10 weeks). Standings rank campaign XP (XP from that guild's quests only). It ends with a scheduled finale night worth double XP, and the winner earns a permanent champion title.

## History imports (file upload, no external API)

- Players can upload an export from another play logger: a **BG Stats** JSON export or a **BoardGameGeek plays CSV** downloaded from the BGG website. Write a parser for each, behind an `importers/` interface, so more formats can be added later.
- Imported plays build the island, tiers, records and stats. They're marked as imported and count toward level XP at 50%, but **don't** count toward crowns, guild campaigns, or titles involving other people, since nobody confirmed them. Player names in the file are matched to friends where possible, and otherwise kept as guests.
- Games in the file that aren't in the catalog are matched by name and year (fuzzy), or created as custom games for the player to confirm.
- Imports are idempotent, keyed by the source's play id, or by a hash of game, date and players.

## Anti-cheat and fairness

- Only confirmed quests count for XP, crowns and campaigns. A disputed quest earns nothing until it's resolved.
- Guests earn nothing until they claim their account, at which point their history backfills and everything recomputes.
- Editing a confirmed quest's scores sends it back for confirmation.
- A crown can only come from a quest with at least one other registered player.
