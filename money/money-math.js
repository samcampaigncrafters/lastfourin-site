/* Last Four In — the $1,000 Challenge: odds and payout maths, and reading lines out of an ESPN scoreboard.
   Same rules as supabase/65_money.sql (the database is what actually settles bets; this only draws the page).
   Loaded by /money/ as window.MONEY; build/money/math_test.js runs it under node. */
(function (root) {
  // Winnings on a win, stake not included. American odds: +150 wins $150 on $100, -110 wins $100 on $110.
  const profit = (stake, odds) => Math.round((odds > 0 ? stake * odds / 100 : stake * 100 / Math.abs(odds)) * 100) / 100;
  const fmtOdds = (o) => o == null ? "" : o > 0 ? "+" + o : String(o);
  const fmtLine = (n) => n == null ? "" : n === 0 ? "PK" : n > 0 ? "+" + n : String(n);
  const money = (n, cents) => {
    const v = Math.abs(n), s = v.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
    return (n < 0 ? "-$" : "$") + s;
  };
  // Whole dollars below $1,000, cents only when there are some.
  const cash = (n) => money(n, Math.round(n * 100) % 100 !== 0);

  // The line and price for one side of one market, from a game_lines row (spread is the home side's number).
  function pick(lines, market, side) {
    if (!lines) return null;
    if (market === "spread") {
      if (lines.spread == null) return null;
      return { line: side === "home" ? +lines.spread : -lines.spread, odds: side === "home" ? lines.spread_home_odds : lines.spread_away_odds };
    }
    if (market === "total") {
      if (lines.total == null) return null;
      return { line: +lines.total, odds: side === "over" ? lines.over_odds : lines.under_odds };
    }
    const o = side === "home" ? lines.ml_home : lines.ml_away;
    return o == null ? null : { line: null, odds: o };
  }

  // "GB -3.5", "Over 47.5", "CAR moneyline".
  function betName(game, market, side, line) {
    if (market === "total") return `${side === "over" ? "Over" : "Under"} ${line}`;
    const t = game[side] || {};
    return market === "spread" ? `${t.abbr} ${fmtLine(line)}` : `${t.abbr} moneyline`;
  }

  // How a settled game grades a bet: "won", "lost" or "push". Mirrors lfi_private.money_settle_game.
  function grade(bet, home, away) {
    let m;
    if (bet.market === "ml") m = bet.side === "home" ? home - away : away - home;
    else if (bet.market === "spread") m = bet.side === "home" ? home + bet.line - away : away + bet.line - home;
    else m = bet.side === "over" ? home + away - bet.line : bet.line - (home + away);
    return m > 0 ? "won" : m < 0 ? "lost" : "push";
  }

  // ESPN odds object -> game_lines shape. Prefers the newer pointSpread/total/moneyline blocks, falls back to the
  // flat spread/overUnder/moneyLine fields. Used only when the site's own board can't be reached.
  const num = (t) => {
    if (t == null) return null;
    const s = String(t).trim().replace(/^[ouOU]/, "");
    if (/^(PK|PICK|EVEN|EV)$/i.test(s)) return 0;
    return /^[+-]?\d+(\.\d+)?$/.test(s) ? +s : null;
  };
  const price = (t) => {
    if (t == null) return null;
    const s = String(t).trim();
    if (/^(EVEN|EV)$/i.test(s)) return 100;
    return /^[+-]?\d{3,5}$/.test(s) && Math.abs(+s) >= 100 ? +s : null;
  };
  function linesFromEspn(o) {
    if (!o) return null;
    const g = (a, ...k) => k.reduce((x, y) => x && x[y], a);
    const spread = num(g(o, "pointSpread", "home", "close", "line")) ?? num(o.spread);
    const total = num(g(o, "total", "over", "close", "line")) ?? num(o.overUnder);
    const L = {
      spread, total,
      spread_home_odds: spread == null ? null : price(g(o, "pointSpread", "home", "close", "odds")) ?? -110,
      spread_away_odds: spread == null ? null : price(g(o, "pointSpread", "away", "close", "odds")) ?? -110,
      over_odds: total == null ? null : price(g(o, "total", "over", "close", "odds")) ?? -110,
      under_odds: total == null ? null : price(g(o, "total", "under", "close", "odds")) ?? -110,
      ml_home: price(g(o, "moneyline", "home", "close", "odds")) ?? price(g(o, "homeTeamOdds", "moneyLine")),
      ml_away: price(g(o, "moneyline", "away", "close", "odds")) ?? price(g(o, "awayTeamOdds", "moneyLine")),
      provider: g(o, "provider", "name") || null,
    };
    return L.spread == null && L.total == null && L.ml_home == null ? null : L;
  }

  // Challenge weeks run Tuesday to Monday, US Eastern, and reset at 4am Tuesday. A week is named by its Tuesday
  // ("2026-10-27"). Mirrors lfi_private.money_week / money_week_end.
  const ET = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const etParts = (t) => Object.fromEntries(ET.formatToParts(t).filter((x) => x.type !== "literal").map((x) => [x.type, +x.value]));
  function weekStart(when) {
    const p = etParts(new Date(new Date(when).getTime() - 4 * 3600e3));
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() - 2 + 7) % 7);
    return d.toISOString().slice(0, 10);
  }
  // The moment a week resets: the next Tuesday at 4am Eastern (8am UTC in summer time, 9am in winter).
  function weekEnd(week) {
    const [y, m, d] = week.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + 7, 8));
    return etParts(t).hour === 4 ? t : new Date(t.getTime() + 3600e3);
  }
  // "Week of Oct 27".
  const weekLabel = (week) => "Week of " + new Date(week + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  const api = { profit, fmtOdds, fmtLine, money, cash, pick, betName, grade, linesFromEspn, weekStart, weekEnd, weekLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MONEY = api;
})(typeof window !== "undefined" ? window : globalThis);
