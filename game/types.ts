import type { ScoringType, Terrain, XpSource } from "./config";

/** Inputs: plain data, no database types, so the engine stays pure. */

export type EngineUser = { id: string; name: string };

export type EngineGame = {
  id: string;
  name: string;
  /** Global terrain (admin override applied). */
  terrain: Terrain;
  weight: number | null;
  maxTime: number | null;
  scoring: ScoringType;
  baseGameId: string | null;
};

export type EngineParticipant = {
  userId: string | null;
  guestId: string | null;
  name: string;
  team: string | null;
  score: number | null;
  midScore: number | null;
  place: number | null;
};

export type EngineQuest = {
  id: string;
  gameId: string;
  playedAt: Date;
  createdAt: Date;
  localDate: string;
  tzOffsetMin: number;
  durationMin: number | null;
  status: "pending" | "confirmed" | "disputed";
  source: "live" | "import";
  loggedById: string | null;
  hostUserId: string | null;
  guildId: string | null;
  gameNightId: string | null;
  coop: boolean;
  coopWin: boolean | null;
  difficulty: number | null;
  quantity: number;
  participants: EngineParticipant[];
};

export type EngineShelfItem = { userId: string; gameId: string; acquiredAt: Date };

export type EngineGuild = { id: string; name: string; founderId: string | null; memberIds: string[] };

export type EngineCampaign = {
  id: string;
  guildId: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  finaleNightIds: string[];
};

export type ExistingTile = {
  userId: string;
  gameId: string;
  q: number;
  r: number;
  terrainOverride: Terrain | null;
};

export type ExistingGuildTile = { guildId: string; gameId: string; q: number; r: number };

export type EngineInput = {
  now: Date;
  users: EngineUser[];
  games: EngineGame[];
  quests: EngineQuest[];
  shelf: EngineShelfItem[];
  /** Accepted friendships as [userA, userB] pairs. */
  friendships: [string, string][];
  guilds: EngineGuild[];
  campaigns: EngineCampaign[];
  existingTiles: ExistingTile[];
  existingGuildTiles: ExistingGuildTile[];
  /** Terrain overrides players set on their own tiles, keyed `${userId}:${gameId}`. */
  tileTerrainOverrides?: Record<string, Terrain>;
};

/** Outputs. */

export type XpLine = { source: XpSource; label: string; amount: number };

export type CrownEvent = {
  scopeKey: string;
  guildId: string | null;
  gameId: string;
  fromUserId: string | null;
  fromName: string | null;
  record: string;
};

export type QuestOutcomePayload = {
  status: "confirmed" | "pending";
  gameId: string;
  /** Tile (base) game id the play counted toward. */
  tileGameId: string;
  lines: XpLine[];
  xp: number;
  place: number | null;
  tied: boolean;
  coopWin: boolean | null;
  plays: number;
  newLand: { terrain: Terrain; tileCount: number } | null;
  tierUp: { from: number; to: number } | null;
  crownsTaken: CrownEvent[];
  crownsClaimed: CrownEvent[];
  personalBest: { score: number; previous: number } | null;
  level: { before: number; after: number; xpIntoLevel: number; xpForNext: number; xpIntoBefore: number };
  classChange: { fromKey: string; fromName: string; toKey: string; toName: string } | null;
  titles: { id: string; name: string }[];
  /** Title closest to unlocking after this quest, for the reward screen. */
  nearTitle: { id: string; name: string; text: string } | null;
  raid: boolean;
  imported: boolean;
};

export type TileOut = {
  userId: string;
  gameId: string;
  q: number;
  r: number;
  plays: number;
  pendingPlays: number;
  tier: number;
  firstPlayedAt: Date | null;
  lastPlayedAt: Date | null;
  bestScore: number | null;
  wins: number;
};

export type LedgerOut = {
  userId: string;
  questId: string;
  source: XpSource;
  amount: number;
  status: "confirmed" | "pending";
  guildId: string | null;
  campaignId: string | null;
  at: Date;
};

export type CrownOut = {
  scopeKey: string;
  gameId: string;
  guildId: string | null;
  ownerUserId: string | null;
  holderUserId: string | null;
  holderGroup: string[];
  heldByGuild: boolean;
  recordValue: number;
  recordLabel: string;
  since: Date;
  questId: string | null;
};

export type CrownChangeOut = {
  scopeKey: string;
  gameId: string;
  guildId: string | null;
  fromUserId: string | null;
  toUserId: string | null;
  questId: string;
  at: Date;
};

export type HouseRecordKind =
  | "highest_score"
  | "lowest_winning_score"
  | "fastest"
  | "longest"
  | "comeback"
  | "largest_party";

export type HouseRecordOut = {
  hostUserId: string;
  gameId: string;
  kind: HouseRecordKind;
  value: number;
  holderUserId: string | null;
  holderName: string;
  questId: string;
  achievedAt: Date;
  detail: string | null;
};

export type TaughtByOut = { gameId: string; teacherId: string; learnerId: string; questId: string; at: Date };

export type TitleAwardOut = { userId: string; titleId: string; name: string; earnedAt: Date; questId: string | null };

export type TitleProgress = {
  id: string;
  name: string;
  rule: string;
  earned: boolean;
  current: number;
  target: number;
  text: string;
};

export type StatsOut = {
  userId: string;
  xp: number;
  pendingXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  classKey: string;
  className: string;
  hIndex: number;
  gamesExplored: number;
  totalPlays: number;
  wins: number;
  raids: number;
  wonders: number;
  citadels: number;
  crownsHeld: number;
  peopleTaught: number;
  nemesisId: string | null;
  nemesisWins: number;
  nemesisLosses: number;
  nemesisMeetings: number;
  terrainPlays: Record<Terrain, number>;
  titleProgress: TitleProgress[];
};

export type GuildTileOut = { guildId: string; gameId: string; q: number; r: number; plays: number; tier: number };

export type CampaignStandingOut = { campaignId: string; userId: string; xp: number; rank: number };

export type EngineOutput = {
  tiles: TileOut[];
  ledger: LedgerOut[];
  outcomes: { questId: string; userId: string; status: "confirmed" | "pending"; xp: number; payload: QuestOutcomePayload }[];
  crowns: CrownOut[];
  crownChanges: CrownChangeOut[];
  houseRecords: HouseRecordOut[];
  taughtBy: TaughtByOut[];
  titles: TitleAwardOut[];
  stats: StatsOut[];
  guildTiles: GuildTileOut[];
  campaignStandings: CampaignStandingOut[];
  campaignChampions: { campaignId: string; userId: string | null }[];
};
