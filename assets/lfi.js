/* Last Four In — shared site behaviour: header + nav, footer, Selection Day clock, toast,
   the saved-entries store behind the account page, and the share pop-up shown after every submit.
   Every page loads this file; a page marks its nav tab with <header class="nav" data-active="...">. */
(function () {
  // The menu. TOP is the main row: plain links and category dropdowns. LEAGUES sit on a slimmer row below it.
  // On phones both become one list. An item marked soon shows in the menu but is not a link yet.
  const TOP = [
    { key: "home", label: "Home", href: "/", sub: "What to play this week" },
    { label: "Trivia", items: [
      ["trivia", "/trivia/", "Daily Five", "Five questions, same for everyone"],
      ["names", "/trivia/names.html", "Name Them All", "How many can you name?"],
      ["pindrop", "/trivia/pindrop.html", "Pin Drop", "Drop a pin on the map, closest wins"],
      ["grid", "/grid/", "Grid Race", "Race a friend for 25 squares"],
    ] },
    { label: "Pick'em", items: [
      ["nfl", "/pickem/", "NFL Pick'em", "Pick every game straight up"],
      ["cfb", "/college/", "College Pick'em", "Every game with a Top 25 team"],
      ["nba", "/nba/", "NBA Pick'em", "Every NBA game, every night"],
      ["nhl", "/nhl/", "NHL Pick'em", "Every NHL game, every night"],
      ["cbb", "/ncaab/", "College Hoops Pick'em", "Every game with a Top 25 team"],
      ["mlb", "/mlb/", "MLB Pick'em", "Every MLB game, every day"],
      ["pools", "/pools/", "Pick'em Pools", "Play your friends in a private pool"],
      ["money", "/money/", "$1,000 Challenge", "Pretend money on real games"],
      ["ap", "/ap-poll/", "Predict the AP Poll", "Call Sunday's Top 25"],
      ["bracket", "/bracket/", "CFP Bracket Builder", "Build and share your field"],
    ] },
    { label: "Multiplayer", items: [
      ["challenges", "/challenges/", "Challenges", "Take on your friends"],
      ["grid", "/grid/", "Grid Race", "Race a friend for 25 squares"],
      ["race", "/trivia/race.html", "Name Them All Race", "Race friends live, first to name it claims it"],
      ["drafts", "/drafts/", "Draft a Friend", "Snake-draft NFL history, live"],
    ] },
    { label: "Drafts", items: [
      ["drafts", "/drafts/", "Drafts", "Draft any slice of NFL history"],
      ["jerseys", "/drafts/?kind=jerseys", "Jersey Draft", "Best player to wear each number"],
      ["coaches", "/drafts/?kind=coaches", "Coaches' Draft", "Draft head coaches by wins"],
      ["redraft", "/drafts/classes.html", "Draft Classes", "Mock or redraft any class since 1999"],
      ["league", "/redraft/", "League Redraft", "Redraft every NFL player into 32 new teams"],
    ] },
    { key: "fantasy", label: "Fantasy", href: "/fantasy/", sub: "Fantasy football tools" },
    { key: "l4picks", label: "Bubble AI", href: "/l4picks/", sub: "AI picks with the stats behind them" },
  ];
  const LEAGUES = [
    { label: "NFL", items: [
      ["nfl", "/pickem/", "NFL Pick'em", "Pick every game straight up"],
      ["drafts", "/drafts/", "Drafts", "Draft any slice of NFL history"],
      ["jerseys", "/drafts/?kind=jerseys", "Jersey Draft", "Best player to wear each number"],
      ["coaches", "/drafts/?kind=coaches", "Coaches' Draft", "Draft head coaches by wins"],
      ["redraft", "/drafts/classes.html", "Draft Classes", "Mock or redraft any class since 1999"],
      ["league", "/redraft/", "League Redraft", "Redraft every NFL player into 32 new teams"],
      ["money", "/money/", "$1,000 Challenge", "Pretend money on real games"],
    ] },
    { label: "NCAAF", items: [
      ["cfb", "/college/", "College Pick'em", "Every game with a Top 25 team"],
      ["ap", "/ap-poll/", "Predict the AP Poll", "Call Sunday's Top 25"],
      ["bracket", "/bracket/", "CFP Bracket Builder", "Build and share your field"],
      ["voters", "/ap-voters/", "AP Voter Tracker", "Every voter, Normal to Hot takes"],
    ] },
    { label: "NBA", items: [["nba", "/nba/", "NBA Pick'em", "Every NBA game, every night"]] },
    { label: "NHL", items: [["nhl", "/nhl/", "NHL Pick'em", "Every NHL game, every night"]] },
    { label: "NCAAB", items: [["cbb", "/ncaab/", "College Hoops Pick'em", "Every game with a Top 25 team"]] },
    { label: "MLB", items: [["mlb", "/mlb/", "MLB Pick'em", "Every MLB game, every day"]] },
  ];
  // An emoji beside every menu entry and group (Sam: "more emojis, makes it more playful"). Items by key, groups by label.
  // The desktop main row stays plain: with emojis it no longer fits beside Sign in at 1280px.
  const EMO = { home: "🏠", trivia: "🧠", names: "📝", pindrop: "📍", grid: "🏁", race: "🏃", challenges: "⚔️",
    nfl: "🏈", cfb: "🏈", nba: "🏀", nhl: "🏒", cbb: "🏀", mlb: "⚾", pools: "👥", ap: "🗳️", bracket: "🏆", voters: "🕵️",
    drafts: "📋", jerseys: "👕", coaches: "🧢", redraft: "🎓", league: "🔁", franchise: "🏟️", fantasy: "📊", l4picks: "🤖",
    Trivia: "🧠", "Pick'em": "🎯", Multiplayer: "⚔️", Drafts: "📋", NFL: "🏈", NCAAF: "🏈", NBA: "🏀", NHL: "🏒", NCAAB: "🏀", MLB: "⚾" };
  const em = (k) => EMO[k] ? `<span class="em" aria-hidden="true">${EMO[k]}</span> ` : "";
  const CARET = '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 4l4 4 4-4"/></svg>';
  const BURGER = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  const SUN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
  const MOON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';

  // Light or dark: theme.js set it before paint; the switch flips it, remembers it, and crossfades where the browser can.
  const theme = () => document.documentElement.dataset.theme === "light" ? "light" : "dark";
  function paintThemeColor() {
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
    m.content = theme() === "light" ? "#ffffff" : "#0d0820";
  }
  function setTheme(t) {
    const go = () => {
      const open = document.getElementById("mmenu") && !document.getElementById("mmenu").hidden; // the phone menu stays open across the swap
      document.documentElement.dataset.theme = t; paintThemeColor(); header();
      if (open) { $("mmenu").hidden = false; document.querySelector("header.nav .mbtn").setAttribute("aria-expanded", "true"); }
    };
    try { localStorage.setItem("lfi-theme", t); } catch (e) {}
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return go();
    const root = document.documentElement;
    root.classList.add("theme-flip"); // a plain crossfade, not the page-change slide
    document.startViewTransition(go).finished.finally(() => root.classList.remove("theme-flip"));
  }
  const themeLabel = () => theme() === "light" ? "Dark mode" : "Light mode";
  const FRIENDS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.4"/><path d="M2.8 20c.6-3.6 3.1-5.6 6.2-5.6s5.6 2 6.2 5.6"/><path d="M15.5 4.9a3.3 3.3 0 0 1 0 6.3M18 14.7c1.9.7 3 2.5 3.3 5.3"/></svg>';
  const SWORDS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/></svg>';
  // bubble mark: a bracket line feeding into the ball, i.e. the team "on the bubble".
  const LOGO = '<svg class="mark" width="30" height="30" viewBox="0 0 34 34" aria-hidden="true"><path d="M2 7h8v20H2M10 17h7" fill="none" stroke="currentColor" stroke-width="3.4"/><circle cx="25" cy="17" r="8" fill="currentColor"/></svg>';
  // "bubble" wordmark: Mr Dafoe jersey script turned into a path, so it never waits on a font.
  const WORDMARK = '<svg class="wm" viewBox="0 0 171.9 50" aria-hidden="true"><path fill="currentColor" d="M35.3 0Q39 0 39 2Q39 4.9 33.4 10.8Q27.8 16.7 22.2 21.2L16.6 25.6Q16.2 26.1 16.2 26.4Q16.2 26.7 16.5 26.7Q22.2 23.1 26.6 22.9Q27.5 22.9 28.2 23.4Q30.6 25.4 30.6 28.1Q30.6 30.7 25.2 37Q27.5 36.4 31.4 34Q35.4 31.6 38.2 29.5L41 27.4Q41.6 27.8 41.6 28.6Q41.6 29.3 41 29.8Q29.2 40.7 23.1 40.7Q22.7 40.7 21.9 40.6L22 40.4Q17.8 44.5 13.6 47.3Q9.4 50 6.7 50Q0 50 0 45.4Q0 43.2 1.5 40.1Q2.9 37 5 34.2Q7.1 31.3 9.2 28.8Q11.3 26.4 12.7 24.9Q14.2 23.4 14.2 23.4Q19.2 17.6 23 12.6Q26.7 7.7 27.9 5.6Q29.1 3.5 30.3 2Q31.6 0.5 32.4 0.2Q33.2 0 35.3 0ZM6.6 46Q9.5 46 14.2 41.9Q18.9 37.7 22.2 33.3Q25.5 28.8 25.5 27.4Q25.5 27.2 25.3 27.2Q21.6 27.2 16.9 31.2Q12.2 35.2 9.2 39.5Q6.1 43.9 6.1 45.5Q6.1 46 6.6 46ZM46.4 42.2Q57.1 36.5 69.8 27Q70.4 27.5 70.4 28.2Q70.4 28.9 69.7 29.6Q69 30.2 67.7 31.4Q66.4 32.6 62.7 35.8Q59 38.9 55.8 41.5Q47.4 48.2 43.4 49.4Q42.1 49.8 40.6 49.8Q38.2 49.8 38.2 46Q38.2 45.2 38.9 43.7Q39.5 42.1 39.6 41.8Q39.7 41.6 39.8 41.5Q39.9 41.3 40 41.2Q40 41.1 40 41Q40 40.8 39.6 40.8Q39.2 40.8 37.3 42.7Q35.3 44.6 33.9 45.7Q32.6 46.9 30.9 47.9Q29.3 48.9 28.2 48.9Q25.4 48.9 25.4 46.2Q25.4 44.7 26.4 42.4Q28.9 37.1 33.9 31.8Q38.9 26.6 41 26.5Q41.8 26.5 42.5 27.1Q43.1 27.6 43.1 28.3Q43.1 29.1 41.7 30.5Q40.2 31.9 38.1 34.2Q35.9 36.4 35 37.9Q34.1 39.4 34.1 39.9Q34.1 40.4 34.7 40.4Q35.3 40.4 36.8 39.5Q40.8 36.7 46 32.6Q51.3 28.6 52.8 26.7Q53.1 25.4 54.9 25.4Q58.3 25.4 58.3 26.6Q58.3 27.1 55 30.3Q44.9 40 44.9 42.2Q44.9 42.6 45.3 42.6Q45.6 42.6 46.4 42.2ZM89.2 0Q92.9 0 92.9 2Q92.9 4.9 87.3 10.8Q81.7 16.7 76.1 21.2L70.5 25.6Q70.1 26.1 70.1 26.4Q70.1 26.7 70.4 26.7Q76.1 23.1 80.6 22.9Q81.4 22.9 82.1 23.4Q84.5 25.4 84.5 28.1Q84.5 30.7 79.1 37Q81.4 36.4 85.4 34Q89.3 31.6 92.1 29.5L94.9 27.4Q95.5 27.8 95.5 28.6Q95.5 29.3 94.9 29.8Q83.1 40.7 77.1 40.7Q76.6 40.7 75.8 40.6L75.9 40.4Q71.7 44.5 67.5 47.3Q63.3 50 60.6 50Q53.9 50 53.9 45.4Q53.9 43.2 55.4 40.1Q56.8 37 58.9 34.2Q61 31.3 63.1 28.8Q65.2 26.4 66.6 24.9Q68.1 23.4 68.1 23.4Q73.1 17.6 76.9 12.6Q80.6 7.7 81.8 5.6Q83 3.5 84.3 2Q85.5 0.5 86.3 0.2Q87.1 0 89.2 0ZM60.5 46Q63.5 46 68.1 41.9Q72.8 37.7 76.1 33.3Q79.4 28.8 79.4 27.4Q79.4 27.2 79.2 27.2Q75.5 27.2 70.8 31.2Q66.1 35.2 63.1 39.5Q60 43.9 60 45.5Q60 46 60.5 46ZM114.3 0Q118 0 118 2Q118 4.9 112.4 10.8Q106.8 16.7 101.2 21.2L95.7 25.6Q95.2 26.1 95.2 26.4Q95.2 26.7 95.6 26.7Q101.2 23.1 105.7 22.9Q106.6 22.9 107.3 23.4Q109.7 25.4 109.7 28.1Q109.7 30.7 104.3 37Q106.6 36.4 110.5 34Q114.5 31.6 117.2 29.5L120 27.4Q120.7 27.8 120.7 28.6Q120.7 29.3 120 29.8Q108.3 40.7 102.2 40.7Q101.8 40.7 100.9 40.6L101.1 40.4Q96.9 44.5 92.7 47.3Q88.5 50 85.8 50Q79.1 50 79.1 45.4Q79.1 43.2 80.5 40.1Q82 37 84 34.2Q86.1 31.3 88.2 28.8Q90.3 26.4 91.8 24.9Q93.2 23.4 93.2 23.4Q98.3 17.6 102 12.6Q105.8 7.7 107 5.6Q108.2 3.5 109.4 2Q110.6 0.5 111.4 0.2Q112.3 0 114.3 0ZM85.7 46Q88.6 46 93.3 41.9Q97.9 37.7 101.2 33.3Q104.6 28.8 104.6 27.4Q104.6 27.2 104.3 27.2Q100.6 27.2 95.9 31.2Q91.2 35.2 88.2 39.5Q85.2 43.9 85.2 45.5Q85.2 46 85.7 46ZM116.2 43.8Q118.6 43.8 125.5 39.6Q132.5 35.4 138.2 31.2L143.9 27Q144.6 27.5 144.6 28.2Q144.6 28.9 143.9 29.6Q143.2 30.2 141.8 31.4Q140.5 32.6 136.8 35.8Q133.1 38.9 129.9 41.5Q121.5 48.2 117.5 49.4Q116.2 49.8 114.9 49.8Q113.5 49.8 112.7 49.6Q112 49.4 111 48.6Q109.2 47.1 109.2 41.7Q109.2 40.2 110.5 37.1Q111.8 34 114.7 29.7Q117.7 25.4 121.6 21Q125.6 16.7 131.7 12.3Q137.7 8 144.7 5.3Q145.7 4.9 146.6 4.9Q147.4 4.9 148.1 5.7Q148.9 6.4 149.1 7.2L149.5 7.9Q149.5 9.5 144.4 15.1Q139.2 20.9 132.4 26.1Q125.6 31.3 119.8 35Q115 38.2 115 41.6Q115 43.8 116.2 43.8ZM122.6 29.1Q124.4 29.1 133.4 20.3Q142.5 11.5 142.5 10.5L142.4 10.4L141.2 11Q137.5 13.4 131.3 19.2Q125.1 25.1 122.8 28.3Q122.5 28.7 122.5 28.9Q122.5 29.1 122.6 29.1ZM152.2 27Q150.4 27 145.9 30.8Q141.5 34.6 141.5 35.5Q141.5 35.6 141.7 35.6Q143.3 35.6 148 32.1Q152.6 28.6 152.6 27.4Q152.6 27 152.2 27ZM137 49.8Q131.6 49.8 131.6 43.1Q131.6 38.9 135.2 34.2Q138.9 29.4 143.9 26.4Q148.9 23.4 152.7 23.4Q154.4 23.4 155.9 24.7Q157.3 26.1 157.3 27.4Q157.3 29.7 154 32.7Q150.6 35.6 147 37.4Q143.3 39.2 142.1 39.2Q141 39.2 140.4 38.2Q140.1 38 139.6 38Q139.1 38 138 39.9Q136.8 41.7 136.8 42.9Q136.8 44.1 137.7 44.4Q143.1 44.4 149.4 41.2Q155.8 38 167 30.1Q167.7 29.5 169.3 28.3Q170.9 27.2 171.2 27Q171.9 27.5 171.9 28.2Q171.9 28.9 171.2 29.5Q167.7 33 162 37.5Q156.3 41.9 149 45.8Q141.7 49.8 137 49.8Z"/></svg>';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ?now=2026-10-31T15:00:00-04:00 lets us preview how the site looks on another day.
  const NOW_OVERRIDE = (() => { const v = new URLSearchParams(location.search).get("now"); const d = v && new Date(v); return d && !isNaN(d) ? d - Date.now() : 0; })();
  const now = () => new Date(Date.now() + NOW_OVERRIDE);

  const local = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // Selection Day: the CFP reveal until it passes, then March Madness Selection Sunday.
  const SELECTION = [
    { key: "cfp", label: "CFP Selection Day", short: "CFP Selection Day", at: new Date("2026-12-06T12:00:00-05:00"), when: "Sun, Dec 6", url: "/bracket/", cta: "Build your playoff bracket" },
    { key: "mm", label: "Selection Sunday", short: "Selection Sunday", at: new Date("2027-03-14T18:00:00-04:00"), when: "Sun, Mar 14", url: "/", cta: "March Madness bracketology opens in February" },
  ];
  const selectionDay = () => SELECTION.find((s) => s.at > now()) || SELECTION[SELECTION.length - 1];

  function parts(ms) {
    ms = Math.max(0, ms);
    const s = Math.floor(ms / 1000);
    return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
  }
  const pad = (n) => String(n).padStart(2, "0");

  // Renders a ticking days/hours/min/sec clock into el. Returns a stop function.
  function countdown(el, at, opts = {}) {
    const tick = () => {
      const p = parts(at - now());
      if (opts.compact) el.innerHTML = `${p.d}d ${pad(p.h)}:${pad(p.m)}:${pad(p.s)}`;
      else el.innerHTML = [["d", "Days"], ["h", "Hrs"], ["m", "Min"], ["s", "Sec"]].map(([k, l]) => `<div><b>${k === "d" ? p[k] : pad(p[k])}</b><span>${l}</span></div>`).join("");
      if (at - now() <= 0 && opts.onDone) { opts.onDone(); clearInterval(t); }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }

  // The signed-in profile, set by cloud.js once the session is known (null when signed out).
  let me = null;
  // Friend requests waiting on me, counted by cloud.js; shows as a badge on the Friends button.
  const inbox = () => (window.LFI && LFI.cloud && LFI.cloud.inbox) || 0;
  // Challenges from friends waiting on me (games.js / 50_games.sql); shows as a badge on the Challenges button.
  let challengesWaiting = 0;
  async function countChallenges() {
    const sb = window.LFI && LFI.cloud && LFI.cloud.sb;
    if (!sb || !me || !me.onboarded) { challengesWaiting = 0; return; }
    try { const { data, error } = await sb.rpc("challenge_count"); if (!error) challengesWaiting = data || 0; } catch (e) {}
    header();
  }
  const myName = () => (me && (me.display_name || me.username)) || local.get("lfi-name", "");

  function header() {
    const h = document.querySelector("header.nav");
    if (!h) return;
    const active = h.dataset.active || "";
    const name = myName();
    const item = ([k, href, label, sub]) => `<a href="${href}"${k === active ? ' class="on" aria-current="page"' : ""}><b>${em(k)}${label}</b><span>${sub}</span></a>`;
    const dd = (g, id) => {
      const on = g.items.some(([k]) => k === active);
      return `<div class="dd${on ? " on" : ""}"><button type="button" class="dd-btn" aria-expanded="false" aria-controls="${id}">${LEAGUES.includes(g) ? em(g.label) : ""}${g.label}${CARET}</button>
        <div class="dd-panel" id="${id}" hidden>${g.items.map(item).join("")}</div></div>`;
    };
    const top = TOP.map((t, i) => t.items ? dd(t, `dd${i}`)
      : t.soon ? `<span class="nav-home nav-soon" title="Coming soon">${t.label}<small>Soon</small></span>`
      : `<a class="nav-home${t.key === active ? " on" : ""}" href="${t.href}">${t.label}</a>`).join("");
    const mmTop = TOP.map((t) => t.items ? `<div class="mm-group"><div class="mm-lbl">${em(t.label)}${t.label}</div>${t.items.map(item).join("")}</div>`
      : t.soon ? `<span class="mm-home mm-soon"><b>${t.label} <i class="mm-badge">Soon</i></b><span>${t.sub}</span></span>`
      : `<a class="mm-home${t.key === active ? " on" : ""}" href="${t.href}"><b>${em(t.key)}${t.label}</b><span>${t.sub}</span></a>`).join("");
    h.innerHTML = `<div class="nav-in">
        <a class="brand" href="/" aria-label="bubble home">${LOGO}${WORDMARK}</a>
        <nav class="nav-links" aria-label="Main">${top}</nav>
        <div class="nav-r">
          ${me && me.avatar_url ? `<a class="avatar" href="/account/" title="My account" aria-label="My account"><img src="${esc(me.avatar_url)}" alt="" referrerpolicy="no-referrer"></a>`
            : name ? `<a class="avatar" href="/account/" title="My predictions" aria-label="My predictions">${esc(name.trim()[0].toUpperCase())}</a>`
                 : window.LFI_CLOUD_ON ? `<a class="btn si" href="/signin/"${active === "signin" ? ' aria-current="page"' : ""}>Sign in</a>`
                 : `<a class="btn si" href="/account/"${active === "account" ? ' aria-current="page"' : ""}>My picks</a>`}
          ${me && me.onboarded ? `<a class="fbtn${active === "friends" ? " on" : ""}" href="/friends/" title="Friends" aria-label="Friends${inbox() ? `, ${inbox()} new request${inbox() > 1 ? "s" : ""}` : ""}">${FRIENDS}${inbox() ? `<i>${inbox() > 9 ? "9+" : inbox()}</i>` : ""}</a>` : ""}
          ${me && me.onboarded ? `<a class="fbtn${active === "challenges" ? " on" : ""}" href="/challenges/" title="Challenges" aria-label="Challenges${challengesWaiting ? `, ${challengesWaiting} waiting` : ""}">${SWORDS}${challengesWaiting ? `<i>${challengesWaiting > 9 ? "9+" : challengesWaiting}</i>` : ""}</a>` : ""}
          <button type="button" class="tbtn" data-theme-flip aria-label="${themeLabel()}" title="${themeLabel()}">${theme() === "light" ? MOON : SUN}</button>
          <button type="button" class="mbtn" aria-expanded="false" aria-controls="mmenu" aria-label="Menu">${BURGER}</button>
        </div>
      </div>
      <div class="mmenu" id="mmenu" hidden>
          ${mmTop}
          ${LEAGUES.map((g) => `<div class="mm-group"><div class="mm-lbl">${em(g.label)}${g.label}</div>${g.items.map(item).join("")}</div>`).join("")}
          <a class="mm-home${active === "account" ? " on" : ""}" href="/account/"><b><span class="em" aria-hidden="true">📋</span> My picks</b><span>Everything you've submitted</span></a>
          ${me && me.onboarded ? `<a class="mm-home${active === "profile" ? " on" : ""}" href="/u/?h=${encodeURIComponent(me.username)}"><b><span class="em" aria-hidden="true">👤</span> My profile</b><span>@${esc(me.username)}</span></a>`
            : window.LFI_CLOUD_ON ? `<a class="mm-home" href="/signin/"><b><span class="em" aria-hidden="true">🔑</span> Sign in</b><span>Keep your picks on every device</span></a>` : ""}
          ${me && me.onboarded ? `<a class="mm-home${active === "friends" ? " on" : ""}" href="/friends/"><b><span class="em" aria-hidden="true">👥</span> Friends${inbox() ? ` <i class="mm-badge">${inbox()}</i>` : ""}</b><span>${inbox() ? `${inbox()} new friend request${inbox() > 1 ? "s" : ""}` : "Add friends and compare stats"}</span></a>` : ""}
          ${me && me.onboarded ? `<a class="mm-home${active === "challenges" ? " on" : ""}" href="/challenges/"><b><span class="em" aria-hidden="true">⚔️</span> Challenges${challengesWaiting ? ` <i class="mm-badge">${challengesWaiting}</i>` : ""}</b><span>${challengesWaiting ? `${challengesWaiting} waiting on you` : "Take on your friends"}</span></a>` : ""}
          <button type="button" class="mm-home mm-theme" data-theme-flip>${theme() === "light" ? MOON : SUN}<b>${themeLabel()}</b></button>
      </div>`;
    let lg = $("navlg");
    if (!lg) { lg = document.createElement("nav"); lg.id = "navlg"; lg.className = "nav-leagues"; lg.setAttribute("aria-label", "Leagues"); h.after(lg); }
    lg.innerHTML = `<div class="nav-lg-in">${LEAGUES.map((g, i) => dd(g, `lg${i}`)).join("")}</div>`;
    if (h.dataset.bound) return;
    h.dataset.bound = "1";

    // Dropdown behaviour: one open at a time, click outside or Escape closes.
    const closeAll = (except) => document.querySelectorAll("header.nav [aria-expanded], #navlg [aria-expanded]").forEach((b) => {
      if (b === except) return;
      b.setAttribute("aria-expanded", "false"); $(b.getAttribute("aria-controls")).hidden = true;
    });
    const onClick = (e) => {
      if (e.target.closest("[data-theme-flip]")) { setTheme(theme() === "light" ? "dark" : "light"); return; }
      const b = e.target.closest("[aria-expanded]"); if (!b) return;
      const open = b.getAttribute("aria-expanded") !== "true";
      closeAll(b);
      b.setAttribute("aria-expanded", String(open)); $(b.getAttribute("aria-controls")).hidden = !open;
    };
    h.addEventListener("click", onClick);
    $("navlg").addEventListener("click", onClick);
    document.addEventListener("click", (e) => { if (!h.contains(e.target) && !$("navlg").contains(e.target)) closeAll(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
  }

  // One inbox for privacy requests, accessibility problems and copyright notices (the legal pages read it from here).
  const CONTACT = "hello@playbubble.app";

  // Terms, Privacy, Accessibility and Contact links on every page. A page with its own footer text keeps it and gets the links added.
  function footer() {
    const f = document.querySelector("footer.foot");
    if (!f) return;
    const links = `<span class="foot-links"><a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a> · <a href="/accessibility/">Accessibility</a> · <a href="mailto:${CONTACT}">Contact</a></span>`;
    if (!f.textContent.trim()) f.innerHTML = `bubble is free to play for fun. No purchase necessary, no real-money betting, no prizes, and nothing here is betting advice. Not affiliated with or endorsed by the NFL, NBA, NHL, MLB, NCAA, the College Football Playoff, the AP or any team. Team names belong to their owners. ${links}`;
    else if (!f.querySelector('a[href="/accessibility/"]')) f.insertAdjacentHTML("beforeend", links);
    document.querySelectorAll("[data-contact]").forEach((a) => { a.href = `mailto:${CONTACT}`; a.textContent = CONTACT; });
  }

  // Keyboard: a "Skip to content" link first in the page, and Tab stays inside whichever pop-up is open.
  function skipLink() {
    const main = document.querySelector("main");
    if (!main || document.querySelector(".skip")) return;
    if (!main.id) main.id = "lfi-main"; // not "main": the money page already uses that id for its board
    document.body.insertAdjacentHTML("afterbegin", `<a class="skip" href="#${main.id}">Skip to content</a>`);
    // main only takes focus for the jump: a lasting tabindex would make cloud.js treat every click inside it as "play".
    document.querySelector(".skip").addEventListener("click", (e) => {
      e.preventDefault();
      if (!main.hasAttribute("tabindex")) { main.setAttribute("tabindex", "-1"); main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true }); }
      main.focus(); main.scrollIntoView();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const dlgs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter((d) => d.getClientRects().length && !d.closest("[hidden]"));
    const dlg = dlgs[dlgs.length - 1]; if (!dlg) return;
    const f = [...dlg.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((x) => x.getClientRects().length);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2400);
  }

  // ---- Saved entries (what the account page lists) ----
  // Kept in this browser until sign-in exists; each entry is replaced when it is re-submitted.
  const entries = {
    all() { return local.get("lfi-entries", []); },
    get(id) { return entries.all().find((e) => e.id === id) || null; },
    put(e) {
      const list = entries.all().filter((x) => x.id !== e.id);
      const prev = entries.get(e.id);
      list.unshift({ ...prev, ...e, saved: now().toISOString() });
      local.set("lfi-entries", list);
      return list[0];
    },
    patch(id, fields) {
      const list = entries.all(), i = list.findIndex((x) => x.id === id);
      if (i < 0) return;
      list[i] = { ...list[i], ...fields };
      local.set("lfi-entries", list);
    },
    remove(id) { local.set("lfi-entries", entries.all().filter((x) => x.id !== id)); },
  };

  // ---- Entry preview (share pop-up, share page, account page all draw it the same way) ----
  const PICK_KINDS = ["nfl", "cfb", "nba", "nhl", "cbb", "mlb"];
  const KIND = {
    nfl: { label: "NFL Pick'em", noun: "picks", share: "Share your picks for the week", url: "/pickem/", make: "Make your NFL picks" },
    cfb: { label: "College Pick'em", noun: "picks", share: "Share your college picks", url: "/college/", make: "Make your college picks" },
    nba: { label: "NBA Pick'em", noun: "picks", share: "Share your NBA picks", url: "/nba/", make: "Make your NBA picks" },
    nhl: { label: "NHL Pick'em", noun: "picks", share: "Share your NHL picks", url: "/nhl/", make: "Make your NHL picks" },
    cbb: { label: "College Hoops Pick'em", noun: "picks", share: "Share your college hoops picks", url: "/ncaab/", make: "Make your college hoops picks" },
    mlb: { label: "MLB Pick'em", noun: "picks", share: "Share your MLB picks", url: "/mlb/", make: "Make your MLB picks" },
    ap: { label: "AP Poll Prediction", noun: "AP poll", share: "Share your AP poll", url: "/ap-poll/", make: "Predict the AP poll" },
    bracket: { label: "CFP Bracket", noun: "bracket", share: "Share your bracket", url: "/bracket/", make: "Build your bracket" },
    trivia: { label: "Trivia", noun: "score", share: "Share your score", url: "/trivia/", make: "Play today's trivia" },
    draft: { label: "Draft", noun: "draft", share: "Share your draft", url: "/drafts/", make: "Run your own draft" },
  };
  // No team logos anywhere: the team's short code in big type sits where a logo would, nickname underneath.
  // cls "r" right-aligns it (right-hand sides); "s" drops the nickname where the name already sits beside it.
  const teamMark = (abbr, nick, cls = "") => abbr
    ? `<span class="tmk${cls ? " " + cls : ""}"><b>${esc(abbr)}</b>${nick && !/\bs\b/.test(cls) ? `<small>${esc(nick)}</small>` : ""}</span>` : "";
  // College team by ESPN id, from cfb-data.js when the page loads it.
  const cfbTeam = (id) => (window.CFB && id && Object.values(window.CFB.teams).find((x) => x.id === String(id))) || null;
  // Older saved picks kept a logo address instead of a code (…/nfl/500-dark/det.png or …/ncaa/500/333.png).
  const codeOf = (x) => {
    if (x.a) return x.a;
    const m = /\/(nfl|ncaa)\/[^/]+\/(\w+)\.png/.exec(x.l || "");
    return !m ? "" : m[1] === "nfl" ? m[2].toUpperCase() : (cfbTeam(m[2]) || {}).abbr || "";
  };

  const abOf = (d, i) => (d.ab || [])[i] || (cfbTeam((d.ids || [])[i]) || {}).abbr || "";
  function renderEntry(e, opts = {}) {
    const k = KIND[e.kind] || { label: "Entry" };
    const d = e.data || {};
    let body = "";
    if (e.kind === "bracket") {
      const ct = cfbTeam(d.champId) || {};
      body = `${d.champ ? `<div class="entry-champ">${teamMark(d.champAb || ct.abbr, d.champNick || ct.nick)}<div><small><span class="em" aria-hidden="true">🏆</span> National champion</small><b>${esc(d.champ)}</b></div></div>` : ""}
        <div class="mini-grid">${(d.seeds || []).map((t, i) => `<div><i>${i + 1}</i>${teamMark(abOf(d, i), "", "s")}${esc(t)}</div>`).join("")}</div>`;
    } else if (e.kind === "ap") {
      const top = d.top || [], n = opts.full ? top.length : 10;
      body = `<div class="mini-grid">${top.slice(0, n).map((t, i) => `<div><i>${i + 1}</i>${teamMark(abOf(d, i), "", "s")}${esc(t)}</div>`).join("")}</div>
        ${top.length > n ? `<div class="entry-more">+ ${top.length - n} more teams</div>` : ""}`;
    } else if (PICK_KINDS.includes(e.kind)) {
      const p = d.picks || [], n = opts.full ? p.length : 8;
      body = `<div class="mini-grid">${p.slice(0, n).map((x) => `<div>${teamMark(codeOf(x), "", "s")}<b>${esc(x.p)}</b>&nbsp;<span class="muted">over ${esc(x.o)}</span></div>`).join("")}</div>
        ${p.length > n ? `<div class="entry-more">+ ${p.length - n} more picks</div>` : ""}`;
    } else if (e.kind === "draft") {
      const dp = d.u === "wins" ? 0 : 1; // coaches' drafts count whole wins
      const side = (name, rows, tot) => `<div><div class="entry-champ" style="margin-bottom:6px"><div><small>${esc(name || "")}</small><b>${tot == null ? "" : esc((+tot).toFixed(dp)) + " " + (d.u || "pts")}</b></div></div>
        <div class="mini-grid" style="grid-template-columns:1fr">${(rows || []).filter((r) => r[1]).map((r) => `<div><i>${esc(r[0])}</i>${esc(r[1])}${r[2] == null ? "" : `&nbsp;<span class="muted">${esc(r[2].toFixed(dp))}</span>`}</div>`).join("")}</div></div>`;
      const mine = d.mn === "You" && opts.by !== undefined ? (opts.by || "Their team") : d.mn; // a friend's link shows their name, not "You"
      body = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${side(mine, d.me, d.mt)}${side(d.on, d.op, d.ot)}</div>`;
    } else if (e.kind === "trivia") {
      body = `<div class="disp" style="font-size:34px">${esc(d.score || "")}</div>${d.grid ? `<div style="font-size:22px;letter-spacing:2px;line-height:1.15;margin-top:6px;white-space:pre-line">${esc(d.grid)}</div>` : ""}`;
    }
    const by = opts.by ? `${esc(opts.by)}'s ` : "";
    return `<div class="entry">
      <div class="entry-h"><b>${by}${esc(e.title || k.label)}</b><span>${esc(e.result || e.sub || "")}</span></div>
      <div class="entry-b">${body}</div></div>`;
  }

  // ---- Share links: the entry rides in the URL, so the static site can show it to a friend ----
  function b64(s) { return btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0))); }
  function shareUrl(e) {
    const payload = { k: e.kind, t: e.title, s: e.sub, r: e.result, d: e.data, n: myName() || undefined, u: (me && me.onboarded && me.username) || undefined };
    return `${location.origin}/share/?e=${b64(JSON.stringify(payload))}`;
  }
  function readShare(s) {
    const p = JSON.parse(unb64(s));
    return { kind: p.k, title: p.t, sub: p.s, result: p.r, data: p.d || {}, by: p.n || "", handle: p.u || "" };
  }

  let dlg;
  function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement("div");
    dlg.className = "ov"; dlg.hidden = true;
    dlg.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="shH">
      <div class="dlg-h"><div><div class="kicker" id="shK">Saved</div><h2 class="disp" id="shH">Get your friends to compete against you <span class="em" aria-hidden="true">🔥</span></h2></div>
        <button class="dlg-x" type="button" data-x aria-label="Close">×</button></div>
      <div class="dlg-b">
        <p style="margin:0 0 12px;color:var(--ink-2)" id="shP"></p>
        <div id="shE"></div>
        <div class="share-acts">
          <button class="btn gold big" type="button" id="shGo"></button>
          <button class="btn" type="button" id="shCopy"><span class="em" aria-hidden="true">🔗</span> Copy link</button>
          <a class="btn" href="/account/" id="shAcct"><span class="em" aria-hidden="true">📋</span> See all my predictions</a>
        </div>
        <div id="shCh"></div>
        <div id="shPost"></div>
      </div></div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener("click", (ev) => { if (ev.target === dlg || ev.target.closest("[data-x]")) closeShare(); });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !dlg.hidden) closeShare(); });
    return dlg;
  }
  function closeShare() { if (dlg) dlg.hidden = true; document.body.style.overflow = ""; }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch {} ta.remove(); return ok;
  }

  // Called after every submit. entry = { id, kind, title, sub, data, shareText }.
  function share(e, opts = {}) {
    const k = KIND[e.kind] || {};
    const d = ensureDialog();
    const url = shareUrl(e);
    const text = e.shareText || `Here are my ${k.noun || "picks"} on PlayBubble. Think you can beat me? 🔥`;
    d.querySelector("#shK").textContent = opts.kicker || `Your ${k.noun || "entry"} ${opts.updated ? "is updated" : "is in"} ✅`;
    d.querySelector("#shP").textContent = opts.note || "Send it to your friends and see who calls it better.";
    d.querySelector("#shE").innerHTML = renderEntry(e);
    const go = d.querySelector("#shGo");
    go.textContent = "📣 " + (k.share || "Share");
    go.onclick = async () => {
      if (navigator.share) {
        try { await navigator.share({ title: "PlayBubble", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
      }
      toast((await copyText(`${text} ${url}`)) ? "🔗 Link copied. Paste it to your friends." : "Couldn't copy. Long-press the link to share.");
    };
    d.querySelector("#shCopy").onclick = async () => toast((await copyText(url)) ? "🔗 Link copied" : "Couldn't copy the link here");
    const post = d.querySelector("#shPost");
    post.innerHTML = "";
    if (LFI.onShareOpen) LFI.onShareOpen(e, post);
    challengeBox(e, d.querySelector("#shCh"), opts.challenge);
    d.hidden = false; document.body.style.overflow = "hidden";
    setTimeout(() => go.focus(), 30);
  }

  // "Challenge a friend" inside the share pop-up: one tap sends the friend a challenge to play the same thing
  // (same contest, same list, same draft pool). Signed-in players with friends only; games.js does the sending.
  // ch = { kind, title, url } overrides what is worked out from the entry.
  function challengeBox(e, slot, ch = {}) {
    slot.innerHTML = "";
    if (!me || !me.onboarded) return;
    const kind = ch.kind || (/^trivia-names/.test(e.id) ? "names" : /^grid/.test(e.id) ? "grid" : e.kind);
    const q = e.kind === "draft" && /^\?[\w=&%.+-]*$/.test((e.data || {}).q || "") ? e.data.q : "";
    const url = ch.url || (e.url && e.url[0] === "/" ? e.url : ((KIND[e.kind] || {}).url || "/") + q);
    const title = ch.title || e.title || (KIND[e.kind] || {}).label || "PlayBubble";
    const note = e.result || (e.data && e.data.score && `Score to beat: ${e.data.score}`) || null;
    const go = async () => {
      if (!window.LFI.games) await new Promise((ok) => { const s = document.createElement("script"); s.src = "/assets/games.js"; s.onload = s.onerror = ok; document.head.appendChild(s); });
      if (!LFI.games) return;
      const friends = await LFI.games.friends();
      if (!slot.isConnected) return;
      slot.innerHTML = `<div class="post-box"><p><b><span class="em" aria-hidden="true">⚔️</span> Challenge a friend</b> ${friends.length ? "to play this too. They'll see it on their Challenges page." : "once you've added some."}</p>
        <div class="post-acts">${friends.length ? friends.map((f) => `<button class="btn" type="button" data-h="${esc(f.username)}">${esc(f.display_name || f.username)}</button>`).join("")
          : `<a class="btn" href="/friends/"><span class="em" aria-hidden="true">👋</span> Add friends</a>`}</div></div>`;
      slot.onclick = async (ev) => {
        const b = ev.target.closest("button[data-h]"); if (!b) return;
        b.disabled = true;
        try { await LFI.games.challenge(b.dataset.h, kind, title, url, note); b.textContent = "✓ " + b.textContent; toast("⚔️ Challenge sent"); }
        catch (err) { toast(err.message); b.disabled = false; }
      };
    };
    go();
  }

  // ---- Score strip (shared by home + pick'em pages) ----
  const ESPN = {
    nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
    cfb: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard",
    nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
    nhl: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
    cbb: "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard",
    mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  };
  const rankOf = (x) => { const r = x.curatedRank && x.curatedRank.current; return r && r <= 25 ? r : null; };
  function normalize(e) {
    const c = e.competitions[0];
    const side = (ha) => {
      const x = c.competitors.find((t) => t.homeAway === ha), t = x.team;
      return { id: t.id, abbr: t.abbreviation, city: t.location, nick: t.name || t.shortDisplayName, color: "#" + (t.color || "334155"),
               rec: (x.records || [])[0]?.summary || "", score: x.score != null && x.score !== "" ? +x.score : null, rank: rankOf(x) };
    };
    const st = e.status.type;
    const status = st.completed ? "post" : st.state === "post" ? "off" : st.state;
    const home = side("home"), away = side("away");
    let winner = null;
    if (status === "post") winner = home.score > away.score ? "home" : away.score > home.score ? "away" : "tie";
    return { id: e.id, kickoff: new Date(e.date), status, detail: st.shortDetail, home, away, winner,
             tv: (c.broadcasts || [])[0]?.names?.[0] || "", stype: e.season && e.season.type };
  }
  // Daily leagues (NBA, NHL, college hoops, MLB) take one day per call: q = "&dates=YYYYMMDD". Their calendar is a
  // flat list of game days, returned as days; football's is weeks, returned as calendar.
  async function scoreboard(league, q = "") {
    const url = league === "cfb" ? `${ESPN.cfb}?groups=80&limit=400${q}` : league === "cbb" ? `${ESPN.cbb}?groups=50&limit=400${q}`
      : `${ESPN[league]}${q ? "?" + q.slice(1) : ""}`;
    const d = await (await fetch(url)).json();
    let games = d.events.map(normalize);
    if (league === "cfb" || league === "cbb") games = games.filter((g) => g.home.rank || g.away.rank);
    games.sort((a, b) => a.kickoff - b.kickoff);
    const cal = d.leagues[0].calendar || [], season = d.season || d.leagues[0].season || {};  // a dated call has no top-level season
    return { raw: d, games, week: d.week && d.week.number, season: season.year, stype: season.type,
             calendar: cal.find((c) => c.value == season.type)?.entries || [],
             days: cal.filter((c) => typeof c === "string") };
  }
  // This week's slate. ESPN's default feed stays on last week until midweek, so jump ahead once it's all final.
  async function thisWeek(league) {
    const sb = await scoreboard(league);
    if (sb.games.length && sb.games.every((g) => g.status === "post" || g.status === "off") && sb.calendar.some((c) => +c.value === sb.week + 1))
      return scoreboard(league, `&week=${sb.week + 1}&seasontype=${sb.stype}&dates=${sb.season}`);
    return sb;
  }

  // AP-poll lock: the first kickoff with a Top 25 team after the given poll date.
  // Early in the week ESPN's feed can still show last week, so look one week ahead too.
  async function firstRankedKickoff(after) {
    const sb = await scoreboard("cfb");
    let up = sb.games.filter((g) => g.kickoff > after);
    if (!up.length && sb.calendar.some((c) => +c.value === sb.week + 1)) {
      const nx = await scoreboard("cfb", `&week=${sb.week + 1}&seasontype=${sb.stype}&dates=${sb.season}`);
      up = nx.games.filter((g) => g.kickoff > after);
    }
    return { at: up.length ? up[0].kickoff : null, sb };
  }
  // Team colour for a filled "your pick" tile: pale brand colours (gold, white, light blue) fall back to navy so white text stays readable.
  const brandDark = () => getComputedStyle(document.documentElement).getPropertyValue("--field").trim() || "#0a1a33";
  function fillColor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return brandDark();
    const n = parseInt(m[1], 16), lin = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
    const L = .2126 * lin(n >> 16) + .7152 * lin((n >> 8) & 255) + .0722 * lin(n & 255);
    return L > .28 ? brandDark() : "#" + m[1];
  }
  const fmtTime = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const fmtShort = (d) => d.toLocaleDateString(undefined, { weekday: "short" }) + " · " + fmtTime(d);
  function stripHTML(games, mine = {}) {
    return games.map((g) => {
      const top = g.status === "in" ? `<span class="live">● ${esc(g.detail)}</span>` : g.status === "pre" ? esc(fmtShort(g.kickoff)) : esc(g.detail);
      const row = (ha) => {
        const t = g[ha], lose = g.winner && g.winner !== ha && g.winner !== "tie";
        return `<div class="sg-row${lose ? " lose" : ""}"><span>${t.rank ? `<small class="muted">${t.rank}</small> ` : ""}<b>${esc(t.abbr)}</b> <small class="nk">${esc(t.nick)}</small>${mine[g.id] === ha ? '<i class="mine" title="Your pick"></i>' : ""}</span><span class="sc">${g.status === "pre" ? esc(t.rec) : t.score ?? ""}</span></div>`;
      };
      return `<a class="sg" href="${g.href || "#g" + g.id}"><div class="sg-top">${top}<span>${esc(g.tv)}</span></div>${row("away")}${row("home")}</a>`;
    }).join("");
  }

  window.LFI = { $, esc, now, local, selectionDay, countdown, toast, entries, renderEntry, share, shareUrl, readShare, copyText,
                 KIND, teamMark, cfbTeam, scoreboard, thisWeek, fillColor, firstRankedKickoff, stripHTML, fmtTime, fmtShort, normalize,
                 setMe(p) { me = p; header(); countChallenges(); }, me: () => me, countChallenges, CONTACT };

  paintThemeColor();
  header();
  footer();
  skipLink();
  // Accounts (sign-in, cloud-saved picks, profiles). Pages that need it first can include it themselves.
  if (!document.querySelector('script[src="/assets/cloud.js"]')) {
    const s = document.createElement("script"); s.src = "/assets/cloud.js"; document.head.appendChild(s);
  }
})();
