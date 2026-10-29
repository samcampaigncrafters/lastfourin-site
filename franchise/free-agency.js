/* Pure, opt-in three-day free agency. No moves, storage, clocks or identities.
 * Parent applies awards only after day 3 and owns sealed bid collection.
 * Integration contract: work/franchise-free-agency-2026-10-28/REPORT.md. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FranchiseFreeAgency = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1, DAYS = 3, MAX_BIDS = 24, ROSTER_LIMIT = 90, AI_ROOKIE_RESERVE = 10;
  const RULE = 'Highest annual salary wins; ties go to the longer contract, then a seeded draw.';
  const round = x => Math.round(x * 10) / 10;
  const units = x => Math.round(x * 10);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const compareId = (a, b) => String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  const copyBids = bids => bids.map(b => ({ p: b.p, salary: round(b.salary), years: b.years })).sort((a, b) => compareId(a.p, b.p));
  function teams(lg) { return lg.teams.map((t, i) => i).filter(i => lg.teams[i]); }
  function humans(E, lg) { return [...new Set(E.humansOf(lg))].sort((a, b) => a - b); }
  function enabled(E, lg) { if (!E.capOn(lg)) throw new Error('Free-agency bidding requires the salary cap.'); }
  function validTeam(lg, t) { return Number.isInteger(t) && t >= 0 && !!lg.teams[t]; }
  function pool(E, lg) {
    // Reject inconsistent FA lists as well as contracted, retired and rostered IDs.
    const rostered = new Set(lg.teams.flatMap(t => t.roster));
    return E.freeAgents(lg).filter(p => !rostered.has(p.id) && !(p.yrs > 0));
  }
  function create(E, lg) {
    enabled(E, lg);
    return { version: VERSION, year: lg.year, day: 1, complete: false, history: [], published: {} };
  }
  function commitments(E, lg, t, bids = []) {
    if (!validTeam(lg, t)) throw new Error('Unknown team.');
    const roster = lg.teams[t].roster.map(id => lg.players[id]).filter(p => p && !p.gone);
    return { t, cap: E.CAP, roster: lg.teams[t].roster.length,
      offered: bids.length, rosterIfAllSign: lg.teams[t].roster.length + bids.length,
      years: Array.from({ length: 4 }, (_, offset) => {
        const current = roster.filter(p => p.yrs > offset).reduce((sum, p) => sum + units(p.sal || 0), 0);
        const reserved = bids.filter(b => b.years > offset).reduce((sum, b) => sum + units(b.salary), 0);
        return { year: lg.year + offset, current: current / 10, reserved: reserved / 10,
          committed: (current + reserved) / 10, room: (units(E.CAP) - current - reserved) / 10 };
      }) };
  }
  function validateBids(E, lg, t, bids) {
    const fail = error => ({ ok: false, error });
    if (!E.capOn(lg)) return fail('Free-agency bidding requires the salary cap.');
    if (!validTeam(lg, t)) return fail('Unknown team.');
    if (!Array.isArray(bids) || bids.length > MAX_BIDS) return fail('Submit at most 24 bids.');
    const available = new Set(pool(E, lg).map(p => p.id)), seen = new Set();
    for (const b of bids) {
      if (!b || typeof b !== 'object' || !available.has(b.p)) return fail('Bid only on current unsigned free agents.');
      if (seen.has(b.p)) return fail('Only one bid per player per team.');
      seen.add(b.p);
      if (typeof b.salary !== 'number' || !Number.isFinite(b.salary) || b.salary < E.MIN_SAL ||
          b.salary > E.CAP || Math.abs(b.salary * 10 - units(b.salary)) > 1e-7) return fail('Annual salary must be in tenths of a million and at least the league minimum.');
      if (!Number.isInteger(b.years) || b.years < 1 || b.years > 4) return fail('Contract length must be 1 to 4 years.');
    }
    const projection = commitments(E, lg, t, bids);
    // An already over-cap/full club can always pass, but gets no exception for minimum offers.
    if (bids.length && projection.rosterIfAllSign > ROSTER_LIMIT) return fail('All offers must fit the 90-player offseason roster.');
    if (projection.years.some(y => y.reserved > 0 && y.room < 0)) return fail('All simultaneous offers must fit under the cap in every covered year.');
    return { ok: true, bids: copyBids(bids), projection };
  }
  function aiBids(E, lg, t, published = {}) {
    enabled(E, lg);
    if (!validTeam(lg, t)) throw new Error('Unknown team.');
    const L = E.lineup(lg, t), chosen = [], planned = {}, base = commitments(E, lg, t);
    for (const g of E.GROUPS) planned[g] = L.bench[g].map(p => p.grade).sort((a, b) => b - a);
    const candidates = pool(E, lg).filter(p => !p.inj && !p.hold).sort((a, b) => b.grade - a.grade || compareId(a.id, b.id));
    // Reserves cover ordinary minimum roster fill plus a disclosed $10M rookie allowance.
    const fits = bid => {
      const offers = [...chosen, bid];
      const fill = Math.max(0, E.ROSTER - base.roster - offers.length) * E.MIN_SAL;
      return base.years.every((y, offset) => {
        const reserved = offers.filter(b => b.years > offset).reduce((s, b) => s + units(b.salary), 0);
        return reserved === 0 || units(y.room) - reserved >= units(fill + AI_ROOKIE_RESERVE);
      });
    };
    while (chosen.length < MAX_BIDS && lg.teams[t].roster.length + chosen.length < ROSTER_LIMIT) {
      const options = [];
      for (const p of candidates) {
        if (chosen.some(b => b.p === p.id)) continue;
        const at = planned[p.g], starterCount = E.STARTERS[p.g], weakest = at.length < starterCount ? 2.5 : at[starterCount - 1];
        const missing = Math.max(0, starterCount - at.length), thin = Math.max(0, E.MINPOS[p.g] - at.length);
        const upgrade = p.grade - weakest;
        if (!missing && !thin && upgrade < .35) continue;
        if (!missing && upgrade < .35 && at.length && p.grade < Math.min(...at) - .5) continue;
        const agePenalty = Math.max(0, p.age - 29) * .025;
        const ask = Math.max(E.MIN_SAL, E.askSalary(lg, p));
        const ceiling = round(Math.max(E.MIN_SAL, ask * Math.max(.8, (missing ? 1.5 : upgrade >= .35 ? 1.35 : 1.05) - agePenalty)));
        let salary = round(Math.max(E.MIN_SAL, ask * .9));
        for (const key of Object.keys(published).sort((a, b) => Number(a) - Number(b))) {
          if (Number(key) === t) continue;
          for (const rival of published[key]) if (rival.p === p.id) salary = Math.max(salary, round(rival.salary + .1));
        }
        if (salary > ceiling) continue;
        const years = p.age >= 32 ? 1 : p.age >= 29 ? 2 : p.grade >= 7 ? 3 : 2;
        const bid = { p: p.id, salary, years };
        if (!fits(bid)) continue;
        const weight = p.g === 'QB' ? 1.25 : p.g === 'K' || p.g === 'P' ? .5 : 1;
        options.push({ bid, p, score: missing * 20 + thin * 2 + Math.max(0, upgrade) * weight - agePenalty });
      }
      options.sort((a, b) => b.score - a.score || a.bid.salary - b.bid.salary || compareId(a.p.id, b.p.id));
      if (!options.length) break;
      const best = options[0]; chosen.push(best.bid);
      planned[best.p.g].push(best.p.grade); planned[best.p.g].sort((a, b) => b - a);
    }
    return copyBids(chosen);
  }
  function snapshot(E, lg, bids) {
    const result = {};
    for (const t of teams(lg)) {
      if (!own(bids, t)) throw new Error('Every team must submit bids or pass.');
      const v = validateBids(E, lg, t, bids[t]);
      if (!v.ok) throw new Error('Team ' + t + ': ' + v.error);
      result[t] = v.bids;
    }
    if (Object.keys(bids).some(k => !teams(lg).some(t => String(t) === k))) throw new Error('Unknown bidding team.');
    return result;
  }
  function checkState(E, lg) {
    enabled(E, lg);
    const s = lg.faMarket;
    if (!s || s.version !== VERSION || s.year !== lg.year || !Number.isInteger(s.day) || s.day < 1 || s.day > DAYS ||
        s.complete || !Array.isArray(s.history) || s.history.length !== s.day - 1) throw new Error('No active free-agency bidding day.');
    // Ensure the advertised snapshot really is the last closed round, never an unclosed draft.
    let previous = {};
    s.history.forEach((h, i) => {
      if (h.day !== i + 1) throw new Error('Invalid bidding history.');
      previous = snapshot(E, lg, h.bids);
    });
    if (JSON.stringify(previous) !== JSON.stringify(s.published)) throw new Error('Published bids do not match the last closed day.');
    return s;
  }
  function winners(E, lg, bids) {
    const byPlayer = new Map();
    for (const t of teams(lg)) for (const b of bids[t]) {
      const offer = { t, ...b };
      if (!byPlayer.has(b.p)) byPlayer.set(b.p, []);
      byPlayer.get(b.p).push(offer);
    }
    return [...byPlayer.keys()].sort(compareId).map(p => {
      const ranked = byPlayer.get(p).sort((a, b) => b.salary - a.salary || b.years - a.years ||
        E.rng(lg.seed, 'fa-tie', VERSION, lg.year, p, a.t)() - E.rng(lg.seed, 'fa-tie', VERSION, lg.year, p, b.t)() || a.t - b.t);
      return { ...ranked[0] };
    });
  }
  function advance(E, lg, humanBids) {
    const s = checkState(E, lg), owners = humans(E, lg), all = {};
    // Deliberately compute AI bids before reading any sealed human values.
    for (const t of teams(lg)) if (!owners.includes(t)) all[t] = aiBids(E, lg, t, s.published);
    if (!humanBids || typeof humanBids !== 'object' || Array.isArray(humanBids) ||
        Object.keys(humanBids).some(k => !owners.some(t => String(t) === k))) throw new Error('Submit exactly the human owners for this day.');
    for (const t of owners) {
      if (!own(humanBids, t)) throw new Error('Every human owner must bid or explicitly pass.');
      all[t] = humanBids[t];
    }
    const published = snapshot(E, lg, all), complete = s.day === DAYS;
    const history = s.history.map(h => ({ day: h.day, bids: snapshot(E, lg, h.bids) }));
    history.push({ day: s.day, bids: snapshot(E, lg, published) });
    const state = { version: VERSION, year: s.year, day: complete ? DAYS : s.day + 1, complete, history, published };
    return { state, awards: complete ? winners(E, lg, published) : [], closedDay: s.day, rule: RULE };
  }
  function dashboard(E, lg, t, privateDraft = []) {
    const published = lg.faMarket ? lg.faMarket.published : {}, complete = !!(lg.faMarket && lg.faMarket.complete), byPlayer = new Map();
    for (const team of teams(lg)) for (const b of published[team] || []) {
      if (!byPlayer.has(b.p)) byPlayer.set(b.p, []);
      byPlayer.get(b.p).push({ t: team, ...b });
    }
    const draft = validateBids(E, lg, t, privateDraft);
    return { rule: RULE, day: lg.faMarket ? lg.faMarket.day : null, complete,
      publishedDay: lg.faMarket ? lg.faMarket.history.length : 0,
      rows: [...byPlayer.keys()].sort(compareId).map(p => ({ p, bids: byPlayer.get(p).sort((a, b) => b.salary - a.salary || b.years - a.years || a.t - b.t) })),
      // The parent commits final awards and complete state atomically. Closed offers reserve nothing afterward.
      teams: teams(lg).map(team => commitments(E, lg, team, complete ? [] : published[team] || [])),
      privateDraft: { ok: draft.ok, error: draft.error || null, bids: Array.isArray(privateDraft) ? privateDraft.map(b => b && ({ ...b })) : [], projection: draft.projection || null },
      aiReserve: { rookie: AI_ROOKIE_RESERVE, minimumFill: 'Minimum salary for each remaining slot up to 53.' } };
  }
  return Object.freeze({ VERSION, DAYS, MAX_BIDS, ROSTER_LIMIT, AI_ROOKIE_RESERVE, RULE,
    create, commitments, validateBids, aiBids, advance, dashboard });
});
