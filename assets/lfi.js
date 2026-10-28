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
      ["grid", "/grid/", "Grid Race", "Race a friend for 25 squares"],
    ] },
    { label: "Pick'em", items: [
      ["nfl", "/pickem/", "NFL Pick'em", "Pick every game straight up"],
      ["cfb", "/college/", "College Pick'em", "Every game with a Top 25 team"],
      ["pools", "/pools/", "Pick'em Pools", "Play your friends in a private pool"],
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
    ] },
    { key: "fantasy", label: "Fantasy", href: "/fantasy/", sub: "Fantasy football tools", soon: true },
    { key: "l4picks", label: "L4 Picks AI", href: "/l4picks/", sub: "AI picks with the stats behind them", soon: true },
  ];
  const LEAGUES = [
    { label: "NFL", items: [
      ["nfl", "/pickem/", "NFL Pick'em", "Pick every game straight up"],
      ["drafts", "/drafts/", "Drafts", "Draft any slice of NFL history"],
      ["jerseys", "/drafts/?kind=jerseys", "Jersey Draft", "Best player to wear each number"],
      ["coaches", "/drafts/?kind=coaches", "Coaches' Draft", "Draft head coaches by wins"],
      ["redraft", "/drafts/classes.html", "Draft Classes", "Mock or redraft any class since 1999"],
    ] },
    { label: "NCAAF", items: [
      ["cfb", "/college/", "College Pick'em", "Every game with a Top 25 team"],
      ["ap", "/ap-poll/", "Predict the AP Poll", "Call Sunday's Top 25"],
      ["bracket", "/bracket/", "CFP Bracket Builder", "Build and share your field"],
      ["voters", "/ap-voters/", "AP Voter Tracker", "Every voter, Normal to Hot takes"],
    ] },
  ];
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
  const LOGO = '<svg width="26" height="26" viewBox="0 0 30 30" aria-hidden="true"><rect x="2" y="2" width="11.5" height="11.5" rx="2" fill="currentColor"/><rect x="16.5" y="2" width="11.5" height="11.5" rx="2" fill="currentColor"/><rect x="2" y="16.5" width="11.5" height="11.5" rx="2" fill="currentColor"/><rect x="16.5" y="16.5" width="11.5" height="11.5" rx="2" fill="#ff3dbb"/></svg>';

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
    const item = ([k, href, label, sub]) => `<a href="${href}"${k === active ? ' class="on" aria-current="page"' : ""}><b>${label}</b><span>${sub}</span></a>`;
    const dd = (g, id) => {
      const on = g.items.some(([k]) => k === active);
      return `<div class="dd${on ? " on" : ""}"><button type="button" class="dd-btn" aria-expanded="false" aria-controls="${id}">${g.label}${CARET}</button>
        <div class="dd-panel" id="${id}" hidden>${g.items.map(item).join("")}</div></div>`;
    };
    const top = TOP.map((t, i) => t.items ? dd(t, `dd${i}`)
      : t.soon ? `<span class="nav-home nav-soon" title="Coming soon">${t.label}<small>Soon</small></span>`
      : `<a class="nav-home${t.key === active ? " on" : ""}" href="${t.href}">${t.label}</a>`).join("");
    const mmTop = TOP.map((t) => t.items ? `<div class="mm-group"><div class="mm-lbl">${t.label}</div>${t.items.map(item).join("")}</div>`
      : t.soon ? `<span class="mm-home mm-soon"><b>${t.label} <i class="mm-badge">Soon</i></b><span>${t.sub}</span></span>`
      : `<a class="mm-home${t.key === active ? " on" : ""}" href="${t.href}"><b>${t.label}</b><span>${t.sub}</span></a>`).join("");
    h.innerHTML = `<div class="nav-in">
        <a class="brand" href="/" aria-label="Last Four In home">${LOGO}<b>Last Four In</b></a>
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
          ${LEAGUES.map((g) => `<div class="mm-group"><div class="mm-lbl">${g.label}</div>${g.items.map(item).join("")}</div>`).join("")}
          <a class="mm-home${active === "account" ? " on" : ""}" href="/account/"><b>My picks</b><span>Everything you've submitted</span></a>
          ${me && me.onboarded ? `<a class="mm-home${active === "profile" ? " on" : ""}" href="/u/?h=${encodeURIComponent(me.username)}"><b>My profile</b><span>@${esc(me.username)}</span></a>`
            : window.LFI_CLOUD_ON ? `<a class="mm-home" href="/signin/"><b>Sign in</b><span>Keep your picks on every device</span></a>` : ""}
          ${me && me.onboarded ? `<a class="mm-home${active === "friends" ? " on" : ""}" href="/friends/"><b>Friends${inbox() ? ` <i class="mm-badge">${inbox()}</i>` : ""}</b><span>${inbox() ? `${inbox()} new friend request${inbox() > 1 ? "s" : ""}` : "Add friends and compare stats"}</span></a>` : ""}
          ${me && me.onboarded ? `<a class="mm-home${active === "challenges" ? " on" : ""}" href="/challenges/"><b>Challenges${challengesWaiting ? ` <i class="mm-badge">${challengesWaiting}</i>` : ""}</b><span>${challengesWaiting ? `${challengesWaiting} waiting on you` : "Take on your friends"}</span></a>` : ""}
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

  function footer() {
    const f = document.querySelector("footer.foot");
    if (f && !f.textContent.trim()) f.innerHTML = `Last Four In is free to play. No purchase necessary. Not affiliated with the NFL, the NCAA, the College Football Playoff, the AP or any team. Team names belong to their owners. <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a>`;
  }

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
  const KIND = {
    nfl: { label: "NFL Pick'em", noun: "picks", share: "Share your picks for the week", url: "/pickem/", make: "Make your NFL picks" },
    cfb: { label: "College Pick'em", noun: "picks", share: "Share your college picks", url: "/college/", make: "Make your college picks" },
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
      body = `${d.champ ? `<div class="entry-champ">${teamMark(d.champAb || ct.abbr, d.champNick || ct.nick)}<div><small>National champion</small><b>${esc(d.champ)}</b></div></div>` : ""}
        <div class="mini-grid">${(d.seeds || []).map((t, i) => `<div><i>${i + 1}</i>${teamMark(abOf(d, i), "", "s")}${esc(t)}</div>`).join("")}</div>`;
    } else if (e.kind === "ap") {
      const top = d.top || [], n = opts.full ? top.length : 10;
      body = `<div class="mini-grid">${top.slice(0, n).map((t, i) => `<div><i>${i + 1}</i>${teamMark(abOf(d, i), "", "s")}${esc(t)}</div>`).join("")}</div>
        ${top.length > n ? `<div class="entry-more">+ ${top.length - n} more teams</div>` : ""}`;
    } else if (e.kind === "nfl" || e.kind === "cfb") {
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
      <div class="dlg-h"><div><div class="kicker" id="shK">Saved</div><h2 class="disp" id="shH">Get your friends to compete against you</h2></div>
        <button class="dlg-x" type="button" data-x aria-label="Close">×</button></div>
      <div class="dlg-b">
        <p style="margin:0 0 12px;color:var(--ink-2)" id="shP"></p>
        <div id="shE"></div>
        <div class="share-acts">
          <button class="btn gold big" type="button" id="shGo"></button>
          <button class="btn" type="button" id="shCopy">Copy link</button>
          <a class="btn" href="/account/" id="shAcct">See all my predictions</a>
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
    const text = e.shareText || `Here are my ${k.noun || "picks"} on Last Four In. Think you can beat me?`;
    d.querySelector("#shK").textContent = opts.kicker || `Your ${k.noun || "entry"} ${opts.updated ? "is updated" : "is in"}`;
    d.querySelector("#shP").textContent = opts.note || "Send it to your friends and see who calls it better.";
    d.querySelector("#shE").innerHTML = renderEntry(e);
    const go = d.querySelector("#shGo");
    go.textContent = k.share || "Share";
    go.onclick = async () => {
      if (navigator.share) {
        try { await navigator.share({ title: "Last Four In", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
      }
      toast((await copyText(`${text} ${url}`)) ? "Link copied. Paste it to your friends." : "Couldn't copy. Long-press the link to share.");
    };
    d.querySelector("#shCopy").onclick = async () => toast((await copyText(url)) ? "Link copied" : "Couldn't copy the link here");
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
    const title = ch.title || e.title || (KIND[e.kind] || {}).label || "Last Four In";
    const note = e.result || (e.data && e.data.score && `Score to beat: ${e.data.score}`) || null;
    const go = async () => {
      if (!window.LFI.games) await new Promise((ok) => { const s = document.createElement("script"); s.src = "/assets/games.js"; s.onload = s.onerror = ok; document.head.appendChild(s); });
      if (!LFI.games) return;
      const friends = await LFI.games.friends();
      if (!slot.isConnected) return;
      slot.innerHTML = `<div class="post-box"><p><b>Challenge a friend</b> ${friends.length ? "to play this too. They'll see it on their Challenges page." : "once you've added some."}</p>
        <div class="post-acts">${friends.length ? friends.map((f) => `<button class="btn" type="button" data-h="${esc(f.username)}">${esc(f.display_name || f.username)}</button>`).join("")
          : `<a class="btn" href="/friends/">Add friends</a>`}</div></div>`;
      slot.onclick = async (ev) => {
        const b = ev.target.closest("button[data-h]"); if (!b) return;
        b.disabled = true;
        try { await LFI.games.challenge(b.dataset.h, kind, title, url, note); b.textContent = "✓ " + b.textContent; toast("Challenge sent"); }
        catch (err) { toast(err.message); b.disabled = false; }
      };
    };
    go();
  }

  // ---- Score strip (shared by home + pick'em pages) ----
  const ESPN = {
    nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
    cfb: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard",
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
             tv: (c.broadcasts || [])[0]?.names?.[0] || "" };
  }
  async function scoreboard(league, q = "") {
    const url = league === "cfb" ? `${ESPN.cfb}?groups=80&limit=400${q}` : `${ESPN.nfl}${q ? "?" + q.slice(1) : ""}`;
    const d = await (await fetch(url)).json();
    let games = d.events.map(normalize);
    if (league === "cfb") games = games.filter((g) => g.home.rank || g.away.rank);
    games.sort((a, b) => a.kickoff - b.kickoff);
    return { raw: d, games, week: d.week && d.week.number, season: d.season.year, stype: d.season.type,
             calendar: (d.leagues[0].calendar || []).find((c) => c.value == d.season.type)?.entries || [] };
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
                 setMe(p) { me = p; header(); countChallenges(); }, me: () => me, countChallenges };

  paintThemeColor();
  header();
  footer();
  // Accounts (sign-in, cloud-saved picks, profiles). Pages that need it first can include it themselves.
  if (!document.querySelector('script[src="/assets/cloud.js"]')) {
    const s = document.createElement("script"); s.src = "/assets/cloud.js"; document.head.appendChild(s);
  }
})();
