import { SHELF, TEACHING, TERRAINS, TITLE_RULES as R } from "./config";
import { longestWeekRun, maxInWindow, type UserState, type WorldFacts } from "./state";
import type { TitleProgress } from "./types";

/**
 * Titles: each has an id, a name, a rule and progress text. `social` titles
 * involve other people, so imported plays never count toward them (GAME.md).
 */
export type TitleDef = {
  id: string;
  name: string;
  rule: string;
  social: boolean;
  target: number;
  current: (s: UserState, w: WorldFacts) => number;
  text: (current: number, target: number) => string;
};

const tilesAtLeast = (s: UserState, tier: number) => {
  let n = 0;
  for (const g of s.games.values()) if (g.plays > 0 && tierAt(g.plays) >= tier) n++;
  return n;
};
function tierAt(plays: number): number {
  return plays >= 100 ? 6 : plays >= 50 ? 5 : plays >= 25 ? 4 : plays >= 10 ? 3 : plays >= 5 ? 2 : plays >= 1 ? 1 : 0;
}
const gamesPlayed = (s: UserState) => [...s.games.values()].filter((g) => g.plays > 0).length;
const of = (c: number, t: number) => `${Math.min(c, t)} of ${t}`;

export const TITLES: readonly TitleDef[] = [
  {
    id: "settler",
    name: "Settler",
    rule: "Log your first quest",
    social: false,
    target: 1,
    current: (s) => s.quests,
    text: (c) => (c >= 1 ? "Your first tile is down." : "Log a quest to settle your island."),
  },
  {
    id: "bridesmaid",
    name: "Bridesmaid",
    rule: `${R.bridesmaidStreak} second places in a row`,
    social: true,
    target: R.bridesmaidStreak,
    current: (s) => s.maxSecondStreak,
    text: (c, t) => `${of(c, t)} second places in a row`,
  },
  {
    id: "kingmaker",
    name: "Kingmaker",
    rule: `Finish last in a game won by ${R.kingmakerMargin} point or less`,
    social: true,
    target: 1,
    current: (s) => s.kingmaker,
    text: (c) => (c ? "You decided a close one from last place." : "Finish last in a game won by a point or less."),
  },
  {
    id: "survived-the-galaxy",
    name: "Survived the Galaxy",
    rule: `Finish a raid of ${R.survivedGalaxyMinutes} minutes or more`,
    social: false,
    target: 1,
    current: (s) => s.survivedGalaxy,
    text: (c) => (c ? "Finished a five-hour raid." : "Finish a raid that runs five hours or more."),
  },
  {
    id: "cartographer",
    name: "Cartographer",
    rule: "Have a tile in every terrain",
    social: false,
    target: TERRAINS.length,
    current: (s) => new Set([...s.games.values()].filter((g) => g.plays > 0).map((g) => g.terrain)).size,
    text: (c, t) => `${of(c, t)} regions explored`,
  },
  {
    id: "polyglot",
    name: "Polyglot",
    rule: `Play ${R.polyglotGames} different games`,
    social: false,
    target: R.polyglotGames,
    current: gamesPlayed,
    text: (c, t) => `${of(c, t)} games`,
  },
  {
    id: "centurion",
    name: "Centurion",
    rule: "Raise any game to a Wonder (100 plays)",
    social: false,
    target: 100,
    current: (s) => Math.max(0, ...[...s.games.values()].map((g) => g.plays)),
    text: (c, t) => `Most-played game: ${of(c, t)} plays`,
  },
  {
    id: "dime-bag",
    name: "Dime Bag",
    rule: `${R.dimeBagGames} games at Town or higher`,
    social: false,
    target: R.dimeBagGames,
    current: (s) => tilesAtLeast(s, 3),
    text: (c, t) => `${of(c, t)} games at Town or higher`,
  },
  {
    id: "evangelist",
    name: "Evangelist",
    rule: `Teach one game to ${TEACHING.evangelistLearners} people`,
    social: true,
    target: TEACHING.evangelistLearners,
    current: (s, w) => Math.max(0, ...w.learnersByGame(s.id).values()),
    text: (c, t) => `${of(c, t)} people taught one game`,
  },
  {
    id: "missionary",
    name: "Missionary",
    rule: `One game you taught spreads to ${TEACHING.missionarySpread} islands`,
    social: true,
    target: TEACHING.missionarySpread,
    current: (s, w) => w.maxSpread(s.id),
    text: (c, t) => `Spread to ${of(c, t)} islands`,
  },
  {
    id: "shelf-cleared",
    name: "Shelf Cleared",
    rule: `No unplayed games while owning at least ${SHELF.shelfClearedMinOwned}`,
    social: false,
    target: 1,
    current: (s, w) => {
      const sh = w.shelf(s.id);
      return sh.owned >= SHELF.shelfClearedMinOwned && sh.unplayed === 0 ? 1 : 0;
    },
    text: (c) => (c ? "Every game you own has been played." : "Play every game you own (with at least 10 owned)."),
  },
  {
    id: "crown-collector",
    name: "Crown Collector",
    rule: `Hold ${R.crownCollector} crowns at once`,
    social: true,
    target: R.crownCollector,
    current: (s) => s.maxCrownsHeld,
    text: (c, t) => `${of(c, t)} crowns held at once`,
  },
  {
    id: "usurper",
    name: "Usurper",
    rule: `Take ${R.usurperCrowns} crowns within ${R.usurperWindowDays} days`,
    social: true,
    target: R.usurperCrowns,
    current: (s) => maxInWindow(s.crownTakeTimes, R.usurperWindowDays),
    text: (c, t) => `${of(c, t)} crowns taken in a month`,
  },
  {
    id: "night-owl",
    name: "Night Owl",
    rule: `${R.nightOwlQuests} quests ending after midnight`,
    social: false,
    target: R.nightOwlQuests,
    current: (s) => s.nightOwl,
    text: (c, t) => `${of(c, t)} quests past midnight`,
  },
  {
    id: "comeback",
    name: "Comeback",
    rule: `Win after ${R.comebackLosses} straight losses in the same game`,
    social: true,
    target: 1,
    current: (s) => s.comebacks,
    text: (c) => (c ? "Won one back after three losses." : "Win a game after losing it three times in a row."),
  },
  {
    id: "underdog",
    name: "Underdog",
    rule: `Beat someone with a ${Math.round(R.underdogRate * 100)}%+ head-to-head record against you`,
    social: true,
    target: 1,
    current: (s) => s.underdogs,
    text: (c) => (c ? "Beat a player who usually beats you." : "Beat someone who wins 70% of your meetings."),
  },
  {
    id: "host-with-the-most",
    name: "Host with the Most",
    rule: `Host ${R.hostWithTheMost} quests`,
    social: true,
    target: R.hostWithTheMost,
    current: (s) => s.hosted,
    text: (c, t) => `${of(c, t)} quests hosted`,
  },
  {
    id: "founder",
    name: "Founder",
    rule: "Start a guild that reaches 10 quests",
    social: true,
    target: 10,
    current: (s, w) => w.foundedGuildQuests(s.id),
    text: (c, t) => `Your guild: ${of(c, t)} quests`,
  },
  {
    id: "raider",
    name: "Raider",
    rule: `Finish ${R.raiderRaids} raids`,
    social: false,
    target: R.raiderRaids,
    current: (s) => s.raids,
    text: (c, t) => `${of(c, t)} raids`,
  },
  {
    id: "marathon",
    name: "Marathon",
    rule: `${R.marathonQuests} quests in one day`,
    social: false,
    target: R.marathonQuests,
    current: (s) => Math.max(0, ...s.questsPerDay.values()),
    text: (c, t) => `Best day: ${of(c, t)} quests`,
  },
  {
    id: "regular",
    name: "Regular",
    rule: `Quests in ${R.regularWeeks} weeks in a row`,
    social: false,
    target: R.regularWeeks,
    current: (s) => longestWeekRun(s.weeks),
    text: (c, t) => `${of(c, t)} weeks in a row`,
  },
  {
    id: "fortified",
    name: "Fortified",
    rule: `${R.fortifiedCitadels} games at Citadel or higher`,
    social: false,
    target: R.fortifiedCitadels,
    current: (s) => tilesAtLeast(s, 5),
    text: (c, t) => `${of(c, t)} games at Citadel or higher`,
  },
  {
    id: "mentor",
    name: "Mentor",
    rule: `Teach ${R.mentorGames} different games`,
    social: true,
    target: R.mentorGames,
    current: (s, w) => w.learnersByGame(s.id).size,
    text: (c, t) => `${of(c, t)} games taught`,
  },
  {
    id: "socialite",
    name: "Socialite",
    rule: `Play with ${R.socialitePeople} different people`,
    social: true,
    target: R.socialitePeople,
    current: (s) => s.coplayers.size,
    text: (c, t) => `${of(c, t)} people played with`,
  },
  {
    id: "crowned",
    name: "Crowned",
    rule: "Hold a crown",
    social: true,
    target: 1,
    current: (s) => s.maxCrownsHeld,
    text: (c) => (c ? "You've worn a crown." : "Hold the record on any game."),
  },
  {
    id: "team-player",
    name: "Team Player",
    rule: `${R.teamPlayerWins} co-op wins`,
    social: true,
    target: R.teamPlayerWins,
    current: (s) => s.coopWins,
    text: (c, t) => `${of(c, t)} co-op wins`,
  },
  {
    id: "open-house",
    name: "Open House",
    rule: `Host ${R.openHousePeople} different people`,
    social: true,
    target: R.openHousePeople,
    current: (s) => s.hostedPeople.size,
    text: (c, t) => `${of(c, t)} guests hosted`,
  },
  {
    id: "trailblazer",
    name: "Trailblazer",
    rule: `${R.trailblazerNewLands} new lands within ${R.trailblazerWindowDays} days`,
    social: false,
    target: R.trailblazerNewLands,
    current: (s) => maxInWindow(s.newLandTimes, R.trailblazerWindowDays),
    text: (c, t) => `${of(c, t)} new games in a month`,
  },
  {
    id: "heavyweight",
    name: "Heavyweight",
    rule: `${R.heavyweightPlays} plays of games weighing ${R.heavyweightWeight}+`,
    social: false,
    target: R.heavyweightPlays,
    current: (s) => s.heavyPlays,
    text: (c, t) => `${of(c, t)} heavy plays`,
  },
];

export const TITLE_BY_ID = new Map(TITLES.map((t) => [t.id, t]));

/** Champion titles from campaigns are dynamic: `champion:<campaignId>`. */
export const championTitleId = (campaignId: string) => `champion:${campaignId}`;

export function titleProgress(s: UserState, w: WorldFacts): TitleProgress[] {
  const fixed = TITLES.map((def) => {
    const current = def.current(s, w);
    const earned = s.titles.has(def.id);
    return {
      id: def.id,
      name: def.name,
      rule: def.rule,
      earned,
      current: earned ? Math.max(current, def.target) : current,
      target: def.target,
      text: def.text(earned ? Math.max(current, def.target) : current, def.target),
    };
  });
  const champions = [...s.titles.entries()]
    .filter(([id]) => id.startsWith("champion:"))
    .map(([id, t]) => ({ id, name: t.name, rule: "Won a guild campaign", earned: true, current: 1, target: 1, text: "Campaign champion" }));
  return [...fixed, ...champions];
}

/** Titles newly earned given current state. */
export function newlyEarned(s: UserState, w: WorldFacts): TitleDef[] {
  return TITLES.filter((def) => !s.titles.has(def.id) && def.current(s, w) >= def.target);
}

/** The unearned title closest to completion (by fraction), for nudges. */
export function nearestTitle(s: UserState, w: WorldFacts): { id: string; name: string; text: string } | null {
  let best: { id: string; name: string; text: string; frac: number } | null = null;
  for (const def of TITLES) {
    if (s.titles.has(def.id) || def.target <= 1) continue;
    const c = def.current(s, w);
    const frac = c / def.target;
    if (frac <= 0 || frac >= 1) continue;
    if (!best || frac > best.frac) best = { id: def.id, name: def.name, text: def.text(c, def.target), frac };
  }
  return best ? { id: best.id, name: best.name, text: best.text } : null;
}
