# Questboard design spec (v1, web first)

"Questboard" is a working name. Keep it in one config constant so it can be renamed.

**Scope:** v1 is a **desktop web app**. It must still work at phone width (390px) because people will open shared links on their phones, but native-feeling mobile features (PWA, offline, push) come later.

Reference mockups are in `design/screens/*.dc.html`. **`DesktopIsland.dc.html` and `DesktopTile.dc.html` are the primary references.** They define the desktop shell (nav rail, main column, side panel) and how a screen is arranged at 1440px. Build every other page in that shell. The remaining mockups are drawn at phone size (390px): use them for **components, colors, type, copy and the content of each screen**, place them in the desktop shell on desktop, and match them at phone width. Each mockup is a self-contained HTML file with a small templating runtime (`<x-dc>`, `<sc-for>`, `{{holes}}`). Read the markup for exact values and rebuild everything as real React components. Don't copy the runtime. The game rules are in `design/GAME.md`, which wins over any mockup copy that disagrees with it.

| Screen | File | Route | Notes |
|---|---|---|---|
| Your island (home), desktop | `DesktopIsland.dc.html` | `/` | **Primary.** Shell, the island at 76px tiles with full names, a side-panel tile card, nudges |
| Game tile page, desktop | `DesktopTile.dc.html` | `/games/[slug]` | **Primary.** Main column (tiers, records, history) plus a side panel (crown, teaching, house records) |
| Your island, phone | `Main.dc.html` | `/` below 900px | One tile per game, monograms, tap to select, map/list switch |
| Game tile page, phone | `TileDetail.dc.html` | `/games/[slug]` below 900px | The same content stacked in one column |
| Replay reward | `QuestCompleteReplay.dc.html` | `/quests/[id]/complete` | Tier-up, crown taken, personal best |
| New-game reward | `QuestComplete.dc.html` | `/quests/[id]/complete` | Visual reference only; its copy uses the old per-play model. Use "New land: Cascadia" copy per GAME.md |
| Shelf of shame | `Shelf.dc.html` | `/shelf` | Unplayed owned games, bounties, game-night vote |
| Quest log | `QuestLog.dc.html` | `/quests` | Reward chips must follow GAME.md (tier-ups, crowns, new land) |
| Log a quest | `LogPlay.dc.html` | `/log` (a modal over any page on desktop) | |
| Character sheet | `Character.dc.html` | `/u/[handle]` | "Mastery by region" becomes "Regions": games per terrain. Headline stat is h-index |
| Guild | `Guild.dc.html` | `/g/[slug]` | The guild island shows a crown on each tile with its holder's disc |
| Share card | `ShareCard.dc.html` | `opengraph-image` routes | 1200×630 |

## The idea

The app is a game about playing board games. **Your world is a hex island in a dark sea. Every game you've played is one tile.** New games add land (breadth). Replays build upward on that game's tile, from Outpost to Wonder (depth). Crowns mark who holds each game's record in a group. Unplayed games on your shelf float offshore as "?" tiles. The island is the hero of the app, and everything else stays calm.

## Desktop layout

```
≥1200px
┌────────────┬──────────────────────────────────────┬────────────────┐
│ Nav rail   │ Search games…        [Map | List]    │ Side panel     │
│ 232px      │                                      │ 360px          │
│ Wordmark   │          THE ISLAND                  │ Selected tile  │
│ Island     │   (fills the column, pan + zoom,     │  card: name,   │
│ Quests     │    zoom in to see full names)        │  tier, plays,  │
│ Shelf      │                                      │  crown, Open   │
│ Guilds     │                                      │ ─────────────  │
│ Me         │                                      │ Next quest     │
│            │                                      │ Nudges ("Azul  │
│ [Log a     │                                      │  is 3 plays    │
│  quest]    │                                      │  from a Keep") │
└────────────┴──────────────────────────────────────┴────────────────┘
900–1199px: rail + main. The side panel becomes a slide-over drawer that opens when a tile is selected.
<900px: single column exactly like the phone mockups, with the bottom tab bar and the hex Log button.
```

- The rail's primary action is a gold "Log a quest" button with a hex icon. On desktop, logging opens as a centered modal (560px) over the current page. Keyboard shortcut: `L`.
- Other pages use a content column (max 760px) in the main area. The side panel holds context, such as the crown and records on a tile page, or standings on a guild page.
- The island map grows to fill the available space with tiles of at least 64px wide on desktop. Monograms become full names once a tile is 72px or wider.
- Search ("Find a game on your island") flies the map to that tile and selects it.

## Color tokens

```
--sea:         #0F2E45   app background
--sea-deep:    #0A2236   rail, tab bar, bottom bars, inset tracks, segmented controls
--panel:       #17405E   panels
--panel-rule:  #23506F   dividers inside panels
--sea-line:    #1C4462   hairlines on sea-deep
--outline:     #2D5878   secondary button and pill borders
--text:        #EAF2F7
--text-muted:  #9DB7C9   (passes 4.5:1 on sea and on panel)
--gold:        #F5C84B   XP, primary actions, selection, crowns, current tier. Text on gold: #0F2E45
--title-bg:    #2A2353   titles and achievements
--title-ink:   #C7B5F2
```

**Terrains:** each has a face color, a side color (the extruded edge) and an ink color for the building and monogram.

| Terrain | Genre | Face | Side | Ink |
|---|---|---|---|---|
| Forest | Engine builders, euros, tableau | #3E9B5F | #245C38 | #FFFFFF |
| Peaks | Area control, war, 4X | #C0563A | #7A3222 | #FFFFFF |
| Meadow | Co-op | #E3B341 | #94711F | #2B2004 |
| Marsh | Deduction, bluffing, hidden roles | #7B5CC4 | #4B3582 | #FFFFFF |
| Reef | Party, word | #E86A8A | #9C3F57 | #FFFFFF |
| Tundra | Abstract, two-player duels | #C9D3DB | #7D8A95 | #16293A |

**Player colors** stay as each person's identity disc: red #C8323B, blue #2459B8, yellow #E8A80C (dark text), green #2E7D4F, purple #6A3FA5, orange #E0662A (dark text), black #23252B, and white #FFFFFF (dark text, 2px dark inset ring).

## Type

- **Big Shoulders Display** (600–900) for game names, monograms, scores, XP and headings.
- **Archivo** (400–800) for UI and body text.
- Tabular numerals. Sentence case. No all-caps labels.

## Components

- **HexTile**: pointy-top hex via `clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)`. A side layer sits offset downward under the face layer, which gives the cardboard depth. The face holds the **tier building** with the **monogram** under it. A gold crown badge sits at the top-right if the viewer holds that game's crown. Selected tiles get a gold hex halo. Shelf tiles are "?" in panel color. Unexplored slots are faint (`rgba(255,255,255,0.05)`).
- **Tier buildings**: six filled glyphs, with exact SVG paths in `Main.dc.html` and `TileDetail.dc.html` (Outpost flag, Village, Town, Keep, Citadel, Wonder). Building size grows with tier.
- **Monogram**: up to about 8 characters of the game name, with short forms for long names ("T. Mars", "BotC", "TI4"). Generate it automatically, let users edit their own, and swap in the full name once there's room.
- **IslandMap**: axial hex coordinates, rendered as SVG or positioned divs (no canvas). Supports pan, zoom (wheel, pinch, + and − buttons), keyboard navigation between tiles (arrow keys), select on click or Enter, and a full accessible list alternative via the Map/List switch. The accessible label states the tile count and the top three games.
- **Tile card** (side panel or under the map): name, tier, plays, plays to the next tier, crown holder, and an Open button.
- **Tier ladder**: six hexes. Done tiers are in the terrain color, the current one is gold, and future ones are dim. Each shows its threshold.
- **Crown card**: gold panel showing who holds it, with what, and the gap to take it.
- **PlayerDisc**, **Quest card**, **Reward chip**, **XP bar**, and the gold hex Log button work as in the mockups.
- **Icons**: lucide-react at 2px stroke. Never emoji.

## Motion

There is one big moment, the reward screen, and it's different for each case:
- **New land:** the new tile flies from the reward card to its slot on the island and drops with a short bounce.
- **Tier-up:** the old building sinks and the new one rises, with a gold halo pulse.
- **Crown taken:** the crown slides from the old holder's disc to yours.
- In every case the XP lines count up one at a time and then the bar fills.

Map pan and zoom are smooth (CSS transforms). Nothing else animates on load. Respect `prefers-reduced-motion`.

## Copy voice

Light game flavor, plain meaning. Examples: "Complete quest", "New land: Cascadia", "Wingspan rises to a Keep", "You took the Wingspan crown from Arjun", "Azul is 3 plays from a Keep", "Your island is waiting. Import your play history or log your first quest." The only game words are *quest*, *party*, *guild*, *raid*, *campaign*, *title*, *crown*, *island*, *tile*, the tier names, and *shelf of shame*. Never write fantasy prose.

## Game data

There's no BoardGameGeek integration in v1. Game data comes from our own catalog (see the build prompt). Any mockup text mentioning BoardGameGeek ("Game data from BoardGameGeek", "weight 1.8 on BoardGameGeek", "Import your plays from BoardGameGeek") is outdated: drop the attribution and say "Import your play history" instead. No box art in v1: a game is represented by its tile.

## Don'ts

No gradient washes, no glassmorphism, no emoji, no tracked all-caps eyebrow labels, no stock fantasy art, no box art. The sea stays flat. The island is the decoration. Never just stretch the phone layout on desktop.
