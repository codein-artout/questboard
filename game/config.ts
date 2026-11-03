/**
 * Every number and table from design/GAME.md lives here. The rules engine reads
 * only from this file, so tuning the game never means hunting through logic.
 */

export const APP_NAME = "Questboard";

export const TERRAINS = ["forest", "peaks", "meadow", "marsh", "reef", "tundra"] as const;
export type Terrain = (typeof TERRAINS)[number];

export const SCORING_TYPES = ["points", "win_lose", "coop", "ranked", "teams"] as const;
export type ScoringType = (typeof SCORING_TYPES)[number];

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

export const TIERS = [
  { tier: 1, key: "outpost", name: "Outpost", plays: 1, nickname: null },
  { tier: 2, key: "village", name: "Village", plays: 5, nickname: "nickel" },
  { tier: 3, key: "town", name: "Town", plays: 10, nickname: "dime" },
  { tier: 4, key: "keep", name: "Keep", plays: 25, nickname: "quarter" },
  { tier: 5, key: "citadel", name: "Citadel", plays: 50, nickname: null },
  { tier: 6, key: "wonder", name: "Wonder", plays: 100, nickname: "dollar" },
] as const;
export type TierNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ---------------------------------------------------------------------------
// Terrain mapping: checked in order, first match wins (GAME.md "Terrain").
// ---------------------------------------------------------------------------

export type TerrainRule = {
  terrain: Terrain;
  categories?: readonly string[];
  mechanics?: readonly string[];
  /** Matches when the game's maximum player count is exactly this or less. */
  maxPlayersAtMost?: number;
};

export const TERRAIN_RULES: readonly TerrainRule[] = [
  { terrain: "meadow", mechanics: ["Cooperative Game"] },
  { terrain: "marsh", categories: ["Deduction", "Bluffing"], mechanics: ["Hidden Roles"] },
  { terrain: "reef", categories: ["Party Game", "Word Game"] },
  { terrain: "tundra", categories: ["Abstract Strategy"], maxPlayersAtMost: 2 },
  { terrain: "peaks", categories: ["Wargame", "Territory Building"], mechanics: ["Area Majority / Influence"] },
];
export const DEFAULT_TERRAIN: Terrain = "forest";

export const TERRAIN_INFO: Record<Terrain, { name: string; genre: string; face: string; side: string; ink: string }> = {
  forest: { name: "Forest", genre: "Engine builders, euros, tableau", face: "#3E9B5F", side: "#245C38", ink: "#FFFFFF" },
  peaks: { name: "Peaks", genre: "Area control, war, 4X", face: "#C0563A", side: "#7A3222", ink: "#FFFFFF" },
  meadow: { name: "Meadow", genre: "Co-op", face: "#E3B341", side: "#94711F", ink: "#2B2004" },
  marsh: { name: "Marsh", genre: "Deduction, bluffing, hidden roles", face: "#7B5CC4", side: "#4B3582", ink: "#FFFFFF" },
  reef: { name: "Reef", genre: "Party, word", face: "#E86A8A", side: "#9C3F57", ink: "#FFFFFF" },
  tundra: { name: "Tundra", genre: "Abstract, two-player duels", face: "#C9D3DB", side: "#7D8A95", ink: "#16293A" },
};

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

export const CONFIRMATION = {
  /** A quest auto-confirms this long after it was logged, if nobody disputed it. */
  autoConfirmHours: 48,
} as const;

// ---------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------

export const XP = {
  showedUp: 40,
  place: { 1: 30, 2: 20, 3: 10 } as Record<number, number>,
  coopWin: 30,
  coopLoss: 10,
  newLand: 40,
  tierUp: { 2: 20, 3: 30, 4: 50, 5: 80, 6: 150 } as Record<number, number>,
  tookCrown: 40,
  personalBest: 20,
  taughtPerLearner: 20,
  taughtMaxLearners: 3,
  /** Shelf bounty by months owned: first matching row wins. */
  shelfBounty: [
    { maxMonths: 3, xp: 80 },
    { maxMonths: 6, xp: 100 },
    { maxMonths: 12, xp: 120 },
    { maxMonths: Infinity, xp: 150 },
  ],
  /** "Owned for a while": a game must sit on the shelf this long to pay a bounty. */
  shelfBountyMinDays: 7,
  rivalry: 20,
  hosting: 10,
  /** Raid: catalog weight >= raidWeight OR max play time >= raidMinutes. */
  raidWeight: 3.5,
  raidMinutes: 180,
  raidShowedUpMultiplier: 2,
  /** From the Nth play of the same game in one day, award half XP. */
  grindFromPlay: 4,
  grindMultiplier: 0.5,
  /** At most this many quests a day count toward XP. */
  dailyQuestCap: 12,
  /** Imported plays count toward level XP at this rate. */
  importMultiplier: 0.5,
  /** Campaign finale quests are worth this multiple. */
  finaleMultiplier: 2,
} as const;

export type XpSource =
  | "showed_up"
  | "place"
  | "coop"
  | "new_land"
  | "tier_up"
  | "took_crown"
  | "personal_best"
  | "taught"
  | "shelf_bounty"
  | "rivalry"
  | "hosting"
  | "raid"
  | "grind"
  | "daily_cap"
  | "imported"
  | "finale";

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return 500 + 250 * (level - 1);
}

// ---------------------------------------------------------------------------
// Crowns
// ---------------------------------------------------------------------------

export const CROWNS = {
  /** Win-lose / ranked / teams crowns need this many plays. */
  winRateMinPlays: 5,
  /** A crown can only come from a quest with at least this many registered players. */
  minRegisteredPlayers: 2,
} as const;

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

export const CLASS = {
  windowMonths: 12,
  /** Below this many plays in the window, use all-time plays. */
  minPlaysForWindow: 30,
  /** Hybrid when the top two terrains' shares are within this many points. */
  hybridWithin: 0.1,
} as const;

export const BASE_CLASSES: Record<Terrain, string> = {
  forest: "The Architect",
  peaks: "The Warlord",
  meadow: "The Warden",
  marsh: "The Oracle",
  reef: "The Trickster",
  tundra: "The Strategist",
};

/** The 15 hand-named hybrids. Keys are the two terrains in TERRAINS order. */
export const HYBRID_CLASSES: Record<string, string> = {
  "forest+peaks": "The Conqueror",
  "forest+meadow": "The Steward",
  "forest+marsh": "The Schemer",
  "forest+reef": "The Showrunner",
  "forest+tundra": "The Engineer",
  "peaks+meadow": "The Marshal",
  "peaks+marsh": "The Spymaster",
  "peaks+reef": "The Gladiator",
  "peaks+tundra": "The Tactician",
  "meadow+marsh": "The Seer",
  "meadow+reef": "The Bard",
  "meadow+tundra": "The Sentinel",
  "marsh+reef": "The Jester",
  "marsh+tundra": "The Sphinx",
  "reef+tundra": "The Wildcard",
};

export const NO_CLASS = { key: "none", name: "The Wanderer" } as const;

// ---------------------------------------------------------------------------
// Nemesis, teaching, titles, campaigns
// ---------------------------------------------------------------------------

export const NEMESIS = {
  windowDays: 90,
  minMeetings: 5,
} as const;

export const TEACHING = {
  evangelistLearners: 10,
  missionarySpread: 25,
} as const;

export const SHELF = {
  shelfClearedMinOwned: 10,
} as const;

export const VOTING = {
  votesPerPerson: 3,
} as const;

export const CAMPAIGN = {
  defaultWeeks: 10,
} as const;

export const GUILD = {
  /** A guild tile needs this many members present. */
  minMembersForTile: 3,
  founderQuests: 10,
} as const;

export const TITLE_RULES = {
  bridesmaidStreak: 5,
  kingmakerMargin: 1,
  kingmakerMinPlayers: 3,
  survivedGalaxyMinutes: 300,
  polyglotGames: 25,
  dimeBagGames: 10,
  crownCollector: 5,
  usurperCrowns: 3,
  usurperWindowDays: 30,
  nightOwlQuests: 10,
  /** Local end hour range counted as "after midnight": [0, nightOwlUntilHour). */
  nightOwlUntilHour: 5,
  comebackLosses: 3,
  underdogRate: 0.7,
  underdogMinMeetings: 5,
  hostWithTheMost: 50,
  raiderRaids: 10,
  marathonQuests: 8,
  regularWeeks: 8,
  fortifiedCitadels: 3,
  mentorGames: 5,
  socialitePeople: 20,
  teamPlayerWins: 25,
  openHousePeople: 10,
  trailblazerNewLands: 5,
  trailblazerWindowDays: 30,
  heavyweightWeight: 4,
  heavyweightPlays: 10,
} as const;

export const RATE_LIMITS = {
  logQuest: { limit: 30, windowSec: 3600 },
  comment: { limit: 60, windowSec: 3600 },
  reaction: { limit: 300, windowSec: 3600 },
  friendRequest: { limit: 50, windowSec: 86400 },
  report: { limit: 20, windowSec: 86400 },
  signIn: { limit: 6, windowSec: 900 },
  signInIp: { limit: 40, windowSec: 900 },
  import: { limit: 10, windowSec: 86400 },
  upload: { limit: 30, windowSec: 3600 },
  search: { limit: 600, windowSec: 600 },
} as const;
