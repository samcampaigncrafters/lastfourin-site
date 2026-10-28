/* CFP 12-team selection logic + saved state, shared by /bracket/ and /head-to-head/.
   Rules (2026-27): four power-conference champions and the top Group of 6 team get automatic bids,
   Notre Dame is in if it finishes top 12, straight seeding, top four seeds get a bye. */
(function () {
  const { local, teamMark } = LFI;
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

  /* Committee history: the final College Football Playoff ranking of every season 2014-2025 (the one released on
     selection day). teams: [name, wins, losses, conference title, note] in ranked order, record as of selection day;
     title W = won its conference title (game), L = lost its title game, N = didn't play for one. games: every game
     played between two teams in that top 25 before selection day, [winner, loser, score, month/day, 1 = title game].
     Source: each season's Wikipedia rankings page (final CFP table, which cites collegefootballplayoff.com) and every
     ranked team's season schedule on Wikipedia, cross-checked so each game appears on both teams' pages and each
     record matches the ranking. Built by work/brand-kit/committee-history/ in October 2026. Never hand-edit a case. */
  const HISTORY = [
    { yr: 2014, date: "Dec 7",
      teams: [["Alabama",12,1,"W"],["Oregon",12,1,"W"],["Florida State",13,0,"W"],["Ohio State",12,1,"W"],["Baylor",11,1,"W","Big 12 co-champion, no title game"],["TCU",11,1,"W","Big 12 co-champion, no title game"],["Mississippi State",10,2,"N"],["Michigan State",10,2,"N"],["Ole Miss",9,3,"N"],["Arizona",10,3,"L"],["Kansas State",9,3,"N"],["Georgia Tech",10,3,"L"],["Georgia",9,3,"N"],["UCLA",9,3,"N"],["Arizona State",9,3,"N"],["Missouri",10,3,"L"],["Clemson",9,3,"N"],["Wisconsin",10,3,"L"],["Auburn",8,4,"N"],["Boise State",11,2,"W"],["Louisville",9,3,"N"],["Utah",8,4,"N"],["LSU",8,4,"N"],["USC",8,4,"N"],["Minnesota",8,4,"N"]],
      games: [["Ole Miss","Alabama","23–17","10/4"],["Alabama","LSU","20–13","11/8"],["Alabama","Mississippi State","25–20","11/15"],["Alabama","Auburn","55–44","11/29"],["Alabama","Missouri","42–13","12/6",1],["Oregon","Michigan State","46–27","9/6"],["Arizona","Oregon","31–24","10/2"],["Oregon","UCLA","42–30","10/11"],["Oregon","Utah","51–27","11/8"],["Oregon","Arizona","51–13","12/5",1],["Florida State","Clemson","23–17","9/20"],["Florida State","Louisville","42–31","10/30"],["Florida State","Georgia Tech","37–35","12/6",1],["Ohio State","Michigan State","49–37","11/8"],["Ohio State","Minnesota","31–24","11/15"],["Ohio State","Wisconsin","59–0","12/6",1],["Baylor","TCU","61–58","10/11"],["Baylor","Kansas State","38–27","12/6"],["TCU","Minnesota","30–7","9/13"],["TCU","Kansas State","41–20","11/8"],["Mississippi State","LSU","34–29","9/20"],["Mississippi State","Auburn","38–23","10/11"],["Ole Miss","Mississippi State","31–17","11/29"],["Ole Miss","Boise State","35–13","8/28"],["LSU","Ole Miss","10–7","10/25"],["Auburn","Ole Miss","35–31","11/1"],["USC","Arizona","28–26","10/11"],["UCLA","Arizona","17–7","11/1"],["Arizona","Utah","42–10","11/22"],["Arizona","Arizona State","42–35","11/28"],["Auburn","Kansas State","20–14","9/18"],["Georgia Tech","Clemson","28–6","11/15"],["Georgia Tech","Georgia","30–24","11/29"],["Georgia","Clemson","45–21","8/30"],["Georgia","Missouri","34–0","10/11"],["Georgia","Auburn","34–7","11/15"],["UCLA","Arizona State","62–27","9/25"],["Utah","UCLA","30–28","10/4"],["UCLA","USC","38–20","11/22"],["Arizona State","USC","38–34","10/4"],["Arizona State","Utah","19–16","11/1"],["Clemson","Louisville","23–17","10/11"],["LSU","Wisconsin","28–24","8/30"],["Wisconsin","Minnesota","34–24","11/29"],["Auburn","LSU","41–7","10/4"],["Utah","USC","24–21","10/25"]] },
    { yr: 2015, date: "Dec 6",
      teams: [["Clemson",13,0,"W"],["Alabama",12,1,"W"],["Michigan State",12,1,"W"],["Oklahoma",11,1,"W","Big 12 champion, no title game"],["Iowa",12,1,"L"],["Stanford",11,2,"W"],["Ohio State",11,1,"N"],["Notre Dame",10,2,"N"],["Florida State",10,2,"N"],["North Carolina",11,2,"L"],["TCU",10,2,"N"],["Ole Miss",9,3,"N"],["Northwestern",10,2,"N"],["Michigan",9,3,"N"],["Oregon",9,3,"N"],["Oklahoma State",10,2,"N"],["Baylor",9,3,"N"],["Houston",12,1,"W"],["Florida",10,3,"L"],["LSU",8,3,"N"],["Navy",9,2,"N"],["Utah",9,3,"N"],["Tennessee",8,4,"N"],["Temple",10,3,"L"],["USC",8,5,"L"]],
      games: [["Clemson","Notre Dame","24–22","10/3"],["Clemson","Florida State","23–13","11/7"],["Clemson","North Carolina","45–37","12/5",1],["Ole Miss","Alabama","43–37","9/19"],["Alabama","Tennessee","19–14","10/24"],["Alabama","LSU","30–16","11/7"],["Alabama","Florida","29–15","12/5",1],["Michigan State","Oregon","31–28","9/12"],["Michigan State","Michigan","27–23","10/17"],["Michigan State","Ohio State","17–14","11/21"],["Michigan State","Iowa","16–13","12/5",1],["Oklahoma","Tennessee","31–24","9/12"],["Oklahoma","Baylor","44–34","11/14"],["Oklahoma","TCU","30–29","11/21"],["Oklahoma","Oklahoma State","58–23","11/28"],["Iowa","Northwestern","40–10","10/17"],["Northwestern","Stanford","16–6","9/5"],["Stanford","USC","41–31","9/19"],["Oregon","Stanford","38–36","11/14"],["Stanford","Notre Dame","38–36","11/28"],["Stanford","USC","41–22","12/5",1],["Ohio State","Michigan","42–13","11/28"],["Notre Dame","Navy","41–24","10/10"],["Notre Dame","USC","41–31","10/17"],["Notre Dame","Temple","24–20","10/31"],["Florida State","Florida","27–2","11/28"],["Oklahoma State","TCU","49–29","11/7"],["TCU","Baylor","28–21","11/27"],["Florida","Ole Miss","38–10","10/3"],["Ole Miss","LSU","38–17","11/21"],["Michigan","Northwestern","38–0","10/10"],["Utah","Michigan","24–17","9/3"],["Utah","Oregon","62–20","9/26"],["Oregon","USC","48–28","11/21"],["Baylor","Oklahoma State","45–35","11/21"],["Houston","Navy","52–31","11/27"],["Houston","Temple","24–13","12/5",1],["Florida","Tennessee","28–27","9/26"],["LSU","Florida","35–28","10/17"],["USC","Utah","42–24","10/24"]] },
    { yr: 2016, date: "Dec 4",
      teams: [["Alabama",13,0,"W"],["Clemson",12,1,"W"],["Ohio State",11,1,"N"],["Washington",12,1,"W"],["Penn State",11,2,"W"],["Michigan",10,2,"N"],["Oklahoma",10,2,"W","Big 12 champion, no title game"],["Wisconsin",10,3,"L"],["USC",9,3,"N"],["Colorado",10,3,"L"],["Florida State",9,3,"N"],["Oklahoma State",9,3,"N"],["Louisville",9,3,"N"],["Auburn",8,4,"N"],["Western Michigan",13,0,"W"],["West Virginia",10,2,"N"],["Florida",8,4,"L"],["Stanford",9,3,"N"],["Utah",8,4,"N"],["LSU",7,4,"N"],["Tennessee",8,4,"N"],["Virginia Tech",9,4,"L"],["Pittsburgh",8,4,"N"],["Temple",10,3,"W"],["Navy",9,3,"L"]],
      games: [["Alabama","USC","52–6","9/3"],["Alabama","Tennessee","49–10","10/15"],["Alabama","LSU","10–0","11/5"],["Alabama","Auburn","30–12","11/26"],["Alabama","Florida","54–16","12/3",1],["Clemson","Auburn","19–13","9/3"],["Clemson","Louisville","42–36","10/1"],["Clemson","Florida State","37–34","10/29"],["Pittsburgh","Clemson","43–42","11/12"],["Clemson","Virginia Tech","42–35","12/3",1],["Ohio State","Oklahoma","45–24","9/17"],["Ohio State","Wisconsin","30–23","10/15"],["Penn State","Ohio State","24–21","10/22"],["Ohio State","Michigan","30–27","11/26"],["Washington","Stanford","44–6","9/30"],["Washington","Utah","31–24","10/29"],["USC","Washington","26–13","11/12"],["Washington","Colorado","41–10","12/2",1],["Pittsburgh","Penn State","42–39","9/10"],["Penn State","Temple","34–27","9/17"],["Michigan","Penn State","49–10","9/24"],["Penn State","Wisconsin","38–31","12/3",1],["Michigan","Colorado","45–28","9/17"],["Michigan","Wisconsin","14–7","10/1"],["Oklahoma","West Virginia","56–28","11/19"],["Oklahoma","Oklahoma State","38–20","12/3"],["Wisconsin","LSU","16–14","9/3"],["Stanford","USC","27–10","9/17"],["Utah","USC","31–27","9/23"],["USC","Colorado","21–17","10/8"],["Colorado","Stanford","10–5","10/22"],["Colorado","Utah","27–22","11/26"],["Louisville","Florida State","63–20","9/17"],["Florida State","Florida","31–13","11/26"],["Oklahoma State","Pittsburgh","45–38","9/17"],["Oklahoma State","West Virginia","37–20","10/29"],["Auburn","LSU","18–13","9/24"],["Tennessee","Florida","38–28","9/24"],["Florida","LSU","16–10","11/19"],["Tennessee","Virginia Tech","45–24","9/10"],["Virginia Tech","Pittsburgh","39–36","10/27"],["Temple","Navy","34–10","12/3",1]] },
    { yr: 2017, date: "Dec 3",
      teams: [["Clemson",12,1,"W"],["Oklahoma",12,1,"W"],["Georgia",12,1,"W"],["Alabama",11,1,"N"],["Ohio State",11,2,"W"],["Wisconsin",12,1,"L"],["Auburn",10,3,"L"],["USC",11,2,"W"],["Penn State",10,2,"N"],["Miami",10,2,"L"],["Washington",10,2,"N"],["UCF",12,0,"W"],["Stanford",9,4,"L"],["Notre Dame",9,3,"N"],["TCU",10,3,"L"],["Michigan State",9,3,"N"],["LSU",9,3,"N"],["Washington State",9,3,"N"],["Oklahoma State",9,3,"N"],["Memphis",10,2,"L"],["Northwestern",9,3,"N"],["Virginia Tech",9,3,"N"],["Mississippi State",8,4,"N"],["NC State",8,4,"N"],["Boise State",10,3,"W"]],
      games: [["Clemson","Auburn","14–6","9/9"],["Clemson","Virginia Tech","31–17","9/30"],["Clemson","NC State","38–31","11/4"],["Clemson","Miami","38–3","12/2",1],["Oklahoma","Ohio State","31–16","9/9"],["Oklahoma","Oklahoma State","62–52","11/4"],["Oklahoma","TCU","38–20","11/11"],["Oklahoma","TCU","41–17","12/2",1],["Georgia","Notre Dame","20–19","9/9"],["Georgia","Mississippi State","31–3","9/23"],["Auburn","Georgia","40–17","11/11"],["Georgia","Auburn","28–7","12/2",1],["Alabama","LSU","24–10","11/4"],["Alabama","Mississippi State","31–24","11/11"],["Auburn","Alabama","26–14","11/25"],["Ohio State","Penn State","39–38","10/28"],["Ohio State","Michigan State","48–3","11/11"],["Ohio State","Wisconsin","27–21","12/2",1],["Wisconsin","Northwestern","33–24","9/30"],["Auburn","Mississippi State","49–10","9/30"],["LSU","Auburn","27–23","10/14"],["USC","Stanford","42–24","9/9"],["Washington State","USC","30–27","9/29"],["Notre Dame","USC","49–14","10/21"],["USC","Stanford","31–28","12/1",1],["Penn State","Northwestern","31–7","10/7"],["Michigan State","Penn State","27–24","11/4"],["Miami","Virginia Tech","28–10","11/4"],["Miami","Notre Dame","41–8","11/11"],["Stanford","Washington","30–22","11/10"],["Washington","Washington State","41–14","11/25"],["UCF","Memphis","40–13","9/30"],["UCF","Memphis","62–55","12/2",1],["Washington State","Stanford","24–21","11/4"],["Stanford","Notre Dame","38–20","11/25"],["Notre Dame","Michigan State","38–18","9/23"],["Notre Dame","NC State","35–14","10/28"],["TCU","Oklahoma State","44–31","9/23"],["Northwestern","Michigan State","39–31","10/28"],["Mississippi State","LSU","37–7","9/16"],["Washington State","Boise State","47–44","9/9"]] },
    { yr: 2018, date: "Dec 2",
      teams: [["Alabama",13,0,"W"],["Clemson",13,0,"W"],["Notre Dame",12,0,"N"],["Oklahoma",12,1,"W"],["Georgia",11,2,"L"],["Ohio State",12,1,"W"],["Michigan",10,2,"N"],["UCF",12,0,"W"],["Washington",10,3,"W"],["Florida",9,3,"N"],["LSU",9,3,"N"],["Penn State",9,3,"N"],["Washington State",10,2,"N"],["Kentucky",9,3,"N"],["Texas",9,4,"L"],["West Virginia",8,3,"N"],["Utah",9,4,"L"],["Mississippi State",8,4,"N"],["Texas A&M",8,4,"N"],["Syracuse",9,3,"N"],["Fresno State",11,2,"W"],["Northwestern",8,5,"L"],["Missouri",8,4,"N"],["Iowa State",8,4,"N"],["Boise State",10,3,"L"]],
      games: [["Alabama","Texas A&M","45–23","9/22"],["Alabama","Missouri","39–10","10/13"],["Alabama","LSU","29–0","11/3"],["Alabama","Mississippi State","24–0","11/10"],["Alabama","Georgia","35–28","12/1",1],["Clemson","Texas A&M","28–26","9/8"],["Clemson","Syracuse","27–23","9/29"],["Notre Dame","Michigan","24–17","9/1"],["Notre Dame","Northwestern","31–21","11/3"],["Notre Dame","Syracuse","36–3","11/17"],["Oklahoma","Iowa State","37–27","9/15"],["Texas","Oklahoma","48–45","10/6"],["Oklahoma","West Virginia","59–56","11/23"],["Oklahoma","Texas","39–27","12/1",1],["Georgia","Missouri","43–29","9/22"],["LSU","Georgia","36–16","10/13"],["Georgia","Florida","36–17","10/27"],["Georgia","Kentucky","34–17","11/3"],["Ohio State","Penn State","27–26","9/29"],["Ohio State","Michigan","62–39","11/24"],["Ohio State","Northwestern","45–24","12/1",1],["Michigan","Northwestern","20–17","9/29"],["Michigan","Penn State","42–7","11/3"],["Washington","Utah","21–7","9/15"],["Washington","Washington State","28–15","11/23"],["Washington","Utah","10–3","11/30",1],["Kentucky","Florida","27–16","9/8"],["Florida","Mississippi State","13–6","9/29"],["Florida","LSU","27–19","10/6"],["Missouri","Florida","38–17","11/3"],["LSU","Mississippi State","19–3","10/20"],["Texas A&M","LSU","74–72","11/24"],["Washington State","Utah","28–24","9/29"],["Kentucky","Mississippi State","28–7","9/22"],["Texas A&M","Kentucky","20–14","10/6"],["Kentucky","Missouri","15–14","10/27"],["West Virginia","Texas","42–41","11/3"],["Texas","Iowa State","24–10","11/17"],["Iowa State","West Virginia","30–14","10/13"],["Mississippi State","Texas A&M","28–13","10/27"],["Boise State","Fresno State","24–17","11/9"],["Fresno State","Boise State","19–16","12/1",1]] },
    { yr: 2019, date: "Dec 8",
      teams: [["LSU",13,0,"W"],["Ohio State",13,0,"W"],["Clemson",13,0,"W"],["Oklahoma",12,1,"W"],["Georgia",11,2,"L"],["Oregon",11,2,"W"],["Baylor",11,2,"L"],["Wisconsin",10,3,"L"],["Florida",10,2,"N"],["Penn State",10,2,"N"],["Utah",11,2,"L"],["Auburn",9,3,"N"],["Alabama",10,2,"N"],["Michigan",9,3,"N"],["Notre Dame",10,2,"N"],["Iowa",9,3,"N"],["Memphis",12,1,"W"],["Minnesota",10,2,"N"],["Boise State",12,1,"W"],["Appalachian State",12,1,"W"],["Cincinnati",10,3,"L"],["USC",8,4,"N"],["Navy",9,2,"N"],["Virginia",9,4,"L"],["Oklahoma State",8,4,"N"]],
      games: [["LSU","Florida","42–28","10/12"],["LSU","Auburn","23–20","10/26"],["LSU","Alabama","46–41","11/9"],["LSU","Georgia","37–10","12/7",1],["Ohio State","Cincinnati","42–0","9/7"],["Ohio State","Wisconsin","38–7","10/26"],["Ohio State","Penn State","28–17","11/23"],["Ohio State","Michigan","56–27","11/30"],["Ohio State","Wisconsin","34–21","12/7",1],["Clemson","Virginia","62–17","12/7",1],["Oklahoma","Baylor","34–31","11/16"],["Oklahoma","Oklahoma State","34–16","11/30"],["Oklahoma","Baylor","30–23","12/7",1],["Georgia","Notre Dame","23–17","9/21"],["Georgia","Florida","24–17","11/2"],["Georgia","Auburn","21–14","11/16"],["Auburn","Oregon","27–21","8/31"],["Oregon","USC","56–24","11/2"],["Oregon","Utah","37–15","12/6",1],["Baylor","Oklahoma State","45–27","10/19"],["Wisconsin","Michigan","35–14","9/21"],["Wisconsin","Iowa","24–22","11/9"],["Wisconsin","Minnesota","38–17","11/30"],["Florida","Auburn","24–13","10/5"],["Penn State","Iowa","17–12","10/12"],["Penn State","Michigan","28–21","10/19"],["Minnesota","Penn State","31–26","11/9"],["USC","Utah","30–23","9/20"],["Auburn","Alabama","48–45","11/30"],["Michigan","Iowa","10–3","10/5"],["Michigan","Notre Dame","45–14","10/26"],["Notre Dame","Virginia","35–20","9/28"],["Notre Dame","USC","30–27","10/12"],["Notre Dame","Navy","52–20","11/16"],["Iowa","Minnesota","23–19","11/16"],["Memphis","Navy","35–23","9/26"],["Memphis","Cincinnati","34–24","11/29"],["Memphis","Cincinnati","29–24","12/7",1]] },
    { yr: 2020, date: "Dec 20",
      teams: [["Alabama",11,0,"W"],["Clemson",10,1,"W"],["Ohio State",6,0,"W"],["Notre Dame",10,1,"L"],["Texas A&M",8,1,"N"],["Oklahoma",8,2,"W"],["Florida",8,3,"L"],["Cincinnati",9,0,"W"],["Georgia",7,2,"N"],["Iowa State",8,3,"L"],["Indiana",6,1,"N"],["Coastal Carolina",11,0,"W","Sun Belt co-champion, title game canceled"],["North Carolina",8,3,"N"],["Northwestern",6,2,"L"],["Iowa",6,2,"N"],["BYU",10,1,"N"],["USC",5,1,"L"],["Miami",8,2,"N"],["Louisiana",9,1,"W","Sun Belt co-champion, title game canceled"],["Texas",6,3,"N"],["Oklahoma State",7,3,"N"],["San Jose State",7,0,"W"],["NC State",8,3,"N"],["Tulsa",6,2,"L"],["Oregon",4,2,"W"]],
      games: [["Alabama","Texas A&M","52–24","10/3"],["Alabama","Georgia","41–24","10/17"],["Alabama","Florida","52–46","12/19",1],["Clemson","Miami","42–17","10/10"],["Notre Dame","Clemson","47–40","11/7"],["Clemson","Notre Dame","34–10","12/19",1],["Ohio State","Indiana","42–35","11/21"],["Ohio State","Northwestern","22–10","12/19",1],["Notre Dame","North Carolina","31–17","11/27"],["Texas A&M","Florida","41–38","10/10"],["Iowa State","Oklahoma","37–30","10/3"],["Oklahoma","Texas","53–45","10/10"],["Oklahoma","Oklahoma State","41–13","11/21"],["Oklahoma","Iowa State","27–21","12/19",1],["Florida","Georgia","44–28","11/7"],["Cincinnati","Tulsa","27–24","12/19",1],["Louisiana","Iowa State","31–14","9/12"],["Oklahoma State","Iowa State","24–21","10/24"],["Iowa State","Texas","23–20","11/27"],["Coastal Carolina","Louisiana","30–27","10/14"],["Coastal Carolina","BYU","22–17","12/5"],["North Carolina","NC State","48–21","10/24"],["North Carolina","Miami","62–26","12/12"],["Northwestern","Iowa","21–20","10/31"],["Oregon","USC","31–24","12/18",1],["Miami","NC State","44–41","11/6"],["Texas","Oklahoma State","41–34","10/31"],["Oklahoma State","Tulsa","16–7","9/19"]] },
    { yr: 2021, date: "Dec 5",
      teams: [["Alabama",12,1,"W"],["Michigan",12,1,"W"],["Georgia",12,1,"L"],["Cincinnati",13,0,"W"],["Notre Dame",11,1,"N"],["Ohio State",10,2,"N"],["Baylor",11,2,"W"],["Ole Miss",10,2,"N"],["Oklahoma State",11,2,"L"],["Michigan State",10,2,"N"],["Utah",10,3,"W"],["Pittsburgh",11,2,"W"],["BYU",10,2,"N"],["Oregon",10,3,"L"],["Iowa",10,3,"L"],["Oklahoma",10,2,"N"],["Wake Forest",10,3,"L"],["NC State",9,3,"N"],["Clemson",9,3,"N"],["Houston",11,2,"L"],["Arkansas",8,4,"N"],["Kentucky",9,3,"N"],["Louisiana",12,1,"W"],["San Diego State",11,2,"L"],["Texas A&M",8,4,"N"]],
      games: [["Alabama","Ole Miss","42–21","10/2"],["Texas A&M","Alabama","41–38","10/9"],["Alabama","Arkansas","42–35","11/20"],["Alabama","Georgia","41–24","12/4",1],["Michigan State","Michigan","37–33","10/30"],["Michigan","Ohio State","42–27","11/27"],["Michigan","Iowa","42–3","12/4",1],["Georgia","Clemson","10–3","9/4"],["Georgia","Arkansas","37–0","10/2"],["Georgia","Kentucky","30–13","10/16"],["Cincinnati","Notre Dame","24–13","10/2"],["Cincinnati","Houston","35–20","12/4",1],["Oregon","Ohio State","35–28","9/11"],["Ohio State","Michigan State","56–7","11/20"],["Oklahoma State","Baylor","24–14","10/2"],["Baylor","BYU","38–24","10/16"],["Baylor","Oklahoma","27–14","11/13"],["Baylor","Oklahoma State","21–16","12/4",1],["Ole Miss","Arkansas","52–51","10/9"],["Ole Miss","Texas A&M","29–19","11/13"],["Oklahoma State","Oklahoma","37–33","11/27"],["BYU","Utah","26–17","9/11"],["San Diego State","Utah","33–31","9/18"],["Utah","Oregon","38–7","11/20"],["Utah","Oregon","38–10","12/3",1],["Pittsburgh","Clemson","27–17","10/23"],["Pittsburgh","Wake Forest","45–21","12/4",1],["Wake Forest","NC State","45–42","11/13"],["Clemson","Wake Forest","48–27","11/20"],["NC State","Clemson","27–21","9/25"],["Arkansas","Texas A&M","20–10","9/25"]] },
    { yr: 2022, date: "Dec 4",
      teams: [["Georgia",13,0,"W"],["Michigan",13,0,"W"],["TCU",12,1,"L"],["Ohio State",11,1,"N"],["Alabama",10,2,"N"],["Tennessee",10,2,"N"],["Clemson",11,2,"W"],["Utah",10,3,"W"],["Kansas State",10,3,"W"],["USC",11,2,"L"],["Penn State",10,2,"N"],["Washington",10,2,"N"],["Florida State",9,3,"N"],["Oregon State",9,3,"N"],["Oregon",9,3,"N"],["Tulane",11,2,"W"],["LSU",9,4,"L"],["UCLA",9,3,"N"],["South Carolina",8,4,"N"],["Texas",8,4,"N"],["Notre Dame",8,4,"N"],["Mississippi State",8,4,"N"],["NC State",8,4,"N"],["Troy",11,2,"W"],["UTSA",11,2,"W"]],
      games: [["Georgia","Oregon","49–3","9/3"],["Georgia","South Carolina","48–7","9/17"],["Georgia","Tennessee","27–13","11/5"],["Georgia","Mississippi State","45–19","11/12"],["Georgia","LSU","50–30","12/3",1],["Michigan","Penn State","41–17","10/15"],["Michigan","Ohio State","45–23","11/26"],["TCU","Kansas State","38–28","10/22"],["TCU","Texas","17–10","11/12"],["Kansas State","TCU","31–28","12/3",1],["Ohio State","Notre Dame","21–10","9/3"],["Ohio State","Penn State","44–31","10/29"],["Alabama","Texas","20–19","9/10"],["Tennessee","Alabama","52–49","10/15"],["Alabama","Mississippi State","30–6","10/22"],["LSU","Alabama","32–31","11/5"],["Tennessee","LSU","40–13","10/8"],["South Carolina","Tennessee","63–38","11/19"],["Clemson","NC State","30–20","10/1"],["Clemson","Florida State","34–28","10/15"],["Notre Dame","Clemson","35–14","11/5"],["South Carolina","Clemson","31–30","11/26"],["Utah","Oregon State","42–16","10/1"],["UCLA","Utah","42–32","10/8"],["Utah","USC","43–42","10/15"],["Oregon","Utah","20–17","11/19"],["Utah","USC","47–24","12/2",1],["Tulane","Kansas State","17–10","9/17"],["Texas","Kansas State","34–27","11/5"],["USC","Oregon State","17–14","9/24"],["USC","UCLA","48–45","11/19"],["USC","Notre Dame","38–27","11/26"],["UCLA","Washington","40–32","9/30"],["Washington","Oregon State","24–21","11/4"],["Washington","Oregon","37–34","11/12"],["Florida State","LSU","24–23","9/4"],["NC State","Florida State","19–17","10/8"],["Oregon State","Oregon","38–34","11/26"],["Oregon","UCLA","45–30","10/22"],["LSU","Mississippi State","31–16","9/17"],["Texas","UTSA","41–20","9/17"]] },
    { yr: 2023, date: "Dec 3",
      teams: [["Michigan",13,0,"W"],["Washington",13,0,"W"],["Texas",12,1,"W"],["Alabama",12,1,"W"],["Florida State",13,0,"W"],["Georgia",12,1,"L"],["Ohio State",11,1,"N"],["Oregon",11,2,"L"],["Missouri",10,2,"N"],["Penn State",10,2,"N"],["Ole Miss",10,2,"N"],["Oklahoma",10,2,"N"],["LSU",9,3,"N"],["Arizona",9,3,"N"],["Louisville",10,3,"L"],["Notre Dame",9,3,"N"],["Iowa",10,3,"L"],["NC State",9,3,"N"],["Oregon State",8,4,"N"],["Oklahoma State",9,4,"L"],["Tennessee",8,4,"N"],["Clemson",8,4,"N"],["Liberty",13,0,"W"],["SMU",11,2,"W"],["Kansas State",8,4,"N"]],
      games: [["Michigan","Penn State","24–15","11/11"],["Michigan","Ohio State","30–24","11/25"],["Michigan","Iowa","26–0","12/2",1],["Washington","Arizona","31–24","9/30"],["Washington","Oregon","36–33","10/14"],["Washington","Oregon State","22–20","11/18"],["Washington","Oregon","34–31","12/1",1],["Texas","Alabama","34–24","9/9"],["Oklahoma","Texas","34–30","10/7"],["Texas","Kansas State","33–30","11/4"],["Texas","Oklahoma State","49–21","12/2",1],["Alabama","Ole Miss","24–10","9/23"],["Alabama","Tennessee","34–20","10/21"],["Alabama","LSU","42–28","11/4"],["Alabama","Georgia","27–24","12/2",1],["Florida State","LSU","45–24","9/3"],["Florida State","Clemson","31–24","9/23"],["Florida State","Louisville","16–6","12/2",1],["Georgia","Missouri","30–21","11/4"],["Georgia","Ole Miss","52–17","11/11"],["Georgia","Tennessee","38–10","11/18"],["Ohio State","Notre Dame","17–14","9/23"],["Ohio State","Penn State","20–12","10/21"],["Oregon","Oregon State","31–7","11/24"],["Missouri","Kansas State","30–27","9/16"],["LSU","Missouri","49–39","10/7"],["Missouri","Tennessee","36–7","11/11"],["Penn State","Iowa","31–0","9/23"],["Ole Miss","LSU","55–49","9/30"],["Oklahoma","SMU","28–11","9/9"],["Oklahoma State","Oklahoma","27–24","11/4"],["Arizona","Oregon State","27–24","10/28"],["Louisville","NC State","13–10","9/29"],["Louisville","Notre Dame","33–20","10/7"],["Notre Dame","NC State","45–24","9/9"],["Clemson","Notre Dame","31–23","11/4"],["NC State","Clemson","24–17","10/28"],["Oklahoma State","Kansas State","29–21","10/6"]] },
    { yr: 2024, date: "Dec 8",
      teams: [["Oregon",13,0,"W"],["Georgia",11,2,"W"],["Texas",11,2,"L"],["Penn State",11,2,"L"],["Notre Dame",11,1,"N"],["Ohio State",10,2,"N"],["Tennessee",10,2,"N"],["Indiana",11,1,"N"],["Boise State",12,1,"W"],["SMU",11,2,"L"],["Alabama",9,3,"N"],["Arizona State",11,2,"W"],["Miami",10,2,"N"],["Ole Miss",9,3,"N"],["South Carolina",9,3,"N"],["Clemson",10,3,"W"],["BYU",10,2,"N"],["Iowa State",10,3,"L"],["Missouri",9,3,"N"],["Illinois",9,3,"N"],["Syracuse",9,3,"N"],["Army",11,1,"W"],["Colorado",9,3,"N"],["UNLV",10,3,"L"],["Memphis",10,2,"N"]],
      games: [["Oregon","Boise State","37–34","9/7"],["Oregon","Ohio State","32–31","10/12"],["Oregon","Illinois","38–9","10/26"],["Oregon","Penn State","45–37","12/7",1],["Georgia","Clemson","34–3","8/31"],["Alabama","Georgia","41–34","9/28"],["Georgia","Texas","30–15","10/19"],["Ole Miss","Georgia","28–10","11/9"],["Georgia","Tennessee","31–17","11/16"],["Georgia","Texas","22–19","12/7",1],["Penn State","Illinois","21–7","9/28"],["Ohio State","Penn State","20–13","11/2"],["Notre Dame","Army","49–14","11/23"],["Ohio State","Indiana","38–15","11/23"],["Tennessee","Alabama","24–17","10/19"],["Boise State","UNLV","29–24","10/25"],["Boise State","UNLV","21–7","12/6",1],["BYU","SMU","18–15","9/6"],["Clemson","SMU","34–31","12/7",1],["Alabama","South Carolina","27–25","10/12"],["Alabama","Missouri","34–0","10/26"],["Arizona State","BYU","28–23","11/23"],["Arizona State","Iowa State","45–19","12/7",1],["Syracuse","Miami","42–38","11/30"],["Ole Miss","South Carolina","27–3","10/5"],["South Carolina","Missouri","34–30","11/16"],["South Carolina","Clemson","17–14","11/30"],["Syracuse","UNLV","44–41","10/4"]] },
    { yr: 2025, date: "Dec 7",
      teams: [["Indiana",13,0,"W"],["Ohio State",12,1,"L"],["Georgia",12,1,"W"],["Texas Tech",12,1,"W"],["Oregon",11,1,"N"],["Ole Miss",11,1,"N"],["Texas A&M",11,1,"N"],["Oklahoma",10,2,"N"],["Alabama",10,3,"L"],["Miami",10,2,"N"],["Notre Dame",10,2,"N"],["BYU",11,2,"L"],["Texas",9,3,"N"],["Vanderbilt",10,2,"N"],["Utah",10,2,"N"],["USC",9,3,"N"],["Arizona",9,3,"N"],["Michigan",9,3,"N"],["Virginia",10,3,"L"],["Tulane",11,2,"W"],["Houston",9,3,"N"],["Georgia Tech",9,3,"N"],["Iowa",8,4,"N"],["James Madison",12,1,"W"],["North Texas",11,2,"L"]],
      games: [["Indiana","Iowa","20–15","9/27"],["Indiana","Oregon","30–20","10/11"],["Indiana","Ohio State","13–10","12/6",1],["Ohio State","Texas","14–7","8/30"],["Ohio State","Michigan","27–9","11/29"],["Alabama","Georgia","24–21","9/27"],["Georgia","Ole Miss","43–35","10/18"],["Georgia","Texas","35–10","11/15"],["Georgia","Georgia Tech","16–9","11/28"],["Georgia","Alabama","28–7","12/6",1],["Texas Tech","Utah","34–10","9/20"],["Texas Tech","Houston","35–11","10/4"],["Texas Tech","BYU","29–7","11/8"],["Texas Tech","BYU","34–7","12/6",1],["Oregon","Iowa","18–16","11/8"],["Oregon","USC","42–27","11/22"],["Ole Miss","Tulane","45–10","9/20"],["Ole Miss","Oklahoma","34–26","10/25"],["Texas A&M","Notre Dame","41–40","9/13"],["Texas","Texas A&M","27–17","11/28"],["Oklahoma","Michigan","24–13","9/6"],["Texas","Oklahoma","23–6","10/11"],["Oklahoma","Alabama","23–21","11/15"],["Alabama","Vanderbilt","30–14","10/4"],["Miami","Notre Dame","27–24","8/31"],["Notre Dame","USC","34–24","10/18"],["BYU","Arizona","33–27","10/11"],["BYU","Utah","24–21","10/18"],["Texas","Vanderbilt","34–31","11/1"],["USC","Michigan","31–13","10/11"],["USC","Iowa","26–21","11/15"],["Houston","Arizona","31–28","10/18"],["Tulane","North Texas","34–21","12/5",1]] },
  ];
  const historySource = (yr) => `https://en.wikipedia.org/wiki/${yr}_NCAA_Division_I_FBS_football_rankings`;

  /* Close calls: every pair of teams the committee ranked within five spots of each other in a final ranking.
     Each one is described by the three things Sam asked to match on: losses, head-to-head, conference title. */
  const CLOSE = 5;
  const CASES = [];
  for (const s of HISTORY) {
    s.teams.forEach((x, i) => {
      for (let j = i + 1; j <= i + CLOSE && j < s.teams.length; j++) {
        const y = s.teams[j], met = s.games.filter((g) => (g[0] === x[0] && g[1] === y[0]) || (g[0] === y[0] && g[1] === x[0]));
        const xw = met.filter((g) => g[0] === x[0]).length, yw = met.length - xw;
        CASES.push({ yr: s.yr, hi: { t: x[0], rk: i + 1, w: x[1], l: x[2], title: x[3], note: x[4] || "" },
          lo: { t: y[0], rk: j + 1, w: y[1], l: y[2], title: y[3], note: y[4] || "" },
          met, h2h: !met.length ? "none" : xw && yw ? "split" : xw ? "hi" : "lo" });
      }
    });
  }

  /* Situation of side p against side q: loss gap, head-to-head, title. Each step widens the match when too few
     cases fit: title counted only as champion or not, then loss gap by direction only, then any loss gap, then
     title ignored (keeping the loss gap's direction). */
  const WIDEN = [{ gap: "n", title: "x" }, { gap: "n", title: "c" }, { gap: "dir", title: "c" }, { gap: "any", title: "c" }, { gap: "dir", title: "any" }];
  function sitKey(p, q, h2h, w) {
    const d = p.l == null || q.l == null ? null : p.l - q.l;
    const gap = d == null || w.gap === "any" ? "?" : w.gap === "dir" ? Math.sign(d) : Math.sign(d) * Math.min(Math.abs(d), 2);
    const tt = (x) => w.title === "any" ? "" : w.title === "c" ? (x === "W" ? "W" : "-") : x;
    return [gap, h2h, tt(p.title), tt(q.title)].join(" ");
  }
  const flipH = (h) => h === "hi" ? "lo" : h === "lo" ? "hi" : h;

  /* a, b: { l: losses or null, title: "W" | "L" | "N" }, h2h: "a" | "b" | "none". Returns the first widening step
     with at least three matching cases (or the last step), each marked with whether the team in a's spot finished
     ahead. sym = the two spots look identical, so a tally would mean nothing. */
  function committeeCases(a, b, h2h) {
    const cur = h2h === "a" ? "hi" : h2h === "b" ? "lo" : "none";
    let res;
    for (let level = 0; level < WIDEN.length; level++) {
      const w = WIDEN[level], want = sitKey(a, b, cur, w), found = [];
      for (const c of CASES) {
        if (sitKey(c.hi, c.lo, c.h2h, w) === want) found.push({ c, aAhead: true });
        else if (sitKey(c.lo, c.hi, flipH(c.h2h), w) === want) found.push({ c, aAhead: false });
      }
      res = { level, widen: w, sym: want === sitKey(b, a, flipH(cur), w), found };
      if (found.length >= 3) break;
    }
    return res;
  }

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
  // Team code + nickname, shown where a logo would be (cls: "r" right-aligned, "s" code only)
  const mark = (t, cls = "") => (TEAMS[t] ? teamMark(TEAMS[t].abbr, TEAMS[t].nick, cls) : "");

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

  window.CFP = { TEAMS, AP, CONF, P4, G6, GAMES, ROUNDS, ORDER_GAMES, HISTORY, CASES, CLOSE, historySource, committeeCases, S, save, reset,
                 conf, rec, rankOf, L, mark, champFor, computeField, resolve, cleanPicks, champion };
})();
