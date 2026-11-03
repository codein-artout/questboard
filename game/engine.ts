/**
 * The rules engine: history in, state and rewards out.
 *
 * `computeWorld` folds over every quest in chronological order. Confirmed and
 * imported quests change state; pending quests are evaluated in "shadow" mode
 * at their place in the timeline (projected rewards, ghost tiles) without
 * changing anything; disputed quests are ignored. The function is pure and
 * deterministic: the same input always yields the same output.
 */
import { CROWNS, GUILD, NEMESIS, TERRAINS, TITLE_RULES, XP, type ScoringType, type Terrain, type XpSource } from "./config";
import { classAt, type PlayerClass } from "./class";
import { placeTiles } from "./layout";
import { levelFromXp } from "./levels";
import { placesFromScores } from "./places";
import { newUserState, weekNumber, type GameRecord, type UserState, type WorldFacts } from "./state";
import { tierForPlays, tierName, withArticle } from "./tiers";
import { championTitleId, nearestTitle, newlyEarned, titleProgress } from "./titles";
import type {
  CampaignStandingOut,
  CrownChangeOut,
  CrownEvent,
  CrownOut,
  EngineGame,
  EngineInput,
  EngineOutput,
  EngineQuest,
  GuildTileOut,
  HouseRecordKind,
  HouseRecordOut,
  LedgerOut,
  QuestOutcomePayload,
  StatsOut,
  TaughtByOut,
  TileOut,
  TitleAwardOut,
  XpLine,
} from "./types";

const DAY = 86400000;

type CrownStat = { best: number | null; bestAt: number; plays: number; wins: number };
type Holder = {
  userId: string | null;
  group: string[];
  guild: boolean;
  value: number;
  label: string;
  since: Date;
  questId: string | null;
};
type CoopGroupStat = { members: string[]; byDiff: Map<number, number> };

const PLACE_LABEL: Record<number, string> = { 1: "First place", 2: "Second place", 3: "Third place" };

export function isRaid(game: Pick<EngineGame, "weight" | "maxTime">): boolean {
  return (game.weight ?? 0) >= XP.raidWeight || (game.maxTime ?? 0) >= XP.raidMinutes;
}

export function shelfBountyXp(acquiredAt: Date, playedAt: Date): number {
  const days = (playedAt.getTime() - acquiredAt.getTime()) / DAY;
  if (days < XP.shelfBountyMinDays) return 0;
  const months = days / 30.4375;
  for (const row of XP.shelfBounty) if (months <= row.maxMonths) return row.xp;
  return 0;
}

/** Nemesis: among opponents met at least 5 times in the window, the one closest to 50/50. */
export function pickNemesis(
  meetings: readonly { otherId: string; at: Date; result: 1 | 0 | -1 }[],
  at: Date,
): { id: string; wins: number; losses: number; meetings: number } | null {
  const since = at.getTime() - NEMESIS.windowDays * DAY;
  const tally = new Map<string, { wins: number; losses: number; meetings: number }>();
  for (const m of meetings) {
    const t = m.at.getTime();
    if (t < since || t > at.getTime()) continue;
    const row = tally.get(m.otherId) ?? { wins: 0, losses: 0, meetings: 0 };
    row.meetings++;
    if (m.result === 1) row.wins++;
    if (m.result === -1) row.losses++;
    tally.set(m.otherId, row);
  }
  let best: { id: string; wins: number; losses: number; meetings: number; gap: number } | null = null;
  for (const [id, row] of [...tally].sort(([a], [b]) => a.localeCompare(b))) {
    if (row.meetings < NEMESIS.minMeetings) continue;
    const decided = row.wins + row.losses;
    const gap = decided === 0 ? 0 : Math.abs(row.wins / decided - 0.5);
    if (!best || gap < best.gap || (gap === best.gap && row.meetings > best.meetings)) best = { id, ...row, gap };
  }
  return best ? { id: best.id, wins: best.wins, losses: best.losses, meetings: best.meetings } : null;
}

function fmtScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function computeWorld(input: EngineInput): EngineOutput {
  const games = new Map(input.games.map((g) => [g.id, g]));
  const rootCache = new Map<string, string>();
  const rootOf = (gameId: string): string => {
    const cached = rootCache.get(gameId);
    if (cached) return cached;
    let cur = gameId;
    const seen = new Set<string>();
    while (true) {
      const g = games.get(cur);
      if (!g?.baseGameId || seen.has(cur) || !games.has(g.baseGameId)) break;
      seen.add(cur);
      cur = g.baseGameId;
    }
    rootCache.set(gameId, cur);
    return cur;
  };
  const overrides = input.tileTerrainOverrides ?? {};
  for (const t of input.existingTiles) if (t.terrainOverride) overrides[`${t.userId}:${t.gameId}`] = t.terrainOverride;
  const terrainFor = (userId: string, tileGameId: string): Terrain =>
    overrides[`${userId}:${tileGameId}`] ?? games.get(tileGameId)?.terrain ?? "forest";

  // People
  const states = new Map<string, UserState>();
  const stateOf = (id: string, name = "Player"): UserState => {
    let s = states.get(id);
    if (!s) {
      s = newUserState(id, name);
      states.set(id, s);
    }
    return s;
  };
  for (const u of input.users) stateOf(u.id, u.name);
  const nameOf = (id: string | null) => (id ? states.get(id)?.name ?? "Someone" : "Someone");

  const friends = new Map<string, Set<string>>();
  const addFriend = (a: string, b: string) => {
    if (!friends.has(a)) friends.set(a, new Set());
    friends.get(a)!.add(b);
  };
  for (const [a, b] of input.friendships) {
    addFriend(a, b);
    addFriend(b, a);
  }
  const friendsOf = (id: string) => friends.get(id) ?? new Set<string>();

  const guilds = new Map(input.guilds.map((g) => [g.id, { ...g, members: new Set(g.memberIds) }]));
  const campaignsByGuild = new Map<string, typeof input.campaigns>();
  for (const c of input.campaigns) {
    const list = campaignsByGuild.get(c.guildId) ?? [];
    list.push(c);
    campaignsByGuild.set(c.guildId, list);
  }

  const shelf = new Map<string, Map<string, Date>>();
  for (const item of input.shelf) {
    const root = rootOf(item.gameId);
    const m = shelf.get(item.userId) ?? new Map<string, Date>();
    const prev = m.get(root);
    if (!prev || item.acquiredAt < prev) m.set(root, item.acquiredAt);
    shelf.set(item.userId, m);
  }

  // Crown state
  const crownStats = new Map<string, CrownStat>(); // `${user}|${game}` across eligible quests
  const guildCrownStats = new Map<string, CrownStat>(); // `${guild}|${user}|${game}`
  const coopGroups = new Map<string, Map<string, CoopGroupStat>>(); // game -> groupKey -> stat
  const guildCoop = new Map<string, Map<number, number>>(); // `${guild}|${game}` -> diff -> wins
  const holders = new Map<string, Holder>(); // `${scopeKey}|${game}`
  const heldCount = new Map<string, number>();
  const crownChanges: CrownChangeOut[] = [];

  // Teaching
  const teacherOf = new Map<string, Map<string, string>>(); // game -> learner -> teacher
  const learnersOf = new Map<string, Map<string, string[]>>(); // game -> teacher -> learners
  const taughtBy: TaughtByOut[] = [];

  // Guild progress
  const guildQuestCounts = new Map<string, number>();
  const guildPlays = new Map<string, Map<string, { plays: number; firstAt: number }>>();
  const campaignXp = new Map<string, Map<string, number>>();

  // Outputs
  const ledger: LedgerOut[] = [];
  const outcomes: EngineOutput["outcomes"] = [];
  const titles: TitleAwardOut[] = [];
  const houseRecords = new Map<string, HouseRecordOut>();
  const pendingPlays = new Map<string, Map<string, { plays: number; firstAt: number }>>();

  const world: WorldFacts = {
    learnersByGame: (userId) => {
      const out = new Map<string, number>();
      for (const [game, byTeacher] of learnersOf) {
        const n = byTeacher.get(userId)?.length ?? 0;
        if (n > 0) out.set(game, n);
      }
      return out;
    },
    maxSpread: (userId) => {
      let best = 0;
      for (const game of learnersOf.keys()) best = Math.max(best, spreadOf(game, userId));
      return best;
    },
    crownsHeld: (userId) => heldCount.get(userId) ?? 0,
    foundedGuildQuests: (userId) => {
      let best = 0;
      for (const g of guilds.values()) if (g.founderId === userId) best = Math.max(best, guildQuestCounts.get(g.id) ?? 0);
      return best;
    },
    shelf: (userId) => {
      const owned = shelf.get(userId);
      if (!owned) return { owned: 0, unplayed: 0 };
      let unplayed = 0;
      for (const game of owned.keys()) if ((states.get(userId)?.games.get(game)?.plays ?? 0) === 0) unplayed++;
      return { owned: owned.size, unplayed };
    },
  };

  function spreadOf(game: string, teacher: string): number {
    const byTeacher = learnersOf.get(game);
    if (!byTeacher) return 0;
    const seen = new Set<string>();
    const queue = [...(byTeacher.get(teacher) ?? [])];
    while (queue.length) {
      const l = queue.shift()!;
      if (seen.has(l) || l === teacher) continue;
      seen.add(l);
      queue.push(...(byTeacher.get(l) ?? []));
    }
    return seen.size;
  }

  function ancestorsOf(game: string, learner: string): string[] {
    const out: string[] = [];
    const map = teacherOf.get(game);
    let cur = map?.get(learner);
    const seen = new Set<string>([learner]);
    while (cur && !seen.has(cur)) {
      out.push(cur);
      seen.add(cur);
      cur = map?.get(cur);
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Crowns
  // -------------------------------------------------------------------------

  const holderIncludes = (h: Holder | undefined, userId: string) => !!h && (h.userId === userId || h.group.includes(userId));
  const sameHolder = (a: Holder | undefined, b: Holder | undefined) =>
    (!a && !b) || (!!a && !!b && a.userId === b.userId && a.guild === b.guild && a.group.join() === b.group.join());
  const countsFor = (scopeKey: string, h: Holder | undefined, userId: string) =>
    !!h && !h.guild && (scopeKey.startsWith("guild:") ? h.userId === userId : scopeKey === `friends:${userId}` && holderIncludes(h, userId));

  function bestIndividual(
    scoring: ScoringType,
    candidates: { userId: string; stat: CrownStat }[],
    incumbent: Holder | undefined,
  ): { userId: string; value: number; label: string } | null {
    if (scoring === "points") {
      const scored = candidates.filter((c) => c.stat.best !== null);
      if (!scored.length) return null;
      const top = Math.max(...scored.map((c) => c.stat.best!));
      const tied = scored.filter((c) => c.stat.best === top);
      const keep = incumbent?.userId ? tied.find((c) => c.userId === incumbent.userId) : undefined;
      const pick = keep ?? [...tied].sort((a, b) => a.stat.bestAt - b.stat.bestAt || a.userId.localeCompare(b.userId))[0]!;
      return { userId: pick.userId, value: top, label: fmtScore(top) };
    }
    const eligible = candidates.filter((c) => c.stat.plays >= CROWNS.winRateMinPlays);
    if (!eligible.length) return null;
    const rate = (c: { stat: CrownStat }) => c.stat.wins / c.stat.plays;
    const topRate = Math.max(...eligible.map(rate));
    const byRate = eligible.filter((c) => rate(c) === topRate);
    const topWins = Math.max(...byRate.map((c) => c.stat.wins));
    const tied = byRate.filter((c) => c.stat.wins === topWins);
    if (topWins === 0) return null;
    const keep = incumbent?.userId ? tied.find((c) => c.userId === incumbent.userId) : undefined;
    const pick = keep ?? [...tied].sort((a, b) => a.userId.localeCompare(b.userId))[0]!;
    return { userId: pick.userId, value: topRate, label: `${Math.round(topRate * 100)}% wins` };
  }

  function coopLabel(diff: number, wins: number): string {
    const w = `${wins} ${wins === 1 ? "win" : "wins"}`;
    return diff > 0 ? `${w} at difficulty ${diff}` : `${w}`;
  }

  /**
   * Re-evaluates the crowns a quest can affect. With `commit`, state is updated
   * and changes recorded; otherwise this is a projection for a pending quest.
   * Returns crowns taken/claimed per participant.
   */
  function evaluateCrowns(
    quest: EngineQuest,
    tileGame: string,
    players: { userId: string; score: number | null; won: boolean }[],
    commit: boolean,
  ): Map<string, { taken: CrownEvent[]; claimed: CrownEvent[] }> {
    const result = new Map<string, { taken: CrownEvent[]; claimed: CrownEvent[] }>();
    for (const p of players) result.set(p.userId, { taken: [], claimed: [] });
    const game = games.get(tileGame) ?? games.get(quest.gameId);
    if (!game) return result;
    const scoring = game.scoring;
    const at = quest.playedAt;
    const atMs = at.getTime();

    // Overlay of updated stats.
    const overlay = new Map<string, CrownStat>();
    const statKey = (u: string) => `${u}|${tileGame}`;
    const gStatKey = (g: string, u: string) => `${g}|${u}|${tileGame}`;
    const bump = (map: Map<string, CrownStat>, key: string, p: (typeof players)[number]) => {
      const prev = overlay.get(key) ?? map.get(key) ?? { best: null, bestAt: 0, plays: 0, wins: 0 };
      const next = { ...prev, plays: prev.plays + 1, wins: prev.wins + (p.won ? 1 : 0) };
      if (p.score !== null && (next.best === null || p.score > next.best)) {
        next.best = p.score;
        next.bestAt = atMs;
      }
      overlay.set(key, next);
    };
    if (!quest.coop) {
      for (const p of players) {
        bump(crownStats, statKey(p.userId), p);
        if (quest.guildId) bump(guildCrownStats, gStatKey(quest.guildId, p.userId), p);
      }
    }
    const read = (map: Map<string, CrownStat>, key: string) => overlay.get(key) ?? map.get(key);

    // Co-op group overlay.
    const groupKey = players.map((p) => p.userId).sort().join("+");
    const diff = quest.difficulty ?? 0;
    const coopWon = quest.coop && quest.coopWin === true;
    const groupOverlay = new Map<string, CoopGroupStat>();
    if (coopWon) {
      const g = coopGroups.get(tileGame)?.get(groupKey);
      const byDiff = new Map(g?.byDiff ?? []);
      byDiff.set(diff, (byDiff.get(diff) ?? 0) + 1);
      groupOverlay.set(groupKey, { members: groupKey.split("+"), byDiff });
    }

    const changes: { scopeKey: string; guildId: string | null; owner: string | null; prev: Holder | undefined; next: Holder | undefined }[] = [];

    // Guild scope
    if (quest.guildId) {
      const scopeKey = `guild:${quest.guildId}`;
      const hk = `${scopeKey}|${tileGame}`;
      const prev = holders.get(hk);
      let next: Holder | undefined = prev;
      if (quest.coop) {
        if (coopWon) {
          const ck = `${quest.guildId}|${tileGame}`;
          const byDiff = new Map(guildCoop.get(ck) ?? []);
          byDiff.set(diff, (byDiff.get(diff) ?? 0) + 1);
          const maxDiff = Math.max(...byDiff.keys());
          const wins = byDiff.get(maxDiff) ?? 0;
          next = { userId: null, group: [], guild: true, value: maxDiff * 10000 + wins, label: coopLabel(maxDiff, wins), since: prev?.since ?? at, questId: prev?.questId ?? quest.id };
          if (commit) guildCoop.set(ck, byDiff);
        }
      } else {
        const g = guilds.get(quest.guildId);
        const members = g ? [...g.members] : players.map((p) => p.userId);
        const candidates = members
          .map((u) => ({ userId: u, stat: read(guildCrownStats, gStatKey(quest.guildId!, u)) }))
          .filter((c): c is { userId: string; stat: CrownStat } => !!c.stat);
        const best = bestIndividual(scoring, candidates, prev);
        if (best) {
          const changed = prev?.userId !== best.userId;
          next = { userId: best.userId, group: [], guild: false, value: best.value, label: best.label, since: changed ? at : prev!.since, questId: changed ? quest.id : prev!.questId };
        }
      }
      changes.push({ scopeKey, guildId: quest.guildId, owner: null, prev, next });
    }

    // Friends scopes: every participant and their friends.
    const owners = new Set<string>();
    for (const p of players) {
      owners.add(p.userId);
      for (const f of friendsOf(p.userId)) owners.add(f);
    }
    for (const owner of [...owners].sort()) {
      const scopeKey = `friends:${owner}`;
      const hk = `${scopeKey}|${tileGame}`;
      const prev = holders.get(hk);
      const circle = new Set([owner, ...friendsOf(owner)]);
      let next: Holder | undefined = prev;
      if (quest.coop) {
        if (!coopWon) continue;
        const groups = new Map(coopGroups.get(tileGame) ?? []);
        for (const [k, v] of groupOverlay) groups.set(k, v);
        let best: { key: string; stat: CoopGroupStat; diff: number; wins: number } | null = null;
        for (const [key, stat] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
          if (!stat.members.every((m) => circle.has(m))) continue;
          const d = Math.max(...stat.byDiff.keys());
          const w = stat.byDiff.get(d) ?? 0;
          if (!best || d > best.diff || (d === best.diff && w > best.wins)) best = { key, stat, diff: d, wins: w };
        }
        if (!best) continue;
        const prevKey = prev?.group.join("+");
        const keepPrev = prev && prevKey !== best.key && groups.get(prevKey ?? "")
          ? (() => {
              const s = groups.get(prevKey!)!;
              const d = Math.max(...s.byDiff.keys());
              return d === best!.diff && (s.byDiff.get(d) ?? 0) === best!.wins;
            })()
          : false;
        if (!keepPrev) {
          const changed = prevKey !== best.key;
          next = { userId: null, group: best.stat.members, guild: false, value: best.diff * 10000 + best.wins, label: coopLabel(best.diff, best.wins), since: changed ? at : prev!.since, questId: changed ? quest.id : prev!.questId };
        }
      } else {
        const candidates = [...circle]
          .map((u) => ({ userId: u, stat: read(crownStats, `${u}|${tileGame}`) }))
          .filter((c): c is { userId: string; stat: CrownStat } => !!c.stat);
        const best = bestIndividual(scoring, candidates, prev);
        if (!best) continue;
        const changed = prev?.userId !== best.userId;
        next = { userId: best.userId, group: [], guild: false, value: best.value, label: best.label, since: changed ? at : prev!.since, questId: changed ? quest.id : prev!.questId };
      }
      changes.push({ scopeKey, guildId: null, owner, prev, next });
    }

    for (const c of changes) {
      // Which participants does this scope matter to? The guild scope and their own friends scope.
      for (const p of players) {
        const relevant = c.scopeKey.startsWith("guild:") || c.owner === p.userId;
        if (!relevant) continue;
        if (holderIncludes(c.next, p.userId) && !holderIncludes(c.prev, p.userId) && !c.next?.guild) {
          const ev: CrownEvent = {
            scopeKey: c.scopeKey,
            guildId: c.guildId,
            gameId: tileGame,
            fromUserId: c.prev?.userId ?? null,
            fromName: c.prev?.userId ? nameOf(c.prev.userId) : c.prev?.group.length ? c.prev.group.map(nameOf).join(", ") : null,
            record: c.next!.label,
          };
          const bucket = result.get(p.userId)!;
          if (c.prev && !c.prev.guild) bucket.taken.push(ev);
          else bucket.claimed.push(ev);
        }
      }
      if (!commit) continue;
      const hk = `${c.scopeKey}|${tileGame}`;
      if (c.next) holders.set(hk, c.next);
      if (!sameHolder(c.prev, c.next) && c.next) {
        // Crown counts for Crown Collector.
        const touched = new Set<string>([...(c.prev ? [c.prev.userId, ...c.prev.group] : []), c.next.userId, ...c.next.group].filter((x): x is string => !!x));
        for (const u of touched) {
          const before = countsFor(c.scopeKey, c.prev, u) ? 1 : 0;
          const after = countsFor(c.scopeKey, c.next, u) ? 1 : 0;
          if (before !== after) heldCount.set(u, (heldCount.get(u) ?? 0) + after - before);
        }
        const record =
          c.scopeKey.startsWith("guild:") ||
          (c.owner !== null && (c.next.userId === c.owner || c.prev?.userId === c.owner));
        if (record && !c.next.guild && c.next.group.length === 0) {
          crownChanges.push({ scopeKey: c.scopeKey, gameId: tileGame, guildId: c.guildId, fromUserId: c.prev?.userId ?? null, toUserId: c.next.userId, questId: quest.id, at });
        }
      }
    }
    if (commit) {
      for (const [k, v] of overlay) {
        if (k.split("|").length === 3) guildCrownStats.set(k, v);
        else crownStats.set(k, v);
      }
      for (const [k, v] of groupOverlay) {
        const m = coopGroups.get(tileGame) ?? new Map<string, CoopGroupStat>();
        m.set(k, v);
        coopGroups.set(tileGame, m);
      }
      for (const p of players) {
        const s = stateOf(p.userId);
        s.maxCrownsHeld = Math.max(s.maxCrownsHeld, heldCount.get(p.userId) ?? 0);
        const taken = result.get(p.userId)!.taken.length;
        for (let i = 0; i < taken; i++) s.crownTakeTimes.push(at);
      }
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // House records
  // -------------------------------------------------------------------------

  function updateHouseRecords(quest: EngineQuest, tileGame: string) {
    const host = quest.hostUserId;
    if (!host) return;
    const parts = quest.participants;
    const put = (kind: HouseRecordKind, value: number, better: (a: number, b: number) => boolean, holderUserId: string | null, holderName: string, detail: string | null) => {
      const key = `${host}|${tileGame}|${kind}`;
      const prev = houseRecords.get(key);
      if (prev && !better(value, prev.value)) return;
      houseRecords.set(key, { hostUserId: host, gameId: tileGame, kind, value, holderUserId, holderName, questId: quest.id, achievedAt: quest.playedAt, detail });
    };
    const gt = (a: number, b: number) => a > b;
    const lt = (a: number, b: number) => a < b;
    if (!quest.coop) {
      const scored = parts.filter((p) => p.score !== null);
      if (scored.length) {
        const top = [...scored].sort((a, b) => b.score! - a.score!)[0]!;
        put("highest_score", top.score!, gt, top.userId, top.name, null);
        const winners = scored.filter((p) => p.place === 1);
        const lowWin = [...winners].sort((a, b) => a.score! - b.score!)[0];
        if (lowWin) put("lowest_winning_score", lowWin.score!, lt, lowWin.userId, lowWin.name, null);
      }
      const mids = parts.filter((p) => p.midScore !== null && p.place !== null);
      if (mids.length >= 2) {
        const midPlaces = placesFromScores(mids.map((p, i) => ({ key: String(i), score: p.midScore })));
        let bestGain = 0;
        let who: (typeof parts)[number] | null = null;
        let fromPlace = 0;
        mids.forEach((p, i) => {
          const mp = midPlaces.get(String(i)) ?? 0;
          const gain = mp - (p.place ?? mp);
          if (gain > bestGain) {
            bestGain = gain;
            who = p;
            fromPlace = mp;
          }
        });
        if (who) {
          const w = who as (typeof parts)[number];
          put("comeback", bestGain, gt, w.userId, w.name, fromPlace === mids.length ? "last at the midpoint" : `${fromPlace}${fromPlace === 2 ? "nd" : fromPlace === 3 ? "rd" : "th"} at the midpoint`);
        }
      }
    }
    if (quest.durationMin && quest.durationMin > 0) {
      const party = `${parts.length} ${parts.length === 1 ? "player" : "players"}`;
      put("fastest", quest.durationMin, lt, null, party, party);
      put("longest", quest.durationMin, gt, null, party, party);
    }
    put("largest_party", parts.length, gt, null, `${parts.length} players`, null);
  }

  // -------------------------------------------------------------------------
  // The fold
  // -------------------------------------------------------------------------

  const quests = [...input.quests]
    .filter((q) => q.status !== "disputed" && games.has(q.gameId))
    .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));

  for (const quest of quests) {
    const commit = quest.status === "confirmed";
    const imported = quest.source === "import";
    const tileGame = rootOf(quest.gameId);
    const playedGame = games.get(quest.gameId)!;
    const baseGame = games.get(tileGame) ?? playedGame;
    const qty = Math.max(1, quest.quantity);
    const raid = isRaid({ weight: playedGame.weight ?? baseGame.weight, maxTime: playedGame.maxTime ?? baseGame.maxTime });
    const at = quest.playedAt;

    // Registered participants who count for this quest. Imported quests only count for the importer.
    const registered = quest.participants.filter((p): p is typeof p & { userId: string } => !!p.userId);
    const counted = imported ? registered.filter((p) => p.userId === quest.loggedById) : registered;
    if (counted.length === 0) continue;
    for (const p of counted) stateOf(p.userId, p.name);

    const won = (p: { place: number | null }) => (quest.coop ? quest.coopWin === true : p.place === 1);
    const tiedFirst = (p: { place: number | null }) => p.place !== null && quest.participants.filter((o) => o.place === p.place).length > 1;

    // Teaching (live quests only).
    const priorPlays = (u: string) => states.get(u)?.games.get(tileGame)?.plays ?? 0;
    const learners = imported ? [] : registered.filter((p) => priorPlays(p.userId) === 0 && !teacherOf.get(tileGame)?.has(p.userId)).map((p) => p.userId);
    const experienced = imported ? [] : registered.filter((p) => priorPlays(p.userId) > 0).map((p) => p.userId);
    let teacher: string | null = null;
    if (learners.length && experienced.length) {
      if (quest.hostUserId && experienced.includes(quest.hostUserId)) teacher = quest.hostUserId;
      else {
        teacher = [...experienced].sort((a, b) => {
          const pa = priorPlays(a);
          const pb = priorPlays(b);
          if (pa !== pb) return pb - pa;
          const fa = states.get(a)?.games.get(tileGame)?.firstAt?.getTime() ?? 0;
          const fb = states.get(b)?.games.get(tileGame)?.firstAt?.getTime() ?? 0;
          return fa - fb || a.localeCompare(b);
        })[0]!;
      }
    }

    // Crowns: only confirmed live quests with at least two registered players.
    const crownEligible = !imported && registered.length >= CROWNS.minRegisteredPlayers;
    const crownResult = crownEligible
      ? evaluateCrowns(
          quest,
          tileGame,
          registered.map((p) => ({ userId: p.userId, score: p.score, won: won(p) })),
          commit,
        )
      : new Map<string, { taken: CrownEvent[]; claimed: CrownEvent[] }>();

    // Campaign context.
    const activeCampaigns = !imported && quest.guildId
      ? (campaignsByGuild.get(quest.guildId) ?? []).filter((c) => at >= c.startsAt && at.getTime() <= endOfDay(c.endsAt))
      : [];
    const finale = activeCampaigns.some(
      (c) => (quest.gameNightId && c.finaleNightIds.includes(quest.gameNightId)) || quest.localDate === ymd(c.endsAt),
    );

    const userOutcomes: { userId: string; lines: XpLine[]; total: number; payload: QuestOutcomePayload }[] = [];

    for (const p of counted) {
      const s = stateOf(p.userId);
      const rec: GameRecord = s.games.get(tileGame) ?? {
        plays: 0,
        firstAt: null,
        lastAt: null,
        best: null,
        wins: 0,
        lossStreak: 0,
        terrain: terrainFor(p.userId, tileGame),
      };
      const before = rec.plays;
      const after = before + qty;
      const tierBefore = tierForPlays(before);
      const tierAfter = tierForPlays(after);
      const lines: XpLine[] = [];
      const add = (source: XpSource, amount: number, label: string) => {
        if (amount !== 0) lines.push({ source, amount, label });
      };

      add("showed_up", XP.showedUp, "Showed up");
      if (raid) add("raid", XP.showedUp * (XP.raidShowedUpMultiplier - 1), "Raid: double for showing up");
      if (quest.coop) {
        if (quest.coopWin === true) add("coop", XP.coopWin, "Co-op win");
        else if (quest.coopWin === false) add("coop", XP.coopLoss, "Co-op loss");
      } else if (p.place !== null) {
        const xp = XP.place[p.place] ?? 0;
        add("place", xp, `${tiedFirst(p) ? "Tied for " : ""}${(PLACE_LABEL[p.place] ?? "").toLowerCase() || `${p.place}th place`}`.replace(/^./, (c) => c.toUpperCase()));
      }
      if (before === 0) add("new_land", XP.newLand, `New land: ${baseGame.name}`);
      if (tierAfter > tierBefore && tierAfter >= 2) add("tier_up", XP.tierUp[tierAfter] ?? 0, `Reached ${withArticle(tierName(tierAfter))}`);
      const crowns = crownResult.get(p.userId) ?? { taken: [], claimed: [] };
      if (crowns.taken.length) add("took_crown", XP.tookCrown, "Took a crown");
      let personalBest: QuestOutcomePayload["personalBest"] = null;
      if (!quest.coop && p.score !== null && rec.best !== null && p.score > rec.best) {
        personalBest = { score: p.score, previous: rec.best };
        add("personal_best", XP.personalBest, "Personal best");
      }
      if (experienced.includes(p.userId) && learners.length) {
        const n = Math.min(learners.length, XP.taughtMaxLearners);
        add("taught", n * XP.taughtPerLearner, n === 1 ? "Taught a new player" : `Taught ${n} new players`);
      }
      if (before === 0) {
        const acquired = shelf.get(p.userId)?.get(tileGame);
        if (acquired) add("shelf_bounty", shelfBountyXp(acquired, at), "Shelf bounty");
      }
      const nemesis = pickNemesis(s.meetings, new Date(at.getTime() - 1));
      if (!imported && nemesis && registered.some((o) => o.userId === nemesis.id)) {
        add("rivalry", XP.rivalry, `Kept your rivalry with ${nameOf(nemesis.id)} alive`);
      }
      if (quest.hostUserId === p.userId) add("hosting", XP.hosting, "Hosted the quest");

      let total = lines.reduce((n, l) => n + l.amount, 0);
      const dayGameKey = `${quest.localDate}|${tileGame}`;
      const playsToday = s.gamePlaysPerDay.get(dayGameKey) ?? 0;
      if (playsToday + 1 >= XP.grindFromPlay) {
        const next = Math.round(total * XP.grindMultiplier);
        add("grind", next - total, `Play ${playsToday + 1} of ${baseGame.name} today: half XP`);
        total = next;
      }
      if (imported) {
        const next = Math.round(total * XP.importMultiplier);
        add("imported", next - total, "Imported play: half XP");
        total = next;
      }
      if (finale) {
        const next = Math.round(total * XP.finaleMultiplier);
        add("finale", next - total, "Campaign finale: double XP");
        total = next;
      }
      const questsToday = s.xpQuestsPerDay.get(quest.localDate) ?? 0;
      if (questsToday >= XP.dailyQuestCap) {
        add("daily_cap", -total, `Daily limit of ${XP.dailyQuestCap} quests reached`);
        total = 0;
      }

      const levelBefore = levelFromXp(s.xp);
      const levelAfter = levelFromXp(s.xp + total);
      const classBefore: PlayerClass = classAt(s.terrainPlays, at);

      const payload: QuestOutcomePayload = {
        status: commit ? "confirmed" : "pending",
        gameId: quest.gameId,
        tileGameId: tileGame,
        lines,
        xp: total,
        place: quest.coop ? null : p.place,
        tied: tiedFirst(p),
        coopWin: quest.coop ? quest.coopWin : null,
        plays: after,
        newLand: before === 0 ? { terrain: rec.terrain, tileCount: [...s.games.values()].filter((g) => g.plays > 0).length + 1 } : null,
        tierUp: tierAfter > tierBefore && tierAfter >= 2 ? { from: tierBefore, to: tierAfter } : null,
        crownsTaken: crowns.taken,
        crownsClaimed: crowns.claimed,
        personalBest,
        level: {
          before: levelBefore.level,
          after: levelAfter.level,
          xpIntoLevel: levelAfter.xpIntoLevel,
          xpForNext: levelAfter.xpForNext,
          xpIntoBefore: levelBefore.xpIntoLevel,
        },
        classChange: null,
        titles: [],
        nearTitle: null,
        raid,
        imported,
      };
      userOutcomes.push({ userId: p.userId, lines, total, payload });

      if (!commit) {
        s.pendingXp += total;
        const pm = pendingPlays.get(p.userId) ?? new Map<string, { plays: number; firstAt: number }>();
        const cur = pm.get(tileGame) ?? { plays: 0, firstAt: at.getTime() };
        pm.set(tileGame, { plays: cur.plays + qty, firstAt: Math.min(cur.firstAt, at.getTime()) });
        pendingPlays.set(p.userId, pm);
        continue;
      }

      // --- Commit state ---
      rec.plays = after;
      rec.firstAt = rec.firstAt ?? at;
      rec.lastAt = at;
      if (!quest.coop && p.score !== null && (rec.best === null || p.score > rec.best)) rec.best = p.score;
      const didWin = won(p);
      if (didWin) {
        rec.wins += qty;
        s.wins += qty;
      }
      s.games.set(tileGame, rec);
      s.xp += total;
      s.terrainPlays.push({ at, terrain: rec.terrain, count: qty });
      s.gamePlaysPerDay.set(dayGameKey, playsToday + qty);
      s.xpQuestsPerDay.set(quest.localDate, questsToday + 1);
      s.questsPerDay.set(quest.localDate, (s.questsPerDay.get(quest.localDate) ?? 0) + 1);
      s.weeks.add(weekNumber(quest.localDate));
      s.quests += 1;
      if (before === 0) s.newLandTimes.push(at);
      if (raid) s.raids += 1;
      if (raid && (quest.durationMin ?? 0) >= TITLE_RULES.survivedGalaxyMinutes) s.survivedGalaxy += 1;
      if ((playedGame.weight ?? baseGame.weight ?? 0) >= TITLE_RULES.heavyweightWeight) s.heavyPlays += qty;
      const endLocal = new Date(at.getTime() + (quest.durationMin ?? 0) * 60000 + quest.tzOffsetMin * 60000);
      if (endLocal.getUTCHours() < TITLE_RULES.nightOwlUntilHour) s.nightOwl += 1;
      for (const row of lines) {
        ledger.push({
          userId: p.userId,
          questId: quest.id,
          source: row.source,
          amount: row.amount,
          status: "confirmed",
          guildId: imported ? null : quest.guildId,
          campaignId: activeCampaigns[0]?.id ?? null,
          at,
        });
      }

      // Social accumulators: live quests only (imports never count toward titles involving others).
      if (!imported) {
        if (quest.hostUserId === p.userId) {
          s.hosted += 1;
          for (const o of registered) if (o.userId !== p.userId) s.hostedPeople.add(o.userId);
        }
        for (const o of registered) if (o.userId !== p.userId) s.coplayers.add(o.userId);
        if (quest.coop && quest.coopWin === true) s.coopWins += 1;
        if (!quest.coop && p.place !== null) {
          if (p.place === 2) {
            s.secondStreak += 1;
            s.maxSecondStreak = Math.max(s.maxSecondStreak, s.secondStreak);
          } else s.secondStreak = 0;
          if (didWin) {
            if (rec.lossStreak >= TITLE_RULES.comebackLosses) s.comebacks += 1;
            rec.lossStreak = 0;
          } else rec.lossStreak += 1;
          // Kingmaker: last place in a points game won by a point or less.
          const scored = quest.participants.filter((o) => o.score !== null).map((o) => o.score!).sort((a, b) => b - a);
          const maxPlace = Math.max(...quest.participants.map((o) => o.place ?? 0));
          if (
            baseGame.scoring === "points" &&
            quest.participants.length >= TITLE_RULES.kingmakerMinPlayers &&
            scored.length >= 2 &&
            scored[0]! - scored[1]! <= TITLE_RULES.kingmakerMargin &&
            scored[0]! !== scored[1]! &&
            p.place === maxPlace &&
            p.place > 1
          ) {
            s.kingmaker += 1;
          }
          // Head-to-head and Underdog.
          for (const o of registered) {
            if (o.userId === p.userId || o.place === null || (p.team && p.team === o.team)) continue;
            const result: 1 | 0 | -1 = p.place < o.place ? 1 : p.place > o.place ? -1 : 0;
            const h = s.h2h.get(o.userId) ?? { wins: 0, losses: 0, meetings: 0 };
            if (result === 1 && h.meetings >= TITLE_RULES.underdogMinMeetings && h.losses / h.meetings >= TITLE_RULES.underdogRate) {
              s.underdogs += 1;
            }
            h.meetings += 1;
            if (result === 1) h.wins += 1;
            if (result === -1) h.losses += 1;
            s.h2h.set(o.userId, h);
            s.meetings.push({ otherId: o.userId, at, result });
          }
        }
      }
    }

    if (commit) {
      // Teaching edges.
      const titleAffected = new Set(counted.map((p) => p.userId));
      if (teacher) {
        const map = teacherOf.get(tileGame) ?? new Map<string, string>();
        const byTeacher = learnersOf.get(tileGame) ?? new Map<string, string[]>();
        for (const l of learners) {
          map.set(l, teacher);
          byTeacher.set(teacher, [...(byTeacher.get(teacher) ?? []), l]);
          taughtBy.push({ gameId: tileGame, teacherId: teacher, learnerId: l, questId: quest.id, at });
          for (const a of ancestorsOf(tileGame, l)) titleAffected.add(a);
        }
        teacherOf.set(tileGame, map);
        learnersOf.set(tileGame, byTeacher);
      }
      // Guild progress.
      if (!imported && quest.guildId) {
        guildQuestCounts.set(quest.guildId, (guildQuestCounts.get(quest.guildId) ?? 0) + 1);
        const g = guilds.get(quest.guildId);
        if (g?.founderId) titleAffected.add(g.founderId);
        const present = registered.filter((p) => g?.members.has(p.userId)).length;
        if (g && present >= GUILD.minMembersForTile) {
          const m = guildPlays.get(g.id) ?? new Map<string, { plays: number; firstAt: number }>();
          const cur = m.get(tileGame) ?? { plays: 0, firstAt: at.getTime() };
          m.set(tileGame, { plays: cur.plays + qty, firstAt: cur.firstAt });
          guildPlays.set(g.id, m);
        }
        for (const c of activeCampaigns) {
          const m = campaignXp.get(c.id) ?? new Map<string, number>();
          for (const o of userOutcomes) m.set(o.userId, (m.get(o.userId) ?? 0) + o.total);
          campaignXp.set(c.id, m);
        }
      }
      updateHouseRecords(quest, tileGame);

      // Titles, class change, near titles.
      for (const uid of [...titleAffected].sort()) {
        const s = stateOf(uid);
        const earned = newlyEarned(s, world);
        for (const def of earned) {
          s.titles.set(def.id, { earnedAt: at, questId: quest.id, name: def.name });
          titles.push({ userId: uid, titleId: def.id, name: def.name, earnedAt: at, questId: quest.id });
        }
        const out = userOutcomes.find((o) => o.userId === uid);
        if (out) out.payload.titles = earned.map((d) => ({ id: d.id, name: d.name }));
      }
      for (const o of userOutcomes) {
        const s = stateOf(o.userId);
        const before = classAt(s.terrainPlays.slice(0, -1), at);
        const after = classAt(s.terrainPlays, at);
        if (before.key !== after.key) {
          o.payload.classChange = { fromKey: before.key, fromName: before.name, toKey: after.key, toName: after.name };
        }
        o.payload.nearTitle = nearestTitle(s, world);
      }
    }

    for (const o of userOutcomes) {
      outcomes.push({ questId: quest.id, userId: o.userId, status: commit ? "confirmed" : "pending", xp: o.total, payload: o.payload });
      if (!commit) {
        for (const row of o.lines) {
          ledger.push({ userId: o.userId, questId: quest.id, source: row.source, amount: row.amount, status: "pending", guildId: quest.guildId, campaignId: activeCampaigns[0]?.id ?? null, at });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Campaign champions (ended campaigns) and Shelf Cleared
  // -------------------------------------------------------------------------

  const campaignStandings: CampaignStandingOut[] = [];
  const campaignChampions: { campaignId: string; userId: string | null }[] = [];
  for (const c of input.campaigns) {
    const m = campaignXp.get(c.id) ?? new Map<string, number>();
    const ranked = [...m].sort(([a, xa], [b, xb]) => xb - xa || a.localeCompare(b));
    ranked.forEach(([userId, xp], i) => campaignStandings.push({ campaignId: c.id, userId, xp, rank: i + 1 }));
    const ended = input.now.getTime() > endOfDay(c.endsAt);
    const champ = ended && ranked[0] ? ranked[0][0] : null;
    campaignChampions.push({ campaignId: c.id, userId: champ });
    if (champ) {
      const s = stateOf(champ);
      const id = championTitleId(c.id);
      const name = `${c.name} champion`;
      s.titles.set(id, { earnedAt: new Date(endOfDay(c.endsAt)), questId: null, name });
      titles.push({ userId: champ, titleId: id, name, earnedAt: new Date(endOfDay(c.endsAt)), questId: null });
    }
  }
  for (const s of states.values()) {
    for (const def of newlyEarned(s, world)) {
      // Titles that can only flip outside a quest (Shelf Cleared): date them by the facts.
      let earnedAt = input.now;
      if (def.id === "shelf-cleared") {
        let latest = 0;
        for (const [game, acquired] of shelf.get(s.id) ?? []) {
          latest = Math.max(latest, acquired.getTime(), s.games.get(game)?.firstAt?.getTime() ?? 0);
        }
        earnedAt = new Date(latest || input.now.getTime());
      }
      s.titles.set(def.id, { earnedAt, questId: null, name: def.name });
      titles.push({ userId: s.id, titleId: def.id, name: def.name, earnedAt, questId: null });
    }
  }

  // -------------------------------------------------------------------------
  // Tiles and layout
  // -------------------------------------------------------------------------

  const existingByUser = new Map<string, typeof input.existingTiles>();
  for (const t of input.existingTiles) {
    const list = existingByUser.get(t.userId) ?? [];
    list.push(t);
    existingByUser.set(t.userId, list);
  }
  const tiles: TileOut[] = [];
  for (const s of [...states.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const pend = pendingPlays.get(s.id) ?? new Map<string, { plays: number; firstAt: number }>();
    const gameIds = new Set<string>([...[...s.games].filter(([, g]) => g.plays > 0).map(([id]) => id), ...pend.keys()]);
    if (!gameIds.size) continue;
    const keep = (existingByUser.get(s.id) ?? []).filter((t) => gameIds.has(t.gameId));
    const firstAt = (id: string) => Math.min(s.games.get(id)?.firstAt?.getTime() ?? Infinity, pend.get(id)?.firstAt ?? Infinity);
    const incoming = [...gameIds]
      .filter((id) => !keep.some((t) => t.gameId === id))
      .sort((a, b) => firstAt(a) - firstAt(b) || a.localeCompare(b))
      .map((id) => ({ id, terrain: s.games.get(id)?.terrain ?? terrainFor(s.id, id) }));
    const positions = placeTiles(
      keep.map((t) => ({ id: t.gameId, q: t.q, r: t.r, terrain: s.games.get(t.gameId)?.terrain ?? terrainFor(s.id, t.gameId) })),
      incoming,
      s.id,
    );
    for (const id of gameIds) {
      const g = s.games.get(id);
      const pos = positions.get(id)!;
      tiles.push({
        userId: s.id,
        gameId: id,
        q: pos.q,
        r: pos.r,
        plays: g?.plays ?? 0,
        pendingPlays: pend.get(id)?.plays ?? 0,
        tier: tierForPlays(g?.plays ?? 0),
        firstPlayedAt: g?.firstAt ?? null,
        lastPlayedAt: g?.lastAt ?? null,
        bestScore: g?.best ?? null,
        wins: g?.wins ?? 0,
      });
    }
  }

  const guildTiles: GuildTileOut[] = [];
  for (const [guildId, m] of [...guildPlays].sort(([a], [b]) => a.localeCompare(b))) {
    const existing = input.existingGuildTiles
      .filter((t) => t.guildId === guildId && m.has(t.gameId))
      .map((t) => ({ id: t.gameId, q: t.q, r: t.r, terrain: games.get(t.gameId)?.terrain ?? ("forest" as Terrain) }));
    const incoming = [...m]
      .filter(([id]) => !existing.some((t) => t.id === id))
      .sort(([a, x], [b, y]) => x.firstAt - y.firstAt || a.localeCompare(b))
      .map(([id]) => ({ id, terrain: games.get(id)?.terrain ?? ("forest" as Terrain) }));
    const positions = placeTiles(existing, incoming, guildId);
    for (const [gameId, v] of m) {
      const pos = positions.get(gameId)!;
      guildTiles.push({ guildId, gameId, q: pos.q, r: pos.r, plays: v.plays, tier: tierForPlays(v.plays) });
    }
  }

  // -------------------------------------------------------------------------
  // Crowns out
  // -------------------------------------------------------------------------

  const crowns: CrownOut[] = [];
  const tileSet = new Set(tiles.filter((t) => t.plays > 0).map((t) => `${t.userId}|${t.gameId}`));
  for (const [hk, h] of holders) {
    const sep = hk.lastIndexOf("|");
    const scopeKey = hk.slice(0, sep);
    const gameId = hk.slice(sep + 1);
    const isGuild = scopeKey.startsWith("guild:");
    const id = scopeKey.slice(scopeKey.indexOf(":") + 1);
    if (!isGuild && !tileSet.has(`${id}|${gameId}`)) continue;
    crowns.push({
      scopeKey,
      gameId,
      guildId: isGuild ? id : null,
      ownerUserId: isGuild ? null : id,
      holderUserId: h.userId,
      holderGroup: h.group,
      heldByGuild: h.guild,
      recordValue: h.value,
      recordLabel: h.label,
      since: h.since,
      questId: h.questId,
    });
  }

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  const stats: StatsOut[] = [];
  for (const s of [...states.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const played = [...s.games.values()].filter((g) => g.plays > 0);
    const counts = played.map((g) => g.plays).sort((a, b) => b - a);
    let h = 0;
    while (h < counts.length && counts[h]! >= h + 1) h++;
    const lvl = levelFromXp(s.xp);
    const cls = classAt(s.terrainPlays, input.now);
    const nem = pickNemesis(s.meetings, input.now);
    const terrainPlays = Object.fromEntries(TERRAINS.map((t) => [t, 0])) as Record<Terrain, number>;
    for (const g of played) terrainPlays[g.terrain] += g.plays;
    let peopleTaught = 0;
    for (const byTeacher of learnersOf.values()) peopleTaught += byTeacher.get(s.id)?.length ?? 0;
    stats.push({
      userId: s.id,
      xp: s.xp,
      pendingXp: s.pendingXp,
      level: lvl.level,
      xpIntoLevel: lvl.xpIntoLevel,
      xpForNext: lvl.xpForNext,
      classKey: cls.key,
      className: cls.name,
      hIndex: h,
      gamesExplored: played.length,
      totalPlays: played.reduce((n, g) => n + g.plays, 0),
      wins: s.wins,
      raids: s.raids,
      wonders: played.filter((g) => tierForPlays(g.plays) === 6).length,
      citadels: played.filter((g) => tierForPlays(g.plays) === 5).length,
      crownsHeld: heldCount.get(s.id) ?? 0,
      peopleTaught,
      nemesisId: nem?.id ?? null,
      nemesisWins: nem?.wins ?? 0,
      nemesisLosses: nem?.losses ?? 0,
      nemesisMeetings: nem?.meetings ?? 0,
      terrainPlays,
      titleProgress: titleProgress(s, world),
    });
  }

  return {
    tiles,
    ledger,
    outcomes,
    crowns,
    crownChanges,
    houseRecords: [...houseRecords.values()],
    taughtBy,
    titles,
    stats,
    guildTiles,
    campaignStandings,
    campaignChampions,
  };
}

function endOfDay(d: Date): number {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x.getTime();
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Spread for one teacher and game from a list of edges (used by pages). */
export function spreadFromEdges(edges: readonly { teacherId: string; learnerId: string }[], teacherId: string): { direct: number; total: number } {
  const children = new Map<string, string[]>();
  for (const e of edges) children.set(e.teacherId, [...(children.get(e.teacherId) ?? []), e.learnerId]);
  const direct = children.get(teacherId)?.length ?? 0;
  const seen = new Set<string>();
  const queue = [...(children.get(teacherId) ?? [])];
  while (queue.length) {
    const l = queue.shift()!;
    if (seen.has(l) || l === teacherId) continue;
    seen.add(l);
    queue.push(...(children.get(l) ?? []));
  }
  return { direct, total: seen.size };
}
