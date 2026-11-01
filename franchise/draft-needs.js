/* Display-only draft recommendations. No hidden development ratings or league writes. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FranchiseDraftNeeds = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function assess(E, lg, teamId) {
    const by = Object.fromEntries(E.GROUPS.map(g => [g, []]));
    for (const id of lg.teams[teamId].roster) {
      const p = lg.players[id];
      if (p && by[p.g]) by[p.g].push(p);
    }
    const context = Object.fromEntries(E.GROUPS.map(g => {
      const ready = by[g].filter(p => !p.inj && !p.hold).sort((a,b) => b.grade-a.grade);
      return [g, { count:by[g].length, ready:ready.length, starters:E.STARTERS[g], target:E.TARGET[g],
        starter:ready.length >= E.STARTERS[g] ? ready[E.STARTERS[g]-1].grade : null }];
    }));
    return p => {
      const c = context[p.g];
      if (p.inj || p.hold) return { priority:0, gain:0, label:"Depth option · currently unavailable" };
      if (c.ready < c.starters) return { priority:3, gain:p.grade, label:`Starting spot needed · ${c.ready}/${c.starters} ready` };
      const gain = Math.round((p.grade-c.starter)*6);
      if (gain > 0) return { priority:2, gain, label:`Starter upgrade · +${gain} OVR over your weakest ${p.g === "ED" ? "Edge" : p.g} starter` };
      if (c.count < c.target) return { priority:1, gain:p.grade, label:`Depth needed · ${c.count}/${c.target} rostered` };
      return { priority:0, gain:0, label:`Position stocked · ${c.count}/${c.target} rostered` };
    };
  }
  function compare(fit) {
    return (a,b) => {
      const x=fit(a),y=fit(b);
      return y.priority-x.priority || y.gain-x.gain || b.grade-a.grade || a.age-b.age || a.name.localeCompare(b.name);
    };
  }
  return { assess, compare };
});
