/* Last Four In — Franchise Simulator engine. No page code: the page, the calibration script and (build 2) the
   friends-league replayer all use this same file.

   A league is a seed plus a list of moves. Every random number comes from the seed and a label (year, week,
   game, player), never from call order, so replaying the same seed and moves on any device gives the same
   league. Moves are only things a person decides: draft picks, "play the next week", re-sign or let go, cuts.
   Everything the AI teams do is worked out from the state, so it is never stored.

   Two modes, picked by settings.mode:
     The Redraft (default, and every save made before modes existed): every current player in one pool.
       const lg = FranchiseEngine.create(window.FRANCHISE_DATA, { seed, team, slot, userRounds });
     Real Rosters: a real season's rosters and schedule, then the real drafts that followed.
       const lg = FranchiseEngine.create({ ...window.FRANCHISE_SEASONS[year], drafts: window.FRANCHISE_DRAFTS },
                                         { seed, mode: "real", year, team, hindsight });
   FranchiseEngine.apply(lg, { t: "pick", p: playerId });   // or replay(data, save)

   Game week (build A): games are played play by play (simGame). Moves { t: "depth", g, ids } pick starters,
   { t: "plan", plan } sets a standing game plan, { t: "half", plan } changes the plan for the second half of this
   week's game. previewGame shows a game before the week is played; live.times / live.at say which play is on
   screen at any moment, so two browsers with the same start time stay in sync.

   Coach decisions: simGame lists the in-game calls a coach would face (close 4th downs, late two-point tries, a
   banged-up starter, a struggling quarterback, late timeouts) in res.asks, at real-life frequency. The default is what
   the engine always did; { t: "call", k, c, team } answers one for this week's game and changes only what follows it.

   Locker room (build B): fan mood for the user's coach with fan posts and a weekly headline, team morale and player
   mood, and a league news feed, all worked out from the games (lg.fans, lg.tm, lg.mood, lg.news). New leagues pass
   { lr: 1 }: morale then nudges play a little and unhappy players may refuse to re-sign. Stories stay football-only. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FranchiseEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- Teams. [code, city, conference, division, color, second color]. How they show is set by NAME_MODE / LOGOS below. ----
  const TEAMS = [
    ["BUF", "Buffalo", "AFC", "East", "#00338D", "#C60C30"], ["MIA", "Miami", "AFC", "East", "#008E97", "#FC4C02"],
    ["NE", "New England", "AFC", "East", "#002244", "#C60C30"], ["NYJ", "New York", "AFC", "East", "#125740", "#FFFFFF"],
    ["BAL", "Baltimore", "AFC", "North", "#241773", "#9E7C0C"], ["CIN", "Cincinnati", "AFC", "North", "#FB4F14", "#000000"],
    ["CLE", "Cleveland", "AFC", "North", "#311D00", "#FF3C00"], ["PIT", "Pittsburgh", "AFC", "North", "#101820", "#FFB612"],
    ["HOU", "Houston", "AFC", "South", "#03202F", "#A71930"], ["IND", "Indianapolis", "AFC", "South", "#002C5F", "#A2AAAD"],
    ["JAX", "Jacksonville", "AFC", "South", "#006778", "#D7A22A"], ["TEN", "Tennessee", "AFC", "South", "#0C2340", "#4B92DB"],
    ["DEN", "Denver", "AFC", "West", "#FB4F14", "#002244"], ["KC", "Kansas City", "AFC", "West", "#E31837", "#FFB81C"],
    ["LV", "Las Vegas", "AFC", "West", "#000000", "#A5ACAF"], ["LAC", "Los Angeles", "AFC", "West", "#0080C6", "#FFC20E"],
    ["DAL", "Dallas", "NFC", "East", "#041E42", "#869397"], ["NYG", "New York", "NFC", "East", "#0B2265", "#A71930"],
    ["PHI", "Philadelphia", "NFC", "East", "#004C54", "#A5ACAF"], ["WAS", "Washington", "NFC", "East", "#5A1414", "#FFB612"],
    ["CHI", "Chicago", "NFC", "North", "#0B162A", "#C83803"], ["DET", "Detroit", "NFC", "North", "#0076B6", "#B0B7BC"],
    ["GB", "Green Bay", "NFC", "North", "#203731", "#FFB612"], ["MIN", "Minnesota", "NFC", "North", "#4F2683", "#FFC62F"],
    ["ATL", "Atlanta", "NFC", "South", "#A71930", "#000000"], ["CAR", "Carolina", "NFC", "South", "#0085CA", "#101820"],
    ["NO", "New Orleans", "NFC", "South", "#101820", "#D3BC8D"], ["TB", "Tampa Bay", "NFC", "South", "#D50A0A", "#34302B"],
    ["ARI", "Arizona", "NFC", "West", "#97233F", "#000000"], ["LA", "Los Angeles", "NFC", "West", "#003594", "#FFA300"],
    ["SF", "San Francisco", "NFC", "West", "#AA0000", "#B3995D"], ["SEA", "Seattle", "NFC", "West", "#002244", "#69BE28"],
  ].map(([code, city, conf, div, c1, c2], i) => ({ i, code, city, conf, div, c1, c2 }));
  const SHARED_CITY = new Set(["New York", "Los Angeles"]);
  const TEAM_IDX = Object.fromEntries(TEAMS.map((t) => [t.code, t.i]));
  // Real Rosters: the city a franchise played in that season (2002 on), still city only.
  const FIRST_REAL = 2002;
  function cityFor(code, year) {
    const t = TEAMS[TEAM_IDX[code]];
    if (code === "LA" && year <= 2015) return "St. Louis";
    if (code === "LAC" && year <= 2016) return "San Diego";
    if (code === "LV" && year <= 2019) return "Oakland";
    return t.city;
  }
  // Set every team's city for lg.year; a city is "shared" only while two teams play there.
  function setCities(lg) {
    for (const t of lg.teams) { t.city = cityFor(t.code, lg.year); t.nick = nickFor(t.code, lg.year); }
    for (const t of lg.teams) t.shared = lg.teams.filter((x) => x.city === t.city).length > 1;
  }
  const isShared = (t) => (t.shared != null ? t.shared : SHARED_CITY.has(t.city));
  const DIVS = ["East", "North", "South", "West"];

  // ---- Display settings. Change them here and only here. ----
  // The public files carry no player names, no team nicknames and no logos. The private pack (Supabase
  // franchise_pack(), friends only) fills them in through setPack(); without it teams show by city.
  // "full" = city plus nickname (from the pack); "city" = "Kansas City", "New York (NFC)".
  const NAME_MODE = "full";
  let NICK = {}, LOGO = "", LOGO_CODE = {};
  function setPack(pack) {
    NICK = (pack && pack.nick) || {}; LOGO = (pack && pack.logo) || ""; LOGO_CODE = (pack && pack.lc) || {};
  }
  // Washington by era: "Football Team" 2020-21; before 2020 we show the city alone (the old name is not used).
  function nickFor(code, year) {
    if (code === "WAS" && year != null && year <= 2021) return year >= 2020 ? NICK.WAS_FT || "" : "";
    return NICK[code] || "";
  }
  function teamLogo(t) {
    if (!LOGO || !t || t.custom) return "";
    return LOGO.replace("{c}", LOGO_CODE[t.code] || t.code.toLowerCase());
  }
  function teamName(t, short) {
    if (t.custom) return t.custom;
    if (NAME_MODE === "full") {
      const nick = t.nick != null ? t.nick : nickFor(t.code);
      return short && nick ? nick : nick ? `${t.city} ${nick}` : t.city;
    }
    if (NAME_MODE === "city") return isShared(t) ? (short ? `${t.city === "New York" ? "NY" : "LA"} ${t.conf}` : `${t.city} (${t.conf})`) : t.city;
    return t.city;
  }
  // Short label for tight spots (score lines, ticker). Full mode: the team's usual letters, by city of that season.
  function teamShort(t) {
    if (t.custom) return t.custom.slice(0, 4).toUpperCase();
    if (NAME_MODE === "full") return { "St. Louis": "STL", "San Diego": "SD", Oakland: "OAK" }[t.city] || t.code;
    if (isShared(t)) return (t.city === "New York" ? "NY" : "LA") + "-" + t.conf[0];
    return { "St. Louis": "STL", "San Diego": "SD", "Green Bay": "GB", "Kansas City": "KC", "Las Vegas": "LV", "New England": "NE", "New Orleans": "NO",
             "San Francisco": "SF", "Tampa Bay": "TB" }[t.city] || t.city.slice(0, 3).toUpperCase();
  }

  // ---- Positions ----
  const GROUPS = ["QB", "RB", "WR", "TE", "OL", "DL", "ED", "LB", "CB", "S", "K", "P"];
  const GROUP_NAME = { QB: "Quarterback", RB: "Running back", WR: "Receiver", TE: "Tight end", OL: "Offensive line",
    DL: "Interior line", ED: "Edge rusher", LB: "Linebacker", CB: "Cornerback", S: "Safety", K: "Kicker", P: "Punter" };
  const STARTERS = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DL: 2, ED: 2, LB: 2, CB: 3, S: 2, K: 1, P: 1 };
  const TARGET = { QB: 3, RB: 4, WR: 6, TE: 3, OL: 9, DL: 5, ED: 5, LB: 5, CB: 6, S: 4, K: 1, P: 1 }; // 52 + 1 spare
  const MAXPOS = { QB: 3, RB: 5, WR: 8, TE: 4, OL: 11, DL: 7, ED: 7, LB: 7, CB: 8, S: 6, K: 1, P: 1 };
  const MINPOS = { QB: 2, RB: 3, WR: 5, TE: 2, OL: 8, DL: 4, ED: 4, LB: 4, CB: 5, S: 3, K: 1, P: 1 };
  const ROSTER = 53;
  const REDRAFT_ROUNDS = 53;
  const ROOKIE_ROUNDS = 7;

  // ---- Seeded random numbers: every draw is labelled, so call order never matters. ----
  function hash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function rng(seed, ...label) {
    let a = hash(seed + "|" + label.join("|"));
    const next = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    next.normal = () => { let u = 0, v = 0; while (!u) u = next(); while (!v) v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    next.int = (n) => Math.floor(next() * n);
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.poisson = (l) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= next(); } while (p > L); return k - 1; };
    next.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    return next;
  }
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const r1 = (x) => Math.round(x * 10) / 10;

  // ---- Real player names: the kill switch ----
  // true (default): real players show their real names. false: every real player shows a made-up name worked out
  // from his player id, so it is the same name on every load and every device, everywhere in the feature; position,
  // grade, age and team stay. Made-up rookies keep their own names either way. No photos or headshots, ever.
  const REAL_NAMES = true;
  const FAKE_FIRST = ["Aaron", "Abe", "Ace", "Adrian", "Alec", "Alonzo", "Amari", "Ansel", "Archer", "Arlo", "August", "Barrett", "Beau", "Bennett",
    "Blaine", "Bo", "Brady", "Brennan", "Brock", "Byron", "Carson", "Cedric", "Chance", "Clay", "Clint", "Colby", "Conrad", "Corey", "Cruz", "Curtis",
    "Dane", "Dawson", "Deacon", "Dexter", "Dorian", "Drew", "Duke", "Eli", "Emory", "Ezra", "Felix", "Finn", "Floyd", "Garrett", "Gideon", "Glen",
    "Grady", "Hank", "Harvey", "Heath", "Hollis", "Hudson", "Ike", "Ira", "Jasper", "Jett", "Joel", "Judd", "Kai", "Kendrick", "Knox", "Lamar",
    "Lane", "Lennox", "Levi", "Lionel", "Lyle", "Mack", "Malcolm", "Marlon", "Maurice", "Monty", "Nash", "Nolan", "Orlando", "Otis", "Parker",
    "Percy", "Quentin", "Rafael", "Reggie", "Rhett", "Rocco", "Rowan", "Royce", "Russell", "Sawyer", "Shea", "Simon", "Sterling", "Tanner",
    "Tobias", "Troy", "Tucker", "Vaughn", "Vernon", "Wade", "Walker", "Warren", "Wyatt", "Yusuf", "Zane", "Ellis", "Cyrus", "Damon", "Fletcher"];
  const FAKE_LAST = ["Ackerly", "Aldridge", "Ambrose", "Ashby", "Atwell", "Bannister", "Barnaby", "Beasley", "Birch", "Blackwood", "Bolden",
    "Bramlett", "Briggs", "Burnside", "Cady", "Carmody", "Cartwright", "Chambliss", "Claymore", "Colvin", "Corbett", "Cragg", "Culpepper",
    "Darrow", "Deakins", "Denham", "Dillard", "Dorsett", "Drummond", "Duvall", "Eastman", "Edgerton", "Elmore", "Emberly", "Fairbanks",
    "Farrow", "Fennimore", "Finch", "Flournoy", "Forsythe", "Garland", "Gentry", "Gilchrist", "Goodwin", "Granger", "Greer", "Hagan",
    "Halloway", "Harkins", "Hatcher", "Haverty", "Hightower", "Hollins", "Horne", "Huxley", "Inman", "Jarrell", "Jeffers", "Kearney",
    "Kendall", "Kingsley", "Kirkland", "Lacey", "Larkin", "Leland", "Linwood", "Lombard", "Lundy", "Mabry", "Marlow", "McAlister",
    "Merriweather", "Milburn", "Montague", "Moseley", "Nesbitt", "Northcutt", "Oldham", "Orr", "Overton", "Paxton", "Pendleton", "Pettigrew",
    "Prather", "Quill", "Radcliffe", "Rainey", "Rawlings", "Renfro", "Rockwell", "Rowland", "Rutledge", "Satterfield", "Searcy", "Shelby",
    "Slade", "Spalding", "Stallworth", "Stroud", "Sumner", "Tackett", "Teague", "Thurman", "Tillery", "Truitt", "Upton", "Vickers", "Waddell",
    "Wainwright", "Westbrook", "Whitlock", "Wilder", "Woodard", "Wyndham", "Yancey", "Yarbrough", "Zeller", "Ashworth", "Bellamy", "Cromartie",
    "Dabney", "Eldridge", "Gatlin", "Hargrove", "Kimbrough", "Langston", "Mayweather", "Penrose", "Ridley", "Stanfield", "Tolliver", "Whitaker"];
  function fakeName(id) { const h = hash("name|" + id); return FAKE_FIRST[h % FAKE_FIRST.length] + " " + FAKE_LAST[Math.floor(h / FAKE_FIRST.length) % FAKE_LAST.length]; }
  const shownName = (p) => (REAL_NAMES ? p.name : fakeName(p.id));

  // ---- Create a league ----
  // opts: seed (string), team (0-31, the user's franchise), slot (1-32 draft slot, 0 = random),
  //       userRounds (how many Redraft rounds the user picks; the AI drafts the rest for them),
  //       straight (1 = the same order every round instead of a snake; the League Redraft page offers it).
  function create(data, opts) {
    if (opts.mode === "real") return createReal(data, opts);
    const seed = String(opts.seed || Date.now().toString(36));
    const cols = data.cols;
    const players = {};
    for (const row of data.players) {
      const p = {}; cols.forEach((c, i) => (p[c] = row[i]));
      p.name = shownName(p); p.real = p.team; p.team = -1; p.inj = 0; p.yrs = 0; p.rookie = false; p.born = data.season - p.age;
      players[p.id] = p;
    }
    const lg = {
      v: 1, seed, data: data.built, year: data.season, user: opts.team | 0,
      settings: { team: opts.team | 0, slot: opts.slot | 0, userRounds: clamp(opts.userRounds || 15, 1, REDRAFT_ROUNDS), ...(opts.lr ? { lr: 1 } : {}), ...(opts.straight ? { straight: 1 } : {}) },
      teams: TEAMS.map((t) => ({ ...t, roster: [] })),
      players, moves: [], phase: "redraft", week: 0, games: [], log: [], history: [], stats: {}, lastRank: null,
      fa: [], notes: [],
    };
    lrInit(lg);
    // Redraft order: the user's slot (or a random one), the other 31 franchises shuffled.
    const r = rng(seed, "order");
    const others = r.shuffle(lg.teams.map((t) => t.i).filter((i) => i !== lg.user));
    const slot = lg.settings.slot ? lg.settings.slot - 1 : r.int(32);
    others.splice(slot, 0, lg.user);
    lg.draft = startDraft(lg, "redraft", others, REDRAFT_ROUNDS, !lg.settings.straight, Object.keys(players));
    settle(lg);
    return lg;
  }

  // Real Rosters: every team as it was that season. End-of-season roster files carry a few late pickups, so each
  // team keeps its best 53 (position minimums held) and anyone short signs free agents. Contracts are generated
  // from experience: rookie deals run four years from the draft, veterans get one to four by age.
  function createReal(data, opts) {
    const seed = String(opts.seed || Date.now().toString(36));
    const lg = {
      v: 1, seed, data: data.built, year: data.season, user: opts.team | 0,
      settings: { mode: "real", year: data.season, team: opts.team | 0, hindsight: !!opts.hindsight, ...(opts.lr ? { lr: 1 } : {}) },
      teams: TEAMS.map((t) => ({ ...t, roster: [] })),
      players: {}, moves: [], phase: "season", week: 0, games: [], log: [], history: [], stats: {}, lastRank: null,
      fa: [], notes: [], drafts: data.drafts || null, realSched: data.sched,
    };
    lrInit(lg);
    setCities(lg);
    for (const row of data.players) {
      const p = {}; data.cols.forEach((c, i) => (p[c] = row[i]));
      const t = p.team ? TEAM_IDX[p.team] : -1;
      p.name = shownName(p); p.real = ""; p.team = t == null ? -1 : t; p.inj = 0; p.yrs = 0; p.rookie = p.exp === 0; p.born = data.season - p.age;
      lg.players[p.id] = p;
      if (p.team >= 0) lg.teams[p.team].roster.push(p.id); else lg.fa.push(p.id);
    }
    for (const t of lg.teams) for (const pid of t.roster) {
      const p = lg.players[pid], r = rng(seed, "deal", pid);
      p.yrs = p.exp <= 3 ? Math.max(1, (p.pick ? 4 : 3) - p.exp) : p.age < 26 ? 2 + r.int(3) : p.age < 30 ? 1 + r.int(3) : 1 + r.int(2);
    }
    for (const t of lg.teams) aiCut(lg, t);
    fillRosters(lg);
    startSeason(lg);
    return lg;
  }

  function startDraft(lg, kind, order, rounds, snake, pool) {
    const seq = [];
    for (let rd = 0; rd < rounds; rd++) {
      const o = snake && rd % 2 ? [...order].reverse() : order;
      for (const t of o) seq.push(t);
    }
    return { kind, order, rounds, seq, n: 0, picks: [], pool: new Set(pool), autoUser: false };
  }

  // ---- Applying moves ----
  function apply(lg, m) {
    const ok = step(lg, m);
    if (ok !== false) { lg.moves.push(m); settle(lg); }
    return ok !== false;
  }

  function replay(data, save) {
    const lg = create(data, save.settings ? { seed: save.seed, ...save.settings } : save);
    for (const m of save.moves || []) apply(lg, m);
    return lg;
  }

  // Save version 2 = the play-by-play engine (build A). A version 1 save still loads, but its games replay with the
  // new engine, so its results can come out different.
  const SAVE_V = 2;
  function saveOf(lg) { return { v: SAVE_V, seed: lg.seed, data: lg.data, settings: lg.settings, moves: lg.moves.slice() }; }

  function step(lg, m) {
    const d = lg.draft;
    switch (m.t) {
      case "pick": { // the user drafts a player
        if (!d || d.seq[d.n] !== lg.user || !d.pool.has(m.p)) return false;
        draftPlayer(lg, lg.user, m.p);
        return true;
      }
      case "auto": { // the AI makes this one pick for the user
        if (!d || d.seq[d.n] !== lg.user) return false;
        draftPlayer(lg, lg.user, aiPick(lg, lg.user));
        return true;
      }
      case "finish": { // the AI drafts the rest of the user's picks
        if (!d) return false;
        d.autoUser = true;
        return true;
      }
      case "week": return lg.phase === "season" ? simWeek(lg) : lg.phase === "playoffs" ? simPlayoffRound(lg) : false;
      case "season": { // play out the rest of the regular season
        if (lg.phase !== "season") return false;
        while (lg.phase === "season") simWeek(lg);
        return true;
      }
      case "offseason": return lg.phase === "done" ? startOffseason(lg) : false;
      case "resign": return lg.phase === "resign" ? resign(lg, new Set(m.keep || [])) : false;
      case "cut": return lg.phase === "cuts" ? cutDown(lg, m.ids || []) : false;
      case "depth": { // set who starts at one position: { g, ids } in order; ids empty = best grades start
        const t = lg.user, ids = m.ids || [];
        if (!STARTERS[m.g] || !Array.isArray(ids) || ids.length > STARTERS[m.g] || new Set(ids).size !== ids.length) return false;
        if (ids.some((id) => !lg.teams[t].roster.includes(id) || lg.players[id].g !== m.g)) return false;
        lg.depth = lg.depth || {}; lg.depth[t] = { ...(lg.depth[t] || {}) };
        if (ids.length) lg.depth[t][m.g] = ids.slice(); else delete lg.depth[t][m.g];
        return true;
      }
      case "plan": { // your game plan, used every game until you change it
        const p = cleanPlan(m.plan); if (!p) return false;
        lg.plans = { ...(lg.plans || {}), [lg.user]: p };
        return true;
      }
      case "half": { // a second-half plan for this week's game only (the halftime hook)
        const p = cleanPlan(m.plan); if (!p || (lg.phase !== "season" && lg.phase !== "playoffs")) return false;
        lg.h2 = { ...(lg.h2 || {}), [lg.user]: p };
        return true;
      }
      case "call": { // a coach decision during this week's game: { k: decision id from simGame's asks, c: choice, team }
        const t = m.team == null ? lg.user : m.team;
        if ((lg.phase !== "season" && lg.phase !== "playoffs") || !lg.teams[t] || typeof m.k !== "string" || !CALL_OPTS[m.c]) return false;
        lg.calls = { ...(lg.calls || {}), [t]: { ...((lg.calls && lg.calls[t]) || {}), [m.k]: m.c } };
        return true;
      }
      case "name": { // rename your franchise (the page runs the word filter first)
        const s = String(m.name || "").trim().slice(0, 24);
        lg.teams[lg.user].custom = s || undefined;
        return true;
      }
      default: return false;
    }
  }

  // Run everything that does not need a person: AI draft picks, the end of a draft.
  function settle(lg) {
    const d = lg.draft;
    if (!d) return;
    while (d.n < d.seq.length) {
      const t = d.seq[d.n];
      const userTurn = t === lg.user && !d.autoUser && !(d.kind === "redraft" && Math.floor(d.n / 32) >= lg.settings.userRounds);
      if (userTurn) return;
      const pid = aiPick(lg, t);
      if (!pid) { d.n++; continue; }
      draftPlayer(lg, t, pid);
    }
    endDraft(lg);
  }

  function draftPlayer(lg, t, pid) {
    const d = lg.draft, p = lg.players[pid];
    if (t === lg.user) fanDraft(lg, d, pid);
    d.pool.delete(pid);
    d.picks.push([t, pid]);
    d.n++;
    p.team = t;
    lg.teams[t].roster.push(pid);
    if (d.kind === "rookie") p.yrs = 4;
  }

  function endDraft(lg) {
    const d = lg.draft;
    lg.lastDraft = { kind: d.kind, year: lg.year, picks: d.picks };
    lg.draft = null;
    if (d.kind === "redraft") {
      // Everyone left over is a free agent. Contracts: one to four years, younger players longer.
      lg.fa = [...d.pool];
      for (const t of lg.teams) for (const pid of t.roster) {
        const p = lg.players[pid], r = rng(lg.seed, "deal", pid);
        p.yrs = p.age < 26 ? 2 + r.int(3) : p.age < 30 ? 1 + r.int(3) : 1 + r.int(2);
      }
      startSeason(lg);
    } else {
      // Undrafted rookies join the free agents; teams then cut down to 53 (the user may need to choose).
      lg.fa.push(...d.pool);
      for (const pid of d.pool) lg.players[pid].yrs = 1;
      for (const t of lg.teams) if (t.i !== lg.user) aiCut(lg, t);
      const u = lg.teams[lg.user];
      if (u.roster.length > ROSTER) { lg.phase = "cuts"; return; }
      finishCuts(lg);
    }
  }

  // ---- AI drafting ----
  function countBy(lg, t) {
    const c = {}; for (const g of GROUPS) c[g] = 0;
    for (const pid of lg.teams[t].roster) c[lg.players[pid].g]++;
    return c;
  }
  // How much a team wants a player now: talent first, then need. Redraft favours quarterbacks and youth;
  // rookie drafts look at the ceiling. Kickers and punters wait. Each team also leans a little toward some
  // positions each year. ctx is worked out once per pick (the pool loop is the hot path).
  function pickContext(lg, t, picksLeft) {
    const c = countBy(lg, t);
    let short = 0; for (const x of GROUPS) short += Math.max(0, MINPOS[x] - c[x]);
    const lean = {}; for (const g of GROUPS) lean[g] = (rng(lg.seed, "lean", lg.year, t, g)() - 0.5) * 0.5;
    return { c, lean, late: picksLeft <= short + 1 };
  }
  function value(ctx, p, kind) {
    const g = p.g, c = ctx.c;
    if (c[g] >= MAXPOS[g]) return -99;
    let v = kind === "rookie" ? 0.45 * p.grade + 0.55 * p.ceil : p.grade + Math.max(0, 27 - p.age) * 0.06 - Math.max(0, p.age - 31) * 0.25;
    if (g === "QB") v += c.QB === 0 ? 1.4 : -1.2;
    else if (g === "K" || g === "P") v -= 3.2;
    else if (g === "RB") v -= 0.4;
    else if (g === "ED" || g === "CB") v += 0.15;
    if (c[g] < STARTERS[g]) v += 0.6;
    else if (c[g] >= TARGET[g]) v -= 2.2;
    if (ctx.late && c[g] >= MINPOS[g]) v -= 20; // late in a draft, every position must reach its minimum
    return v + ctx.lean[g];
  }
  function aiPick(lg, t) {
    const d = lg.draft;
    let picksLeft = 0; for (let i = d.n; i < d.seq.length; i++) if (d.seq[i] === t) picksLeft++;
    const ctx = pickContext(lg, t, picksLeft);
    let best = null, bv = -1e9;
    for (const pid of d.pool) { const v = value(ctx, lg.players[pid], d.kind); if (v > bv) { bv = v; best = pid; } }
    return best;
  }

  // ---- Lineups and team strength ----
  // lg.depth[team][group] = the starters a person picked, in order. Injured or departed players are skipped and the
  // best healthy backups fill in, so an old choice never breaks a lineup. No entry = the best grades start.
  // L.bench[group] lists every healthy player there, starters first, then the rest by grade.
  function lineup(lg, t) {
    const by = {}; for (const g of GROUPS) by[g] = [];
    for (const pid of lg.teams[t].roster) { const p = lg.players[pid]; if (!p.inj && !p.hold) by[p.g].push(p); }
    const pick = lg.depth && lg.depth[t];
    const L = {};
    for (const g of GROUPS) {
      by[g].sort((a, b) => b.grade - a.grade);
      if (pick && pick[g]) {
        const chosen = pick[g].map((id) => by[g].find((p) => p.id === id)).filter(Boolean);
        by[g] = [...chosen, ...by[g].filter((p) => !chosen.includes(p))];
      }
      L[g] = by[g].slice(0, STARTERS[g]);
      while (L[g].length < STARTERS[g]) L[g].push({ id: null, name: "Replacement", g, grade: 2.5 });
    }
    L.bench = by;
    return L;
  }
  const avg = (a) => a.reduce((s, p) => s + p.grade, 0) / a.length;
  // Unit grades on the 1-10 scale, from the starters.
  function unitsOf(L) {
    const u = {
      QB: L.QB[0].grade, RB: L.RB[0].grade, WR: avg(L.WR), TE: L.TE[0].grade, OL: avg(L.OL),
      DL: avg(L.DL), ED: avg(L.ED), LB: avg(L.LB), CB: avg(L.CB), S: avg(L.S), K: L.K[0].grade, P: L.P[0].grade,
    };
    u.off = 0.34 * u.QB + 0.07 * u.RB + 0.2 * u.WR + 0.07 * u.TE + 0.32 * u.OL;
    u.def = 0.18 * u.DL + 0.27 * u.ED + 0.15 * u.LB + 0.25 * u.CB + 0.15 * u.S;
    u.ovr = (u.off + u.def) / 2;
    return u;
  }
  function units(lg, t) { const L = lineup(lg, t); return { u: unitsOf(L), L }; }

  // ---- Game plans ----
  // lean: -2 run heavy .. 2 pass heavy. fourth: 0 play it safe, 1 by the book, 2 aggressive (4th downs and 2-point
  // tries). tempo: 0 slow it down, 1 normal, 2 hurry-up. blitz: 0 sit back, 1 mix it up, 2 bring pressure.
  // feature: a player id who gets the ball more, or null. A person's plan stays until they change it (lg.plans[team]);
  // AI teams pick one each game from their roster and the matchup.
  const PLAN0 = { lean: 0, fourth: 1, tempo: 1, blitz: 1, feature: null };
  function cleanPlan(x) {
    if (!x || typeof x !== "object") return null;
    const n = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
    const p = { lean: n(x.lean, -2, 2), fourth: n(x.fourth, 0, 2), tempo: n(x.tempo, 0, 2), blitz: n(x.blitz, 0, 2),
      feature: typeof x.feature === "string" && x.feature ? x.feature.slice(0, 40) : null };
    return p.lean == null || p.fourth == null || p.tempo == null || p.blitz == null ? null : p;
  }
  function aiPlan(lg, t, opp, wk) {
    const r = rng(lg.seed, "plan", lg.year, wk, t), m = lg.midU || MIDU0;
    const { u, L } = units(lg, t), ou = units(lg, opp).u;
    const passTilt = (u.QB - m.QB) * 0.9 + (u.WR - m.WR) * 0.5 - (u.RB - m.RB) * 0.5 - (u.OL - m.OL) * 0.3;
    const rush = (u.ED + u.DL - m.ED - m.DL) / 2, cover = (u.CB + u.S - m.CB - m.S) / 2;
    const gap = u.ovr - ou.ovr; // underdogs gamble more on fourth down and shorten the game; favorites play it straight
    const skill = [L.WR[0], L.TE[0], L.RB[0]].filter((p) => p.id).sort((a, b) => b.grade - a.grade);
    return {
      lean: clamp(Math.round(passTilt * 1.1 + r.normal() * 0.6), -2, 2),
      fourth: clamp(Math.round(1 - gap * 1.2 + r.normal() * 0.5), 0, 2),
      tempo: clamp(Math.round(1 + Math.min(0, gap) * 0.8 + r.normal() * 0.4), 0, 2),
      blitz: clamp(Math.round(1 - rush * 0.9 + cover * 0.6 + r.normal() * 0.5), 0, 2),
      feature: skill.length > 1 && skill[0].grade - skill[1].grade > 1 && r() < 0.5 ? skill[0].id : null,
    };
  }
  function isHuman(lg, t) { return t === lg.user; }
  function planFor(lg, t, opp, wk) { return (lg.plans && lg.plans[t]) || (isHuman(lg, t) ? PLAN0 : aiPlan(lg, t, opp, wk)); }

  // ---- Model constants (tuned by build/franchise/calibrate.js) ----
  // Units are measured against this season's league average (lg.mid), so scoring stays steady as rosters age.
  // Real Rosters: real teams differ far more than an AI Redraft league does, so each season the gaps between teams
  // are scaled down to this spread of unit grades (never scaled up). realSd is tuned by calibrate.js real.
  const M = { base: 22.4, off: 12, def: 12, hfa: 0.85, sd: 9.4, kick: 0.25, realSd: { off: 0.32, def: 0.28 } };

  function expectedPoints(lg, a, b, home) { // a's offense against b's defense
    const mid = lg.mid || { off: 7.9, def: 7.9, K: 7.9 };
    const sc = lg.scale || { off: 1, def: 1 };
    return M.base + M.off * sc.off * (a.u.off - mid.off) - M.def * sc.def * (b.u.def - mid.def) + M.kick * (a.u.K - mid.K) + (home === 1 ? M.hfa : home === -1 ? -M.hfa : 0);
  }

  // ---- Play by play ----
  // A game is a list of real plays: down, distance, yard line, clock, possession. Each play is drawn from the unit
  // matchup (protection vs pass rush, passing vs coverage, running vs run defense) and both teams' game plans.
  // Draws come from one labelled stream per half (and one for overtime), so a second-half plan change never changes
  // the first half: that is the halftime hook. Injuries are drawn up front (who, at what second, how long).
  // simGame never changes the league, so a page can preview the game it is about to show (previewGame).
  const MIDU0 = { QB: 6.5, RB: 6.5, WR: 6.5, TE: 6.5, OL: 6.5, DL: 6.5, ED: 6.5, LB: 6.5, CB: 6.5, S: 6.5, K: 6.5, P: 6.5 };
  const PM = { // play model, tuned by build/franchise/calibrate.js
    edge: 2.45, cap: 2.4, realK: 0.45, hfa: 0.07, inj: 0.011,
    run: 3.85, runSd: 2.7, runE: 1.0, brk: 0.062, brkLen: 11, shortRun: 1.9,
    sack: 0.05, sackE: 0.03, blzSack: 0.042, sitSack: -0.012, scram: 0.03,
    deep: 0.16, cmpS: 0.72, cmpD: 0.4, cmpE: 0.05, airS: 4.6, yac: 4.2, deepYds: 17, deepYac: 8, ydsE: 0.9,
    intS: 0.017, intD: 0.042, intE: 0.007, fum: 0.006,
    passBase: 0.53, lean: 0.06, blitz: [0.14, 0.27, 0.42], gap: [39, 33, 24], snapT: 6,
    pen: 0.055, rz: 1.1, cmpRz: 0.28,
    knock: 0.8, agg: 0.3, // coach decisions: a starter kept in with a knock plays this much slower; chance he aggravates it
  };
  // Coach decisions: the choices each kind of in-game call can take (see "Coach decisions" in simGame).
  const CALL_OPTS = { go: 1, punt: 1, fg: 1, kick: 1, two: 1, sit: 1, keep: 1, stay: 1, bench: 1, run: 1, to: 1 };
  const GO2 = new Set([-2, -5, -10, -13, 1, 5, 12]); // after the touchdown, trailing or leading by these: go for two
  function edges(lg, o, d, home, mo) {
    // Real Rosters: real teams' units differ much more than an AI Redraft's, so their gaps count for less (realK).
    const m = lg.midU || MIDU0, sc = lg.scale || { off: 1, def: 1 }, k = PM.edge * (lg.settings.mode === "real" ? PM.realK : 1), h = PM.hfa * home + (mo || 0);
    const so = sc.off, sd = sc.def;
    // Soft cap: small gaps count in full, huge ones (an elite unit against a weak one) level off.
    const cap = (x) => PM.cap * Math.tanh(x / PM.cap);
    return {
      pass: cap(k * (so * (0.5 * (o.QB - m.QB) + 0.32 * (o.WR - m.WR) + 0.1 * (o.TE - m.TE) + 0.08 * (o.RB - m.RB))
        - sd * (0.55 * (d.CB - m.CB) + 0.3 * (d.S - m.S) + 0.15 * (d.LB - m.LB)))) + h,
      prot: cap(k * (so * (0.8 * (o.OL - m.OL) + 0.2 * (o.QB - m.QB)) - sd * (0.62 * (d.ED - m.ED) + 0.38 * (d.DL - m.DL)))) + h,
      run: cap(k * (so * (0.4 * (o.RB - m.RB) + 0.45 * (o.OL - m.OL) + 0.15 * (o.TE - m.TE))
        - sd * (0.4 * (d.DL - m.DL) + 0.3 * (d.LB - m.LB) + 0.15 * (d.ED - m.ED) + 0.15 * (d.S - m.S)))) + h,
      K: o.K - m.K, P: o.P - m.P,
    };
  }
  const expo = (r, mean) => -mean * Math.log(1 - r() * 0.9999);
  const short = (p) => { if (!p || !p.id) return "a backup"; const w = p.name.split(" "); return w.length > 1 ? `${w[0][0]}. ${w.slice(1).join(" ")}` : p.name; };
  const nth = ["", "1st", "2nd", "3rd", "4th"];

  // rec: keep every play (for the live viewer). Returns everything playGame needs to commit the result.
  function simGame(lg, g, neutral, rec) {
    const sides = [g.h, g.a], m = lg.midU || MIDU0, playoff = g.po != null;
    const S = sides.map((t, i) => {
      const { u, L } = units(lg, t), plan = planFor(lg, t, sides[1 - i], g.wk);
      const skill = [...L.bench.QB, ...L.bench.RB, ...L.bench.WR, ...L.bench.TE];
      return { t, L, u, plan, out: new Set(), feat: skill.some((p) => p.id === plan.feature) ? plan.feature : null };
    });
    const home = neutral ? [0, 0] : [1, -1], EG = [];
    const mo = moraleEdge(lg, g.h) - moraleEdge(lg, g.a); // build B: team morale, a small nudge
    const setEdges = () => { EG[0] = edges(lg, S[0].u, S[1].u, home[0], mo); EG[1] = edges(lg, S[1].u, S[0].u, home[1], -mo); };
    setEdges();
    const R1 = rng(lg.seed, "pbp", lg.year, g.wk, g.h, g.a, 1), R2 = rng(lg.seed, "pbp", lg.year, g.wk, g.h, g.a, 2);
    const R3 = rng(lg.seed, "pbp", lg.year, g.wk, g.h, g.a, "ot");
    let r = R1;
    const ir = rng(lg.seed, "inj", lg.year, g.wk, g.h, g.a), hurt = [];
    S.forEach((s, i) => { for (const grp of GROUPS) for (const p of s.L[grp]) if (p.id && ir() < PM.inj) {
      const x = ir(); hurt.push({ i, p, at: 60 + ir.int(3480), w: x < 0.55 ? 1 + ir.int(2) : x < 0.88 ? 3 + ir.int(4) : 30 });
    } });
    hurt.sort((a, b) => a.at - b.at);
    const injured = [];

    const st = {}, plays = rec ? [] : null, scoring = [];
    const T = [0, 1].map(() => ({ plays: 0, pass: 0, run: 0, yards: 0, passY: 0, rushY: 0, sacks: 0, sackY: 0, to: 0, fd: 0, d3: [0, 0], d4: [0, 0],
      top: 0, pen: 0, penY: 0, blz: 0, drop: 0, touch: {}, two: [0, 0], q: [0, 0, 0, 0, 0] }));
    const add = (p, k, v) => { if (!p || !p.id || !v) return; const s = st[p.id] || (st[p.id] = {}); s[k] = (s[k] || 0) + v; };
    const sc = [0, 0];
    let q = 1, clock = 900, o = 0, yl = 25, dn = 1, tg = 10, over = false, kickNext = null, onside = false, otPoss = null, pre = null;
    const recv1 = R1() < 0.5 ? 0 : 1;
    const elapsed = () => (q <= 4 ? (q - 1) * 900 + 900 - clock : 3600);
    const ax = (side, y) => (side === 0 ? y : 100 - y);
    const mark = () => { pre = { q, c: clock, o, x0: ax(o, yl), dn, tg: Math.min(tg, 100 - yl) }; };
    const log = (k, t, extra) => { if (plays) plays.push({ ...pre, k, t, x1: ax(o, yl), to: o, sc: [sc[0], sc[1]], ...extra }); };
    const use = (secs) => { const s = Math.min(clock, secs); clock -= s; T[o].top += s; };
    // Always log the play first, then score: the scoring play's record then shows the new score.
    const score = (side, pts, what, p) => { sc[side] += pts; if (plays && plays.length) plays[plays.length - 1].sc = [sc[0], sc[1]]; T[side].q[Math.min(q, 5) - 1] += pts; scoring.push([q, clock, side, what, p && p.id ? p.id : null, sc[0], sc[1]]); };
    const endPoss = () => { if (otPoss) otPoss[o] = true; };
    const otCheck = () => { if (otPoss && otPoss[0] && otPoss[1] && sc[0] !== sc[1]) over = true; };
    const pickW = (list) => { let tot = 0; for (const [, w] of list) tot += w; let x = r() * tot; for (const [p, w] of list) if ((x -= w) <= 0) return p; return list[list.length - 1][0]; };
    const tackler = (D, pass) => pickW(pass ? [[D.L.CB, 0.38], [D.L.S, 0.32], [D.L.LB, 0.3]].map(([a, w]) => [r.pick(a), w])
      : [[D.L.LB, 0.4], [D.L.DL, 0.2], [D.L.ED, 0.15], [D.L.S, 0.15], [D.L.CB, 0.1]].map(([a, w]) => [r.pick(a), w]));
    const newSeries = (side, at) => { o = side; yl = at; dn = 1; tg = Math.min(10, 100 - at); };

    // Coach decisions. At a handful of real decision points (a close 4th down, a two-point question late, a banged-up
    // starter, a quarterback having a genuinely bad day, the clock in the last two minutes) the game asks the team's
    // coach. Every point is found from the game state alone, with no random draws, and the default is exactly what the
    // engine did before decisions existed, so a game nobody answers is unchanged. A person's answer is a "call" move
    // (lg.calls[team][id]); ids count decision points in order, so everything before an answered call stays identical.
    // asks lists every point (both teams); at = the play index the decision comes before (the viewer pauses there).
    const asks = [], calls = lg.calls;
    const ask = (i, kind, def, opts, at, info) => {
      const id = kind + asks.length, mine = calls && calls[S[i].t], c = mine && mine[id];
      const pick = c != null && opts.includes(c) ? c : def;
      asks.push({ id, kind, t: S[i].t, side: i, def, opts, c: pick, at: plays ? at : 0, q, clock, sc: [sc[0], sc[1]], ...info });
      return pick;
    };
    const tol = [3, 3], toAsk = [0, 0], qbAsked = [false, false];
    const change = (at) => { endPoss(); newSeries(1 - o, at); };

    function injure(h) {
      const s = S[h.i], arr = s.L[h.p.g], k = arr.indexOf(h.p);
      if (k < 0) return;
      // Coach decision: a minor knock (one or two weeks) to a starter. Sitting him is what always happened. Keeping him
      // in: he plays on a bit slower, misses a week less afterwards, but may aggravate it (out longer, sometimes the year).
      if (!h.agg && h.w <= 2 && ask(h.i, "inj", "sit", ["sit", "keep"], plays ? plays.length : 0, { p: h.p.id, w: h.w }) === "keep") {
        const kr = rng(lg.seed, "knock", lg.year, g.wk, g.h, g.a, h.p.id), hurtP = { ...h.p, grade: h.p.grade - PM.knock };
        arr[k] = hurtP; s.u = unitsOf(s.L); setEdges();
        if (kr() < PM.agg) { const x = kr(); hurt.push({ i: h.i, p: hurtP, agg: 1, at: Math.min(3599, elapsed() + 60 + kr.int(Math.max(1, 3540 - elapsed()))), w: x < 0.8 ? 3 + kr.int(4) : 30 }); hurt.sort((a, b) => a.at - b.at); }
        else if (h.w > 1) s.later = [...(s.later || []), { p: h.p.id, t: s.t, w: h.w - 1, hp: hurtP }];
        mark(); log("inj", `${short(h.p)} is banged up but stays in the game.`, { side: h.i });
        return;
      }
      if (h.agg && s.later) s.later = s.later.filter((x) => x.hp !== h.p);
      s.out.add(h.p.id); injured.push({ p: h.p.id, t: s.t, w: h.w });
      const next = s.L.bench[h.p.g].find((p) => !arr.includes(p) && !s.out.has(p.id)) || { id: null, name: "Replacement", g: h.p.g, grade: 2.5 };
      arr[k] = next; s.u = unitsOf(s.L); setEdges();
      if (s.feat === h.p.id) s.feat = null;
      mark(); log("inj", `${h.agg ? `${short(h.p)} aggravates the injury and` : `Injury: ${short(h.p)}`} is out for the game${next.id ? `, ${short(next)} takes over` : ""}.`, { side: h.i });
    }

    function kickoff(kicker) {
      const ons = onside; onside = false;
      newSeries(kicker, 35); mark();
      const recv = 1 - kicker;
      if (ons) {
        if (r() < 0.12) { newSeries(kicker, 47); use(4); log("ko", "Onside kick... recovered by the kicking team!"); }
        else { newSeries(recv, 53); use(4); log("ko", "Onside kick, the receiving team covers it."); }
        return;
      }
      const x = r();
      if (x < 0.003) { newSeries(recv, 100); use(12); log("ko", "Kickoff returned all the way. Touchdown!", { big: 1 }); return touchdown(recv, null); }
      if (x < 0.6) { newSeries(recv, 35); log("ko", "Kickoff, touchback."); return; }
      const at = clamp(Math.round(19 + expo(r, 8)), 4, 75);
      newSeries(recv, at); use(6); log("ko", `Kickoff returned to the ${at > 50 ? "opposing " + (100 - at) : at}.`);
    }
    function pat(side) {
      o = side; yl = 98; dn = 0; tg = 2; mark();
      const diff = sc[side] - sc[1 - side], a = S[side].plan.fourth, chart = GO2.has(diff);
      const late = q >= 4 && clock <= 600;
      let go2 = q < 5 && (late ? (a === 0 ? diff === -2 : chart) : a === 2 && (chart || r() < 0.06));
      // Coach decision: only in the last ten minutes, at the scores where the chart makes it a real question.
      if (q === 4 && clock <= 600 && (chart || diff === -1 || diff === -8)) go2 = ask(side, "2pt", go2 ? "two" : "kick", ["kick", "two"], plays ? plays.length : 0, { diff }) === "two";
      const K = S[side].L.K[0];
      if (go2) {
        T[side].two[1]++;
        if (r() < 0.47 + 0.03 * EG[side].pass) { T[side].two[0]++; log("2pt", "Two-point try is good."); score(side, 2, "2PT", null); }
        else log("2pt", "Two-point try fails.");
      } else {
        add(K, "xpa", 1);
        if (r() < 0.945 + 0.01 * EG[side].K) { add(K, "xpm", 1); log("xp", `${short(K)} adds the extra point.`); score(side, 1, "XP", K); }
        else log("xp", `${short(K)} misses the extra point.`);
      }
    }
    function afterScore(scorer) {
      otCheck();
      if (over) return;
      const diff = sc[scorer] - sc[1 - scorer];
      onside = q === 4 && clock <= 240 && diff < 0 && diff >= -16;
      kickNext = scorer;
    }
    function touchdown(side, p) {
      score(side, 6, "TD", p); endPoss();
      pat(side); afterScore(side);
    }
    function safety() {
      const d = 1 - o; score(d, 2, "SAF", null); endPoss();
      if (plays) plays[plays.length - 1].t += " Safety!";
      otCheck(); if (over) return;
      // Free kick from the 20: the scoring team gets it back around midfield.
      newSeries(o, 20); mark();
      const at = clamp(Math.round(40 + r.normal() * 8), 20, 65);
      newSeries(d, at); use(6); log("ko", `Free kick after the safety, returned to the ${at > 50 ? "opposing " + (100 - at) : at}.`);
    }
    // Move the ball y yards. Handles touchdowns, safeties, first downs, turnovers on downs.
    function gain(y, p, txt, k, extra) {
      const was = dn;
      yl += y;
      if (yl >= 100) { yl = 100; if (was === 3) T[o].d3[0]++; if (was === 4) T[o].d4[0]++; log(k, txt + " Touchdown!", { big: 1, ...extra }); touchdown(o, p); return; }
      if (yl <= 0) { yl = 0; log(k, txt, extra); safety(); return; }
      if (y >= tg) { T[o].fd++; if (was === 3) T[o].d3[0]++; if (was === 4) T[o].d4[0]++; dn = 1; tg = Math.min(10, 100 - yl); log(k, txt, { fd: 1, ...extra }); return; }
      if (dn === 4) { log(k, txt + " Turnover on downs.", extra); change(100 - yl); return; }
      dn++; tg -= y; log(k, txt, extra);
    }
    const yds = (y) => (y === 0 ? "no gain" : y < 0 ? `a loss of ${-y}` : `${y} yard${y === 1 ? "" : "s"}`);

    function punt() {
      const P = S[o].L.P[0], net = Math.round(41 + 1.5 * EG[o].P + r.normal() * 6);
      add(P, "pnt", 1); use(8); endPoss();
      if (r() < 0.003) { newSeries(1 - o, 100); log("punt", `${short(P)} punts, and it's returned for a touchdown!`, { big: 1 }); return touchdown(o, null); }
      let land = yl + net, txt;
      if (land >= 100) { land = 80; txt = `${short(P)} punts into the end zone. Touchback.`; add(P, "pny", 100 - yl); }
      else { land = Math.min(land, 99); txt = `${short(P)} punts ${land - yl} yards, downed at the ${100 - land}.`; add(P, "pny", land - yl); }
      newSeries(1 - o, 100 - land); log("punt", txt);
    }
    function fieldGoal() {
      const K = S[o].L.K[0], d = 100 - yl + 17;
      const p = clamp(0.995 - Math.max(0, d - 30) * 0.011 - Math.max(0, d - 46) * 0.02 + 0.02 * EG[o].K, 0.05, 0.995);
      add(K, "fga", 1); use(5);
      if (r() < p) { add(K, "fgm", 1); yl = 100; log("fg", `${short(K)} ${d}-yard field goal is good.`, { big: 1 }); score(o, 3, "FG", K); endPoss(); afterScore(o); }
      else { log("fg", `${short(K)} ${d}-yard field goal is no good.`); change(Math.max(20, 107 - yl)); }
    }
    const fgRange = (side) => 100 - yl + 17 <= 55 + Math.round(2 * EG[side].K) - (S[side].plan.fourth === 0 ? 2 : 0);

    function run(O, D, e, featQB) {
      const L = O.L, b = L.bench;
      let p;
      if (featQB) p = L.QB[0];
      else {
        const list = [[L.RB[0], 0.62], [b.RB[1], 0.28], [L.QB[0], 0.07]].filter(([x]) => x && x.id && !O.out.has(x.id));
        for (const it of list) if (it[0].id === O.feat) it[1] *= 1.7;
        p = list.length ? pickW(list) : L.RB[0];
      }
      const ee = e.run + 0.08 * (p.grade - m[p.g]);
      // Near the goal line the field shrinks: shorter gains.
      let y = Math.round((tg <= 2 ? PM.shortRun : PM.run) - (yl >= 80 ? PM.rz : 0) + PM.runE * ee + r.normal() * PM.runSd);
      if (r() < PM.brk + 0.02 * ee) y += Math.round(5 + expo(r, PM.brkLen));
      y = Math.max(-5, Math.min(y, 100 - yl));
      T[o].run++; T[o].plays++; T[o].touch[p.id] = (T[o].touch[p.id] || 0) + 1;
      add(p, "car", 1); add(p, "rsy", y); T[o].rushY += y; T[o].yards += y;
      if (r() < PM.fum) {
        const d = r.pick([...D.L.LB, ...D.L.DL, ...D.L.S]);
        add(p, "fum", 1); add(d, "ff", 1); T[o].to++; use(PM.snapT);
        yl = clamp(yl + y, 1, 99); log("fum", `${short(p)} runs for ${yds(y)} but fumbles. ${short(d)} forces it, the defense recovers!`, { big: 1 });
        return change(100 - yl);
      }
      if (yl + y < 100) add(tackler(D, false), "tk", 1); else add(p, "rstd", 1);
      return { y, p, kind: "run", txt: `${short(p)} runs for ${yds(y)}.` };
    }
    function pass(O, D, e, hail) {
      const L = O.L, b = L.bench, qb = L.QB[0];
      const blitz = r() < PM.blitz[D.plan.blitz];
      T[1 - o].drop++; if (blitz) T[1 - o].blz++;
      T[o].pass++; T[o].plays++;
      const sackP = clamp(PM.sack - PM.sackE * e.prot + (blitz ? PM.blzSack : D.plan.blitz === 0 ? PM.sitSack : 0), 0.015, 0.2);
      if (!hail && r() < sackP) {
        const x = r(), who = blitz && x < 0.35 ? r.pick([...D.L.LB, ...D.L.S, ...D.L.CB]) : x < 0.55 ? r.pick(D.L.ED) : x < 0.82 ? r.pick(D.L.DL) : r.pick([...D.L.LB, ...D.L.ED]);
        const y = -Math.min(yl, 3 + r.int(8));
        add(who, "sk", 1); T[o].sacks++; T[o].sackY -= y; T[o].yards += y; T[o].passY += y;
        if (r() < 0.07) { T[o].to++; add(qb, "fum", 1); add(who, "ff", 1); use(PM.snapT); yl = clamp(yl + y, 1, 99); log("fum", `${short(qb)} is sacked by ${short(who)} and loses the ball. Defense recovers!`, { big: 1 }); change(100 - yl); return null; }
        return { y, p: null, txt: `${short(qb)} is sacked by ${short(who)} for ${yds(y)}.`, sack: 1 };
      }
      if (!hail && r() < PM.scram + (O.feat === qb.id ? 0.04 : 0)) {
        const y = Math.min(100 - yl, Math.max(-2, Math.round(2 + r() * 8 + e.run * 0.8)));
        add(qb, "car", 1); add(qb, "rsy", y); T[o].rushY += y; T[o].yards += y; if (yl + y >= 100) add(qb, "rstd", 1);
        return { y, p: qb, kind: "run", txt: `${short(qb)} scrambles for ${yds(y)}.` };
      }
      const list = [[L.WR[0], 0.27], [L.WR[1], 0.2], [L.WR[2], 0.13], [L.TE[0], 0.17], [L.RB[0], 0.11], [b.WR[3], 0.04], [b.TE[1], 0.04], [b.RB[1], 0.04]]
        .filter(([x]) => x && x.id && !O.out.has(x.id)).map(([x, w]) => [x, w * (0.7 + 0.06 * x.grade) * (x.id === O.feat ? 1.6 : 1)]);
      const rc = list.length ? pickW(list) : L.WR[0];
      const rz = yl >= 80, deep = hail || r() < (rz ? 0.24 : PM.deep) + 0.015 * O.plan.lean;
      const ee = e.pass + 0.08 * (rc.grade - m[rc.g]);
      let cmp = deep ? (rz ? PM.cmpRz : PM.cmpD) + PM.cmpE * ee : PM.cmpS - (rz ? 0.08 : 0) + PM.cmpE * ee;
      if (blitz) cmp -= 0.05; else if (D.plan.blitz === 0) cmp += deep ? -0.04 : 0.015;
      if (hail) cmp = 0.08;
      const intP = (deep ? PM.intD : PM.intS) - PM.intE * ee + (blitz ? 0.004 : 0);
      add(qb, "att", 1); add(rc, "tgt", 1); T[o].touch[rc.id] = (T[o].touch[rc.id] || 0) + 1;
      const x = r(), how = deep ? "deep " : "";
      if (x < intP) {
        const d = r() < 0.75 ? r.pick([...D.L.CB, ...D.L.S]) : r.pick(D.L.LB);
        add(qb, "int", 1); add(d, "di", 1); T[o].to++; use(PM.snapT);
        const at = clamp(yl + (deep ? 25 + r.int(15) : 6 + r.int(8)), 1, 99);
        yl = at; log("int", `${short(qb)} throws ${how}for ${short(rc)}... intercepted by ${short(d)}!`, { big: 1 });
        if (r() < 0.07) { change(100); if (plays) plays[plays.length - 1].t += " Returned for a touchdown!"; return touchdown(o, d), null; }
        const back = Math.round(expo(r, 7));
        change(clamp(100 - at + back, 1, 99));
        return null;
      }
      if (x < intP + cmp) {
        let y = deep ? Math.round(PM.deepYds + r.int(10) + expo(r, PM.deepYac) + PM.ydsE * ee) : Math.round(1 + r() * PM.airS * 2 + expo(r, PM.yac) + PM.ydsE * ee);
        if (blitz && r() < 0.25) y += Math.round(expo(r, 10));
        y = Math.max(-2, Math.min(y, 100 - yl));
        add(qb, "cmp", 1); add(qb, "py", y); add(rc, "rec", 1); add(rc, "ry", y); T[o].passY += y; T[o].yards += y;
        if (yl + y >= 100) { add(qb, "ptd", 1); add(rc, "rtd", 1); } else add(tackler(D, true), "tk", 1);
        return { y, p: rc, qb, kind: "pass", txt: `${short(qb)} ${deep ? "goes deep to" : "finds"} ${short(rc)} for ${yds(y)}.`, oob: r() < 0.22 };
      }
      return { y: 0, p: null, txt: `${short(qb)} throws ${how}for ${short(rc)}, incomplete.`, inc: 1 };
    }

    function snap() {
      const O = S[o], D = S[1 - o], e = EG[o], plan = O.plan, diff = sc[o] - sc[1 - o];
      mark();
      const trailingLate = q >= 4 && diff < 0 && clock <= 300, twoMin = q === 2 && clock <= 120;
      // Kneel to run out the clock.
      if ((q === 4 && diff > 0 && clock <= Math.min(120, (5 - dn) * 40)) || (q === 2 && clock <= 30 && yl < 50 && dn < 4)) {
        T[o].plays++; use(40); yl = Math.max(1, yl - 1);
        if (dn === 4) { log("kneel", `${short(O.L.QB[0])} takes a knee.`); return change(100 - yl); }
        dn++; tg++; log("kneel", `${short(O.L.QB[0])} takes a knee.`); return;
      }
      // Fourth down: punt, kick or go for it.
      const inRange = fgRange(o), tieOrWinFG = diff >= -3 && diff <= 0;
      if (clock <= 8 && inRange && (q === 2 || (q >= 4 && tieOrWinFG))) return fieldGoal();
      if (otPoss && otPoss[1 - o] && diff === 0 && inRange && (dn >= 3 || clock <= 120)) return fieldGoal();
      if (dn === 4) {
        const a = plan.fourth, need = tg;
        let go;
        if ((q >= 4 && clock <= 300 && diff < 0 && !(tieOrWinFG && inRange)) || (otPoss && otPoss[1 - o] && diff < 0 && !(tieOrWinFG && inRange))) go = true;
        else if (q >= 4 && diff > 0 && clock <= 240) go = false;
        else {
          const max = yl >= 95 ? [1, 2, 4][a] : yl >= 60 ? [1, 2, 4][a] : yl >= 45 ? [0, 1, 2][a] : yl >= 28 ? [0, 0, 1][a] : 0;
          go = need <= max;
        }
        // Coach decision: only the genuinely close calls (short yardage around midfield and in the red zone, or a
        // field-goal-or-go call late in a close game). Forced calls (trailing late, running out the clock) stay automatic.
        const forced = (q >= 4 && clock <= 300 && diff < 0 && !(tieOrWinFG && inRange)) || (otPoss && otPoss[1 - o] && diff < 0 && !(tieOrWinFG && inRange)) || (q >= 4 && diff > 0 && clock <= 240);
        const close = (need <= 1 && yl >= 40 && yl < 90) || (need === 2 && yl >= 50 && yl < 75) || (need <= 2 && yl >= 95) || (q >= 4 && clock <= 600 && Math.abs(diff) <= 8 && inRange && need <= 4);
        let call = go ? "go" : inRange ? "fg" : "punt";
        if (!forced && close) call = ask(o, "4th", call, ["go", ...(inRange ? ["fg"] : []), ...(yl < 70 || call === "punt" ? ["punt"] : [])], plays ? plays.length : 0, { dn, tg: need, yl, diff });
        go = call === "go";
        T[o].d4[1] += go ? 1 : 0;
        if (!go) return call === "fg" ? fieldGoal() : punt();
      }
      if (dn === 3) T[o].d3[1]++;
      // Flags before the snap.
      const pf = r();
      if (pf < PM.pen * 0.33) {
        const offn = pf < PM.pen * 0.2, y = offn ? -Math.min(5, Math.floor(yl / 2)) : Math.min(5, 100 - yl - 1);
        T[offn ? o : 1 - o].pen++; T[offn ? o : 1 - o].penY += Math.abs(y);
        yl += y; tg -= y; if (tg <= 0) { dn = 1; tg = Math.min(10, 100 - yl); }
        log("pen", offn ? `False start on the offense, ${-y} yards.` : `Defense jumps offside, ${y} yards.`); return;
      }
      // Pick the play: plan lean, then down, distance and the scoreboard.
      let pp = PM.passBase + PM.lean * plan.lean;
      if (dn >= 3) pp = tg >= 7 ? 0.9 : tg >= 4 ? 0.74 : tg <= 1 ? 0.33 : 0.55;
      else if (dn === 2 && tg >= 8) pp += 0.12;
      if (dn >= 3) pp += 0.03 * plan.lean;
      if (yl >= 97) pp -= 0.15;
      if (q >= 4 && diff < 0 && clock <= 420) pp = Math.max(pp, diff < -8 ? 0.9 : 0.76);
      if (q >= 4 && diff > 0 && clock <= 480) pp -= 0.25;
      if (twoMin) pp = Math.max(pp, 0.76);
      const hail = clock <= 8 && (q === 2 || (q >= 4 && diff < 0 && diff >= -8)) && yl < 62;
      const featQB = O.feat && O.feat === O.L.QB[0].id && r() < 0.05;
      const isPass = hail || (!featQB && r() < clamp(pp, 0.1, 0.95));
      const res = isPass ? pass(O, D, e, hail) : run(O, D, e, featQB);
      if (!res) return; // turnover already handled
      // Flags on the play: offensive holding wipes it out; pass interference gives a big chunk.
      const af = r();
      if (af < PM.pen * 0.25 && res.p && res.y > 0 && yl + res.y < 100) {
        undo(res); const y = -Math.min(10, Math.floor(yl / 2)); T[o].pen++; T[o].penY -= y; yl += y; tg -= y; use(PM.snapT);
        log("pen", `Holding on the offense wipes out the play. ${-y} yards.`); return;
      }
      if (isPass && res.inc && af > 1 - PM.pen * 0.18) {
        const y = Math.min(12 + r.int(20), 99 - yl); T[1 - o].pen++; T[1 - o].penY += y; use(PM.snapT);
        yl += y; T[o].fd++; dn = 1; tg = Math.min(10, 100 - yl); log("pen", `Pass interference on the defense, ${y} yards and a first down.`, { fd: 1 }); return;
      }
      // The clock: it stops on incompletions, and on the sideline late in each half.
      const stopWin = (q === 2 && clock <= 120) || (q >= 4 && clock <= 300);
      const hurry = twoMin || trailingLate || (otPoss && (diff < 0 || clock <= 240));
      const gap = hurry ? 9 : q >= 4 && diff > 0 && clock <= 480 ? 40 : PM.gap[plan.tempo];
      let runs = !(res.inc || (res.oob && stopWin) || yl + res.y >= 100), toCalled = false;
      // Coach decision: the clock in the last two minutes of a close game. When the team with the ball (ahead or level)
      // lets the clock run, the defense may stop it with one of its three timeouts. At most three asks a half.
      if (runs && q === 4 && clock <= 120 && clock > PM.snapT && gap >= 20 && diff >= 0 && diff <= 8 && yl + res.y > 0 && !(dn === 4 && res.y < tg)) {
        const who = 1 - o;
        if (tol[who] > 0 && toAsk[who] < 3) {
          toAsk[who]++;
          if (ask(who, "to", "run", ["run", "to"], plays ? plays.length + 1 : 0, { save: gap, left: tol[who] }) === "to") { tol[who]--; runs = false; toCalled = true; }
        }
      }
      use(PM.snapT + (runs ? gap : 0));
      gain(res.y, res.p, res.txt, res.sack ? "sack" : res.inc ? "inc" : isPass && res.p && res.p.g !== "QB" ? "pass" : "run");
      if (!runs && toCalled) { mark(); log("to", `Timeout, defense (${tol[1 - o]} left).`, { side: 1 - o }); }
    }
    // Take back the stats of a play wiped out by a flag.
    function undo(res) {
      const y = res.y, s = st[res.p.id] || {};
      if (res.kind === "pass") { const sq = st[res.qb.id] || {}; s.rec--; s.ry -= y; s.tgt--; sq.cmp--; sq.py -= y; sq.att--; T[o].passY -= y; T[o].pass--; }
      else { s.car--; s.rsy -= y; T[o].rushY -= y; if (res.p.g !== "QB") T[o].run--; }
      T[o].yards -= y; T[o].plays--;
    }

    function endPeriod() {
      mark();
      if (q === 1 || q === 3) { log("qtr", `End of the ${nth[q]} quarter.`); q++; clock = 900; return; }
      if (q === 2) {
        log("half", "Halftime.");
        q = 3; clock = 900; r = R2; kickNext = recv1; onside = false; tol[0] = tol[1] = 3; toAsk[0] = toAsk[1] = 0;
        // The halftime hook: a person can change their plan for the second half (lg.h2, set by the "half" move).
        S.forEach((s) => { const h2 = lg.h2 && lg.h2[s.t]; if (h2) { s.plan = h2; if (s.feat !== h2.feature) { const skill = [...s.L.bench.QB, ...s.L.bench.RB, ...s.L.bench.WR, ...s.L.bench.TE]; s.feat = skill.some((p) => p.id === h2.feature && !s.out.has(p.id)) ? h2.feature : null; } } });
        return;
      }
      if (sc[0] !== sc[1]) { log("end", "Final."); over = true; return; }
      if (q === 4 || playoff) {
        if (q === 4) log("qtr", "End of regulation. Overtime!");
        else log("qtr", "End of the overtime period. Another one.");
        q++; clock = playoff ? 900 : 600;
        if (!otPoss) { r = R3; otPoss = [false, false]; kickNext = r() < 0.5 ? 0 : 1; onside = false; }
        return;
      }
      log("end", "Final. It ends in a tie."); over = true;
    }

    // Coach decision: a quarterback having a genuinely bad day (three picks, or a long day of misses) with his team down
    // 14+ in the second half. Asked at most once a game, when his team gets the ball; sticking with him is the default.
    function qbCheck(side) {
      const s = S[side], qb = s.L.QB[0], x = (qb && st[qb.id]) || {}, att = x.att || 0;
      const down = sc[1 - side] - sc[side];
      if (qbAsked[side] || q < 3 || q > 4 || down < 14) return;
      if (!((x.int || 0) >= 3 || (att >= 18 && (x.cmp || 0) / att < 0.45 && (x.py || 0) / att < 5))) return;
      const bk = s.L.bench.QB.find((p) => p !== qb && p.id !== qb.id && !s.out.has(p.id));
      if (!bk) return;
      qbAsked[side] = true;
      if (ask(side, "qb", "stay", ["stay", "bench"], plays ? plays.length : 0, { p: qb.id, b: bk.id, cmp: x.cmp || 0, att, int: x.int || 0 }) === "bench") {
        s.L.QB[0] = bk; s.u = unitsOf(s.L); setEdges(); if (s.feat === qb.id) s.feat = null;
        mark(); log("inj", `${short(bk)} comes in at quarterback for ${short(qb)}.`, { side });
      }
    }

    kickNext = 1 - recv1;
    let guard = 0, lastO = -1;
    while (!over && guard++ < 600) {
      if (clock <= 0) { endPeriod(); continue; }
      if (kickNext != null) { const k = kickNext; kickNext = null; kickoff(k); continue; }
      otCheck(); if (over) { mark(); log("end", "Final."); break; }
      while (hurt.length && hurt[0].at <= elapsed()) injure(hurt.shift());
      if (o !== lastO) { lastO = o; qbCheck(o); }
      snap();
    }
    if (!over) { mark(); log("end", "Final."); }
    if (plays) { mark(); plays.push({ ...pre, k: "final", t: sc[0] === sc[1] ? "Final, a tie." : "Final.", x1: pre.x0, to: o, sc: [sc[0], sc[1]] }); }
    const tend = T.map((x) => {
      const top = Object.entries(x.touch).sort((a, b) => b[1] - a[1])[0];
      return { plays: x.plays, pass: x.pass, run: x.run, blz: x.blz, drop: x.drop, d4: x.d4, two: x.two, top: top ? top[0] : null, topN: top ? top[1] : 0 };
    });
    for (const s of S) for (const x of s.later || []) injured.push({ p: x.p, t: x.t, w: x.w }); // played through a knock
    return { sc, ot: q >= 5, plays, scoring, st, T, injured, tend, asks, plans: S.map((s) => s.plan),
      ls: S.map((s) => GROUPS.flatMap((grp) => s.L[grp].map((p) => p.id).filter(Boolean))) };
  }

  // Play one game for real: the result, the box score, season stats and injuries. neutral: no home field (the final).
  function playGame(lg, g, neutral) {
    const H = units(lg, g.h), A = units(lg, g.a);
    g.spread = r1(expectedPoints(lg, H, A, neutral ? 0 : 1) - expectedPoints(lg, A, H, neutral ? 0 : -1));
    const res = simGame(lg, g, neutral, g.h === lg.user || g.a === lg.user);
    g.hs = res.sc[0]; g.as = res.sc[1]; g.ot = res.ot; g.done = true;
    g.scoring = res.scoring; g.tend = res.tend;
    if (res.plays) g.pbp = res.plays;
    const boxes = [g.h, g.a].map((t, i) => {
      const x = res.T[i];
      return { t, pts: res.sc[i], yards: x.yards, passY: x.passY, rushY: x.rushY, sacks: x.sacks, to: x.to, fd: x.fd, d3: x.d3, d4: x.d4,
        top: x.top, pen: x.pen, penY: x.penY, plays: x.plays, q: x.q, players: [] };
    });
    for (const [id, s] of Object.entries(res.st)) {
      const p = lg.players[id]; if (!p) continue;
      const i = p.team === g.h ? 0 : 1, b = boxes[i];
      b.players.push({ id, g: p.g, ...s });
      const z = lg.stats[id] || (lg.stats[id] = { t: p.team, gp: 0 });
      for (const k in s) z[k] = (z[k] || 0) + s[k];
      z.gp++;
    }
    g.box = { h: boxes[0], a: boxes[1] };
    if (lg.starts) [g.h, g.a].forEach((t, i) => { // who started, for player mood (build B)
      for (const id of res.ls[i]) { lg.starts[id] = (lg.starts[id] || 0) + 1; lg.wkStart.add(id); }
      lg.feat[t] = res.plans[i].feature;
    });
    for (const h of res.injured) { const p = lg.players[h.p]; p.inj = h.w; lg.log.push({ y: lg.year, wk: g.wk, t: h.t, p: h.p, w: h.w }); }
  }
  // The same game, without changing anything: what a viewer shows before the week is played. The week then plays
  // out exactly this (nothing that could change it happens in between).
  function previewGame(lg, g) { return simGame(lg, g, !!g.neutral, true); }

  // ---- Live viewing: which play shows at a moment, as a pure function of time ----
  // Two friends' browsers with the same league and the same start time show the same play: each works out
  // live.at(times, now - start). HALF_MS is the halftime window (a "half" move must arrive before it ends).
  const LIVE_MS = { ko: 3500, xp: 2600, "2pt": 3200, run: 5200, pass: 5600, inc: 4400, sack: 5000, kneel: 3000, punt: 5200, fg: 4800,
    int: 6500, fum: 6500, pen: 3800, qtr: 4000, inj: 3500, to: 2500, end: 0, final: 0 };
  const HALF_MS = 30000;
  function liveTimes(plays) {
    const t = [0];
    for (const p of plays) t.push(t[t.length - 1] + (p.k === "half" ? HALF_MS : (LIVE_MS[p.k] || 4000) + (p.big ? 2500 : 0)));
    return t; // t[i] = when play i starts; the last entry is the end
  }
  function liveAt(times, ms) { // the play showing ms after kickoff
    let lo = 0, hi = times.length - 2;
    if (ms <= 0) return 0;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (times[mid] <= ms) lo = mid; else hi = mid - 1; }
    return lo;
  }

  // ---- Schedule: the real 17-game shape ----
  // 6 division games; 4 against a rotating division in the same conference; 4 against a rotating division in the
  // other conference; 2 against same-place finishers in the other two same-conference divisions; 1 more against a
  // same-place finisher from another division in the other conference. 18 weeks, one bye each (weeks 5-14).
  function divTeams(lg, conf, d) { return lg.teams.filter((t) => t.conf === conf && t.div === DIVS[d]); }
  function placeIn(lg, t) { // last season's place in the division (0 = won it); first season: a seeded order
    if (lg.lastRank) return lg.lastRank[t.i];
    const r = rng(lg.seed, "place", t.i); return r();
  }
  function buildSchedule(lg) {
    const y = lg.year, games = [];
    const intra = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]][y % 3];
    const ranked = {};
    for (const conf of ["AFC", "NFC"]) for (let d = 0; d < 4; d++) {
      const ts = divTeams(lg, conf, d).sort((a, b) => placeIn(lg, a) - placeIn(lg, b));
      ranked[conf + d] = ts;
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { games.push([ts[i].i, ts[j].i]); games.push([ts[j].i, ts[i].i]); }
    }
    const grid = (A, B, flip) => { // 4 x 4, each team two home and two away
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) games.push((i + j + flip) % 2 ? [A[i].i, B[j].i] : [B[j].i, A[i].i]);
    };
    for (const conf of ["AFC", "NFC"]) for (const [a, b] of intra) grid(ranked[conf + a], ranked[conf + b], y % 2);
    for (let d = 0; d < 4; d++) grid(ranked["AFC" + d], ranked["NFC" + ((d + y) % 4)], (y + 1) % 2);
    // Same-place, same conference: the two divisions not in the intra pairing; a 4-cycle per place, so 1 home 1 away.
    for (const conf of ["AFC", "NFC"]) {
      const [[a, b], [c, e]] = intra; // a-b and c-e play each other in full; a plays c and e, b plays c and e
      for (let k = 0; k < 4; k++) {
        const T = (d) => ranked[conf + d][k].i;
        games.push([T(a), T(c)], [T(c), T(b)], [T(b), T(e)], [T(e), T(a)]);
      }
    }
    // The 17th game: other conference, a division two steps further along; AFC hosts in even years.
    for (let d = 0; d < 4; d++) for (let k = 0; k < 4; k++) {
      const A = ranked["AFC" + d][k].i, N = ranked["NFC" + ((d + y + 2) % 4)][k].i;
      games.push(y % 2 === 0 ? [A, N] : [N, A]);
    }
    return weekify(lg, games);
  }
  function weekify(lg, games) {
    const byeCount = [0, 0, 0, 0, 0, 2, 4, 4, 2, 4, 4, 2, 4, 2, 4, 0, 0, 0, 0]; // index = week, sums to 32
    for (let attempt = 0; attempt < 400; attempt++) {
      const r = rng(lg.seed, "sched", lg.year, attempt);
      const teams = r.shuffle(lg.teams.map((t) => t.i));
      const bye = {}; let k = 0;
      for (let wk = 1; wk <= 18; wk++) for (let n = 0; n < byeCount[wk]; n++) bye[teams[k++]] = wk;
      const left = r.shuffle(games.map((g, i) => ({ h: g[0], a: g[1], i })));
      const out = [];
      let fail = false;
      for (let wk = 1; wk <= 18 && !fail; wk++) {
        const playing = lg.teams.map((t) => t.i).filter((t) => bye[t] !== wk);
        const pick = matchWeek(r, playing, left, 18 - wk);
        if (!pick) { fail = true; break; }
        for (const g of pick) { out.push({ wk, h: g.h, a: g.a }); left.splice(left.indexOf(g), 1); }
      }
      if (!fail && !left.length) return out;
    }
    throw new Error("schedule failed");
  }
  // Find a perfect matching of this week's teams from the games left. Teams with the most games left go first,
  // so nobody is stranded at the end of the season.
  function matchWeek(r, playing, left, weeksAfter) {
    const opts = {}; const remain = {};
    for (const t of playing) { opts[t] = []; remain[t] = 0; }
    for (const g of left) {
      if (g.h in remain) remain[g.h]++;
      if (g.a in remain) remain[g.a]++;
      if (g.h in opts && g.a in opts) { opts[g.h].push(g); opts[g.a].push(g); }
    }
    const used = new Set(), pick = [];
    let budget = 4000;
    const go = () => {
      if (--budget < 0) return false;
      let t = null, bestScore = 1e9;
      for (const x of playing) if (!used.has(x)) {
        const n = opts[x].filter((g) => !used.has(g.h === x ? g.a : g.h)).length;
        const s = n * 100 - remain[x];
        if (s < bestScore) { bestScore = s; t = x; }
      }
      if (t === null) return true;
      const choices = r.shuffle(opts[t].filter((g) => !used.has(g.h === t ? g.a : g.h)));
      choices.sort((a, b) => remain[b.h === t ? b.a : b.h] - remain[a.h === t ? a.a : a.h]);
      for (const g of choices) {
        const o = g.h === t ? g.a : g.h;
        used.add(t); used.add(o); pick.push(g);
        if (go()) return true;
        used.delete(t); used.delete(o); pick.pop();
      }
      return false;
    };
    return go() ? pick : null;
  }

  // ---- Season ----
  function startSeason(lg) {
    lg.phase = "season"; lg.week = 0; lg.stats = {}; lg.playoffs = null; lg.log = [];
    if (lg.settings.mode === "real") setCities(lg);
    // Real Rosters, year one: that season's real schedule. Every other season: our formula schedule.
    const real = lg.realSched && lg.year === lg.settings.year;
    lg.games = real ? lg.realSched.map(([wk, h, a]) => ({ wk, h: TEAM_IDX[h], a: TEAM_IDX[a] })) : buildSchedule(lg);
    lg.weeks = real ? Math.max(...lg.games.map((g) => g.wk)) : 18;
    for (const p of Object.values(lg.players)) if (p.inj && p.inj < 30) p.inj = 0;
    const us = lg.teams.map((t) => units(lg, t.i).u), mean = (k) => r1(us.reduce((a, u) => a + u[k], 0) / us.length * 10) / 10;
    lg.mid = { off: mean("off"), def: mean("def"), K: mean("K") };
    lg.midU = {}; for (const g of GROUPS) lg.midU[g] = mean(g);
    if (lg.settings.mode === "real") {
      const sd = (k) => Math.sqrt(us.reduce((a, u) => a + (u[k] - lg.mid[k]) ** 2, 0) / us.length) || 1;
      lg.scale = { off: Math.min(1, M.realSd.off / sd("off")), def: Math.min(1, M.realSd.def / sd("def")) };
    }
    lrSeason(lg);
  }
  function healWeek(lg) { for (const t of lg.teams) for (const pid of t.roster) { const p = lg.players[pid]; if (p.inj && p.inj < 30) p.inj--; } }
  function simWeek(lg) {
    lg.week++;
    const wg = lg.games.filter((g) => g.wk === lg.week);
    for (const g of wg) playGame(lg, g);
    lrWeek(lg, wg);
    lg.h2 = null; lg.calls = null;
    healWeek(lg);
    if (lg.week >= (lg.weeks || 18)) startPlayoffs(lg);
    return true;
  }

  function standings(lg) {
    const rec = lg.teams.map((t) => ({ t: t.i, w: 0, l: 0, tie: 0, pf: 0, pa: 0, dw: 0, dl: 0, cw: 0, cl: 0, h2h: {} }));
    for (const g of lg.games) {
      if (!g.done) continue;
      const H = rec[g.h], A = rec[g.a], th = lg.teams[g.h], ta = lg.teams[g.a];
      H.pf += g.hs; H.pa += g.as; A.pf += g.as; A.pa += g.hs;
      const div = th.conf === ta.conf && th.div === ta.div, conf = th.conf === ta.conf;
      const res = g.hs > g.as ? 1 : g.hs < g.as ? -1 : 0;
      const put = (X, o, r) => {
        if (r > 0) X.w++; else if (r < 0) X.l++; else X.tie++;
        if (div) r > 0 ? X.dw++ : r < 0 ? X.dl++ : 0;
        if (conf) r > 0 ? X.cw++ : r < 0 ? X.cl++ : 0;
        X.h2h[o] = (X.h2h[o] || 0) + r;
      };
      put(H, g.a, res); put(A, g.h, -res);
    }
    for (const x of rec) { const n = x.w + x.l + x.tie; x.pct = n ? (x.w + x.tie / 2) / n : 0; x.diff = x.pf - x.pa; }
    return rec;
  }
  // Tiebreak order (our simple version): win %, head to head, division record, conference record, points
  // difference, then a seeded coin.
  function sortRecs(lg, list) {
    const coin = (t) => rng(lg.seed, "coin", lg.year, t)();
    return list.sort((a, b) => b.pct - a.pct || (b.h2h[a.t] || 0) - (a.h2h[b.t] || 0) ||
      (b.dw - b.dl) - (a.dw - a.dl) || (b.cw - b.cl) - (a.cw - a.cl) || b.diff - a.diff || coin(b.t) - coin(a.t));
  }
  function divisionTables(lg) {
    const rec = standings(lg), out = [];
    for (const conf of ["AFC", "NFC"]) for (const d of DIVS) {
      out.push({ conf, div: d, rows: sortRecs(lg, rec.filter((x) => lg.teams[x.t].conf === conf && lg.teams[x.t].div === d)) });
    }
    return out;
  }
  function seeds(lg) {
    const tables = divisionTables(lg), res = {};
    for (const conf of ["AFC", "NFC"]) {
      const ts = tables.filter((x) => x.conf === conf);
      const winners = sortRecs(lg, ts.map((x) => x.rows[0]));
      const rest = sortRecs(lg, ts.flatMap((x) => x.rows.slice(1))).slice(0, 3);
      res[conf] = [...winners, ...rest].map((x) => x.t);
    }
    return res;
  }

  // ---- Playoffs: 7 per conference, the 1 seed rests the first week; higher seed hosts; the final is neutral. ----
  const ROUNDS = ["Wild Card", "Divisional", "Conference final", "The Final"];
  function startPlayoffs(lg) {
    const tables = divisionTables(lg);
    lg.lastRank = {};
    for (const x of tables) x.rows.forEach((r, i) => (lg.lastRank[r.t] = i + r.t / 100));
    const s = seeds(lg);
    lg.playoffs = { seeds: s, round: 0, games: [], alive: { AFC: s.AFC.slice(), NFC: s.NFC.slice() }, champ: null };
    lg.phase = "playoffs";
  }
  // This round's games (pure: the page shows the next one before it is played).
  function playoffGames(lg) {
    const P = lg.playoffs, k = P.round, wk = 19 + k;
    const games = [];
    const seedOf = (conf, t) => P.seeds[conf].indexOf(t);
    if (k < 3) {
      for (const conf of ["AFC", "NFC"]) {
        let a = P.alive[conf].slice().sort((x, y) => seedOf(conf, x) - seedOf(conf, y));
        if (k === 0) a = a.slice(1); // the 1 seed rests
        if (k === 0) {
          const top = P.alive[conf].slice().sort((x, y) => seedOf(conf, x) - seedOf(conf, y));
          for (const [i, j] of [[1, 6], [2, 5], [3, 4]]) games.push({ wk, h: top[i], a: top[j], po: k, conf });
        } else {
          while (a.length) { const h = a.shift(), aw = a.pop(); games.push({ wk, h, a: aw, po: k, conf }); }
        }
      }
    } else {
      games.push({ wk, h: P.alive.AFC[0], a: P.alive.NFC[0], po: 3, conf: "", neutral: true });
      if (rng(lg.seed, "finalside", lg.year)() < 0.5) { const g = games[0]; [g.h, g.a] = [g.a, g.h]; }
    }
    return games;
  }
  function simPlayoffRound(lg) {
    const P = lg.playoffs, k = P.round, games = playoffGames(lg);
    for (const g of games) {
      playGame(lg, g, g.neutral);
      const loser = g.hs > g.as ? g.a : g.h;
      if (k < 3) P.alive[g.conf] = P.alive[g.conf].filter((t) => t !== loser);
      else P.champ = g.hs > g.as ? g.h : g.a;
      P.games.push(g);
    }
    lrWeek(lg, games);
    lg.h2 = null; lg.calls = null;
    healWeek(lg);
    P.round++;
    if (P.round === 4) finishSeason(lg);
    return true;
  }

  // ---- Awards and the season summary ----
  function leaders(lg) {
    const L = {};
    const cats = { py: "Passing yards", ptd: "Passing TDs", rsy: "Rushing yards", ry: "Receiving yards", rec: "Catches",
      rtd: "Receiving TDs", sk: "Sacks", di: "Interceptions", tk: "Tackles" };
    for (const k of Object.keys(cats)) {
      L[k] = { label: cats[k], top: Object.entries(lg.stats).filter(([, s]) => s[k]).sort((a, b) => b[1][k] - a[1][k]).slice(0, 10)
        .map(([id, s]) => ({ id, v: s[k], t: lg.players[id] ? lg.players[id].team : s.t })) };
    }
    return L;
  }
  function awardScore(lg, id, s, rec) {
    const p = lg.players[id]; if (!p) return 0;
    const team = rec.find((x) => x.t === p.team) || { pct: 0 };
    const v = (s.py || 0) / 25 + (s.ptd || 0) * 4 - (s.int || 0) * 3 + (s.rsy || 0) / 10 + (s.ry || 0) / 10 + ((s.rstd || 0) + (s.rtd || 0)) * 6 + (s.sk || 0) * 4 + (s.di || 0) * 6;
    return v * (0.6 + team.pct) * (p.g === "QB" ? 1.1 : 1);
  }
  function finishSeason(lg) {
    const rec = standings(lg);
    const ranked = Object.entries(lg.stats).map(([id, s]) => [id, awardScore(lg, id, s, rec)]).sort((a, b) => b[1] - a[1]);
    const mvp = ranked[0] && ranked[0][0];
    const rookie = (ranked.find(([id]) => lg.players[id] && lg.players[id].exp === 0) || [])[0];
    const u = rec[lg.user], P = lg.playoffs;
    let fate = "Missed the playoffs";
    const inPo = P.seeds[lg.teams[lg.user].conf].includes(lg.user);
    if (inPo) {
      const lost = P.games.find((g) => (g.h === lg.user || g.a === lg.user) && (g.hs > g.as ? g.a : g.h) === lg.user);
      fate = P.champ === lg.user ? "Won the Final" : lost ? `Lost in the ${ROUNDS[lost.po]}` : "Made the playoffs";
    }
    lg.history.push({ year: lg.year, champ: P.champ, runnerUp: (() => { const f = P.games[P.games.length - 1]; return f.hs > f.as ? f.a : f.h; })(),
      w: u.w, l: u.l, tie: u.tie, pf: u.pf, pa: u.pa, fate, seed: inPo ? P.seeds[lg.teams[lg.user].conf].indexOf(lg.user) + 1 : 0,
      mvp, rookie, mvpName: mvp && lg.players[mvp].name, rookieName: rookie && lg.players[rookie].name,
      mvpTeam: mvp && lg.players[mvp].team, rookieTeam: rookie && lg.players[rookie].team });
    lrSeasonEnd(lg, lg.history[lg.history.length - 1]);
    lg.phase = "done";
  }

  // ---- Offseason v1: age, develop or decline, retire, contracts, rookie draft, cut to 53 ----
  // Where a position's curve starts falling, by age. Backs fade early, quarterbacks and kickers late.
  const PEAK = { QB: 32, RB: 27, WR: 29, TE: 29, OL: 30, DL: 29, ED: 29, LB: 28, CB: 28, S: 29, K: 35, P: 35 };
  function startOffseason(lg) {
    const done = lg.year;
    lg.year++;
    lg.offseason = { from: done, retired: [], changes: [], expiring: [], wont: [] };
    const O = lg.offseason;
    for (const p of Object.values(lg.players)) {
      if (p.gone) continue;
      const r = rng(lg.seed, "age", lg.year, p.id);
      p.age = r1(p.age + 1); p.exp++; p.inj = 0; p.rookie = false;
      const peak = PEAK[p.g], over = p.age - peak;
      let dlt;
      if (p.age < 26.5) dlt = Math.min(Math.max(0, p.ceil - p.grade), 0.25 + r() * 0.9) + r.normal() * 0.25;
      else if (over < 0) dlt = r.normal() * 0.35 + 0.05;
      else dlt = -(0.25 + over * 0.22) + r.normal() * 0.35;
      const before = p.grade;
      p.grade = r1(clamp(p.grade + dlt, 1, 10));
      p.ceil = r1(Math.max(p.ceil - (p.age > 26 ? 0.3 : 0), p.grade));
      // Retirement: likelier with age past the peak and with a low grade.
      const pr = over < 2 ? (p.grade < 3.5 && p.age > 29 ? 0.25 : 0) : clamp(0.12 + (over - 2) * 0.12 + (p.grade < 5 ? 0.2 : 0) - (p.grade > 8 ? 0.15 : 0), 0, 0.92);
      if (r() < pr) {
        p.gone = true;
        if (p.team >= 0) { lg.teams[p.team].roster = lg.teams[p.team].roster.filter((x) => x !== p.id); if (p.team === lg.user) O.retired.push(p.id); }
        lg.fa = lg.fa.filter((x) => x !== p.id);
        p.team = -1;
        continue;
      }
      if (p.team === lg.user && Math.abs(p.grade - before) >= 0.5) O.changes.push([p.id, r1(p.grade - before)]);
      if (p.team >= 0) { p.yrs--; if (p.yrs <= 0 && p.team === lg.user) O.expiring.push(p.id); }
    }
    // Unsigned free agents who are old or poor drift away.
    lg.fa = lg.fa.filter((id) => { const p = lg.players[id]; if (p.age > PEAK[p.g] + 2 || p.grade < 2.5) { p.gone = true; return false; } return true; });
    // AI teams re-sign the ones worth keeping: starters, young players, anyone above their team's need line.
    for (const t of lg.teams) {
      if (t.i === lg.user) continue;
      const exp = t.roster.map((id) => lg.players[id]).filter((p) => p.yrs <= 0);
      for (const p of exp) {
        const keep = p.grade >= 6 || p.age < 26 || rng(lg.seed, "keep", lg.year, p.id)() < 0.35;
        const no = keep && refuses(lg, p); // build B: an unhappy player may walk
        if (no && p.grade >= 7.5) news(lg, { k: "walk", t: t.i, p: p.id, pr: 4 + (p.grade - 7.5), wk: 24, h: `${p.name} won't re-sign with ${teamName(t)}`, b: "He is heading to free agency." });
        if (keep && !no) newDeal(lg, p); else release(lg, p);
      }
    }
    for (const id of O.expiring) { const p = lg.players[id]; if (refuses(lg, p)) { O.wont.push(id);
      news(lg, { k: "walk", t: lg.user, p: id, pr: 9, wk: 24, h: `${p.name} won't re-sign with ${teamName(lg.teams[lg.user])}`, b: "Unhappy with last season, he wants to test free agency." }); } }
    for (const id of O.retired) { const p = lg.players[id]; if (p.grade >= 6)
      news(lg, { k: "retire", t: lg.user, p: id, pr: 6, wk: 24, h: `${p.name} retires`, b: `The ${GROUP_NAME[p.g].toLowerCase()} calls it a career.` }); }
    lrOffseason(lg);
    lg.phase = "resign";
    return true;
  }
  function newDeal(lg, p) {
    const r = rng(lg.seed, "redeal", lg.year, p.id); p.yrs = p.age < 27 ? 3 + r.int(2) : p.age < 31 ? 2 + r.int(2) : 1 + r.int(2);
    if (lg.mood) { lg.mood[p.id] = Math.min(100, moodOf(lg, p.id) + 15); lg.why[p.id] = ["newdeal"]; }
  }
  function release(lg, p) {
    if (lg.mood) delete lg.mood[p.id];
    if (p.team >= 0) lg.teams[p.team].roster = lg.teams[p.team].roster.filter((x) => x !== p.id);
    p.team = -1; p.yrs = 0; if (!lg.fa.includes(p.id)) lg.fa.push(p.id);
  }
  function resign(lg, keep) {
    const wont = new Set(lg.offseason.wont || []);
    for (const id of lg.offseason.expiring) { const p = lg.players[id]; if (p.gone) continue; keep.has(id) && !wont.has(id) ? newDeal(lg, p) : release(lg, p); }
    // The rookie class (Real Rosters: the real draft class of that year while there is one; otherwise generated).
    const cls = rookieClass(lg);
    const rec = standings(lg);
    const P = lg.playoffs;
    const exitRound = (t) => { if (t === P.champ) return 5; const g = P.games.filter((x) => x.h === t || x.a === t); return g.length ? g[g.length - 1].po + 1 : 0; };
    const order = lg.teams.map((t) => t.i).sort((a, b) => exitRound(a) - exitRound(b) || rec[a].pct - rec[b].pct || rec[a].diff - rec[b].diff ||
      rng(lg.seed, "dorder", lg.year, a)() - rng(lg.seed, "dorder", lg.year, b)());
    lg.draftOrder = order;
    lg.draft = startDraft(lg, "rookie", order, ROOKIE_ROUNDS, false, cls);
    lg.phase = "rookie";
    return true;
  }

  const FIRST = ["Aiden", "Andre", "Bryce", "Caleb", "Camden", "Darius", "Dante", "Devin", "Elijah", "Emmanuel", "Ethan", "Grant", "Isaiah",
    "Jabari", "Jalen", "Jamal", "Jaylen", "Jordan", "Josiah", "Julian", "Kade", "Keon", "Landon", "Logan", "Malik", "Marcus", "Mason", "Micah",
    "Miles", "Nate", "Noah", "Omar", "Owen", "Quincy", "Reed", "Rashad", "Roman", "Sam", "Silas", "Terrell", "Theo", "Tre", "Tyrese", "Wes",
    "Xavier", "Zion", "Brooks", "Cole", "Dalton", "Easton", "Gavin", "Hayes", "Jace", "Kellen", "Luca", "Nico", "Pierce", "Ricky", "Shane", "Trey"];
  const LAST = ["Abbott", "Alston", "Barlow", "Beckett", "Booker", "Bradford", "Calloway", "Carver", "Coleman", "Dawson", "Delaney", "Easley",
    "Ellison", "Fairley", "Fontaine", "Gaines", "Garrison", "Hadley", "Hampton", "Holloway", "Ingram", "Jennings", "Keller", "Lockett",
    "Lowery", "Maddox", "Mercer", "Nash", "Oakley", "Odom", "Pruitt", "Quarles", "Ransom", "Redding", "Sampson", "Sutter", "Tatum",
    "Thornton", "Underwood", "Vance", "Waller", "Whitfield", "Winslow", "Yates", "Ziegler", "Banks", "Crowder", "Dupree", "Everett",
    "Fulton", "Grady", "Harlan", "Iverson", "Jessup", "Kimble", "Langford", "Mayfield", "Norwood", "Pickett", "Rhodes", "Sterling", "Talley"];
  const CLASS_MIX = { QB: 14, RB: 22, WR: 38, TE: 18, OL: 46, DL: 24, ED: 30, LB: 22, CB: 34, S: 22, K: 5, P: 5 }; // ~280 players
  // A real draft class, graded only from where each player was picked plus his position, never from his career.
  // A seeded wobble per league keeps every class from playing out the same. Hindsight (a setting, off by default)
  // grades them from their real careers instead: their grade after year one and their best grade in our pools.
  const SLOT_ADJ = { QB: [-0.8, 0.8], RB: [0.3, -0.3], WR: [0.1, 0], TE: [-0.2, 0], OL: [0.1, 0], DL: [0, 0], ED: [0, 0.1],
    LB: [0.1, -0.1], CB: [0, 0], S: [0.1, -0.1], K: [0.8, 0.3], P: [0.8, 0.3] };
  function realClass(lg, cls) {
    const cols = lg.drafts.cols, ids = [];
    for (const row of cls) {
      const x = {}; cols.forEach((c, i) => (x[c] = row[i]));
      if (lg.players[x.id]) continue;
      const r = rng(lg.seed, "rk", lg.year, x.id), s = 1 - Math.log(x.pick) / Math.log(300), [ag, ac] = SLOT_ADJ[x.g];
      let grade, ceil;
      if (lg.settings.hindsight && x.hg != null) { grade = r1(clamp(x.hg - 0.4, 1, 9.5)); ceil = r1(Math.max(x.hc, grade)); }
      else {
        grade = r1(clamp(2.5 + 4.3 * s + ag + r.normal() * 0.45, 1, 8.5));
        ceil = r1(clamp(grade + 1.0 + 3.6 * s + ac + r.normal() * 0.9, grade, 9.9));
      }
      lg.players[x.id] = { id: x.id, name: shownName(x), g: x.g, pos: x.pos, age: x.age, team: -1, real: "", grade, ceil, exp: 0, pick: x.pick,
        line: x.college ? `${x.college} · real pick ${x.pick}` : `Real pick ${x.pick}`, inj: 0, yrs: 0, rookie: true, rk: true };
      ids.push(x.id);
    }
    return ids;
  }
  function rookieClass(lg) {
    const D = lg.drafts && lg.drafts.years[lg.year];
    if (D && D.length) return realClass(lg, D);
    const ids = [], used = new Set(Object.values(lg.players).map((p) => p.name));
    let n = 0;
    for (const g of GROUPS) for (let i = 0; i < CLASS_MIX[g]; i++, n++) {
      const r = rng(lg.seed, "rookie", lg.year, g, i);
      let name; do { name = r.pick(FIRST) + " " + r.pick(LAST); } while (used.has(name) && r() < 0.98);
      used.add(name);
      // Most are depth players; a few start right away; the ceiling is where the class's value sits.
      const q = r();
      const grade = r1(clamp(q < 0.04 ? 6.8 + r() * 1.4 : q < 0.2 ? 5.2 + r() * 1.6 : 2.2 + r() * 3, 1, 9));
      const ceil = r1(clamp(grade + 0.5 + r() * 3 + (q < 0.2 ? 0.6 : 0), grade, 10));
      const id = `r${lg.year}-${g}-${i}`;
      lg.players[id] = { id, name, g, pos: g === "OL" ? r.pick(["T", "G", "C"]) : g === "S" ? r.pick(["FS", "SS"]) : g === "ED" ? r.pick(["DE", "OLB"]) : g === "DL" ? "DT" : g === "LB" ? "ILB" : g,
        age: r1(21 + r() * 2), team: -1, real: "", grade, ceil, exp: 0, pick: 0, line: "", inj: 0, yrs: 0, rookie: true, gen: true };
      ids.push(id);
    }
    return ids;
  }

  // Keep the best 53 by value, never dropping a position below its minimum.
  function keepValue(p) { return p.grade + Math.max(0, 26 - p.age) * 0.12 + (p.ceil - p.grade) * 0.15 - (p.inj >= 30 ? 1.5 : 0); }
  function aiCut(lg, t) {
    while (t.roster.length > ROSTER) {
      const c = countBy(lg, t.i);
      let worst = null, wv = 1e9;
      for (const id of t.roster) { const p = lg.players[id]; if (c[p.g] <= MINPOS[p.g]) continue; const v = keepValue(p) + (c[p.g] <= STARTERS[p.g] ? 5 : 0); if (v < wv) { wv = v; worst = p; } }
      if (!worst) break;
      release(lg, worst);
    }
  }
  function suggestCuts(lg) { // what the AI would cut from the user's team
    const t = lg.teams[lg.user], ids = t.roster.slice(), out = [];
    const c = countBy(lg, t.i);
    while (ids.length - out.length > ROSTER) {
      let worst = null, wv = 1e9;
      for (const id of ids) { if (out.includes(id)) continue; const p = lg.players[id]; if (c[p.g] <= MINPOS[p.g]) continue; const v = keepValue(p); if (v < wv) { wv = v; worst = p; } }
      if (!worst) break;
      out.push(worst.id); c[worst.g]--;
    }
    return out;
  }
  function cutDown(lg, ids) {
    const t = lg.teams[lg.user];
    const set = new Set(ids.filter((id) => t.roster.includes(id)));
    if (t.roster.length - set.size > ROSTER) return false;
    for (const id of set) release(lg, lg.players[id]);
    finishCuts(lg);
    return true;
  }
  // Every team short of 53 or of a position minimum signs the best free agents it needs.
  function fillRosters(lg) {
    const pool = () => lg.fa.map((id) => lg.players[id]).filter((p) => !p.gone).sort((a, b) => keepValue(b) - keepValue(a));
    for (const t of lg.teams) {
      let c = countBy(lg, t.i);
      const sign = (p) => { lg.fa = lg.fa.filter((x) => x !== p.id); p.team = t.i; p.yrs = 1; t.roster.push(p.id); c[p.g]++; };
      for (const g of GROUPS) while (c[g] < MINPOS[g]) { const p = pool().find((x) => x.g === g); if (!p) break; sign(p); }
      while (t.roster.length < ROSTER) { const p = pool().find((x) => c[x.g] < MAXPOS[x.g]); if (!p) break; sign(p); }
      if (t.i !== lg.user) aiCut(lg, t);
    }
  }
  function finishCuts(lg) {
    fillRosters(lg);
    startSeason(lg);
  }

  // ---- Locker room (build B): fans, morale, news ----
  // Everything here is worked out from the games and the moves, with labelled draws, so it replays like the rest.
  // SAFETY RULE: players carry real names, so every story and fan post is about football inside the sim only
  // (results, snaps, contracts, trade wishes, sideline frustration after a loss). Never anything off the field.
  // Every story is labelled simulated by the page. Morale only touches play and re-signing in leagues made with
  // build B (settings.lr), so a save from before replays to the identical league.
  const LR = { mor: 0.03, keep: 40 };
  const lrOn = (lg) => !!lg.settings.lr;
  function lrInit(lg) {
    lg.mood = {}; lg.why = {}; lg.tm = TEAMS.map(() => 55); lg.starts = {}; lg.tgp = TEAMS.map(() => 0); lg.wkStart = new Set();
    lg.feat = {}; lg.flags = {}; lg.news = [];
    lg.fans = { m: 55, exp: null, d: 0, posts: [], head: null, hist: [] };
  }
  const moodOf = (lg, id) => (lg.mood && lg.mood[id] != null ? lg.mood[id] : 60);
  function moraleEdge(lg, t) { return lrOn(lg) && lg.tm ? LR.mor * clamp((lg.tm[t] - 55) / 35, -1, 1) : 0; }
  const MOOD_WORD = (m) => m >= 75 ? "Fired up" : m >= 60 ? "Happy" : m >= 45 ? "Steady" : m >= 30 ? "Unhappy" : "Upset";
  const WHY = { start: "Starting", bench: "Lost his starting spot", snaps: "Wants more snaps", lose: "Losing wears on him", win: "Loving the winning",
    deal: "Contract year", feat: "Featured in the game plan", hold: "Holding out", newdeal: "Just re-signed", hurt: "Injured" };

  // A team's results so far this season, in order (regular season, then playoffs).
  function resultsOf(lg, t) {
    const gs = lg.games.filter((g) => g.done && (g.h === t || g.a === t));
    if (lg.playoffs) gs.push(...lg.playoffs.games.filter((g) => g.h === t || g.a === t));
    return gs.map((g) => { const me = g.h === t ? g.hs : g.as, them = g.h === t ? g.as : g.hs; return me > them ? 1 : me < them ? -1 : 0; });
  }
  function streakOf(res) { if (!res.length) return 0; const last = res[res.length - 1]; if (!last) return 0; let n = 0; for (let i = res.length - 1; i >= 0 && res[i] === last; i--) n++; return n * last; }
  const recStr = (r) => `${r.w}-${r.l}${r.tie ? "-" + r.tie : ""}`;

  // Season start: expected wins for the fans, holdouts, the preseason headline.
  function lrSeason(lg) {
    if (!lg.fans) lrInit(lg);
    lg.starts = {}; lg.tgp = TEAMS.map(() => 0); lg.wkStart = new Set(); lg.feat = {}; lg.flags = {};
    lg.news = lg.news.filter((n) => n.y >= lg.year - 1);
    const us = lg.teams.map((t) => units(lg, t.i).u.ovr), mean = us.reduce((a, x) => a + x, 0) / 32;
    const sd = Math.sqrt(us.reduce((a, x) => a + (x - mean) ** 2, 0) / 32) || 1, n = lg.games.filter((g) => g.h === lg.user || g.a === lg.user).length || 17;
    const F = lg.fans;
    F.exp = clamp(Math.round((n / 2 + (us[lg.user] - mean) / sd * n * 0.13) * 2) / 2, 2, n - 2);
    F.games = n; F.d = 0;
    const c = teamName(lg.teams[lg.user]), r = rng(lg.seed, "fanpre", lg.year);
    F.head = F.exp >= n * 0.62 ? r.pick([`Big things expected in ${c}: fans set the bar at ${F.exp} wins`, `${c} enters ${lg.year} as a contender, and the fans know it`])
      : F.exp <= n * 0.38 ? r.pick([`Patience asked for in ${c}: a ${F.exp}-win team on paper`, `Low expectations in ${c}. Can the coach beat them?`])
      : r.pick([`${c} looks like a ${F.exp}-win team. Fans want more`, `Middle of the pack on paper: ${c} coach starts the ${lg.year} season`]);
    F.hist.push({ y: lg.year, wk: 0, m: Math.round(F.m) });
    if (F.hist.length > 80) F.hist = F.hist.slice(-80);
    for (const p of Object.values(lg.players)) if (p.hold) p.hold = 0;
    if (!lrOn(lg)) return;
    // A star in the last year of his deal who is unhappy may hold out the first week.
    for (const t of lg.teams) for (const pid of t.roster) {
      const p = lg.players[pid];
      if (p.yrs !== 1 || p.g === "K" || p.g === "P" || p.grade < 7.5 || p.inj || moodOf(lg, pid) >= 55 || rng(lg.seed, "hold", lg.year, pid)() > 0.3) continue;
      p.hold = 1; (lg.why[pid] = lg.why[pid] || []).unshift("hold");
      news(lg, { k: "hold", t: t.i, p: pid, pr: t.i === lg.user ? 9 : 5 + (p.grade - 7.5),
        h: `${p.name} holds out for a new deal`, b: `The ${GROUP_NAME[p.g].toLowerCase()} is in the last year of his contract and won't play week 1 for ${teamName(t)} without a new one.` });
    }
  }
  function news(lg, n) { lg.news.push({ y: lg.year, wk: n.wk != null ? n.wk : lg.week, ph: lg.phase, me: n.t === lg.user || n.t2 === lg.user, ...n }); }

  // After every week of games (regular season and playoffs).
  function lrWeek(lg, games) {
    if (!lg.fans) lrInit(lg);
    const rec = standings(lg), played = new Set(games.flatMap((g) => [g.h, g.a]));
    // Player mood: playing time, results, contract year, being featured, a benching.
    for (const t of lg.teams) {
      if (!played.has(t.i)) continue;
      const res = resultsOf(lg, t.i), G = res.length, r = rec[t.i], last = res[res.length - 1];
      const pct = r.w + r.l + r.tie ? (r.w + r.tie / 2) / (r.w + r.l + r.tie) : 0.5;
      const by = {}; for (const g of GROUPS) by[g] = [];
      for (const pid of t.roster) { const p = lg.players[pid]; if (!p.inj && !p.hold) by[p.g].push(p); }
      for (const g of GROUPS) by[g].sort((a, b) => b.grade - a.grade);
      const mood = [];
      for (const pid of t.roster) {
        const p = lg.players[pid], why = [];
        if (p.inj) { lg.why[pid] = ["hurt"]; continue; }
        let target = 60;
        const rank = by[p.g].indexOf(p), started = lg.wkStart.has(pid), share = G ? (lg.starts[pid] || 0) / G : 0;
        const worst = by[p.g][STARTERS[p.g] - 1];
        if (p.hold) { target -= 20; why.push("hold"); }
        else if (started) { target += 8; why.push("start"); }
        else if (rank >= 0 && rank < STARTERS[p.g]) { target -= 28; why.push("bench"); }
        else if (worst && p.grade >= worst.grade - 0.4 && p.age >= 24 && share < 0.3 && G >= 3) { target -= 10; why.push("snaps"); }
        if (G >= 3 && pct < 0.35) { target -= p.age >= 29 ? 14 : 8; why.push("lose"); }
        else if (G >= 3 && pct > 0.65) { target += 8; why.push("win"); }
        target += last > 0 ? 5 : last < 0 ? -5 : 0;
        if (p.yrs === 1 && p.grade >= 7 && pct <= 0.6) { target -= 8; why.push("deal"); }
        if (lg.feat[t.i] === pid) { target += 10; why.push("feat"); }
        const m0 = moodOf(lg, pid);
        lg.mood[pid] = Math.round(clamp(m0 + (target - m0) * 0.35, 0, 100));
        lg.why[pid] = why;
        if (started) mood.push(lg.mood[pid]);
      }
      const avgM = mood.length ? mood.reduce((a, x) => a + x, 0) / mood.length : 60, sk = clamp(streakOf(res), -5, 5);
      lg.tm[t.i] = Math.round(clamp(0.55 * avgM + 0.45 * (55 + sk * 5 + (pct - 0.5) * 30), 5, 95));
    }
    lg.wkStart = new Set();
    for (const t of lg.teams) for (const pid of t.roster) { const p = lg.players[pid]; if (p.hold && lg.week >= p.hold) p.hold = 0; }
    // Fans of the user's coach.
    const mine = games.find((g) => g.h === lg.user || g.a === lg.user);
    if (mine) fanGame(lg, mine, rec);
    weekNews(lg, games, rec);
  }

  const FAN_A = ["Blitz", "EndZone", "Tailgate", "FourthAnd", "Pigskin", "Sideline", "Huddle", "Goalline", "Hashmark", "Audible", "Snapcount", "Kickoff",
    "Redzone", "TwoMinute", "Gridiron", "Playbook", "Turf", "Chalk", "Spiral", "Stadium"];
  const FAN_B = ["Guru", "Dad", "Queen", "Prophet", "Junkie", "Diehard", "Mom", "Nerd", "Lifer", "Takes", "Grandpa", "Hive", "Whisperer", "Truther",
    "Season Ticket", "Couch Coach", "Watcher", "Faithful"];
  function fanHandle(r) { return "@" + r.pick(FAN_A) + r.pick(FAN_B).replace(/ /g, "") + (r() < 0.7 ? 2 + r.int(98) : ""); }
  // Fan posts: {c} your team, {o} opponent, {s} the score, {r} record, {n} your best player of the game.
  const POSTS = {
    upw: ["Nobody gave us a chance against {o}. {s}. Nobody! 😤", "Book it: {c} just took down {o}. Who's laughing now? 😂", "Underdogs my foot. {s} 🔥🔥"],
    bigw: ["{s}?! Put it on a poster 🖼️", "That was a statement. {o} wanted no part of us 💪", "{n} was cooking all day 🔥", "Blowout city. {c} at {r} and rolling 🚂"],
    w: ["W. Back to work Monday ✅", "{n} with the game ball for me 🏈", "Ugly or pretty, a win is a win. {r} 🙌", "Love this team. {s} over {o} 💜"],
    closew: ["My heart can't take these {s} finishes 😮‍💨", "Clutch. Absolutely clutch 🧊", "Survived {o}. Barely. I'll take it 😅"],
    closel: ["So close against {o}. One play 😩", "{s}. That one stings. Need to finish drives 😞", "Lost a coin flip game. Moving on 🙄"],
    l: ["{s}. Not good enough 😠", "The play calling today... I have questions 🤔", "{r} and I'm worried. Fix it ⚠️", "Tough loss to {o}. Next week matters"],
    bigl: ["{s}?? Embarrassing. Turned it off at halftime 📺", "Whatever that was against {o}, never again 🤮", "Somebody check on the defense, they never showed up 🚨"],
    upl: ["We were supposed to beat {o}! {s}?! 🤬", "How do you lose that one. HOW 😤", "That loss to {o} is going to haunt us 👻"],
    tie: ["A tie. Nobody is happy. 😐", "{s}. Kiss your sister football 🤷"],
    pow: ["PLAYOFF WIN! {s} over {o} 🎉", "Survive and advance! {c} moves on 💜", "{n} in January, built different 🥶"],
    pol: ["Season over. {s}. Proud of the run, but it hurts 💔", "Out to {o}. The offseason starts now 😔"],
    champ: ["CHAMPIONS!!! {c} wins The Final 🏆🏆🏆", "I've waited my whole life for this. CHAMPIONS 😭🏆", "Parade route when?! 🎊"],
    hot: ["Best coach in the league and it's not close 🐐", "In Coach we trust 🙏", "This is our year. Calling it now 🏆"],
    warm: ["Trusting the process 📈", "Coach has them believing 💜", "Starting to feel good about this team"],
    cool: ["Coach needs a big win soon 😬", "Not sold yet. Show me 🤨", "Fine. Not great. Fine 😐"],
    cold: ["Hot seat. Hot hot seat 🔥🪑", "How much longer do we wait? 😤", "I want a new coach, simple as that 👋"],
    steal: ["Can't believe {n} fell to us. Steal of the draft 🤑", "Front office cooked with {n} 🧑‍🍳", "{n}! Day-one starter, mark it 📝"],
    reach: ["{n}?? With THAT pick? Somebody explain 🤨", "Huge reach on {n}. Hope I'm wrong 😬", "Not who I wanted. {n} better prove it"],
    okpick: ["{n} makes sense. Solid pick 👍", "Welcome to {c}, {n} 💜", "Like the {n} pick. Fills a need"],
  };
  function fill(s, v) { return s.replace(/\{(\w)\}/g, (_, k) => v[k] != null ? v[k] : ""); }
  function fanPosts(lg, kinds, v, key) {
    const r = rng(lg.seed, "fanpost", lg.year, key), out = [], used = new Set();
    for (const k of kinds) {
      const pool = POSTS[k].filter((x) => !used.has(x) && (v.n || !x.includes("{n}")));
      if (!pool.length) continue;
      const txt = r.pick(pool); used.add(txt);
      out.push({ h: fanHandle(r), txt: fill(txt, v), likes: 3 + r.int(400) });
    }
    return out;
  }
  const band = (m) => m >= 75 ? "hot" : m >= 55 ? "warm" : m >= 35 ? "cool" : "cold";
  // The user's best player in a game, by a simple box-score score.
  function starOf(lg, g, t) {
    const b = g.box && (g.box.h.t === t ? g.box.h : g.box.a); if (!b) return null;
    let best = null, bv = 0;
    for (const x of b.players) {
      const v = (x.py || 0) / 25 + (x.ptd || 0) * 4 - (x.int || 0) * 3 + (x.rsy || 0) / 10 + (x.ry || 0) / 10 + ((x.rstd || 0) + (x.rtd || 0)) * 6 + (x.sk || 0) * 4 + (x.di || 0) * 5;
      if (v > bv) { bv = v; best = x.id; }
    }
    return best && lg.players[best] ? lg.players[best] : null;
  }
  function fanGame(lg, g, rec) {
    const F = lg.fans, me = g.h === lg.user, my = me ? g.hs : g.as, th = me ? g.as : g.hs, opp = me ? g.a : g.h;
    const margin = my - th, line = (me ? 1 : -1) * (g.spread || 0), win = margin > 0, loss = margin < 0;
    const tu = lg.teams[lg.user], to = lg.teams[opp], div = !g.po && tu.conf === to.conf && tu.div === to.div;
    const res = resultsOf(lg, lg.user), sk = streakOf(res);
    let d = clamp((margin - line) / 10 * 3, -5, 5) + (win ? 3 : loss ? -3 : 0);
    if (div) d *= 1.4;
    if (margin >= 20) d += 2; if (margin <= -20) d -= 3;
    if (sk <= -3) d -= 1.5; if (sk >= 4) d += 1;
    let kind = !win && !loss ? "tie" : win ? (line <= -3 ? "upw" : margin >= 20 ? "bigw" : margin <= 3 ? "closew" : "w")
      : (line >= 6 ? "upl" : margin <= -20 ? "bigl" : margin >= -3 ? "closel" : "l");
    if (g.po != null) {
      if (win) { d += 6; kind = g.po === 3 ? "champ" : "pow"; if (g.po === 3) d += 12; }
      else { d -= line >= 4 ? 5 : 2; kind = "pol"; }
    }
    const m0 = F.m;
    F.m = Math.round(clamp(F.m + d + (50 - F.m) * 0.04, 0, 100));
    F.d = F.m - m0;
    const r = rec[lg.user], star = starOf(lg, g, lg.user);
    const v = { c: teamName(tu), o: teamName(to), s: `${Math.max(my, th)}-${Math.min(my, th)}`, r: recStr(r), n: star ? star.name : "" };
    F.posts = fanPosts(lg, [kind, kind, band(F.m)], v, g.wk);
    F.hist.push({ y: lg.year, wk: g.wk, m: F.m });
    if (F.hist.length > 80) F.hist = F.hist.slice(-80);
    F.head = coachHead(lg, kind, sk, v, g);
  }
  function coachHead(lg, kind, sk, v, g) {
    const r = rng(lg.seed, "coachhead", lg.year, g.wk), m = lg.fans.m, c = v.c;
    if (kind === "champ") return r.pick([`${c} coach climbs the mountain: champions`, `Coach delivers a title to ${c}`]);
    if (kind === "pow") return r.pick([`${c} coach wins in January, ${v.s} over ${v.o}`, `Playoff win quiets every doubter in ${c}`]);
    if (kind === "pol") return m < 40 ? `Early playoff exit puts the ${c} coach under the microscope` : `${c} season ends against ${v.o}, but fans see progress`;
    if (sk <= -4) return r.pick([`Seat getting hot: ${c} has lost ${-sk} straight`, `${-sk} straight losses and ${c} fans want answers`]);
    if (sk >= 5) return r.pick([`${sk} in a row: ${c} coach has the city buzzing`, `Winning streak hits ${sk} as ${c} rolls to ${v.r}`]);
    if (kind === "upw") return `${c} coach out-schemes ${v.o} in a ${v.s} upset`;
    if (kind === "upl") return `Stunning ${v.s} loss to ${v.o} has ${c} fans fuming`;
    if (m < 20) return r.pick([`Hot seat: ${c} coach under fire at ${v.r}`, `Fan mood hits rock bottom in ${c}`]);
    if (m < 40) return r.pick([`Patience wearing thin in ${c} at ${v.r}`, `${c} coach needs a turnaround, and soon`]);
    if (m < 60) return r.pick([`So far, so-so: ${c} sits at ${v.r}`, `${c} coach still searching for an identity at ${v.r}`]);
    if (m < 80) return r.pick([`Fans buying in as ${c} reaches ${v.r}`, `${c} coach earning trust, one week at a time`]);
    return r.pick([`${c} coach can do no wrong right now`, `The whole city is behind the ${c} coach at ${v.r}`]);
  }

  // A fan reaction to the user's first pick of a draft (Redraft round one, every rookie draft).
  function fanDraft(lg, d, pid) {
    if (!lg.fans || d.mineDone) return;
    d.mineDone = true;
    const p = lg.players[pid], rookie = d.kind === "rookie", v = boardValue(p, rookie);
    let rank = 1; for (const id of d.pool) if (id !== pid && boardValue(lg.players[id], rookie) > v) rank++;
    const pickNo = d.n + 1, diff = pickNo - rank;
    const dd = clamp(diff / 4, -4, 5) + (p.g === "QB" && pickNo <= 32 ? 1.5 : 0);
    lg.fans.m = Math.round(clamp(lg.fans.m + dd, 0, 100)); lg.fans.d = Math.round(dd);
    const kind = diff >= 4 ? "steal" : diff <= -8 ? "reach" : "okpick";
    lg.fans.posts = fanPosts(lg, [kind, kind, kind], { n: p.name, c: teamName(lg.teams[lg.user]) }, "draft" + d.kind);
    lg.fans.head = kind === "steal" ? `Draft win: ${teamName(lg.teams[lg.user])} lands ${p.name} at pick ${pickNo}` : kind === "reach"
      ? `Fans question the ${teamName(lg.teams[lg.user])} pick of ${p.name} at ${pickNo}` : `${teamName(lg.teams[lg.user])} takes ${p.name} with pick ${pickNo}`;
    news(lg, { k: "draft", t: lg.user, p: pid, pr: 8, h: lg.fans.head, b: `${rookie ? "Rookie draft" : "The Redraft"}: our board had him ${rank === 1 ? "as the best player left" : `${ordinal(rank)} on the board`}. ${kind === "steal" ? "The fans love it." : kind === "reach" ? "The fans aren't sure." : "The fans like it."}` });
  }
  const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  // League news for a week: upsets, big games, rookies, streaks, injuries, unhappy players, the playoffs.
  function weekNews(lg, games, rec) {
    const N = [], wk = lg.week, po = games[0] && games[0].po != null;
    const tn = (t) => teamName(lg.teams[t]);
    for (const g of games) {
      const hw = g.hs > g.as, w = hw ? g.h : g.a, l = hw ? g.a : g.h, ws = Math.max(g.hs, g.as), ls = Math.min(g.hs, g.as);
      const s = `${ws}-${ls}`, fav = (g.spread || 0) >= 0 ? g.h : g.a, surprise = Math.abs(g.spread || 0);
      if (po) {
        if (g.hs === g.as) continue;
        N.push({ k: "po", t: w, t2: l, pr: 7 + g.po, h: g.po === 3 ? `${tn(w)} wins The Final, ${s} over ${tn(l)}` : `${E_ROUND(g.po)}: ${tn(w)} beats ${tn(l)} ${s}`,
          b: g.po === 3 ? `${tn(w)} are champions of the ${lg.year} season.` : `${tn(w)} moves on. ${tn(l)}'s season is over.` });
      } else if (g.hs !== g.as && w !== fav && surprise >= 4) {
        N.push({ k: "upset", t: w, t2: l, pr: 3 + surprise / 2, h: `Upset: ${tn(w)} stuns ${tn(l)} ${s}`, b: `${tn(l)} were favored by ${Math.round(surprise)} on our line.` });
      } else if (g.hs + g.as >= 70) {
        N.push({ k: "shoot", t: w, t2: l, pr: 3 + (g.hs + g.as - 70) / 6, h: `Shootout: ${tn(w)} outlasts ${tn(l)} ${s}`, b: `${g.hs + g.as} points between them.` });
      } else if (ws - ls >= 30) {
        N.push({ k: "rout", t: w, t2: l, pr: 2.5 + (ws - ls - 30) / 6, h: `Rout: ${tn(w)} crushes ${tn(l)} ${s}`, b: "Over before the fourth quarter." });
      }
      for (const side of ["h", "a"]) {
        const b = g.box && g.box[side]; if (!b) continue;
        for (const x of b.players) {
          const p = lg.players[x.id]; if (!p) continue;
          const tds = (x.rstd || 0) + (x.rtd || 0), rk = p.exp === 0;
          let line = null, pr = 0;
          if ((x.py || 0) >= 400 || (x.ptd || 0) >= 5) { line = `${x.py} passing yards and ${x.ptd || 0} touchdowns`; pr = 2.5 + (x.py - 400) / 60 + (x.ptd || 0) * 0.3; }
          else if ((x.rsy || 0) >= 160) { line = `${x.rsy} rushing yards${x.rstd ? ` and ${x.rstd} touchdown${x.rstd > 1 ? "s" : ""}` : ""}`; pr = 3 + (x.rsy - 160) / 30; }
          else if ((x.ry || 0) >= 160) { line = `${x.rec || 0} catches for ${x.ry} yards${x.rtd ? ` and ${x.rtd} touchdown${x.rtd > 1 ? "s" : ""}` : ""}`; pr = 3 + (x.ry - 160) / 30; }
          else if (tds >= 3) { line = `${tds} touchdowns`; pr = 3 + tds - 3; }
          else if ((x.sk || 0) >= 3) { line = `${x.sk} sacks`; pr = 3 + (x.sk - 3); }
          else if ((x.di || 0) >= 2) { line = `${x.di} interceptions`; pr = 3 + (x.di - 2); }
          else if (rk && ((x.py || 0) >= 280 || (x.rsy || 0) >= 110 || (x.ry || 0) >= 110 || (x.sk || 0) >= 2 || tds >= 2)) {
            line = (x.py || 0) >= 280 ? `${x.py} passing yards` : (x.rsy || 0) >= 110 ? `${x.rsy} rushing yards` : (x.ry || 0) >= 110 ? `${x.ry} receiving yards` : (x.sk || 0) >= 2 ? `${x.sk} sacks` : `${tds} touchdowns`;
            pr = 2.5;
          }
          if (!line) continue;
          const t = b.t, o = b.t === g.h ? g.a : g.h, won = t === w && g.hs !== g.as;
          N.push({ k: rk ? "rookie" : "big", t, p: x.id, pr: pr + (rk ? 1.5 : 0),
            h: rk ? `Rookie ${p.name} breaks out for ${tn(t)}` : `${p.name} goes off: ${line}`,
            b: rk ? `${line} ${won ? "in a win over" : "against"} ${tn(o)}${won ? "" : g.hs === g.as ? " in a tie" : " in a loss"}.`
              : `${won ? "In a win over" : "Against"} ${tn(o)}${won ? "" : g.hs === g.as ? " in a tie" : " in a loss"}.` });
        }
      }
    }
    // Streaks (regular season only).
    if (!po) for (const t of lg.teams) {
      const res = resultsOf(lg, t.i), sk = streakOf(res), r = rec[t.i];
      if (sk >= 4 && sk % 2 === 0) N.push({ k: "streak", t: t.i, pr: 2 + sk / 2, h: r.l === 0 ? `${tn(t.i)} still perfect at ${recStr(r)}` : `${tn(t.i)} has won ${sk} straight`, b: `${tn(t.i)} is ${recStr(r)}.` });
      if (sk <= -4 && sk % 2 === 0) N.push({ k: "skid", t: t.i, pr: 2 - sk / 3, h: r.w === 0 ? `${tn(t.i)} still looking for a win at ${recStr(r)}` : `${tn(t.i)} skid reaches ${-sk}`, b: `${tn(t.i)} is ${recStr(r)}.` });
    }
    // Injuries this week.
    for (const x of lg.log) {
      if (x.y !== lg.year || x.wk !== (po ? 19 + lg.playoffs.round : wk)) continue;
      const p = lg.players[x.p]; if (!p) continue;
      const mine = x.t === lg.user;
      if (!(p.grade >= 7.5 || (mine && x.w >= 3))) continue;
      N.push({ k: "inj", t: x.t, p: x.p, pr: (x.w >= 30 ? 4 : x.w >= 3 ? 2.5 : 1) + (p.grade - 7) / 2,
        h: x.w >= 30 ? `${p.name} out for the season` : `${p.name} out ${x.w === 1 ? "a week" : `${x.w} weeks`}`,
        b: `${tn(x.t)} loses its ${GROUP_NAME[p.g].toLowerCase()} to an injury in week ${x.wk}.` });
    }
    // Morale stories: once per player per kind per season.
    const flag = (pid, k) => { const f = lg.flags[pid] || (lg.flags[pid] = {}); if (f[k]) return false; f[k] = 1; return true; };
    const G = (t) => resultsOf(lg, t).length;
    for (const g of games) for (const t of [g.h, g.a]) {
      const T = lg.teams[t], mine = t === lg.user, n = G(t);
      for (const pid of T.roster) {
        const p = lg.players[pid], m = moodOf(lg, pid), why = lg.why[pid] || [];
        if (p.inj) continue;
        if (why.includes("bench") && m < 50 && p.grade >= 6 && flag(pid, "bench"))
          N.push({ k: "bench", t, p: pid, pr: mine ? 8 : 3, h: `${p.name} unhappy after losing his starting spot`, b: `He sat out the starting lineup for ${tn(t)} this week and wants his snaps back.` });
        else if (why.includes("snaps") && m < 42 && p.grade >= 6 && flag(pid, "snaps"))
          N.push({ k: "snaps", t, p: pid, pr: mine ? 6 : 1.5, h: `${p.name} wants a bigger role in ${tn(t)}`, b: `Stuck behind the starters, he has asked for more snaps.` });
        if (p.g !== "K" && p.g !== "P" && p.yrs === 1 && p.grade >= 7.5 && m < 50 && n >= 4 && flag(pid, "deal"))
          N.push({ k: "deal", t, p: pid, pr: mine ? 7 : 2 + (p.grade - 7.5), h: `${p.name} wants a new deal`, b: `In the last year of his contract, he wants ${tn(t)} to pay up before he can test the open market.` });
        if (p.g !== "K" && p.g !== "P" && m < 22 && n >= 6 && p.grade >= 6 && flag(pid, "trade"))
          N.push({ k: "trade", t, p: pid, pr: mine ? 9 : 3 + (p.grade - 6) / 2, h: `${p.name} asks ${tn(t)} for a trade`, b: `Unhappy with how things are going, he has asked to be moved. He could walk when his deal is up.` });
      }
      // Sideline frustration after a lopsided loss: the team's best skill player or quarterback, if he is unhappy.
      const my = t === g.h ? g.hs : g.as, th = t === g.h ? g.as : g.hs;
      if (th - my >= 14) {
        const star = T.roster.map((id) => lg.players[id]).filter((p) => !p.inj && ["QB", "WR", "RB", "TE"].includes(p.g) && lg.starts[p.id])
          .sort((a, b) => b.grade - a.grade)[0];
        if (star && moodOf(lg, star.id) < 48 && star.grade >= 6.5 && flag(star.id, "side"))
          N.push({ k: "side", t, p: star.id, pr: mine ? 7 : 2.5, h: `${star.name} frustrated on the sideline in ${th}-${my} loss`, b: `${tn(t)} fell to ${tn(t === g.h ? g.a : g.h)}, and its ${GROUP_NAME[star.g].toLowerCase()} let it show on the bench.` });
      }
    }
    // Keep the best eight for the league, plus up to four more about the user's team.
    N.sort((a, b) => b.pr - a.pr);
    const keep = [], mineN = [], per = {};
    for (const n of N) {
      const me = n.t === lg.user || n.t2 === lg.user, full = (per[n.k] || 0) >= 3 && !me; // at most three of a kind, so the feed stays varied
      if (keep.length < 8 && !full) { keep.push(n); per[n.k] = (per[n.k] || 0) + 1; } else if (me && mineN.length < 4) mineN.push(n);
    }
    for (const n of [...keep, ...mineN]) news(lg, { ...n, wk: po ? 19 + lg.playoffs.round : wk });
  }
  const E_ROUND = (k) => ROUNDS[k];

  // Season over: the fans judge it against what they expected; MVP and top rookie make the news.
  function lrSeasonEnd(lg, h) {
    if (!lg.fans) lrInit(lg);
    const F = lg.fans, w = h.w + h.tie / 2, made = !!h.seed, c = teamName(lg.teams[lg.user]);
    const d = clamp((w - (F.exp || 8.5)) * 2.5, -12, 12) + (made ? 4 : (F.exp || 0) >= (F.games || 17) * 0.6 ? -5 : 0);
    F.m = Math.round(clamp(F.m + d, 0, 100)); F.d = Math.round(d);
    F.hist.push({ y: lg.year, wk: 23, m: F.m });
    const r = rng(lg.seed, "fanend", lg.year);
    F.head = h.champ === lg.user ? `Champions. ${c} coach has a city in love` : w >= F.exp + 2 ? `${c} beat expectations: ${recStr(h)} against a ${F.exp}-win bar`
      : w <= F.exp - 2 ? r.pick([`${c} falls short: ${recStr(h)} when fans wanted ${F.exp}`, `A ${recStr(h)} letdown leaves the ${c} coach on the hot seat`])
      : `${c} lands about where expected: ${recStr(h)}`;
    F.posts = fanPosts(lg, [band(F.m), band(F.m), h.champ === lg.user ? "champ" : made ? "warm" : "cool"], { c }, "end");
    if (h.mvp) news(lg, { k: "award", t: h.mvpTeam, p: h.mvp, pr: 9, wk: 23, h: `${h.mvpName} is our most valuable player`, b: `The ${GROUP_NAME[lg.players[h.mvp].g].toLowerCase()} of ${teamName(lg.teams[h.mvpTeam])} wins the ${lg.year} award.` });
    if (h.rookie) news(lg, { k: "award", t: h.rookieTeam, p: h.rookie, pr: 8, wk: 23, h: `${h.rookieName} is the top rookie`, b: `${teamName(lg.teams[h.rookieTeam])}'s first-year player takes the ${lg.year} rookie award.` });
  }

  // Offseason: unhappy players with expiring deals may refuse to re-sign. Returns true if he refuses.
  function refuses(lg, p) {
    if (!lrOn(lg)) return false;
    const m = moodOf(lg, p.id);
    return m < 50 && rng(lg.seed, "resign", lg.year, p.id)() < (50 - m) / LR.keep;
  }
  function lrOffseason(lg) {
    if (!lg.fans) lrInit(lg);
    // A fresh season: moods drift halfway back toward neutral, reasons clear.
    for (const id in lg.mood) lg.mood[id] = Math.round(60 + (lg.mood[id] - 60) * 0.7);
    lg.why = {}; lg.tm = lg.tm.map((x) => Math.round(55 + (x - 55) * 0.5));
    lg.fans.m = Math.round(50 + (lg.fans.m - 50) * 0.8);
  }

  // ---- Read helpers for pages ----
  // "Our board": a team-neutral draft order (talent, youth, quarterbacks up, kickers and punters down).
  function boardValue(p, rookie) {
    const v = rookie ? 0.45 * p.grade + 0.55 * p.ceil : p.grade + Math.max(0, 27 - p.age) * 0.06 - Math.max(0, p.age - 31) * 0.25;
    return v + (p.g === "QB" ? 0.8 : p.g === "K" || p.g === "P" ? -3.2 : p.g === "RB" ? -0.4 : 0);
  }
  function record(lg, t) { const r = standings(lg)[t]; return `${r.w}-${r.l}${r.tie ? "-" + r.tie : ""}`; }
  // Your next game this week (regular season or playoffs), or null (bye, out, offseason).
  function nextGame(lg) {
    if (lg.phase === "season") return lg.games.find((g) => g.wk === lg.week + 1 && (g.h === lg.user || g.a === lg.user)) || null;
    if (lg.phase === "playoffs" && !lg.playoffs.champ) return playoffGames(lg).find((g) => g.h === lg.user || g.a === lg.user) || null;
    return null;
  }
  function userGames(lg) { return lg.games.filter((g) => g.h === lg.user || g.a === lg.user); }
  function pickOwner(lg) { const d = lg.draft; return d && d.n < d.seq.length ? d.seq[d.n] : -1; }
  function userOnClock(lg) { return !!lg.draft && pickOwner(lg) === lg.user; }

  return {
    TEAMS, GROUPS, GROUP_NAME, FIRST_REAL, cityFor, STARTERS, TARGET, MINPOS, MAXPOS, ROSTER, REDRAFT_ROUNDS, ROOKIE_ROUNDS, ROUNDS, M,
    teamName, teamShort, teamLogo, nickFor, NAME_MODE, get LOGOS() { return !!LOGO; }, rng, create, apply, replay, saveOf, units, lineup, standings, divisionTables, seeds, leaders,
    record, userGames, pickOwner, userOnClock, suggestCuts, countBy, playGame, expectedPoints, startSeason, boardValue,
    REAL_NAMES, fakeName, setPack, SAVE_V, PLAN0, PM, cleanPlan, aiPlan, planFor, simGame, previewGame, playoffGames, nextGame, short,
    live: { times: liveTimes, at: liveAt, HALF_MS, MS: LIVE_MS },
    moodOf, MOOD_WORD, WHY, moraleEdge, lrOn,
  };
});
