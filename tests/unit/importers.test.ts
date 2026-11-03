import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bgStatsImporter, parseBgStats } from "../../importers/bgstats";
import { bggCsvImporter, parseBggCsv, parseCompactPlayers, parseCsv, parseCsvDate } from "../../importers/bggcsv";
import {
  ImportFormatError,
  detectImporter,
  fnv1a64,
  importers,
  parseImportFile,
  playHash,
} from "../../importers/index";
import type { ImportedPlay, ImportedPlayer } from "../../importers/types";

const sample = (name: string): string =>
  readFileSync(path.resolve(__dirname, "../../importers/samples", name), "utf8");

const BGSTATS = sample("bgstats-sample.json");
const BGG_CSV = sample("bgg-plays-sample.csv");
const BGG_COMPACT = sample("bgg-plays-compact.csv");

const bgsUuid = (n: number): string => `e5b1d6c2-2023-4a00-b000-${String(n).padStart(12, "0")}`;

function playById(plays: readonly ImportedPlay[], sourceId: string): ImportedPlay {
  const play = plays.find((p) => p.sourceId === sourceId);
  if (!play) throw new Error(`no play ${sourceId}`);
  return play;
}

function playerNamed(play: ImportedPlay, name: string): ImportedPlayer {
  const player = play.players.find((p) => p.name === name);
  if (!player) throw new Error(`no player ${name} in ${play.sourceId ?? play.gameName}`);
  return player;
}

/** Minimal valid play for hash tests. */
function makePlay(overrides: Partial<ImportedPlay> = {}): ImportedPlay {
  const player = (name: string): ImportedPlayer => ({
    name,
    sourcePlayerId: null,
    isMe: false,
    score: null,
    winner: false,
    rank: null,
    team: null,
    firstPlay: false,
    color: null,
  });
  return {
    sourceId: null,
    gameName: "Cascadia",
    gameYear: null,
    sourceGameId: null,
    playedAt: "2023-07-02T12:00:00",
    localDate: "2023-07-02",
    durationMin: null,
    location: null,
    cooperative: false,
    coopWin: null,
    quantity: 1,
    incomplete: false,
    notes: null,
    players: [player("Ciao"), player("Priya"), player("Ravi")],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// BG Stats
// ---------------------------------------------------------------------------

describe("BG Stats importer: sample file", () => {
  const { plays, warnings } = parseBgStats(BGSTATS);

  it("imports every non-ignored play and reports the ignored ones once", () => {
    expect(plays).toHaveLength(23);
    expect(warnings).toEqual(["Skipped 2 plays marked as ignored in BG Stats."]);
    const ids = plays.map((p) => p.sourceId);
    expect(ids).not.toContain(bgsUuid(11));
    expect(ids).not.toContain(bgsUuid(22));
    expect(new Set(ids).size).toBe(23);
  });

  it("marks exactly one player per play as me, from userInfo.meRefId", () => {
    for (const play of plays) {
      const me = play.players.filter((p) => p.isMe);
      expect(me).toHaveLength(1);
      expect(me[0]?.name).toBe("Ciao");
    }
  });

  it("maps game, date, location, duration and player fields", () => {
    const play = playById(plays, bgsUuid(1));
    expect(play).toMatchObject({
      gameName: "Cascadia",
      gameYear: 2021,
      sourceGameId: "295947",
      localDate: "2023-01-05",
      playedAt: "2023-01-05T20:15:00",
      durationMin: 45,
      location: "Home",
      quantity: 1,
      incomplete: false,
      notes: null,
    });
    expect(play.players.map((p) => [p.name, p.score, p.rank, p.winner, p.firstPlay])).toEqual([
      ["Ciao", 95, 1, true, true],
      ["Priya", 88, 2, false, true],
      ["Ravi", 81, 3, false, true],
    ]);
    expect(playerNamed(play, "Ciao").sourcePlayerId).toBe("7b0f6a2e-1c4d-4f5e-9a1b-2c3d4e5f6a01");
    expect(playById(plays, bgsUuid(4)).location).toBe("Meeple & Mug Café");
  });

  it("parses string scores as numbers and blank scores as null; rank 0 is null", () => {
    const partial = playById(plays, bgsUuid(12));
    expect(playerNamed(partial, "Ciao").score).toBe(101);
    expect(playerNamed(partial, "Ravi").score).toBeNull();
    expect(playerNamed(partial, "Ravi").rank).toBeNull();
    const noRanks = playById(plays, bgsUuid(18));
    expect(noRanks.players.map((p) => p.rank)).toEqual([null, null]);
  });

  it("treats a 0 duration as unknown", () => {
    expect(playById(plays, bgsUuid(18)).durationMin).toBeNull();
  });

  it("takes cooperative from the game and coopWin from any winner flag", () => {
    const won = playById(plays, bgsUuid(3));
    expect(won.cooperative).toBe(true);
    expect(won.coopWin).toBe(true);
    const lost = playById(plays, bgsUuid(8));
    expect(lost.cooperative).toBe(true);
    expect(lost.coopWin).toBe(false);
    expect(plays.filter((p) => p.cooperative).every((p) => p.gameName === "Pandemic")).toBe(true);
    expect(plays.filter((p) => !p.cooperative).every((p) => p.coopWin === null)).toBe(true);
    expect(plays.filter((p) => p.cooperative)).toHaveLength(5);
  });

  it("keeps teams and maps roles to color", () => {
    const codenames = playById(plays, bgsUuid(6));
    expect(codenames.players.map((p) => [p.name, p.team, p.winner])).toEqual([
      ["Ciao", "Red", true],
      ["Ravi", "Red", true],
      ["Priya", "Blue", false],
    ]);
    expect(playById(plays, bgsUuid(1)).players.every((p) => p.team === null)).toBe(true);
    const roles = playById(plays, bgsUuid(14));
    expect(roles.players.map((p) => p.color)).toEqual(["Medic", "Scientist", "Dispatcher"]);
  });

  it("falls back to the BG Stats game uuid when the game has no BGG id", () => {
    const grandma = playById(plays, bgsUuid(9));
    expect(grandma.gameName).toBe("Grandma's Kitchen Card Game");
    expect(grandma.sourceGameId).toBe("c0ffee00-6a6a-4b4b-8c8c-0d0d0d0d0d06");
    expect(grandma.gameYear).toBeNull();
  });

  it("spans several months", () => {
    const months = new Set(plays.map((p) => p.localDate.slice(0, 7)));
    expect(months.size).toBe(6);
  });
});

describe("BG Stats importer: tolerance", () => {
  const minimal = (plays: unknown[], extra: Record<string, unknown> = {}): string =>
    JSON.stringify({
      games: [{ id: 1, name: "Azul", bggId: 230802, bggYear: 2017 }],
      players: [{ id: 7, name: "Lee" }],
      plays,
      ...extra,
    });

  it("accepts numeric scores, missing optional fields and a missing userInfo", () => {
    const { plays, warnings } = parseBgStats(
      minimal([{ gameRefId: 1, playDate: "2024-02-29", playerScores: [{ playerRefId: 7, score: 12.5 }] }]),
    );
    expect(warnings).toEqual([]);
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({
      sourceId: null,
      localDate: "2024-02-29",
      playedAt: "2024-02-29T12:00:00",
      location: null,
      durationMin: null,
      cooperative: false,
    });
    expect(plays[0]?.players[0]).toMatchObject({ name: "Lee", score: 12.5, isMe: false, sourcePlayerId: "7" });
  });

  it("parses non-numeric scores as null", () => {
    const { plays } = parseBgStats(
      minimal([{ gameRefId: 1, playDate: "2024-01-01 10:00:00", playerScores: [{ playerRefId: 7, score: "n/a" }] }]),
    );
    expect(plays[0]?.players[0]?.score).toBeNull();
  });

  it("warns about and skips plays with an unknown game, a bad date, or a broken shape", () => {
    const { plays, warnings } = parseBgStats(
      minimal([
        { uuid: "p1", gameRefId: 99, playDate: "2024-01-01 10:00:00" },
        { uuid: "p2", gameRefId: 1, playDate: "2024-13-01 10:00:00" },
        { uuid: "p3", playDate: "2024-01-01 10:00:00" },
        { uuid: "p4", gameRefId: 1, playDate: "2024-01-01 10:00:00" },
      ]),
    );
    expect(plays.map((p) => p.sourceId)).toEqual(["p4"]);
    expect(warnings).toHaveLength(3);
    expect(warnings.join("\n")).toMatch(/p1.*unknown game/);
    expect(warnings.join("\n")).toMatch(/p2.*unreadable date/);
    expect(warnings.join("\n")).toMatch(/1 malformed play/);
  });

  it("names players it cannot find instead of dropping them", () => {
    const { plays } = parseBgStats(
      minimal([{ gameRefId: 1, playDate: "2024-01-01", playerScores: [{ playerRefId: 42, score: "3" }] }]),
    );
    expect(plays[0]?.players[0]?.name).toBe("Unknown player 42");
  });

  it("rejects non-JSON and JSON that isn't a BG Stats export", () => {
    expect(() => parseBgStats("not json")).toThrow(/not valid JSON/);
    expect(() => parseBgStats(JSON.stringify({ hello: "world" }))).toThrow(/doesn't look like a BG Stats export/);
  });
});

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

describe("parseCsv", () => {
  it("handles quoted commas, escaped quotes and empty fields", () => {
    expect(parseCsv('a,"b,c","say ""hi""",,e\n').rows).toEqual([["a", "b,c", 'say "hi"', "", "e"]]);
  });

  it("strips a BOM and accepts CRLF, LF and lone CR line endings", () => {
    expect(parseCsv("﻿x,y\r\n1,2\n3,4\r5,6").rows).toEqual([
      ["x", "y"],
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });

  it("keeps embedded newlines in quoted fields, normalizing CRLF to LF", () => {
    expect(parseCsv('a,"line 1\r\nline 2\nline 3"\r\nb,c\r\n').rows).toEqual([
      ["a", "line 1\nline 2\nline 3"],
      ["b", "c"],
    ]);
  });

  it("skips blank lines but keeps rows of empty fields", () => {
    expect(parseCsv("a,b\n\n\r\n,\n").rows).toEqual([
      ["a", "b"],
      ["", ""],
    ]);
  });

  it("is lenient with stray quotes and reports an unterminated quote", () => {
    expect(parseCsv('5" tall,"x"y\n').rows).toEqual([['5" tall', "xy"]]);
    const result = parseCsv('a,"never closed\nb');
    expect(result.unterminatedQuote).toBe(true);
    expect(result.rows).toEqual([["a", "never closed\nb"]]);
  });
});

describe("parseCsvDate", () => {
  it.each([
    ["2023-07-02", "2023-07-02", "2023-07-02T12:00:00"],
    ["2023/7/2", "2023-07-02", "2023-07-02T12:00:00"],
    ["7/2/2023", "2023-07-02", "2023-07-02T12:00:00"],
    ["12/31/2023", "2023-12-31", "2023-12-31T12:00:00"],
    ["2023-07-02 19:05", "2023-07-02", "2023-07-02T19:05:00"],
    ["2023-07-02T19:05:30", "2023-07-02", "2023-07-02T19:05:30"],
    [" 2024-02-29 ", "2024-02-29", "2024-02-29T12:00:00"],
  ])("parses %j", (input, localDate, playedAt) => {
    expect(parseCsvDate(input)).toEqual({ localDate, playedAt });
  });

  it.each(["", "2023-02-30", "13/1/2023", "31/12/2023", "July 2, 2023", "2023-07-02 25:00", "2023-02-29"])(
    "rejects %j",
    (input) => {
      expect(parseCsvDate(input)).toBeNull();
    },
  );
});

// ---------------------------------------------------------------------------
// BGG CSV
// ---------------------------------------------------------------------------

describe("BGG CSV importer: repeated player columns (sample file)", () => {
  const { plays, warnings } = parseBggCsv(BGG_CSV);

  it("imports every row with no warnings", () => {
    expect(warnings).toEqual([]);
    expect(plays).toHaveLength(25);
    expect(plays.every((p) => p.cooperative === false && p.coopWin === null)).toBe(true);
  });

  it("maps the play columns", () => {
    expect(playById(plays, "71230001")).toMatchObject({
      gameName: "Cascadia",
      gameYear: 2021,
      sourceGameId: "295947",
      localDate: "2023-07-02",
      playedAt: "2023-07-02T12:00:00",
      durationMin: 45,
      location: "Home",
      quantity: 1,
      incomplete: false,
      notes: null,
    });
  });

  it("reads players, scores, winners, colors and first plays", () => {
    const tm = playById(plays, "71230005");
    expect(tm.players.map((p) => [p.name, p.score, p.winner, p.color, p.firstPlay])).toEqual([
      ["Ciao", 78, false, "Red", false],
      ["Priya", 83, true, "Green", false],
      ["Ravi", 71, false, "Blue", true],
    ]);
    expect(playerNamed(tm, "Priya").sourcePlayerId).toBe("2210377");
    expect(playerNamed(tm, "Ravi").sourcePlayerId).toBeNull();
  });

  it("detects me by matching the player username to the row username", () => {
    for (const play of plays) {
      expect(play.players.filter((p) => p.isMe).map((p) => p.name)).toEqual(["Ciao"]);
    }
    expect(playById(plays, "71230010").players.map((p) => [p.name, p.isMe])).toEqual([
      ["Priya", false],
      ["Ciao", true],
    ]);
  });

  it("reads quantity, incomplete and games without scores", () => {
    expect(playById(plays, "71230003").quantity).toBe(2);
    expect(playById(plays, "71230009").quantity).toBe(3);
    expect(plays.filter((p) => p.incomplete).map((p) => p.sourceId)).toEqual(["71230008", "71230024"]);
    const hive = playById(plays, "71230003");
    expect(hive.players.map((p) => p.score)).toEqual([null, null]);
    expect(playerNamed(hive, "Priya").winner).toBe(true);
  });

  it("keeps quoted commas, newlines and escaped quotes in comments", () => {
    expect(playById(plays, "71230003").notes).toBe("Best of two, Priya took both.");
    expect(playById(plays, "71230005").notes).toBe(
      "Long one, but worth it.\nVenus track maxed by gen 9, oceans done by gen 11.",
    );
    expect(playById(plays, "71230011").notes).toBe(
      'Grandma said "house rules apply", and she makes the house rules.',
    );
  });

  it("treats blank ids, years, lengths and locations as null", () => {
    const grandma = playById(plays, "71230011");
    expect(grandma.sourceGameId).toBeNull();
    expect(grandma.gameYear).toBeNull();
    expect(playById(plays, "71230008").durationMin).toBeNull();
    expect(playById(plays, "71230021").location).toBeNull();
  });

  it("does not guess cooperative plays from all-win rows", () => {
    const crew = playById(plays, "71230009");
    expect(crew.players.every((p) => p.winner)).toBe(true);
    expect(crew.cooperative).toBe(false);
  });
});

describe("BGG CSV importer: single players column (compact sample)", () => {
  const { plays, warnings } = parseBggCsv(BGG_COMPACT);
  const summary = (play: ImportedPlay): Array<[string, boolean, number | null, boolean]> =>
    play.players.map((p) => [p.name, p.isMe, p.score, p.winner]);

  it("imports all rows with M/D/YYYY and ISO dates", () => {
    expect(warnings).toEqual([]);
    expect(plays.map((p) => p.localDate)).toEqual([
      "2023-11-04",
      "2023-11-05",
      "2023-11-07",
      "2023-11-11",
      "2023-11-12",
      "2023-12-01",
    ]);
  });

  it("reads the free-text grammar with (me), scores and W flags", () => {
    expect(summary(playById(plays, "101"))).toEqual([
      ["Ciao", true, 45, true],
      ["Priya", false, 41, false],
      ["Ravi", false, 38, false],
    ]);
    expect(summary(playById(plays, "103"))).toEqual([
      ["Ciao", true, null, true],
      ["Ravi", false, null, false],
    ]);
    expect(playById(plays, "103").quantity).toBe(2);
  });

  it("reads the pipe grammar", () => {
    expect(summary(playById(plays, "102"))).toEqual([
      ["Ciao", false, 84, false],
      ["Priya", false, 90, true],
    ]);
    const azul = playById(plays, "106");
    expect(azul.players.map((p) => [p.name, p.isMe, p.score, p.winner, p.firstPlay, p.color])).toEqual([
      ["Ciao", true, 66, true, false, "blue"],
      ["Priya", false, 54, false, true, "green"],
    ]);
  });

  it("reads new flags and bracketed colors", () => {
    expect(playerNamed(playById(plays, "104"), "Ravi")).toMatchObject({ winner: true, firstPlay: true });
    expect(playerNamed(playById(plays, "105"), "Ciao")).toMatchObject({ isMe: true, score: 12, color: "red" });
  });

  it("uses header aliases (Game, Game ID, Notes, Play ID)", () => {
    expect(playById(plays, "102")).toMatchObject({
      gameName: "Wingspan",
      sourceGameId: "266192",
      notes: "Close one, 6 points.",
    });
  });
});

describe("parseCompactPlayers", () => {
  it("parses the examples from the grammar", () => {
    expect(parseCompactPlayers("Ciao (me) 45 W; Priya 41; Ravi 38").map((p) => [p.name, p.isMe, p.score, p.winner])).toEqual([
      ["Ciao", true, 45, true],
      ["Priya", false, 41, false],
      ["Ravi", false, 38, false],
    ]);
    expect(parseCompactPlayers("Ciao|45|1;Priya|41|0").map((p) => [p.name, p.score, p.winner])).toEqual([
      ["Ciao", 45, true],
      ["Priya", 41, false],
    ]);
  });

  it("handles multi-word names, negative and decimal scores, and flags in any order", () => {
    expect(
      parseCompactPlayers("Mary Jane W 12.5 ; Old Tom -3 new;;  ").map((p) => [p.name, p.score, p.winner, p.firstPlay]),
    ).toEqual([
      ["Mary Jane", 12.5, true, false],
      ["Old Tom", -3, false, true],
    ]);
  });

  it("never consumes the whole entry as flags or score", () => {
    expect(parseCompactPlayers("W; 42").map((p) => [p.name, p.score, p.winner])).toEqual([
      ["W", null, false],
      ["42", null, false],
    ]);
  });

  it("matches pipe usernames against the row's me usernames", () => {
    const players = parseCompactPlayers("Ciao|1|0||Blue|CiaoPlays;Priya|2|1", { usernames: new Set(["ciaoplays"]) });
    expect(players.map((p) => [p.name, p.isMe, p.sourcePlayerId])).toEqual([
      ["Ciao", true, "CiaoPlays"],
      ["Priya", false, null],
    ]);
  });
});

describe("BGG CSV importer: header variants and row errors", () => {
  it("accepts player_1_name style columns, mixed case and a preamble line", () => {
    const csv = [
      "My plays export",
      "Play_ID,Play Date,ObjectName,Duration,Me,Player_1_Name,Player_1_Score,Player_1_Win,Player_1_Username,Player_2_Name,Player_2_Score,Player_2_Win,Player_2_Username,Player_2_Team",
      "9,2024-03-01,Catan,60,ciao,Ciao,10,1,ciao,Bea,8,0,,Blue",
    ].join("\n");
    const { plays, warnings } = parseBggCsv(csv);
    expect(warnings).toEqual([]);
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({ sourceId: "9", gameName: "Catan", durationMin: 60, localDate: "2024-03-01" });
    expect(plays[0]?.players.map((p) => [p.name, p.isMe, p.score, p.winner, p.team])).toEqual([
      ["Ciao", true, 10, true, null],
      ["Bea", false, 8, false, "Blue"],
    ]);
  });

  it("handles a BOM, CRLF line endings, escaped quotes and embedded newlines inline", () => {
    const csv =
      "﻿date,game,players,notes,incomplete,quantity\r\n" +
      '2024-01-02,"Codenames","Ana W; Ben","She said ""blue""\r\nthen won",true,0\r\n' +
      '1/3/2024,Hive,"Ana|1|1;Ben|0|0",,false,x\r\n';
    const { plays, warnings } = parseBggCsv(csv);
    expect(warnings).toEqual([]);
    expect(plays).toHaveLength(2);
    expect(plays[0]).toMatchObject({
      gameName: "Codenames",
      notes: 'She said "blue"\nthen won',
      incomplete: true,
      quantity: 1,
      sourceId: null,
    });
    expect(plays[0]?.players.map((p) => [p.name, p.winner])).toEqual([
      ["Ana", true],
      ["Ben", false],
    ]);
    expect(plays[1]).toMatchObject({ gameName: "Hive", localDate: "2024-01-03", incomplete: false, quantity: 1 });
  });

  it("warns about and skips rows with no game name or an unreadable date", () => {
    const csv = "game,date\n,2024-01-01\nAzul,someday\nAzul,\nAzul,2024-01-05\n";
    const { plays, warnings } = parseBggCsv(csv);
    expect(plays.map((p) => p.localDate)).toEqual(["2024-01-05"]);
    expect(warnings).toEqual([
      "Row 2: no game name; skipped.",
      'Row 3 (Azul): unreadable date "someday"; skipped.',
      "Row 4 (Azul): no date; skipped.",
    ]);
  });

  it("rejects a CSV without game and date headers", () => {
    expect(() => parseBggCsv("foo,bar\n1,2\n")).toThrow(/no recognizable header row/);
  });
});

// ---------------------------------------------------------------------------
// Detection and the entry point
// ---------------------------------------------------------------------------

describe("detectImporter", () => {
  it("lists both importers", () => {
    expect(importers.map((i) => i.id)).toEqual(["bgstats", "bgg-csv"]);
  });

  it("picks the importer for each sample", () => {
    expect(detectImporter("BGStatsExport.json", BGSTATS.slice(0, 4096))).toBe(bgStatsImporter);
    expect(detectImporter("plays.CSV", BGG_CSV.slice(0, 4096))).toBe(bggCsvImporter);
    expect(detectImporter("compact.csv", BGG_COMPACT)).toBe(bggCsvImporter);
  });

  it("accepts BG Stats JSON by its plays/games keys alone", () => {
    expect(detectImporter("export.json", '{"games": [], "plays": []}')).toBe(bgStatsImporter);
  });

  it("returns null for the wrong extension or unrelated content", () => {
    expect(detectImporter("BGStatsExport.txt", BGSTATS)).toBeNull();
    expect(detectImporter("plays.json", BGG_CSV)).toBeNull();
    expect(detectImporter("package.json", '{"name": "x", "version": "1.0.0"}')).toBeNull();
    expect(detectImporter("contacts.csv", "first,last,email\nA,B,a@b.c\n")).toBeNull();
    expect(detectImporter("noext", BGG_CSV)).toBeNull();
  });
});

describe("parseImportFile", () => {
  it("parses each sample and reports which importer ran", () => {
    expect(parseImportFile("bgstats.json", BGSTATS)).toMatchObject({ importer: "bgstats" });
    expect(parseImportFile("plays.csv", BGG_CSV).plays).toHaveLength(25);
    expect(parseImportFile("compact.csv", BGG_COMPACT).importer).toBe("bgg-csv");
  });

  it("throws ImportFormatError for garbage, empty and unsupported files", () => {
    const attempt = (name: string, text: string): ImportFormatError => {
      try {
        parseImportFile(name, text);
      } catch (error) {
        if (error instanceof ImportFormatError) return error;
        throw error;
      }
      throw new Error("expected parseImportFile to throw");
    };
    const garbage = attempt("random.bin", "\u0000\u0001garbage");
    expect(garbage.code).toBe("unrecognized");
    expect(garbage.message).toMatch(/couldn't recognize "random.bin"/);
    expect(attempt("plays.csv", "   \n").code).toBe("unrecognized");
    expect(attempt("notes.csv", "hello world\n").code).toBe("unrecognized");
  });

  it("throws an 'invalid' ImportFormatError when the matching importer fails", () => {
    const broken = '{"plays": [ {"playerScores": ';
    expect(() => parseImportFile("export.json", broken)).toThrow(ImportFormatError);
    try {
      parseImportFile("export.json", broken);
    } catch (error) {
      expect(error).toBeInstanceOf(ImportFormatError);
      expect(error).toMatchObject({ code: "invalid", importer: "bgstats", name: "ImportFormatError" });
      expect((error as Error).message).toMatch(/not valid JSON/);
    }
  });
});

describe("playHash", () => {
  it("implements 64-bit FNV-1a", () => {
    expect(fnv1a64("")).toBe("cbf29ce484222325");
    expect(fnv1a64("a")).toBe("af63dc4c8601ec8c");
    expect(fnv1a64("foobar")).toBe("85944171f73967e8");
  });

  it("is stable and 16 hex digits", () => {
    const hash = playHash(makePlay());
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(playHash(makePlay())).toBe(hash);
  });

  it("ignores player order, name case/whitespace, scores and other fields", () => {
    const base = makePlay();
    const shuffled = makePlay({
      gameName: "  CASCADIA ",
      playedAt: "2023-07-02T21:00:00",
      sourceId: "abc",
      quantity: 2,
      players: [...base.players].reverse().map((p, i) => ({ ...p, name: ` ${p.name.toUpperCase()} `, score: i })),
    });
    expect(playHash(shuffled)).toBe(playHash(base));
  });

  it("changes with the game, the date or the set of players", () => {
    const base = playHash(makePlay());
    expect(playHash(makePlay({ gameName: "Wingspan" }))).not.toBe(base);
    expect(playHash(makePlay({ localDate: "2023-07-03" }))).not.toBe(base);
    const fewer = makePlay();
    expect(playHash({ ...fewer, players: fewer.players.slice(0, 2) })).not.toBe(base);
  });

  it("matches the same play imported from different sources", () => {
    const csv = parseBggCsv("game,date,players\nCascadia,7/2/2023,Ravi 79; Ciao (me) 92 W; Priya 88\n").plays[0];
    if (!csv) throw new Error("no play");
    expect(playHash(csv)).toBe(playHash(makePlay()));
  });
});
