/* Read-only season outlook and reveal helpers. No forecast writes to a league or its random streams. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FranchiseSim = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function friendStop(E, lg, t = lg.user) {
    if (lg.phase !== "season") return 0; // unknown playoff opponents: ask again each round
    const friends = new Set(E.humansOf(lg).filter((x) => x !== t));
    const next = lg.games.filter((g) => !g.done && (g.h === t || g.a === t) && friends.has(g.h === t ? g.a : g.h))
      .sort((a, b) => a.wk - b.wk)[0];
    return Math.max(0, (next ? next.wk - 1 : lg.weeks || 18) - lg.week);
  }
  function outlook(E, lg, t = lg.user, samples = 160) {
    if (lg.phase !== "season") {
      const inField = !!lg.playoffs && lg.playoffs.seeds[lg.teams[t].conf].includes(t);
      return { pct: inField ? 100 : 0, win: null, loss: null, samples: 0, watch: null };
    }
    const todo = lg.games.filter((g) => !g.done), next = todo.find((g) => g.wk === lg.week + 1 && (g.h === t || g.a === t));
    const us = lg.teams.map((x) => E.units(lg, x.i));
    const lines = todo.map((g) => E.expectedPoints(lg, us[g.h], us[g.a], 1) - E.expectedPoints(lg, us[g.a], us[g.h], -1));
    let made = 0, win = 0, loss = 0;
    const trials = Math.max(1, Math.floor(samples));
    for (let s = 0; s < trials; s++) {
      const r = E.rng(lg.seed, "outlook", lg.year, lg.week, s);
      const futures = todo.map((g, i) => {
        const margin = Math.round(lines[i] + r.normal() * 13.5);
        return { ...g, done: true, hs: Math.max(0, 24 + margin), as: 24 };
      });
      const trial = { ...lg, games: lg.games.filter((g) => g.done).concat(futures) };
      const has = () => E.seeds(trial)[lg.teams[t].conf].includes(t);
      if (has()) made++;
      if (next) {
        const g = futures[todo.indexOf(next)], h = g.h === t, old = [g.hs, g.as];
        g.hs = h ? 25 : 24; g.as = h ? 24 : 25; if (has()) win++;
        g.hs = h ? 24 : 25; g.as = h ? 25 : 24; if (has()) loss++;
        [g.hs, g.as] = old;
      }
    }
    const pct = (n) => Math.round(n / trials * 100);
    const W = next ? pct(win) : null, L = next ? pct(loss) : null;
    // This is a sampled warning, never a claim of mathematical elimination or clinching.
    const watch = lg.week >= (lg.weeks || 18) - 5 && next && W > L &&
      ((L <= 10 && W >= 25) || (W >= 90 && L <= 65))
      ? (L <= 10 ? "Must-win watch: a loss leaves almost no path in our simulated finishes."
        : "Playoff spot in reach: a win could put you in, based on our simulated finishes.") : null;
    return { pct: pct(made), win: W, loss: L, samples: trials, watch };
  }
  function major(E, lg, items, t = lg.user) {
    return items.filter((n) => (n.t === t || n.t2 === t) &&
      (["trade", "side"].includes(n.k) || (n.k === "off" && /practice reps|play call|teammate|team meeting|offense/i.test(n.h + " " + n.b)) || (n.k === "inj" && lg.players[n.p] &&
        (lg.players[n.p].g === "QB" || lg.players[n.p].grade >= 7.5))));
  }
  function headlines(items) {
    return items.filter((n) => n.pr >= 5 || ["inj", "trade", "tx", "side", "po"].includes(n.k))
      .sort((a, b) => (b.pr || 0) - (a.pr || 0)).slice(0, 4);
  }
  return { friendStop, outlook, major, headlines };
});
