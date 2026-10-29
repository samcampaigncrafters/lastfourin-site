/* Optional trade-market recipe. Loading this file changes no league or engine.
 * Evidence, assumptions and integration requirements:
 * work/franchise-trade-market-2026-10-28/REPORT.md
 * Values are design estimates in middle-first units, never acceptance odds.
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FranchiseTradeMarket = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = "historical-market-v1";
  // Grade 9.5 (97 displayed OVR), age at/below peak, two years of control,
  // no injury, no projected development or salary adjustment.
  const ELITE_VALUE = Object.freeze({ QB: 350, RB: 75, WR: 150, TE: 75,
    OL: 180, DL: 150, ED: 220, LB: 65, CB: 190, S: 75, K: 6, P: 4 });
  const PEAK = Object.freeze({ QB: 32, RB: 27, WR: 29, TE: 29, OL: 30,
    DL: 29, ED: 29, LB: 28, CB: 28, S: 29, K: 35, P: 35 });
  const AGE_DECAY = Object.freeze({ QB: .09, RB: .19, WR: .14, TE: .12,
    OL: .11, DL: .13, ED: .13, LB: .15, CB: .16, S: .13, K: .09, P: .09 });
  // Deliberate piecewise-linear heuristic, not an empirical draft-pick chart.
  // 32 teams, seven rounds; compensatory picks are not represented.
  const PICK_CURVE = Object.freeze([
    [1, 250], [8, 150], [16.5, 100], [32, 68], [48.5, 42], [64, 28],
    [80.5, 20], [96, 15], [112.5, 11], [128, 8], [144.5, 6], [160, 4.5],
    [176.5, 3.2], [192, 2.4], [208.5, 1.7], [224, 1]
  ].map(Object.freeze));
  const FUTURE_DISCOUNT = .85;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function number(n, label, lo, hi) {
    if (typeof n !== "number" || !Number.isFinite(n)) throw new TypeError(label + " must be finite");
    if (n < lo || n > hi) throw new RangeError(label + " out of range");
    return n;
  }
  function facts(p, context) {
    if (!p || typeof p !== "object") throw new TypeError("player required");
    const g = p.g;
    if (!Object.prototype.hasOwnProperty.call(ELITE_VALUE, g)) throw new TypeError("unknown player group");
    const grade = number(p.grade, "grade (1..10)", 1, 10);
    const suppliedPeak = typeof context.peak === "object" && context.peak !== null ? context.peak[g] : context.peak;
    const peak = suppliedPeak == null ? PEAK[g] : number(suppliedPeak, "peak", 18, 50);
    return { g, grade, peak,
      age: p.age == null ? peak : number(p.age, "age", 16, 60),
      ceiling: p.ceil == null ? grade : Math.max(grade, number(p.ceil, "ceiling", 1, 10)),
      years: p.yrs == null ? 2 : number(p.yrs, "contract years", 0, 20),
      injury: p.inj == null ? 0 : number(p.inj, "injury weeks", 0, 100),
      risk: p.injuryRisk == null ? 0 : number(p.injuryRisk, "injury risk", 0, 1) };
  }
  function explainPlayer(p, context = {}) {
    const f = facts(p, context);
    const potential = Math.min(.6, Math.max(0, f.ceiling - f.grade) * .25 * clamp((26 - f.age) / 5, 0, 1));
    const effectiveGrade = Math.min(10, f.grade + potential);
    const talent = ELITE_VALUE[f.g] * (Math.max(0, effectiveGrade - 5) / 4.5) ** 2.5;
    const age = Math.exp(-AGE_DECAY[f.g] * Math.max(0, f.age - f.peak));
    const contract = f.years < 1 ? 0 : f.years < 2 ? .75 : f.years < 3 ? 1 : f.years < 4 ? 1.08 : 1.12;
    const inSeason = context.phase == null || context.phase === "season" || context.phase === "playoffs";
    const injury = f.injury >= 30 ? (inSeason ? .5 : .8)
      : 1 - Math.min(inSeason ? .425 : .1, f.injury * (inSeason ? .025 : .01));
    const healthRisk = 1 - .25 * f.risk;
    let salary = 1;
    if (context.marketSalary != null) {
      const market = number(context.marketSalary, "market salary", Number.MIN_VALUE, 1e9);
      // Both amounts must use the same units; omit marketSalary in cap-off leagues.
      if (p.sal != null) salary = clamp(1 + .2 * (1 - number(p.sal, "salary", 0, 1e9) / market), .75, 1.15);
    }
    const value = p.gone ? 0 : talent * age * contract * injury * healthRisk * salary;
    return { value, group: f.g, effectiveGrade, potential,
      factors: { talent, age, contract, injury, healthRisk, salary },
      assumed: { age: p.age == null, years: p.yrs == null, ceiling: p.ceil == null } };
  }
  function playerValue(p, context) { return explainPlayer(p, context).value; }
  function explainPick({ round, slot = 16.5, yearsAway = 0 } = {}) {
    number(round, "round", 1, 7);
    if (!Number.isInteger(round)) throw new RangeError("round must be an integer");
    number(slot, "slot within round", 1, 32);
    number(yearsAway, "drafts after next available draft", 0, 10);
    if (!Number.isInteger(yearsAway)) throw new RangeError("yearsAway must be an integer");
    const overall = (round - 1) * 32 + slot;
    let current = PICK_CURVE[PICK_CURVE.length - 1][1];
    for (let i = 1; i < PICK_CURVE.length; i++) {
      const [x, y] = PICK_CURVE[i], [a, b] = PICK_CURVE[i - 1];
      if (overall <= x) { current = b + (y - b) * (overall - a) / (x - a); break; }
    }
    const discount = FUTURE_DISCOUNT ** yearsAway;
    return { value: current * discount, overall, current, discount };
  }
  function pickValue(pick) { return explainPick(pick).value; }
  // This is the complete optional retention multiplier. Do not stack it with
  // the old top-three/untouchable, starter-loss and blanket AI-demand markups.
  // Rebuilding teams and players without at least two years of control get none.
  function corePremium(p, context = {}) {
    const f = facts(p, context);
    if (!context.starter || context.rebuilding || p.gone || p.age == null || p.yrs == null || f.years < 2 || f.injury || f.risk >= .5) return 1;
    if (f.g === "QB" && f.grade >= 8.5 && f.age <= f.peak + 2) return 1.35;
    if (f.grade < 9 || f.age > f.peak || f.g === "K" || f.g === "P") return 1;
    return ["RB", "TE", "LB", "S"].includes(f.g) ? 1.1 : 1.15;
  }
  return Object.freeze({ VERSION, ELITE_VALUE, PEAK, AGE_DECAY, PICK_CURVE,
    FUTURE_DISCOUNT, playerValue, explainPlayer, pickValue, explainPick, corePremium });
});
