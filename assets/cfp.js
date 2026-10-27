/* CFP 12-team selection logic + saved state, shared by /bracket/ and /head-to-head/.
   Rules (2026-27): four power-conference champions and the top Group of 6 team get automatic bids,
   Notre Dame is in if it finishes top 12, straight seeding, top four seeds get a bye. */
(function () {
  const { local, cfbLogo } = LFI;
  const TEAMS = CFB.teams;
  const AP = CFB.ap;
  const CONF = { SEC: "SEC", B1G: "Big Ten", ACC: "ACC", B12: "Big 12", IND: "Independent", AAC: "American", PAC: "Pac-12", MWC: "Mountain West", SBC: "Sun Belt", CUSA: "Conference USA", MAC: "MAC" };
  const P4 = ["SEC", "B1G", "ACC", "B12"];
  const G6 = ["AAC", "CUSA", "MAC", "MWC", "PAC", "SBC"];

  const GAMES = {
    r89: { a: { seed: 8 }, b: { seed: 9 } }, r512: { a: { seed: 5 }, b: { seed: 12 } },
    r710: { a: { seed: 7 }, b: { seed: 10 } }, r611: { a: { seed: 6 }, b: { seed: 11 } },
    q1: { a: { seed: 1 }, b: { win: "r89" } }, q4: { a: { seed: 4 }, b: { win: "r512" } },
    q2: { a: { seed: 2 }, b: { win: "r710" } }, q3: { a: { seed: 3 }, b: { win: "r611" } },
    s1: { a: { win: "q1" }, b: { win: "q4" } }, s2: { a: { win: "q2" }, b: { win: "q3" } },
    f: { a: { win: "s1" }, b: { win: "s2" } },
  };
  const ROUNDS = [
    { t: "First round", ids: ["r89", "r512", "r710", "r611"] },
    { t: "Quarterfinals", ids: ["q1", "q4", "q2", "q3"] },
    { t: "Semifinals", ids: ["s1", "s2"] },
    { t: "Title game", ids: ["f"] },
  ];
  const ORDER_GAMES = ["r89", "r512", "r710", "r611", "q1", "q4", "q2", "q3", "s1", "s2", "f"];

  const PRECEDENTS = [
    { yr: 2025, w: "Miami", l: "Notre Dame", score: "27–24, Week 1", held: true,
      body: "Notre Dame sat ahead of Miami for five straight weeks. At the final reveal the committee called them close and used head-to-head. Miami got in; Notre Dame was first team out." },
    { yr: 2023, w: "Texas", l: "Alabama", score: "34–24 at Alabama", held: true,
      body: "Both won their conference titles with one loss. The final ranking had Texas third and Alabama fourth, both in the four-team field." },
    { yr: 2016, w: "Penn State", l: "Ohio State", score: "24–21", held: false,
      body: "Penn State won the game and the Big Ten. Ohio State, with one loss to Penn State's two, finished third and made the field; Penn State finished fifth." },
    { yr: 2014, w: "Baylor", l: "TCU", score: "61–58", held: true,
      body: "TCU sat ahead of Baylor for most of the season. In the final ranking Baylor moved ahead, fifth to TCU's sixth, and both missed the four-team field." },
  ];

  // Same storage key as the original prototype so anyone's saved bracket carries over.
  const KEY = "committee-room-v1";
  const fresh = () => ({ order: AP.slice(), champs: {}, picks: {}, h2h: { a: "Ole Miss", b: "Texas Tech", res: "none" } });
  const S = Object.assign(fresh(), local.get(KEY, null) || {});
  S.order = (S.order || []).filter((t) => TEAMS[t]);
  const save = () => local.set(KEY, S);
  function reset() { Object.assign(S, fresh()); save(); }

  const conf = (t) => TEAMS[t].conf;
  const rec = (t) => TEAMS[t].rec;
  const rankOf = (t) => S.order.indexOf(t);
  const L = (t) => TEAMS[t] || { abbr: t.slice(0, 4).toUpperCase(), c: "#555", acc: "#888" };
  const logo = (t) => (TEAMS[t] ? cfbLogo(TEAMS[t].id) : "");

  function champFor(c) {
    const pick = S.champs[c];
    if (pick && TEAMS[pick] && conf(pick) === c) return { t: pick, projected: false };
    const t = S.order.find((x) => conf(x) === c);
    return t ? { t, projected: true } : null;
  }

  function computeField() {
    const reasons = {}, autos = [];
    for (const c of P4) {
      const ch = champFor(c);
      if (ch && !reasons[ch.t]) { autos.push(ch.t); reasons[ch.t] = { kind: "auto", why: CONF[c] + " champion" + (ch.projected ? " (projected)" : "") }; }
    }
    const g6 = S.order.find((t) => G6.includes(conf(t)));
    if (g6 && !reasons[g6]) { autos.push(g6); reasons[g6] = { kind: "auto", why: "Top-ranked Group of 6 team" }; }
    const nd = rankOf("Notre Dame");
    if (nd >= 0 && nd < 12 && !reasons["Notre Dame"]) { autos.push("Notre Dame"); reasons["Notre Dame"] = { kind: "auto", why: "Notre Dame in the top 12" }; }
    const field = autos.slice();
    for (const t of S.order) {
      if (field.length >= 12) break;
      if (!field.includes(t)) { field.push(t); reasons[t] = { kind: "large", why: "At-large" }; }
    }
    const key = (t) => { const r = rankOf(t); return r >= 0 ? r : 100 + autos.indexOf(t); };
    field.sort((a, b) => key(a) - key(b));
    const bumped = S.order.slice(0, 12).filter((t) => !field.includes(t));
    const bumpers = field.filter((t) => rankOf(t) < 0 || rankOf(t) >= 12);
    const firstOut = S.order.filter((t) => !field.includes(t)).slice(0, 4);
    return { seeds: field, reasons, bumped, bumpers, firstOut };
  }

  function resolve(src, F) {
    if (src.seed) return F.seeds[src.seed - 1] || null;
    const g = GAMES[src.win], a = resolve(g.a, F), b = resolve(g.b, F), p = S.picks[src.win];
    return p && (p === a || p === b) ? p : null;
  }
  function cleanPicks(F) {
    for (const id of ORDER_GAMES) {
      const a = resolve(GAMES[id].a, F), b = resolve(GAMES[id].b, F);
      if (S.picks[id] && S.picks[id] !== a && S.picks[id] !== b) delete S.picks[id];
    }
  }
  const champion = (F) => S.picks.f && resolve({ win: "f" }, F);

  window.CFP = { TEAMS, AP, CONF, P4, G6, GAMES, ROUNDS, ORDER_GAMES, PRECEDENTS, S, save, reset,
                 conf, rec, rankOf, L, logo, champFor, computeField, resolve, cleanPicks, champion };
})();
