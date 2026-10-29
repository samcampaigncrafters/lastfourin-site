/* Round-one clock tapers to 15 seconds across the human draft rounds. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FranchiseDraftClock = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function seconds(start, round, rounds) {
    if (!Number.isFinite(start) || start <= 0 || !Number.isInteger(round) ||
        !Number.isInteger(rounds) || rounds < 1 || round < 1 || round > rounds) throw Error("Invalid draft clock");
    const floor = Math.min(start, 15);
    return rounds === 1 ? start : Math.round((start - (start - floor) * (round - 1) / (rounds - 1)) * 1000) / 1000;
  }
  function context(lg) {
    const d = lg && lg.draft;
    if (!d) return null;
    return { kind: d.kind, round: Math.floor(d.n / 32) + 1,
      rounds: d.kind === "redraft" ? Math.min(d.rounds, lg.settings.userRounds || 15) : d.rounds };
  }
  function request(lg, policy) {
    const c = context(lg);
    // Old servers keep receiving their existing fixed-clock request.
    return policy === 1 && c ? `pick/${c.kind}/${c.round}` : "pick";
  }
  return { seconds, context, request };
});
