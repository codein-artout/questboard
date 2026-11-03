# Catalog entry format (one JSON array per part file)

Each entry:
{
  "slug": "wingspan",                 // lowercase kebab-case of the name, ascii only; stable
  "name": "Wingspan",
  "altNames": [],                     // other common names / spellings / abbreviations people search for (e.g. "TI4", "Settlers of Catan"). [] if none
  "short": null,                      // optional monogram <= 8 chars for long names (e.g. "T. Mars", "BotC", "TI4"); null to auto-generate
  "year": 2019,                       // first publication year, or null if unsure
  "minPlayers": 1, "maxPlayers": 5,   // or null if unsure
  "minTime": 40, "maxTime": 70,       // play time in minutes as printed on the box, or null if unsure
  "weight": 2.4,                      // complexity 1.0-5.0 (one decimal), community-consensus style, or null if unsure
  "categories": ["Animals", "Card Game"],          // ONLY from the category list below
  "mechanics": ["Engine Building", "Hand Management"], // ONLY from the mechanic list below
  "scoring": "points",                // one of: "points" | "win-lose" | "co-op" | "ranked" | "teams"
  "baseGame": null                    // for expansions: the slug of the base game (must also be in the catalog); else null
}

scoring guide: points = highest score wins (most euros). win-lose = winner without meaningful score (chess, hive, most duels, last-player-standing). co-op = players win or lose together. ranked = finishing order matters but scores aren't comparable (racing, elimination order). teams = two or more teams compete (Codenames, The Resistance, Werewolf, Decrypto).

CATEGORIES (exact strings):
Abstract Strategy, Action / Dexterity, Adventure, Age of Reason, American West, Ancient, Animals, Arabian, Aviation / Flight, Bluffing, Card Game, Children's Game, City Building, Civilization, Collectible Components, Comic Book / Strip, Deduction, Dice, Economic, Educational, Environmental, Exploration, Fantasy, Farming, Fighting, Horror, Humor, Industry / Manufacturing, Mafia, Math, Mature / Adult, Medical, Medieval, Memory, Miniatures, Modern Warfare, Movies / TV / Radio theme, Murder / Mystery, Music, Mythology, Napoleonic, Nautical, Negotiation, Novel-based, Number, Party Game, Pirates, Political, Post-Napoleonic, Prehistoric, Puzzle, Racing, Real-time, Renaissance, Science Fiction, Space Exploration, Spies / Secret Agents, Sports, Territory Building, Trains, Transportation, Travel, Trivia, Video Game Theme, Wargame, Word Game, World War I, World War II, Zombies

MECHANICS (exact strings):
Action Points, Action Drafting, Action Queue, Area Majority / Influence, Area Movement, Auction / Bidding, Bag Building, Betting and Bluffing, Campaign / Battle Card Driven, Card Drafting, Card Play Conflict Resolution, Communication Limits, Cooperative Game, Deck Building, Dice Rolling, Drafting, Drawing, Engine Building, Grid Movement, Hand Management, Hexagon Grid, Hidden Movement, Hidden Roles, Income, Legacy Game, Line Drawing, Memory, Modular Board, Negotiation, Network and Route Building, Open Drafting, Pattern Building, Pick-up and Deliver, Player Elimination, Point to Point Movement, Push Your Luck, Race, Real-Time, Roll / Spin and Move, Rondel, Scenario / Mission / Campaign Game, Set Collection, Simultaneous Action Selection, Solo / Solitaire Game, Storytelling, Tableau Building, Take That, Team-Based Game, Tile Placement, Trading, Trick-taking, Variable Phase Order, Variable Player Powers, Variable Set-up, Voting, Worker Placement, Dice Placement, Paper-and-Pencil, Track Movement, Deduction Clues, Roles with Asymmetric Information

IMPORTANT tag placement (the app derives a "terrain" from these, so be accurate):
- "Cooperative Game" is a MECHANIC: add it to every fully cooperative game (and semi/one-vs-all only if the core is co-op).
- "Deduction", "Bluffing", "Party Game", "Word Game", "Abstract Strategy", "Wargame", "Territory Building" are CATEGORIES.
- "Hidden Roles" and "Area Majority / Influence" are MECHANICS.
