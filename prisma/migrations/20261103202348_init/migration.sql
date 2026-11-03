-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Privacy" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVATE');

-- CreateEnum
CREATE TYPE "PlayerColor" AS ENUM ('red', 'blue', 'yellow', 'green', 'purple', 'orange', 'black', 'white');

-- CreateEnum
CREATE TYPE "Terrain" AS ENUM ('forest', 'peaks', 'meadow', 'marsh', 'reef', 'tundra');

-- CreateEnum
CREATE TYPE "ScoringType" AS ENUM ('points', 'win_lose', 'coop', 'ranked', 'teams');

-- CreateEnum
CREATE TYPE "GameSource" AS ENUM ('catalog', 'custom');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('pending', 'confirmed', 'disputed');

-- CreateEnum
CREATE TYPE "QuestSource" AS ENUM ('live', 'import');

-- CreateEnum
CREATE TYPE "ConfirmationKind" AS ENUM ('confirm', 'dispute');

-- CreateEnum
CREATE TYPE "FriendStatus" AS ENUM ('pending', 'accepted');

-- CreateEnum
CREATE TYPE "ShelfSource" AS ENUM ('manual', 'onboarding', 'import', 'logged');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('going', 'maybe', 'cant');

-- CreateEnum
CREATE TYPE "GuildRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "GameNightStatus" AS ENUM ('scheduled', 'cancelled');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('user', 'quest', 'comment', 'game');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('confirmed', 'pending');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "handle" TEXT,
    "displayName" TEXT,
    "color" "PlayerColor" NOT NULL DEFAULT 'blue',
    "privacy" "Privacy" NOT NULL DEFAULT 'FRIENDS',
    "role" "Role" NOT NULL DEFAULT 'USER',
    "displayedTitleId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "inviteCode" TEXT NOT NULL,
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "claimToken" TEXT NOT NULL,
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "altNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "short" TEXT,
    "year" INTEGER,
    "minPlayers" INTEGER,
    "maxPlayers" INTEGER,
    "minTime" INTEGER,
    "maxTime" INTEGER,
    "weight" DOUBLE PRECISION,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mechanics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scoring" "ScoringType" NOT NULL DEFAULT 'points',
    "terrain" "Terrain" NOT NULL,
    "terrainOverride" "Terrain",
    "baseGameId" TEXT,
    "source" "GameSource" NOT NULL DEFAULT 'catalog',
    "createdById" TEXT,
    "needsConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "searchText" TEXT NOT NULL DEFAULT '',
    "wikidataId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "loggedById" TEXT,
    "guildId" TEXT,
    "gameNightId" TEXT,
    "hostUserId" TEXT,
    "location" TEXT,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "localDate" TEXT NOT NULL,
    "tzOffsetMin" INTEGER NOT NULL DEFAULT 0,
    "durationMin" INTEGER,
    "coop" BOOLEAN NOT NULL DEFAULT false,
    "coopWin" BOOLEAN,
    "difficulty" INTEGER,
    "teams" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "photoKey" TEXT,
    "status" "QuestStatus" NOT NULL DEFAULT 'pending',
    "source" "QuestSource" NOT NULL DEFAULT 'live',
    "importJobId" TEXT,
    "sourceKey" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "autoConfirmAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestParticipant" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "team" TEXT,
    "score" DOUBLE PRECISION,
    "midScore" DOUBLE PRECISION,
    "place" INTEGER,
    "seat" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuestParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Confirmation" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ConfirmationKind" NOT NULL,
    "reason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestDraft" (
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestDraft_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Tile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "pendingPlays" INTEGER NOT NULL DEFAULT 0,
    "tier" INTEGER NOT NULL DEFAULT 0,
    "firstPlayedAt" TIMESTAMP(3),
    "lastPlayedAt" TIMESTAMP(3),
    "bestScore" DOUBLE PRECISION,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "monogramOverride" TEXT,
    "terrainOverride" "Terrain",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "LedgerStatus" NOT NULL DEFAULT 'confirmed',
    "guildId" TEXT,
    "campaignId" TEXT,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XpLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestOutcome" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "LedgerStatus" NOT NULL,
    "xp" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "QuestOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crown" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "guildId" TEXT,
    "ownerUserId" TEXT,
    "holderUserId" TEXT,
    "holderGroup" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "heldByGuild" BOOLEAN NOT NULL DEFAULT false,
    "recordValue" DOUBLE PRECISION NOT NULL,
    "recordLabel" TEXT NOT NULL,
    "since" TIMESTAMP(3) NOT NULL,
    "questId" TEXT,

    CONSTRAINT "Crown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrownChange" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "guildId" TEXT,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "questId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrownChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseRecord" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "holderUserId" TEXT,
    "holderName" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "detail" TEXT,

    CONSTRAINT "HouseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaughtBy" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaughtBy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TitleAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "questId" TEXT,

    CONSTRAINT "TitleAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerStats" (
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "pendingXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xpIntoLevel" INTEGER NOT NULL DEFAULT 0,
    "xpForNext" INTEGER NOT NULL DEFAULT 500,
    "classKey" TEXT NOT NULL DEFAULT 'none',
    "className" TEXT NOT NULL DEFAULT 'The Wanderer',
    "hIndex" INTEGER NOT NULL DEFAULT 0,
    "gamesExplored" INTEGER NOT NULL DEFAULT 0,
    "totalPlays" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "raids" INTEGER NOT NULL DEFAULT 0,
    "wonders" INTEGER NOT NULL DEFAULT 0,
    "citadels" INTEGER NOT NULL DEFAULT 0,
    "crownsHeld" INTEGER NOT NULL DEFAULT 0,
    "peopleTaught" INTEGER NOT NULL DEFAULT 0,
    "nemesisId" TEXT,
    "nemesisWins" INTEGER NOT NULL DEFAULT 0,
    "nemesisLosses" INTEGER NOT NULL DEFAULT 0,
    "nemesisMeetings" INTEGER NOT NULL DEFAULT 0,
    "terrainPlays" JSONB NOT NULL DEFAULT '{}',
    "titleProgress" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerStats_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ShelfItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "ShelfSource" NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShelfItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameNight" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "guildId" TEXT,
    "campaignId" TEXT,
    "isFinale" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "notes" TEXT,
    "status" "GameNightStatus" NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameNight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rsvp" (
    "id" TEXT NOT NULL,
    "gameNightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightProposal" (
    "id" TEXT NOT NULL,
    "gameNightId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NightProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "gameNightId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "founderId" TEXT,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildMember" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GuildRole" NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildTile" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "plays" INTEGER NOT NULL,
    "tier" INTEGER NOT NULL,

    CONSTRAINT "GuildTile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "championUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignStanding" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "CampaignStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT,
    "targetType" "ReportTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'queued',
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "payload" JSONB,
    "error" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteCode_key" ON "User"("inviteCode");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

-- CreateIndex
CREATE INDEX "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_claimToken_key" ON "Guest"("claimToken");

-- CreateIndex
CREATE INDEX "Guest_ownerId_idx" ON "Guest"("ownerId");

-- CreateIndex
CREATE INDEX "Guest_claimedById_idx" ON "Guest"("claimedById");

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE INDEX "Game_baseGameId_idx" ON "Game"("baseGameId");

-- CreateIndex
CREATE INDEX "Game_createdById_idx" ON "Game"("createdById");

-- CreateIndex
CREATE INDEX "Game_source_idx" ON "Game"("source");

-- CreateIndex
CREATE INDEX "Game_searchText_trgm_idx" ON "Game" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Quest_gameId_playedAt_idx" ON "Quest"("gameId", "playedAt");

-- CreateIndex
CREATE INDEX "Quest_loggedById_playedAt_idx" ON "Quest"("loggedById", "playedAt");

-- CreateIndex
CREATE INDEX "Quest_guildId_playedAt_idx" ON "Quest"("guildId", "playedAt");

-- CreateIndex
CREATE INDEX "Quest_gameNightId_idx" ON "Quest"("gameNightId");

-- CreateIndex
CREATE INDEX "Quest_hostUserId_idx" ON "Quest"("hostUserId");

-- CreateIndex
CREATE INDEX "Quest_importJobId_idx" ON "Quest"("importJobId");

-- CreateIndex
CREATE INDEX "Quest_status_autoConfirmAt_idx" ON "Quest"("status", "autoConfirmAt");

-- CreateIndex
CREATE INDEX "Quest_playedAt_id_idx" ON "Quest"("playedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Quest_loggedById_sourceKey_key" ON "Quest"("loggedById", "sourceKey");

-- CreateIndex
CREATE INDEX "QuestParticipant_userId_questId_idx" ON "QuestParticipant"("userId", "questId");

-- CreateIndex
CREATE INDEX "QuestParticipant_guestId_idx" ON "QuestParticipant"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestParticipant_questId_userId_key" ON "QuestParticipant"("questId", "userId");

-- CreateIndex
CREATE INDEX "Confirmation_userId_idx" ON "Confirmation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Confirmation_questId_userId_key" ON "Confirmation"("questId", "userId");

-- CreateIndex
CREATE INDEX "Tile_gameId_idx" ON "Tile"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Tile_userId_gameId_key" ON "Tile"("userId", "gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Tile_userId_q_r_key" ON "Tile"("userId", "q", "r");

-- CreateIndex
CREATE INDEX "XpLedger_userId_status_at_idx" ON "XpLedger"("userId", "status", "at");

-- CreateIndex
CREATE INDEX "XpLedger_questId_idx" ON "XpLedger"("questId");

-- CreateIndex
CREATE INDEX "XpLedger_guildId_idx" ON "XpLedger"("guildId");

-- CreateIndex
CREATE INDEX "XpLedger_campaignId_idx" ON "XpLedger"("campaignId");

-- CreateIndex
CREATE INDEX "QuestOutcome_userId_idx" ON "QuestOutcome"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestOutcome_questId_userId_key" ON "QuestOutcome"("questId", "userId");

-- CreateIndex
CREATE INDEX "Crown_gameId_idx" ON "Crown"("gameId");

-- CreateIndex
CREATE INDEX "Crown_guildId_idx" ON "Crown"("guildId");

-- CreateIndex
CREATE INDEX "Crown_ownerUserId_idx" ON "Crown"("ownerUserId");

-- CreateIndex
CREATE INDEX "Crown_holderUserId_idx" ON "Crown"("holderUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Crown_scopeKey_gameId_key" ON "Crown"("scopeKey", "gameId");

-- CreateIndex
CREATE INDEX "CrownChange_guildId_at_idx" ON "CrownChange"("guildId", "at");

-- CreateIndex
CREATE INDEX "CrownChange_gameId_idx" ON "CrownChange"("gameId");

-- CreateIndex
CREATE INDEX "CrownChange_questId_idx" ON "CrownChange"("questId");

-- CreateIndex
CREATE INDEX "CrownChange_fromUserId_idx" ON "CrownChange"("fromUserId");

-- CreateIndex
CREATE INDEX "CrownChange_toUserId_idx" ON "CrownChange"("toUserId");

-- CreateIndex
CREATE INDEX "HouseRecord_gameId_idx" ON "HouseRecord"("gameId");

-- CreateIndex
CREATE INDEX "HouseRecord_questId_idx" ON "HouseRecord"("questId");

-- CreateIndex
CREATE INDEX "HouseRecord_holderUserId_idx" ON "HouseRecord"("holderUserId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseRecord_hostUserId_gameId_kind_key" ON "HouseRecord"("hostUserId", "gameId", "kind");

-- CreateIndex
CREATE INDEX "TaughtBy_teacherId_gameId_idx" ON "TaughtBy"("teacherId", "gameId");

-- CreateIndex
CREATE INDEX "TaughtBy_learnerId_idx" ON "TaughtBy"("learnerId");

-- CreateIndex
CREATE INDEX "TaughtBy_questId_idx" ON "TaughtBy"("questId");

-- CreateIndex
CREATE UNIQUE INDEX "TaughtBy_gameId_learnerId_key" ON "TaughtBy"("gameId", "learnerId");

-- CreateIndex
CREATE INDEX "TitleAward_titleId_idx" ON "TitleAward"("titleId");

-- CreateIndex
CREATE UNIQUE INDEX "TitleAward_userId_titleId_key" ON "TitleAward"("userId", "titleId");

-- CreateIndex
CREATE INDEX "PlayerStats_nemesisId_idx" ON "PlayerStats"("nemesisId");

-- CreateIndex
CREATE INDEX "ShelfItem_gameId_idx" ON "ShelfItem"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "ShelfItem_userId_gameId_key" ON "ShelfItem"("userId", "gameId");

-- CreateIndex
CREATE INDEX "GameNight_guildId_startsAt_idx" ON "GameNight"("guildId", "startsAt");

-- CreateIndex
CREATE INDEX "GameNight_hostId_startsAt_idx" ON "GameNight"("hostId", "startsAt");

-- CreateIndex
CREATE INDEX "GameNight_campaignId_idx" ON "GameNight"("campaignId");

-- CreateIndex
CREATE INDEX "Rsvp_userId_idx" ON "Rsvp"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_gameNightId_userId_key" ON "Rsvp"("gameNightId", "userId");

-- CreateIndex
CREATE INDEX "NightProposal_gameId_idx" ON "NightProposal"("gameId");

-- CreateIndex
CREATE INDEX "NightProposal_proposedById_idx" ON "NightProposal"("proposedById");

-- CreateIndex
CREATE UNIQUE INDEX "NightProposal_gameNightId_gameId_key" ON "NightProposal"("gameNightId", "gameId");

-- CreateIndex
CREATE INDEX "Vote_gameNightId_userId_idx" ON "Vote"("gameNightId", "userId");

-- CreateIndex
CREATE INDEX "Vote_userId_idx" ON "Vote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_proposalId_userId_key" ON "Vote"("proposalId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_slug_key" ON "Guild"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_inviteCode_key" ON "Guild"("inviteCode");

-- CreateIndex
CREATE INDEX "Guild_founderId_idx" ON "Guild"("founderId");

-- CreateIndex
CREATE INDEX "GuildMember_userId_idx" ON "GuildMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildMember_guildId_userId_key" ON "GuildMember"("guildId", "userId");

-- CreateIndex
CREATE INDEX "GuildTile_gameId_idx" ON "GuildTile"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildTile_guildId_gameId_key" ON "GuildTile"("guildId", "gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildTile_guildId_q_r_key" ON "GuildTile"("guildId", "q", "r");

-- CreateIndex
CREATE INDEX "Campaign_guildId_startsAt_idx" ON "Campaign"("guildId", "startsAt");

-- CreateIndex
CREATE INDEX "Campaign_createdById_idx" ON "Campaign"("createdById");

-- CreateIndex
CREATE INDEX "Campaign_championUserId_idx" ON "Campaign"("championUserId");

-- CreateIndex
CREATE INDEX "CampaignStanding_userId_idx" ON "CampaignStanding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignStanding_campaignId_userId_key" ON "CampaignStanding"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "Reaction_userId_idx" ON "Reaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_questId_userId_kind_key" ON "Reaction"("questId", "userId", "kind");

-- CreateIndex
CREATE INDEX "Comment_questId_createdAt_idx" ON "Comment"("questId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX "Report_resolvedById_idx" ON "Report"("resolvedById");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ImportJob_userId_createdAt_idx" ON "ImportJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_status_createdAt_idx" ON "ImportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_baseGameId_fkey" FOREIGN KEY ("baseGameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_gameNightId_fkey" FOREIGN KEY ("gameNightId") REFERENCES "GameNight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestParticipant" ADD CONSTRAINT "QuestParticipant_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestParticipant" ADD CONSTRAINT "QuestParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestParticipant" ADD CONSTRAINT "QuestParticipant_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestDraft" ADD CONSTRAINT "QuestDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tile" ADD CONSTRAINT "Tile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tile" ADD CONSTRAINT "Tile_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpLedger" ADD CONSTRAINT "XpLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpLedger" ADD CONSTRAINT "XpLedger_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestOutcome" ADD CONSTRAINT "QuestOutcome_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestOutcome" ADD CONSTRAINT "QuestOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crown" ADD CONSTRAINT "Crown_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crown" ADD CONSTRAINT "Crown_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crown" ADD CONSTRAINT "Crown_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crown" ADD CONSTRAINT "Crown_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrownChange" ADD CONSTRAINT "CrownChange_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrownChange" ADD CONSTRAINT "CrownChange_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrownChange" ADD CONSTRAINT "CrownChange_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrownChange" ADD CONSTRAINT "CrownChange_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrownChange" ADD CONSTRAINT "CrownChange_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseRecord" ADD CONSTRAINT "HouseRecord_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseRecord" ADD CONSTRAINT "HouseRecord_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseRecord" ADD CONSTRAINT "HouseRecord_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseRecord" ADD CONSTRAINT "HouseRecord_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaughtBy" ADD CONSTRAINT "TaughtBy_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaughtBy" ADD CONSTRAINT "TaughtBy_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaughtBy" ADD CONSTRAINT "TaughtBy_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaughtBy" ADD CONSTRAINT "TaughtBy_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitleAward" ADD CONSTRAINT "TitleAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStats" ADD CONSTRAINT "PlayerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStats" ADD CONSTRAINT "PlayerStats_nemesisId_fkey" FOREIGN KEY ("nemesisId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfItem" ADD CONSTRAINT "ShelfItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfItem" ADD CONSTRAINT "ShelfItem_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameNight" ADD CONSTRAINT "GameNight_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameNight" ADD CONSTRAINT "GameNight_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameNight" ADD CONSTRAINT "GameNight_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_gameNightId_fkey" FOREIGN KEY ("gameNightId") REFERENCES "GameNight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightProposal" ADD CONSTRAINT "NightProposal_gameNightId_fkey" FOREIGN KEY ("gameNightId") REFERENCES "GameNight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightProposal" ADD CONSTRAINT "NightProposal_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightProposal" ADD CONSTRAINT "NightProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_gameNightId_fkey" FOREIGN KEY ("gameNightId") REFERENCES "GameNight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "NightProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guild" ADD CONSTRAINT "Guild_founderId_fkey" FOREIGN KEY ("founderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildTile" ADD CONSTRAINT "GuildTile_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildTile" ADD CONSTRAINT "GuildTile_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_championUserId_fkey" FOREIGN KEY ("championUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignStanding" ADD CONSTRAINT "CampaignStanding_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignStanding" ADD CONSTRAINT "CampaignStanding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
