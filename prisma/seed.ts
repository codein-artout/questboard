/**
 * pnpm db:seed — a believable world: 12 players (Ciao is a heavy host with
 * 40+ games and a big shelf), 3 guilds with active campaigns, ~500 quests over
 * 10 months with raids, co-op, ties, guests, disputes, crowns changing hands,
 * teaching chains and tier-ups. Deterministic (seeded PRNG). Ends with a full
 * recompute of derived state.
 */
import { PrismaClient, type PlayerColor, type Prisma } from "@prisma/client";
import { CONFIRMATION } from "../game/config";
import { computePlaces } from "../lib/quest-places";
import type { ScoringType } from "../game/config";

const db = new PrismaClient();
const DAY = 86400000;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261103);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
function sample<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]!);
  return out;
}

const PEOPLE: { handle: string; name: string; color: PlayerColor; privacy?: "PUBLIC" | "FRIENDS" | "PRIVATE" }[] = [
  { handle: "ciao", name: "Ciao", color: "blue", privacy: "PUBLIC" },
  { handle: "priya", name: "Priya", color: "green", privacy: "PUBLIC" },
  { handle: "ravi", name: "Ravi", color: "red" },
  { handle: "meera", name: "Meera", color: "yellow" },
  { handle: "kabir", name: "Kabir", color: "white" },
  { handle: "arjun", name: "Arjun", color: "purple" },
  { handle: "sana", name: "Sana", color: "orange" },
  { handle: "jonas", name: "Jonas", color: "black" },
  { handle: "lena", name: "Lena", color: "red", privacy: "PRIVATE" },
  { handle: "tomas", name: "Tomas", color: "green" },
  { handle: "noor", name: "Noor", color: "purple" },
  { handle: "eli", name: "Eli", color: "yellow" },
];

const THURSDAY = ["ciao", "priya", "ravi", "meera", "kabir", "arjun"];
const HEAVY = ["ciao", "arjun", "kabir", "jonas", "lena"];
const PARTY = ["sana", "noor", "tomas", "eli", "meera", "priya"];

const THURSDAY_GAMES = ["cascadia", "cascadia", "cascadia", "wingspan", "wingspan", "the-crew-the-quest-for-planet-nine", "the-crew-the-quest-for-planet-nine", "azul", "codenames", "terraforming-mars", "catan", "everdell", "root", "spirit-island", "wavelength", "just-one", "ark-nova", "blood-on-the-clocktower", "the-resistance", "decrypto", "dune-imperium", "pandemic", "hanabi", "forbidden-island", "telestrations", "gloomhaven", "7-wonders", "splendor", "the-quacks-of-quedlinburg", "wingspan-european-expansion"];
const HEAVY_GAMES = ["twilight-imperium-fourth-edition", "brass-birmingham", "gloomhaven", "spirit-island", "ark-nova", "terraforming-mars", "mage-knight-board-game", "through-the-ages-a-new-story-of-civilization", "scythe", "root", "dune-imperium", "great-western-trail", "a-feast-for-odin"];
const PARTY_GAMES = ["codenames", "wavelength", "just-one", "telestrations", "dixit", "the-resistance-avalon", "secret-hitler", "skull", "coup", "sushi-go-party", "so-clover", "decrypto", "love-letter"];
const DUELS = ["patchwork", "hive", "7-wonders-duel", "jaipur", "santorini", "cascadia", "azul", "lost-cities", "splendor-duel", "codenames-duet", "the-crew-the-quest-for-planet-nine", "onitama", "star-realms", "targi", "schotten-totten", "hanamikoji", "the-fox-in-the-forest", "carcassonne", "kingdomino", "ticket-to-ride", "sky-team"];
const CIAO_SHELF = ["sky-team", "arcs", "heat-pedal-to-the-metal", "lost-ruins-of-arnak", "earthborne-rangers", "frosthaven", "oath-chronicles-of-empire-and-exile", "seti-search-for-extraterrestrial-intelligence", "nucleum", "barrage", "food-chain-magnate", "on-mars", "maracaibo", "pax-pamir-second-edition", "john-company-second-edition", "the-castles-of-burgundy", "concordia", "orleans"];

type GameRow = { id: string; slug: string; name: string; scoring: ScoringType; maxTime: number | null; minTime: number | null; maxPlayers: number | null; weight: number | null };

async function main() {
  const now = new Date();
  const start = new Date(now.getTime() - 300 * DAY);
  console.log("[seed] clearing previous data");
  await db.$transaction([
    db.notification.deleteMany(),
    db.reaction.deleteMany(),
    db.comment.deleteMany(),
    db.report.deleteMany(),
    db.vote.deleteMany(),
    db.nightProposal.deleteMany(),
    db.rsvp.deleteMany(),
    db.questOutcome.deleteMany(),
    db.xpLedger.deleteMany(),
    db.crownChange.deleteMany(),
    db.crown.deleteMany(),
    db.houseRecord.deleteMany(),
    db.taughtBy.deleteMany(),
    db.titleAward.deleteMany(),
    db.playerStats.deleteMany(),
    db.tile.deleteMany(),
    db.guildTile.deleteMany(),
    db.campaignStanding.deleteMany(),
    db.confirmation.deleteMany(),
    db.questParticipant.deleteMany(),
    db.quest.deleteMany(),
    db.gameNight.deleteMany(),
    db.campaign.deleteMany(),
    db.guildMember.deleteMany(),
    db.guild.deleteMany(),
    db.shelfItem.deleteMany(),
    db.guest.deleteMany(),
    db.friendship.deleteMany(),
    db.block.deleteMany(),
    db.importJob.deleteMany(),
    db.questDraft.deleteMany(),
    db.game.deleteMany({ where: { source: "custom" } }),
    db.session.deleteMany(),
    db.account.deleteMany(),
    db.user.deleteMany({ where: { email: { endsWith: "@questboard.local" } } }),
  ]);

  const games = new Map<string, GameRow>((await db.game.findMany({ select: { id: true, slug: true, name: true, scoring: true, maxTime: true, minTime: true, maxPlayers: true, weight: true } })).map((g) => [g.slug, g]));
  if (games.size < 100) throw new Error("Catalog missing: run `pnpm db:setup` first.");
  const g = (slug: string) => {
    const row = games.get(slug);
    if (!row) throw new Error(`Seed game missing from catalog: ${slug}`);
    return row;
  };

  console.log("[seed] players");
  const users = new Map<string, string>();
  for (const [i, p] of PEOPLE.entries()) {
    const email = p.handle === "ciao" ? "host@questboard.local" : `${p.handle}@questboard.local`;
    const u = await db.user.create({
      data: {
        email,
        emailVerified: new Date(),
        handle: p.handle,
        displayName: p.name,
        name: p.name,
        color: p.color,
        privacy: p.privacy ?? "FRIENDS",
        role: p.handle === "ciao" ? "ADMIN" : "USER",
        onboardedAt: new Date(start.getTime() - (20 - i) * DAY),
        createdAt: new Date(start.getTime() - (20 - i) * DAY),
        inviteCode: `invite-${p.handle}`,
      },
    });
    users.set(p.handle, u.id);
  }
  const U = (h: string) => users.get(h)!;

  // Friendships: everyone in a shared guild, plus a few extras.
  const pairs = new Set<string>();
  const befriend = (a: string, b: string) => {
    if (a === b) return;
    const k = [a, b].sort().join("|");
    pairs.add(k);
  };
  for (const group of [THURSDAY, HEAVY, PARTY]) for (const a of group) for (const b of group) befriend(a, b);
  befriend("ciao", "sana");
  befriend("ciao", "tomas");
  befriend("priya", "noor");
  await db.friendship.createMany({
    data: [...pairs].map((k) => {
      const [a, b] = k.split("|") as [string, string];
      return { requesterId: U(a), addresseeId: U(b), status: "accepted" as const, acceptedAt: start };
    }),
  });
  // A pending request for the notification center.
  await db.friendship.create({ data: { requesterId: U("eli"), addresseeId: U("ciao"), status: "pending" } });

  console.log("[seed] guilds and campaigns");
  const mkGuild = async (slug: string, name: string, description: string, founder: string, members: string[]) => {
    const guild = await db.guild.create({ data: { slug, name, description, founderId: U(founder), createdAt: start, inviteCode: `join-${slug}` } });
    await db.guildMember.createMany({ data: members.map((m) => ({ guildId: guild.id, userId: U(m), role: m === founder ? ("owner" as const) : ("member" as const), joinedAt: start })) });
    return guild.id;
  };
  const thursday = await mkGuild("thursday-crew", "Thursday Crew", "Thursday nights, mostly at Ciao’s.", "ciao", THURSDAY);
  const heavy = await mkGuild("heavy-hitters", "Heavy Hitters", "Long games, longer nights.", "arjun", HEAVY);
  const party = await mkGuild("party-reef", "Party Reef", "Loud games for big tables.", "sana", PARTY);

  const week = 7 * DAY;
  const atHour = (d: Date, h: number, m = 0) => {
    const x = new Date(d);
    x.setUTCHours(h, m, 0, 0);
    return x;
  };
  const campaigns: { id: string; guildId: string; startsAt: Date; endsAt: Date; finaleNightId?: string }[] = [];
  const mkCampaign = async (guildId: string, name: string, startsAt: Date, weeks: number, host: string, location: string) => {
    const endsAt = new Date(startsAt.getTime() + weeks * week);
    const c = await db.campaign.create({ data: { guildId, name, startsAt, endsAt: atHour(endsAt, 20), createdById: U(host) } });
    const finale = await db.gameNight.create({
      data: { hostId: U(host), guildId, campaignId: c.id, isFinale: true, title: `${name} finale`, startsAt: atHour(endsAt, 19), location },
    });
    campaigns.push({ id: c.id, guildId, startsAt, endsAt: atHour(endsAt, 20), finaleNightId: finale.id });
    return c.id;
  };
  await mkCampaign(thursday, "Summer campaign", new Date(now.getTime() - 25 * week), 10, "ciao", "Ciao’s");
  await mkCampaign(thursday, "Autumn campaign", new Date(now.getTime() - 5.5 * week), 10, "ciao", "Ciao’s");
  await mkCampaign(heavy, "Long nights", new Date(now.getTime() - 2.5 * week), 10, "arjun", "Arjun’s");
  await mkCampaign(party, "Winter cup", new Date(now.getTime() - 4 * week), 8, "sana", "Sana’s");

  // Guests owned by Ciao and Priya.
  const sam = await db.guest.create({ data: { ownerId: U("ciao"), name: "Sam", claimToken: "claim-sam" } });
  const zoe = await db.guest.create({ data: { ownerId: U("priya"), name: "Zoe", claimToken: "claim-zoe" } });

  console.log("[seed] shelves");
  const shelfRows: Prisma.ShelfItemCreateManyInput[] = [];
  CIAO_SHELF.forEach((slug, i) => {
    if (!games.has(slug)) return;
    shelfRows.push({ userId: U("ciao"), gameId: g(slug).id, acquiredAt: new Date(now.getTime() - (20 + i * 23) * DAY), source: i % 3 ? "manual" : "onboarding" });
  });
  // Ciao also owns most games played at his place.
  for (const slug of new Set([...THURSDAY_GAMES, ...DUELS.slice(0, 10)])) {
    if (!games.has(slug)) continue;
    if (slug === "sky-team") continue;
    shelfRows.push({ userId: U("ciao"), gameId: g(slug).id, acquiredAt: new Date(start.getTime() - 200 * DAY), source: "manual" });
  }
  for (const [h, slugs] of [["priya", ["heat-pedal-to-the-metal", "harmonies", "faraway", "patchwork", "hive"]], ["arjun", ["twilight-imperium-fourth-edition", "brass-birmingham", "arcs", "oath-chronicles-of-empire-and-exile"]], ["sana", ["dixit", "codenames", "wavelength", "so-clover", "just-one"]]] as const) {
    for (const s of slugs) if (games.has(s)) shelfRows.push({ userId: U(h), gameId: g(s).id, acquiredAt: new Date(now.getTime() - 200 * DAY), source: "manual" });
  }
  await db.shelfItem.createMany({ data: shelfRows, skipDuplicates: true });

  console.log("[seed] quests");
  type Seat = { user?: string; guest?: string };
  type Plan = { slug: string; at: Date; seats: Seat[]; guild?: string; host?: string; location?: string; night?: string };
  const plans: Plan[] = [];
  const nightIds = new Map<string, string>();

  // Thursday nights at Ciao's (mostly), 2-3 quests each.
  for (let t = start.getTime() + 3 * DAY; t < now.getTime() - DAY; t += week) {
    const day = new Date(t);
    const hostH = chance(0.7) ? "ciao" : pick(THURSDAY);
    const night = await db.gameNight.create({
      data: { hostId: U(hostH), guildId: thursday, startsAt: atHour(day, 19), location: hostH === "ciao" ? "Ciao’s" : `${PEOPLE.find((p) => p.handle === hostH)!.name}’s`, createdAt: new Date(t - 5 * DAY) },
    });
    nightIds.set(night.id, hostH);
    const n = int(2, 3);
    for (let k = 0; k < n; k++) {
      const slug = pick(THURSDAY_GAMES);
      const max = Math.min(g(slug).maxPlayers ?? 5, 6);
      const size = Math.max(2, Math.min(max, int(3, 5)));
      const people = sample(THURSDAY.filter((x) => x !== hostH), size - 1).concat(hostH);
      const seats: Seat[] = people.map((u) => ({ user: u }));
      if (chance(0.12) && seats.length < max) seats.push({ guest: hostH === "ciao" ? sam.id : zoe.id });
      plans.push({ slug, at: atHour(day, 19 + k * 1, int(0, 50)), seats, guild: thursday, host: hostH, location: hostH === "ciao" ? "Ciao’s place" : undefined, night: night.id });
    }
  }
  // Heavy Hitters: every ~10 days, one raid-ish game. TI4 at Arjun's ends late.
  for (let t = start.getTime() + 5 * DAY; t < now.getTime() - 2 * DAY; t += 10 * DAY) {
    const day = new Date(t);
    const slug = chance(0.25) ? "twilight-imperium-fourth-edition" : pick(HEAVY_GAMES);
    if (!games.has(slug)) continue;
    const max = Math.min(g(slug).maxPlayers ?? 4, 5);
    const people = sample(HEAVY, Math.max(2, Math.min(max, int(3, 5))));
    const host = chance(0.5) ? "arjun" : people[0]!;
    if (!people.includes(host)) people[0] = host;
    plans.push({ slug, at: atHour(day, slug.startsWith("twilight") ? 17 : 19, 15), seats: people.map((u) => ({ user: u })), guild: heavy, host, location: `${PEOPLE.find((p) => p.handle === host)!.name}’s place` });
  }
  // Party Reef: every ~6 days, 2 party games.
  for (let t = start.getTime() + 2 * DAY; t < now.getTime() - DAY; t += 6 * DAY) {
    const day = new Date(t);
    const host = pick(PARTY);
    for (let k = 0; k < 2; k++) {
      const slug = pick(PARTY_GAMES);
      if (!games.has(slug)) continue;
      const max = Math.min(g(slug).maxPlayers ?? 8, 6);
      const people = sample(PARTY.filter((x) => x !== host), Math.max(2, Math.min(max, int(4, 6))) - 1).concat(host);
      plans.push({ slug, at: atHour(day, 20 + k, int(0, 40)), seats: people.map((u) => ({ user: u })), guild: party, host });
    }
  }
  // Ciao and Priya duels (Ciao's place), plus Ciao's Cascadia habit.
  for (let t = start.getTime(); t < now.getTime() - DAY; t += int(2, 4) * DAY) {
    const day = new Date(t);
    const slug = chance(0.42) ? "cascadia" : pick(DUELS);
    if (!games.has(slug) || slug === "sky-team") continue;
    plans.push({ slug, at: atHour(day, 21, int(0, 50)), seats: [{ user: "ciao" }, { user: "priya" }], host: "ciao", location: "Ciao’s place" });
  }
  // Teaching chains: Ciao teaches Priya, Priya teaches Sana, Sana teaches Noor and Tomas.
  const chainGames = ["harmonies", "faraway"].filter((s) => games.has(s));
  for (const [i, slug] of chainGames.entries()) {
    const base = start.getTime() + (40 + i * 30) * DAY;
    plans.push({ slug, at: new Date(base), seats: [{ user: "ciao" }, { user: "priya" }], host: "ciao" });
    plans.push({ slug, at: new Date(base + 2 * DAY), seats: [{ user: "ciao" }, { user: "priya" }], host: "ciao" });
    plans.push({ slug, at: new Date(base + 10 * DAY), seats: [{ user: "priya" }, { user: "sana" }], host: "priya" });
    plans.push({ slug, at: new Date(base + 20 * DAY), seats: [{ user: "sana" }, { user: "noor" }, { user: "tomas" }], host: "sana" });
    plans.push({ slug, at: new Date(base + 30 * DAY), seats: [{ user: "noor" }, { user: "eli" }], host: "noor" });
  }
  // Random pair plays among friends.
  const friendList = [...pairs].map((k) => k.split("|") as [string, string]);
  for (let i = 0; i < 150; i++) {
    const [a, b] = pick(friendList);
    const slug = pick([...DUELS, ...THURSDAY_GAMES]);
    if (!games.has(slug) || slug === "sky-team") continue;
    plans.push({ slug, at: new Date(start.getTime() + rand() * (now.getTime() - start.getTime() - 3 * DAY)), seats: [{ user: a }, { user: b }], host: chance(0.5) ? a : b });
  }

  plans.sort((a, b) => a.at.getTime() - b.at.getTime());
  const meanFor = (slug: string) => 40 + (slug.split("").reduce((n, c) => n + c.charCodeAt(0), 0) % 80);
  let created = 0;
  for (const p of plans) {
    const game = g(p.slug);
    const mode = game.scoring;
    const mean = meanFor(p.slug);
    const raid = (game.weight ?? 0) >= 3.5 || (game.maxTime ?? 0) >= 180;
    const durationMin = p.slug.startsWith("twilight") ? int(300, 400) : Math.max(15, Math.round(((game.minTime ?? 30) + (game.maxTime ?? game.minTime ?? 60)) / 2 + int(-10, 25)));
    const skill: Record<string, number> = { ciao: 6, priya: 8, arjun: 7, ravi: 3, meera: 5, kabir: 4, jonas: 5, lena: 6, sana: 6, noor: 4, tomas: 3, eli: 2 };
    const teams = ["red", "blue"];
    const parts = p.seats.map((s, i) => {
      const key = s.user ?? "guest";
      const base = mean + (skill[key] ?? 3) * 1.5 + (rand() - 0.5) * mean * 0.45;
      const score = mode === "points" ? Math.max(0, Math.round(base)) : null;
      return { seat: s, i, score, team: mode === "teams" ? teams[i % 2]! : null, won: false };
    });
    if (mode === "points" && parts.length > 2 && chance(0.06)) parts[1]!.score = parts[0]!.score; // ties happen
    if (mode === "win_lose" || mode === "ranked") parts[Math.floor(rand() * parts.length)]!.won = true;
    if (mode === "teams") {
      const w = pick(teams);
      for (const x of parts) x.won = x.team === w;
    }
    const placeInputs = parts.map((x) => ({ key: String(x.i), score: x.score, team: x.team, won: x.won, rank: null }));
    const places = mode === "ranked" ? new Map(parts.map((x) => [String(x.i), x.won ? 1 : 2])) : computePlaces(mode, placeInputs);
    const midScores = mode === "points" && chance(0.2) ? parts.map((x) => (x.score === null ? null : Math.round(x.score * (0.35 + rand() * 0.3)))) : null;
    const age = now.getTime() - p.at.getTime();
    let status: "confirmed" | "pending" | "disputed" = "confirmed";
    if (age < 4 * DAY && chance(0.75)) status = "pending";
    else if (chance(0.02)) status = "disputed";
    // Pending quests were logged recently, so their 48-hour window is still open.
    const createdAt = status === "pending" ? new Date(now.getTime() - int(2, 30) * 3600 * 1000) : new Date(p.at.getTime() + (durationMin + 10) * 60000);
    const logger = p.seats.find((s) => s.user)?.user ?? "ciao";
    const others = p.seats.filter((s) => s.user && s.user !== logger).map((s) => s.user!);
    const quest = await db.quest.create({
      data: {
        gameId: game.id,
        loggedById: U(logger),
        guildId: p.guild ?? null,
        gameNightId: p.night ?? null,
        hostUserId: p.host ? U(p.host) : null,
        location: p.location ?? null,
        playedAt: p.at,
        localDate: p.at.toISOString().slice(0, 10),
        tzOffsetMin: 0,
        durationMin,
        coop: mode === "coop",
        coopWin: mode === "coop" ? chance(0.6) : null,
        difficulty: mode === "coop" ? int(3, 6) : null,
        teams: mode === "teams",
        notes: chance(0.08) ? pick(["Close one.", "First time with the expansion.", "Rules question about end game, sorted.", "New record table setup."]) : null,
        status,
        createdAt,
        autoConfirmAt: new Date(createdAt.getTime() + CONFIRMATION.autoConfirmHours * 3600 * 1000),
        confirmedAt: status === "confirmed" ? new Date(p.at.getTime() + int(1, 30) * 3600 * 1000) : null,
        disputedAt: status === "disputed" ? new Date(p.at.getTime() + 3600 * 1000) : null,
        participants: {
          create: parts.map((x) => ({
            userId: x.seat.user ? U(x.seat.user) : null,
            guestId: x.seat.guest ?? null,
            score: x.score,
            midScore: midScores?.[x.i] ?? null,
            team: x.team,
            place: places.get(String(x.i)) ?? null,
            seat: x.i,
          })),
        },
      },
    });
    if (status === "confirmed" && others.length) {
      await db.confirmation.create({ data: { questId: quest.id, userId: U(others[0]!), kind: "confirm", createdAt: quest.confirmedAt! } });
    }
    if (status === "disputed" && others.length) {
      await db.confirmation.create({ data: { questId: quest.id, userId: U(others[0]!), kind: "dispute", reason: "I think the scores are swapped." } });
    }
    created++;
    void raid;
  }

  // Recent, deliberate cases: a pending first play of Heat (ghost tile) and a pending Wingspan replay.
  const yesterday = new Date(now.getTime() - 20 * 3600 * 1000);
  const heat = g("heat-pedal-to-the-metal");
  await db.quest.create({
    data: {
      gameId: heat.id, loggedById: U("priya"), hostUserId: U("priya"), location: "Priya’s place", playedAt: yesterday, localDate: yesterday.toISOString().slice(0, 10), durationMin: 50,
      status: "pending", autoConfirmAt: new Date(yesterday.getTime() + 48 * 3600 * 1000), createdAt: yesterday,
      participants: { create: [{ userId: U("priya"), place: 1, seat: 0 }, { userId: U("ciao"), place: 2, seat: 1 }, { userId: U("ravi"), place: 3, seat: 2 }] },
    },
  });
  created++;

  // A few imported plays for Lena (counted for her only, at 50% XP).
  for (let i = 0; i < 12; i++) {
    const at = new Date(start.getTime() - (200 - i * 15) * DAY);
    const slug = pick(["brass-birmingham", "terraforming-mars", "gloomhaven", "ark-nova", "great-western-trail"]);
    await db.quest.create({
      data: {
        gameId: g(slug).id, loggedById: U("lena"), playedAt: at, localDate: at.toISOString().slice(0, 10), durationMin: 120, status: "confirmed", source: "import", sourceKey: `seed-import-${i}`,
        coop: g(slug).scoring === "coop", coopWin: g(slug).scoring === "coop" ? true : null,
        participants: { create: [{ userId: U("lena"), score: g(slug).scoring === "points" ? int(60, 140) : null, place: 1, seat: 0 }] },
      },
    });
    created++;
  }
  console.log(`[seed] ${created} quests`);

  console.log("[seed] upcoming game nights, votes, reactions");
  const nextThursday = new Date(now.getTime() + ((4 - now.getUTCDay() + 7) % 7 || 7) * DAY);
  const upcoming = await db.gameNight.create({ data: { hostId: U("ciao"), guildId: thursday, startsAt: atHour(nextThursday, 19), location: "Ciao’s", notes: "Bring snacks. Doors at 7." } });
  await db.rsvp.createMany({ data: [["ciao", "going"], ["priya", "going"], ["ravi", "going"], ["meera", "going"], ["arjun", "maybe"]].map(([h, s]) => ({ gameNightId: upcoming.id, userId: U(h!), status: s as "going" | "maybe" })) });
  const props = [] as { id: string; slug: string }[];
  for (const [slug, by] of [["sky-team", "ciao"], ["cascadia", "priya"], ["arcs", "ciao"]] as const) {
    const pr = await db.nightProposal.create({ data: { gameNightId: upcoming.id, gameId: g(slug).id, proposedById: U(by) } });
    props.push({ id: pr.id, slug });
  }
  const votes: [string, string][] = [["ciao", "sky-team"], ["priya", "sky-team"], ["ravi", "sky-team"], ["meera", "cascadia"]];
  await db.vote.createMany({ data: votes.map(([h, slug]) => ({ gameNightId: upcoming.id, proposalId: props.find((p) => p.slug === slug)!.id, userId: U(h) })) });
  const partyNight = await db.gameNight.create({ data: { hostId: U("sana"), guildId: party, startsAt: atHour(new Date(now.getTime() + 3 * DAY), 20), location: "Sana’s" } });
  await db.rsvp.createMany({ data: ["sana", "noor", "tomas"].map((h) => ({ gameNightId: partyNight.id, userId: U(h), status: "going" as const })) });

  const recent = await db.quest.findMany({ where: { playedAt: { gte: new Date(now.getTime() - 21 * DAY) }, source: "live" }, include: { participants: true }, orderBy: { playedAt: "desc" }, take: 40 });
  for (const q of recent) {
    const members = q.participants.map((p) => p.userId).filter((x): x is string => !!x);
    for (const m of sample(members, int(0, 3))) {
      await db.reaction.create({ data: { questId: q.id, userId: m, kind: pick(["cheer", "gg", "wow", "ouch"]) } }).catch(() => undefined);
    }
    if (chance(0.35) && members.length > 1) {
      await db.comment.create({ data: { questId: q.id, userId: pick(members), body: pick(["Rematch Thursday.", "That last round though.", "Never again with that opening.", "GG all.", "I want the expansion in next time."]), createdAt: new Date(q.playedAt.getTime() + 3 * 3600 * 1000) } });
    }
  }

  console.log("[seed] recomputing derived state");
  const { recompute } = await import("../server/recompute");
  const result = await recompute("all", { notify: false });
  console.log(`[seed] ${result.output.tiles.length} tiles, ${result.output.crowns.length} crowns, ${result.output.titles.length} titles, ${result.output.taughtBy.length} teaching edges`);

  // Notifications that would have been sent live.
  const pending = await db.quest.findMany({ where: { status: "pending" }, include: { participants: true, game: true } });
  for (const q of pending) {
    for (const p of q.participants) {
      if (!p.userId || p.userId === q.loggedById) continue;
      await db.notification.create({ data: { userId: p.userId, type: "confirm_request", data: { title: `${q.game.name} is waiting for your confirmation`, body: "It confirms itself in 48 hours if nobody disputes it.", href: `/quests/${q.id}` }, dedupeKey: `confirm_request:${q.id}` } }).catch(() => undefined);
    }
  }
  const changes = await db.crownChange.findMany({ where: { at: { gte: new Date(now.getTime() - 30 * DAY) }, fromUserId: { not: null } }, include: { game: true }, take: 10, orderBy: { at: "desc" } });
  for (const c of changes) {
    if (!c.toUserId || !c.fromUserId) continue;
    await db.notification.create({ data: { userId: c.fromUserId, type: "crown_lost", data: { title: `Someone took your ${c.game.name} crown`, href: `/games/${c.game.slug}` }, dedupeKey: `seed-crown-lost:${c.id}`, createdAt: c.at } }).catch(() => undefined);
    await db.notification.create({ data: { userId: c.toUserId, type: "crown_taken", data: { title: `You took the ${c.game.name} crown`, href: `/games/${c.game.slug}` }, dedupeKey: `seed-crown-taken:${c.id}`, createdAt: c.at, readAt: c.at } }).catch(() => undefined);
  }
  console.log("[seed] done. Sign in as host@questboard.local (Ciao) with the development sign-in on /signin.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
