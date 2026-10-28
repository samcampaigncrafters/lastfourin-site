// The AP poll guess window (Sam, 2026-10-28): it is just for fun, and the real window runs from Saturday night,
// once the last game with a Top 25 team ends (Eastern), until the new AP poll comes out Sunday about 2pm ET.
// Before that people can still play with a draft. Needs lfi.js loaded first.
window.LFI_AP = (function () {
  const { now, scoreboard } = LFI;
  const ET = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = (d) => Object.fromEntries(ET.formatToParts(d).map((p) => [p.type, p.value]));
  const ymd = (d) => { const p = parts(d); return `${p.year}-${p.month}-${p.day}`; };
  const addDays = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  // An Eastern wall-clock time as a real moment, either side of the daylight-saving switch.
  function at(day, h, m) {
    for (const off of ["-04:00", "-05:00"]) {
      const d = new Date(`${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00${off}`);
      if (+parts(d).hour === h) return d;
    }
    return new Date(`${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-05:00`);
  }
  const GAME = 3.75 * 3600e3; // a college game, kickoff to final, with room to spare

  // pollDate: the AP poll currently out. Returns { openAt, closeAt, done, sat }.
  async function window_(pollDate) {
    let day = ymd(pollDate);
    for (let i = 0; i < 7 && new Date(day + "T12:00:00Z").getUTCDay() !== 6; i++) day = addDays(day, 1);
    if (day === ymd(pollDate)) day = addDays(day, 7);
    const closeAt = at(addDays(day, 1), 14, 0);
    let openAt = at(day, 23, 30), done = false;
    try {
      const pick = (sb) => sb.games.filter((g) => ymd(g.kickoff) === day && (g.home.rank || g.away.rank));
      let sb = await scoreboard("cfb"), sat = pick(sb);
      if (!sat.length && sb.calendar.some((c) => +c.value === sb.week + 1)) sat = pick(await scoreboard("cfb", `&week=${sb.week + 1}&seasontype=${sb.stype}&dates=${sb.season}`));
      if (sat.length) {
        openAt = new Date(Math.max(...sat.map((g) => +g.kickoff)) + GAME);
        done = sat.every((g) => g.status === "post" || g.status === "off");
      }
    } catch (e) {}
    if (openAt > closeAt) openAt = at(addDays(day, 1), 3, 0);
    return { openAt, closeAt, done, sat: day };
  }

  // "draft" before Saturday's games end, "open" until the poll is due, then "closed" until the new poll shows up.
  function phase(w) {
    const t = now();
    if (t >= w.closeAt) return "closed";
    return w.done || t >= w.openAt ? "open" : "draft";
  }

  // Your guess against the real poll, for fun: 5 exact, 3 one off, 2 two or three off, 1 anywhere else in the Top 25.
  function score(guess, real) {
    let pts = 0, exact = 0, hits = 0;
    guess.forEach((id, i) => {
      const r = real.indexOf(id);
      if (r < 0) return;
      const off = Math.abs(r - i);
      hits++; if (!off) exact++;
      pts += !off ? 5 : off === 1 ? 3 : off <= 3 ? 2 : 1;
    });
    return { pts, exact, hits };
  }

  return { window: window_, phase, score };
})();
