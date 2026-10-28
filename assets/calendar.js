/* Last Four In sports calendar. The home page reads this to decide which contest leads the carousel and
   which tiles are open, so nothing needs hand edits as the seasons turn over.
   Dates are the leagues' published schedules (checked Oct 27, 2026). Windows marked est: true follow the usual
   pattern and should be swapped for the real dates once the league announces them.
   Sources: NFL 2026 schedule release (Sep 9 2026 to Jan 10 2027, playoffs from Jan 16, Super Bowl LXI Feb 14 2027);
   2027 NFL Draft Apr 29 to May 1 (NFL.com); CFP 2026-27 schedule (Dec 18 2026 to Jan 25 2027, collegefootballplayoff.com);
   NBA 2026-27 (Oct 20 2026 to Apr 11 2027, playoffs from Apr 17, NBA.com); NHL 2026-27 (Sep 29 2026 to Apr 10 2027, NHL.com);
   2026 World Series Oct 23 to Oct 31 (MLB.com); 2027 MLB opening day Mar 24 (AP, subject to the labor deal);
   2027 men's NCAA tournament Selection Sunday Mar 14, title game Apr 5 (NCAA.com). */
(function () {
  // Each window: [first day, last day] in Eastern time, inclusive.
  const W = {
    nfl: [["2026-09-09", "2027-02-14"], ["2027-09-09", "2028-02-13", "est"]],         // regular season through the Super Bowl
    nflDraft: [["2027-04-29", "2027-05-01"]],
    cfb: [["2026-08-29", "2027-01-25"], ["2027-08-28", "2028-01-24", "est"]],         // week 0 through the CFP title game
    apPoll: [["2026-08-10", "2026-12-06", "est-start"], ["2027-01-26", "2027-01-26"], ["2027-08-09", "2027-12-05", "est"]], // weekly polls; no poll during the CFP, then one final poll
    cfp: [["2026-11-03", "2026-12-06"], ["2027-11-02", "2027-12-05", "est"]],         // committee rankings through Selection Day
    nba: [["2026-10-20", "2027-06-20", "est-end"]],                                   // season Oct 20 to Apr 11, playoffs from Apr 17, Finals in June
    nhl: [["2026-09-29", "2027-06-20", "est-end"]],                                   // season Sep 29 to Apr 10, playoffs to June
    mlbPost: [["2026-09-29", "2026-10-31"], ["2027-09-28", "2027-10-31", "est"]],     // postseason through the World Series
    mlb: [["2027-03-24", "2027-10-31", "est-end"]],                                    // opening day through the World Series (regular season ends Sep 26)
    ncaab: [["2026-11-02", "2027-04-05", "est-start"], ["2027-11-01", "2028-04-03", "est"]], // college basketball through the title game
    mm: [["2027-03-14", "2027-04-05"]],                                               // Selection Sunday through the title game
    sbWeekend: [["2026-09-09", "2027-02-14"]],                                        // the $1,000 Challenge runs through Super Bowl weekend
  };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const day = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d); // YYYY-MM-DD, Eastern

  function inSeason(key, now) {
    const t = day(now);
    return (W[key] || []).some(([a, b]) => t >= a && t <= b);
  }
  // The next window that hasn't started yet, for "Back in August" style notes.
  function next(key, now) {
    const t = day(now), w = (W[key] || []).find(([a]) => a > t);
    return w ? { at: new Date(w[0] + "T12:00:00-05:00"), month: MONTHS[+w[0].slice(5, 7) - 1], est: !!w[2] } : null;
  }
  function backNote(key, now) {
    const n = next(key, now);
    return n ? `Back in ${n.month}` : "Back next season";
  }

  window.LFI_CAL = { W, inSeason, next, backNote };
})();
