/* Last Four In — shared site behaviour: header + nav, footer, Selection Day clock, toast,
   the saved-entries store behind the account page, and the share pop-up shown after every submit.
   Every page loads this file; a page marks its nav tab with <header class="nav" data-active="...">. */
(function () {
  // The menu, grouped by league. Each group is one dropdown on desktop and one section of the phone menu.
  const MENU = [
    { label: "NFL", items: [["nfl", "/pickem/", "Weekly Pick'em", "Pick every game straight up"]] },
    { label: "College Football", items: [
      ["cfb", "/college/", "Weekly Picks", "Every game with a Top 25 team"],
      ["ap", "/ap-poll/", "Predict the AP Poll", "Call Sunday's Top 25"],
      ["bracket", "/bracket/", "CFP Bracket Builder", "Rank 25, the playoff builds itself"],
      ["h2h", "/head-to-head/", "Head-to-Head", "How the committee breaks ties"],
    ] },
    { label: "Trivia", items: [
      ["trivia", "/trivia/", "Daily Five", "Five questions, same for everyone"],
      ["names", "/trivia/names.html", "Name 'Em All", "How many can you name?"],
    ] },
  ];
  const CARET = '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 4l4 4 4-4"/></svg>';
  const LOGO = '<svg width="26" height="26" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="7" fill="#0a1a33"/><path d="M8 8h5v5h4M8 22h5v-5M17 13v4h5" fill="none" stroke="#f2b33d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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

  function header() {
    const h = document.querySelector("header.nav");
    if (!h) return;
    const active = h.dataset.active || "";
    const name = local.get("lfi-name", "");
    const sd = selectionDay();
    const item = ([k, href, label, sub]) => `<a href="${href}"${k === active ? ' class="on" aria-current="page"' : ""}><b>${label}</b><span>${sub}</span></a>`;
    const groups = MENU.map((g, i) => {
      const on = g.items.some(([k]) => k === active);
      return `<div class="dd${on ? " on" : ""}"><button type="button" class="dd-btn" aria-expanded="false" aria-controls="dd${i}">${g.label}${CARET}</button>
        <div class="dd-panel" id="dd${i}" hidden>${g.items.map(item).join("")}</div></div>`;
    }).join("");
    const cur = MENU.flatMap((g) => g.items.map((x) => [g.label, x])).find(([, x]) => x[0] === active);
    h.innerHTML = `<div class="nav-in">
        <a class="brand" href="/" aria-label="Last Four In home">${LOGO}<b>Last Four In</b></a>
        <nav class="nav-links" aria-label="Main"><a class="nav-home${active === "home" ? " on" : ""}" href="/">Home</a>${groups}</nav>
        <div class="nav-r">
          <a class="nav-clock" href="${sd.url}" title="${esc(sd.label)}, ${esc(sd.when)}"><span>${esc(sd.short)}</span><b id="navClock"></b></a>
          ${name ? `<a class="avatar" href="/account/" title="My predictions" aria-label="My predictions">${esc(name.trim()[0].toUpperCase())}</a>`
                 : `<a class="btn gold" href="/account/"${active === "account" ? ' aria-current="page"' : ""}>My picks</a>`}
        </div>
      </div>
      <div class="mbar"><button type="button" class="mbar-btn" aria-expanded="false" aria-controls="mmenu">
          <span>${cur ? `<small>${cur[0]}</small> ${cur[1][2]}` : active === "home" ? "Home" : active === "account" ? "My picks" : "Browse contests"}</span>
          <span class="mbar-r">Menu ${CARET}</span></button>
        <div class="mmenu" id="mmenu" hidden>
          <a class="mm-home${active === "home" ? " on" : ""}" href="/"><b>Home</b><span>What to play this week</span></a>
          ${MENU.map((g) => `<div class="mm-group"><div class="mm-lbl">${g.label}</div>${g.items.map(item).join("")}</div>`).join("")}
          <a class="mm-home${active === "account" ? " on" : ""}" href="/account/"><b>My picks</b><span>Everything you've submitted</span></a>
        </div></div>`;
    countdown($("navClock"), sd.at, { compact: true });

    // Dropdown behaviour: one open at a time, click outside or Escape closes.
    const closeAll = (except) => h.querySelectorAll("[aria-expanded]").forEach((b) => {
      if (b === except) return;
      b.setAttribute("aria-expanded", "false"); $(b.getAttribute("aria-controls")).hidden = true;
    });
    h.addEventListener("click", (e) => {
      const b = e.target.closest("[aria-expanded]"); if (!b) return;
      const open = b.getAttribute("aria-expanded") !== "true";
      closeAll(b);
      b.setAttribute("aria-expanded", String(open)); $(b.getAttribute("aria-controls")).hidden = !open;
    });
    document.addEventListener("click", (e) => { if (!h.contains(e.target)) closeAll(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
  }

  function footer() {
    const f = document.querySelector("footer.foot");
    if (f && !f.textContent.trim()) f.innerHTML = `Last Four In is free to play. No purchase necessary. Not affiliated with the NFL, the NCAA, the College Football Playoff, the AP or any team. Team names and logos belong to their owners.`;
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
    cfb: { label: "College Picks", noun: "picks", share: "Share your college picks", url: "/college/", make: "Make your college picks" },
    ap: { label: "AP Poll Prediction", noun: "AP poll", share: "Share your AP poll", url: "/ap-poll/", make: "Predict the AP poll" },
    bracket: { label: "CFP Bracket", noun: "bracket", share: "Share your bracket", url: "/bracket/", make: "Build your bracket" },
    trivia: { label: "Trivia", noun: "score", share: "Share your score", url: "/trivia/", make: "Play today's trivia" },
  };
  const cfbLogo = (id) => id ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png` : "";
  const img = (src) => src ? `<img src="${esc(src)}" alt="" loading="lazy">` : "";

  function renderEntry(e, opts = {}) {
    const k = KIND[e.kind] || { label: "Entry" };
    const d = e.data || {};
    let body = "";
    if (e.kind === "bracket") {
      body = `${d.champ ? `<div class="entry-champ">${img(cfbLogo(d.champId))}<div><small>National champion</small><b>${esc(d.champ)}</b></div></div>` : ""}
        <div class="mini-grid">${(d.seeds || []).map((t, i) => `<div><i>${i + 1}</i>${img(cfbLogo((d.ids || [])[i]))}${esc(t)}</div>`).join("")}</div>`;
    } else if (e.kind === "ap") {
      const top = d.top || [], n = opts.full ? top.length : 10;
      body = `<div class="mini-grid">${top.slice(0, n).map((t, i) => `<div><i>${i + 1}</i>${img(cfbLogo((d.ids || [])[i]))}${esc(t)}</div>`).join("")}</div>
        ${top.length > n ? `<div class="entry-more">+ ${top.length - n} more teams</div>` : ""}`;
    } else if (e.kind === "nfl" || e.kind === "cfb") {
      const p = d.picks || [], n = opts.full ? p.length : 8;
      body = `<div class="mini-grid">${p.slice(0, n).map((x) => `<div>${img(x.l)}<b>${esc(x.p)}</b>&nbsp;<span class="muted">over ${esc(x.o)}</span></div>`).join("")}</div>
        ${p.length > n ? `<div class="entry-more">+ ${p.length - n} more picks</div>` : ""}`;
    } else if (e.kind === "trivia") {
      body = `<div class="disp" style="font-size:34px">${esc(d.score || "")}</div>${d.grid ? `<div style="font-size:22px;letter-spacing:2px;margin-top:6px">${esc(d.grid)}</div>` : ""}`;
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
    const payload = { k: e.kind, t: e.title, s: e.sub, r: e.result, d: e.data, n: local.get("lfi-name", "") || undefined };
    return `${location.origin}/share/?e=${b64(JSON.stringify(payload))}`;
  }
  function readShare(s) {
    const p = JSON.parse(unb64(s));
    return { kind: p.k, title: p.t, sub: p.s, result: p.r, data: p.d || {}, by: p.n || "" };
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
    d.hidden = false; document.body.style.overflow = "hidden";
    setTimeout(() => go.focus(), 30);
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
      return { id: t.id, abbr: t.abbreviation, city: t.location, nick: t.name || t.shortDisplayName, logo: t.logo, color: "#" + (t.color || "334155"),
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
  function fillColor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#0a1a33";
    const n = parseInt(m[1], 16), lin = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
    const L = .2126 * lin(n >> 16) + .7152 * lin((n >> 8) & 255) + .0722 * lin(n & 255);
    return L > .28 ? "#0a1a33" : "#" + m[1];
  }
  const fmtTime = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const fmtShort = (d) => d.toLocaleDateString(undefined, { weekday: "short" }) + " · " + fmtTime(d);
  function stripHTML(games, mine = {}) {
    return games.map((g) => {
      const top = g.status === "in" ? `<span class="live">● ${esc(g.detail)}</span>` : g.status === "pre" ? esc(fmtShort(g.kickoff)) : esc(g.detail);
      const row = (ha) => {
        const t = g[ha], lose = g.winner && g.winner !== ha && g.winner !== "tie";
        return `<div class="sg-row${lose ? " lose" : ""}"><img src="${esc(t.logo)}" alt=""><span>${t.rank ? `<small class="muted">${t.rank}</small> ` : ""}${esc(t.abbr)}${mine[g.id] === ha ? '<i class="mine" title="Your pick"></i>' : ""}</span><span class="sc">${g.status === "pre" ? esc(t.rec) : t.score ?? ""}</span></div>`;
      };
      return `<a class="sg" href="${g.href || "#g" + g.id}"><div class="sg-top">${top}<span>${esc(g.tv)}</span></div>${row("away")}${row("home")}</a>`;
    }).join("");
  }

  window.LFI = { $, esc, now, local, selectionDay, countdown, toast, entries, renderEntry, share, shareUrl, readShare, copyText,
                 KIND, cfbLogo, scoreboard, thisWeek, fillColor, firstRankedKickoff, stripHTML, fmtTime, fmtShort, normalize };

  header();
  footer();
})();
