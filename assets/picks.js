/* Weekly pick'em engine shared by every pick'em page: NFL (/pickem/), college football (/college/), and the daily
   leagues NBA (/nba/), NHL (/nhl/), college hoops (/ncaab/) and MLB (/mlb/).
   Games come straight from ESPN's public scoreboard and picks are kept in this browser. Signed in, every tap
   also goes to the account's picks table (locked server-side at kickoff, graded by the server).
   The page sets window.PICKS = { league, name, url } before loading this file. Daily leagues add
   daily: true, cal: [calendar.js window keys], share: "..."; their week is Monday to Sunday (US Eastern), the same
   week the server grades, shown one day at a time. */
(function () {
  const { $, esc, now, local, toast, entries, scoreboard, stripHTML, fmtTime, fmtShort } = LFI;
  const CFG = window.PICKS;
  const league = CFG.league;
  let games = [], week = null, season = null, stype = 2, calendar = [];
  const storeKey = league === "nfl" ? "lfi-preview-picks" : `lfi-picks-${league}`;
  let picks = local.get(storeKey, {});
  const infoOpen = new Set();   // game ids whose "Injuries, preview & news" panel is open, kept across redraws
  const daily = !!CFG.daily;
  let day = null, gameDays = [];  // daily leagues: the day on screen (YYYY-MM-DD) and the season's game days
  const entryId = () => daily ? `${league}-${week}` : `${league}-${season}-${stype}-${week}`;

  const isOpen = (g) => g.status === "pre" && g.kickoff > now();
  const fmtDay = (d) => d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const pro = league !== "cfb" && league !== "cbb";
  const label = (t) => (t.rank ? `#${t.rank} ` : "") + (pro ? t.nick : t.city);
  const starts = daily ? "starts" : "kicks off", start = daily ? "game time" : "kickoff";
  const weekTitle = () => daily ? `Week of ${fmtYmd(week)}` : `Week ${week}`;

  // ---- Daily leagues: dates are Eastern-time YYYY-MM-DD strings ----
  const ymdET = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
  const addDays = (ymd, n) => { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const mondayOf = (ymd) => addDays(ymd, -((new Date(ymd + "T12:00:00Z").getUTCDay() + 6) % 7));
  const fmtYmd = (ymd, o = { month: "short", day: "numeric" }) => new Date(ymd + "T12:00:00Z").toLocaleDateString(undefined, { timeZone: "UTC", ...o });
  // Game days from ESPN's calendar (only used to list weeks), kept to this league's windows in calendar.js
  // (drops preseason and spring training).
  const inWindow = (ymd) => !CFG.cal || !window.LFI_CAL || CFG.cal.some((k) => (LFI_CAL.W[k] || []).some(([a, b]) => ymd >= a && ymd <= b));
  const dayGames = (ymd) => games.filter((g) => ymdET(g.kickoff) === ymd);

  async function loadDaily(mon) {
    if (!mon) {
      const sb = await scoreboard(league);
      season = sb.season;
      gameDays = [...new Set(sb.days.map((d) => ymdET(new Date(d))))].filter(inWindow).sort();
      const weeks = [...new Set([mondayOf(ymdET(now())), ...gameDays.map(mondayOf)])].sort();
      $("weekSel").innerHTML = weeks.map((m) => `<option value="${m}">Week of ${esc(fmtYmd(m))} · ${esc(fmtYmd(addDays(m, 6), { month: "short", day: "numeric" }))}</option>`).join("");
      mon = mondayOf(ymdET(now()));
    }
    week = mon;
    // Every day of the week, not just ESPN's calendar days: MLB's calendar skips real game days.
    const want = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(mon, n));
    const sbs = await Promise.all(want.map((d) => scoreboard(league, `&dates=${d.replace(/-/g, "")}`).catch(() => ({ games: [] }))));
    if (week !== mon) return;
    const seen = new Set();
    games = sbs.flatMap((x) => x.games).filter((g) => !seen.has(g.id) && seen.add(g.id) && (g.stype === 2 || g.stype === 3)).sort((a, b) => a.kickoff - b.kickoff);
    // Nothing left to pick this week (Sunday night, or before the season): jump to the next week with games.
    const later = gameDays.find((d) => d > addDays(mon, 6));
    if (games.every((g) => g.status === "post" || g.status === "off") && later && !$("weekSel").dataset.moved) { $("weekSel").dataset.moved = "1"; return loadDaily(mondayOf(later)); }
    $("weekSel").value = mon;
    const today = ymdET(now()), ds = [...new Set(games.map((g) => ymdET(g.kickoff)))];
    if (!ds.includes(day)) day = ds.includes(today) ? today : (ds.find((d) => dayGames(d).some(isOpen)) || ds[ds.length - 1] || null);
    render();
    mergeCloud();
  }

  async function load(w) {
    if (daily) return loadDaily(w);
    const q = w ? `&week=${w}&seasontype=${stype}&dates=${season}` : "";
    const sb = await scoreboard(league, q);
    season = sb.season; stype = sb.stype; week = sb.week; games = sb.games;
    if (!w) {
      calendar = sb.calendar;
      $("weekSel").innerHTML = calendar.map((c) => `<option value="${c.value}">${esc(c.label)} · ${esc(c.detail)}</option>`).join("");
      // The default feed stays on last week until midweek; jump ahead once every game in it is final.
      if (games.length && games.every((g) => g.status === "post" || g.status === "off") && calendar.some((c) => +c.value === week + 1)) return load(week + 1);
    }
    $("weekSel").value = String(week);
    render();
    mergeCloud();
  }

  // Signed in: the account's picks win (another phone may have newer ones); picks only made here go up.
  async function mergeCloud() {
    const c = await cloudReady();
    if (!c || !c.profile || !c.profile.onboarded || !games.length) return;
    const wk = week, remote = await c.myPicks(league, games.map((g) => g.id));
    if (wk !== week) return;
    let changed = false;
    const up = {};
    for (const g of games) {
      if (remote[g.id] && picks[g.id] !== remote[g.id]) { picks[g.id] = remote[g.id]; changed = true; }
      else if (!remote[g.id] && picks[g.id] && isOpen(g)) up[g.id] = picks[g.id];
    }
    if (Object.keys(up).length) c.savePicks(league, up);
    if (changed) { local.set(storeKey, picks); render(); }
  }
  // cloud.js loads after this file; wait for it briefly (it isn't required for the page to work).
  function cloudReady() {
    return new Promise((res) => {
      let n = 0;
      const t = () => LFI.cloud ? LFI.cloud.ready.then(res) : ++n > 100 ? res(null) : setTimeout(t, 50);
      t();
    });
  }

  function teamBtn(g, ha) {
    const t = g[ha], mine = picks[g.id] === ha, open = isOpen(g);
    const showScore = g.status !== "pre" && t.score != null;
    const lost = g.winner && g.winner !== ha;
    return `<button class="tm ${ha}${mine ? " pick" : ""}${lost ? " lost" : ""}" style="--tc:${LFI.fillColor(t.color)}" data-g="${g.id}" data-s="${ha}"
       ${open ? "" : "disabled"} aria-pressed="${mine}" aria-label="Pick ${esc(t.city)} ${esc(t.nick)}">
       ${LFI.teamMark(t.abbr, t.nick, ha === "home" ? "r" : "")}
       <span class="tn"><span class="nick" style="display:block">${t.rank ? `<small>#${t.rank}</small> ` : ""}${esc(t.city)}</span><span class="rec">${esc(t.rec)}</span></span>
       <span class="ts">${showScore ? t.score : ""}</span></button>`;
  }

  function chipFor(g) {
    const p = picks[g.id];
    if (g.status === "in") return `<span class="chip live">🔴 ${esc(g.detail)}</span>`;
    if (g.status === "off") return `<span class="chip lock">${esc(g.detail)}</span>`;
    if (g.status === "post") {
      if (!p) return `<span class="chip lock">🏁 Final · no pick</span>`;
      if (g.winner === "tie") return `<span class="chip lock">🏁 Final · tie</span>`;
      return g.winner === p ? `<span class="chip ok">✅ Correct</span>` : `<span class="chip no">❌ Missed</span>`;
    }
    if (!isOpen(g)) return `<span class="chip lock">🔒 Locked</span>`;
    return p ? `<span class="chip ok">🎯 Picked</span>` : `<span class="chip">Open</span>`;
  }

  function render() {
    const em = { nfl: "🏈", cfb: "🎓" }[league];
    $("title").innerHTML = (em ? `<span class="em" aria-hidden="true">${em}</span> ` : "") + esc(`${CFG.name} · ${weekTitle()}`);
    $("stripWeek").textContent = daily && day ? fmtYmd(day, { weekday: "short", month: "short", day: "numeric" }) : weekTitle();
    renderStrip(); renderGames(); renderSummary();
  }
  const shown = () => daily ? dayGames(day) : games;
  function renderStrip() { $("strip").innerHTML = stripHTML(shown(), picks); }

  // Daily leagues: one tab per game day this week, with how many you've picked.
  function dayTabs() {
    const ds = [...new Set(games.map((g) => ymdET(g.kickoff)))];
    return `<div class="day-tabs" role="tablist" aria-label="Day">${ds.map((d) => {
      const gs = dayGames(d), n = gs.filter((g) => picks[g.id]).length;
      return `<button type="button" role="tab" data-day="${d}" aria-selected="${d === day}"><b>${esc(fmtYmd(d, { weekday: "short" }))}</b>
        <span>${esc(fmtYmd(d))}</span><small>${n ? `${n}/${gs.length} picked` : `${gs.length} ${gs.length === 1 ? "game" : "games"}`}</small></button>`;
    }).join("")}</div>`;
  }

  function renderGames() {
    const off = !games.length && daily && CFG.cal && window.LFI_CAL && !CFG.cal.some((k) => LFI_CAL.inSeason(k, now()));
    $("progN").closest(".card").hidden = $("submitBtn").closest(".dock").hidden = off;  // nothing to count or submit in the off-season
    if (!games.length) {
      $("days").innerHTML = off ? `<div class="card off-season"><div class="kicker">Off-season</div><h2 class="disp">${esc(CFG.name)} is ${esc(LFI_CAL.backNote(CFG.cal[0], now()).replace(/^Back/, "back"))}</h2>
          <p>There are no games on the board right now. Picks open again when the new season starts.</p></div>`
        : `<p class="empty">📅 No games on the board for this week.</p>`;
      return;
    }
    let html = daily ? dayTabs() : "", cur = "";
    for (const g of shown()) {
      const d = fmtDay(g.kickoff);
      if (d !== cur) { if (cur) html += "</div>"; html += `<div class="day">${esc(d)}</div><div class="games">`; cur = d; }
      html += `<article class="g${isOpen(g) ? "" : " locked"}" id="g${g.id}">
        <div class="g-meta"><span class="when">${esc(fmtTime(g.kickoff))}${g.tv ? " · " + esc(g.tv) : ""}</span>${chipFor(g)}</div>
        <div class="g-teams">${teamBtn(g, "away")}<span class="at">@</span>${teamBtn(g, "home")}</div>
        <button class="g-more" type="button" data-info="${g.id}" aria-expanded="${infoOpen.has(g.id)}">${g.status === "post" ? "Recap, injuries & news" : "Injuries, preview & news"}</button>
        <div class="gi" id="gi${g.id}"${infoOpen.has(g.id) ? "" : " hidden"}></div></article>`;
    }
    $("days").innerHTML = html + "</div>";
    for (const id of infoOpen) { const g = games.find((x) => x.id === id); if (g) LFI.gameInfo(league, g, $("gi" + id)); }
  }

  function record() {
    const graded = games.filter((g) => g.status === "post" && picks[g.id] && g.winner !== "tie");
    const right = graded.filter((g) => g.winner === picks[g.id]).length;
    return { right, wrong: graded.length - right, graded: graded.length };
  }

  function renderSummary() {
    const made = games.filter((g) => picks[g.id]).length;
    $("progN").textContent = `🎯 ${made} of ${games.length} picked${daily ? " this week" : ""}`;
    $("progBar").style.width = games.length ? (made / games.length) * 100 + "%" : "0";
    const next = games.find(isOpen);
    $("deadline").textContent = next ? `Next lock ${fmtShort(next.kickoff)}` : "🔒 All games locked";

    const r = record();
    const pending = games.filter((g) => picks[g.id] && g.status !== "post").length;
    $("wkChip").textContent = daily ? fmtYmd(week) + " to " + fmtYmd(addDays(week, 6)) : `Week ${week}`;
    $("myWeek").innerHTML = `<div style="display:flex;gap:24px;align-items:end">
        <div><div class="disp" style="font-size:48px">${r.right}-${r.wrong}</div><div class="empty" style="padding:0">Record${r.graded && r.graded === games.length && !r.wrong ? " 💯" : r.right > r.wrong ? " 🎉" : ""}</div></div>
        <div><div class="disp" style="font-size:48px;color:var(--muted)">${pending}</div><div class="empty" style="padding:0">Still to play</div></div>
      </div>`;

    // Submit state. Picks save as you tap; submitting adds the week to your account and opens the share pop-up.
    const saved = entries.get(entryId());
    const btn = $("submitBtn");
    btn.disabled = !made || !next;
    btn.innerHTML = saved ? `<span class="em" aria-hidden="true">📣</span> Update &amp; share my picks` : `<span class="em" aria-hidden="true">🔒</span> Submit my picks`;
    $("submitNote").textContent = !next ? "🔒 This week is locked." : saved ? `✅ Submitted. Change any pick before its game ${starts}, then update.` : made < games.length ? `${games.length - made} game${games.length - made === 1 ? "" : "s"} left. Submit any time; you can change picks until ${start}.` : "Every game picked. Lock it in. 🔒";
    if (saved && r.graded) entries.patch(entryId(), { result: `${r.right}-${r.wrong}` + (r.graded < games.length ? " so far" : "") });
  }

  function entry() {
    const list = games.filter((g) => picks[g.id]).map((g) => {
      const side = picks[g.id], other = side === "home" ? "away" : "home";
      return { p: label(g[side]), o: label(g[other]), a: g[side].abbr };
    });
    const r = record();
    return {
      id: entryId(), kind: league, title: `${CFG.name} · ${weekTitle()}`, sub: `${list.length} of ${games.length} picked`,
      result: r.graded ? `${r.right}-${r.wrong}` : "", url: CFG.url, data: { picks: list },
      shareText: CFG.share ? `${CFG.share} for the week of ${fmtYmd(week)} are in on Last Four In. Think you can beat me?`
        : league === "nfl" ? `🏈 My NFL picks for Week ${week} are in on Last Four In. Think you can beat me?` : `🎓 My college football picks for Week ${week} are in on Last Four In. Think you can beat me?`,
    };
  }

  $("days").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-day]");
    if (tab) { day = tab.dataset.day; render(); return; }
    const more = e.target.closest(".g-more");
    if (more) {
      const panel = $("gi" + more.dataset.info), open = panel.hidden;
      panel.hidden = !open; more.setAttribute("aria-expanded", open);
      if (open) infoOpen.add(more.dataset.info); else infoOpen.delete(more.dataset.info);
      if (open) LFI.gameInfo(league, games.find((x) => x.id === more.dataset.info), panel);
      return;
    }
    const b = e.target.closest(".tm"); if (!b || b.disabled) return;
    const g = games.find((x) => x.id === b.dataset.g);
    if (!isOpen(g)) { toast(`🔒 That game has ${daily ? "started" : "kicked off"}. Picks are locked.`); return; }
    const side = b.dataset.s;
    if (picks[g.id] === side) delete picks[g.id]; else picks[g.id] = side;
    local.set(storeKey, picks);
    if (LFI.cloud && LFI.cloud.savePicks) LFI.cloud.savePicks(league, { [g.id]: picks[g.id] || null });
    // Patch the clicked card in place instead of redrawing the whole slate.
    const card = $("g" + g.id);
    card.querySelectorAll(".tm").forEach((t) => {
      const on = picks[g.id] === t.dataset.s;
      t.classList.toggle("pick", on); t.setAttribute("aria-pressed", on);
    });
    card.querySelector(".g-meta .chip").outerHTML = chipFor(g);
    if (daily) { const t = document.querySelector(`[data-day="${ymdET(g.kickoff)}"] small`), gs = dayGames(ymdET(g.kickoff)), n = gs.filter((x) => picks[x.id]).length;
      if (t) t.textContent = n ? `${n}/${gs.length} picked` : `${gs.length} ${gs.length === 1 ? "game" : "games"}`; }
    renderStrip(); renderSummary();
    if (picks[g.id]) toast(`✅ ${label(g[side])} saved. Locks at ${start}.`);
  });
  $("submitBtn").addEventListener("click", () => {
    const had = !!entries.get(entryId());
    const e = entries.put(entry());
    renderSummary();
    LFI.share(e, { updated: had });
  });
  $("weekSel").addEventListener("change", (e) => { $("weekSel").dataset.moved = "1"; load(daily ? e.target.value : +e.target.value); });

  load().catch(() => { $("days").innerHTML = `<p class="empty">😬 Couldn't load this week's games. Refresh to try again.</p>`; });
  setInterval(() => { if (games.some((g) => g.status === "in")) load(week); }, 60000);
})();
