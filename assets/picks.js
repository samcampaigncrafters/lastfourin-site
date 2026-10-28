/* Weekly pick'em engine shared by NFL Pick'em (/pickem/) and College Pick'em (/college/).
   Games come straight from ESPN's public scoreboard and picks are kept in this browser. Signed in, every tap
   also goes to the account's picks table (locked server-side at kickoff, graded by the server).
   The page sets window.PICKS = { league: "nfl" | "cfb", name: "NFL Pick'em" } before loading this file. */
(function () {
  const { $, esc, now, local, toast, entries, scoreboard, stripHTML, fmtTime, fmtShort } = LFI;
  const CFG = window.PICKS;
  const league = CFG.league;
  let games = [], week = null, season = null, stype = 2, calendar = [];
  const storeKey = league === "nfl" ? "lfi-preview-picks" : `lfi-picks-${league}`;
  let picks = local.get(storeKey, {});
  const infoOpen = new Set();   // game ids whose "Injuries, preview & news" panel is open, kept across redraws
  const entryId = () => `${league}-${season}-${stype}-${week}`;

  const isOpen = (g) => g.status === "pre" && g.kickoff > now();
  const fmtDay = (d) => d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const label = (t) => (t.rank ? `#${t.rank} ` : "") + (league === "nfl" ? t.nick : t.city);

  async function load(w) {
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
    if (g.status === "in") return `<span class="chip live">● ${esc(g.detail)}</span>`;
    if (g.status === "off") return `<span class="chip lock">${esc(g.detail)}</span>`;
    if (g.status === "post") {
      if (!p) return `<span class="chip lock">Final · no pick</span>`;
      if (g.winner === "tie") return `<span class="chip lock">Final · tie</span>`;
      return g.winner === p ? `<span class="chip ok">✓ Correct</span>` : `<span class="chip no">✗ Missed</span>`;
    }
    if (!isOpen(g)) return `<span class="chip lock">🔒 Locked</span>`;
    return p ? `<span class="chip ok">Picked</span>` : `<span class="chip">Open</span>`;
  }

  function render() {
    $("title").textContent = `${CFG.name} · Week ${week}`;
    $("stripWeek").textContent = `Week ${week}`;
    renderStrip(); renderGames(); renderSummary();
  }
  function renderStrip() { $("strip").innerHTML = stripHTML(games, picks); }

  function renderGames() {
    if (!games.length) { $("days").innerHTML = `<p class="empty">No games on the board for this week.</p>`; return; }
    let html = "", day = "";
    for (const g of games) {
      const d = fmtDay(g.kickoff);
      if (d !== day) { if (day) html += "</div>"; html += `<div class="day">${esc(d)}</div><div class="games">`; day = d; }
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
    $("progN").textContent = `${made} of ${games.length} picked`;
    $("progBar").style.width = games.length ? (made / games.length) * 100 + "%" : "0";
    const next = games.find(isOpen);
    $("deadline").textContent = next ? `Next lock ${fmtShort(next.kickoff)}` : "All games locked";

    const r = record();
    const pending = games.filter((g) => picks[g.id] && g.status !== "post").length;
    $("wkChip").textContent = `Week ${week}`;
    $("myWeek").innerHTML = `<div style="display:flex;gap:24px;align-items:end">
        <div><div class="disp" style="font-size:48px">${r.right}-${r.wrong}</div><div class="empty" style="padding:0">Record</div></div>
        <div><div class="disp" style="font-size:48px;color:var(--muted)">${pending}</div><div class="empty" style="padding:0">Still to play</div></div>
      </div>`;

    // Submit state. Picks save as you tap; submitting adds the week to your account and opens the share pop-up.
    const saved = entries.get(entryId());
    const btn = $("submitBtn");
    btn.disabled = !made || !next;
    btn.textContent = saved ? "Update & share my picks" : "Submit my picks";
    $("submitNote").textContent = !next ? "This week is locked." : saved ? `Submitted. Change any pick before its game kicks off, then update.` : made < games.length ? `${games.length - made} game${games.length - made === 1 ? "" : "s"} left. Submit any time; you can change picks until kickoff.` : "Every game picked. Lock it in.";
    if (saved && r.graded) entries.patch(entryId(), { result: `${r.right}-${r.wrong}` + (r.graded < games.length ? " so far" : "") });
  }

  function entry() {
    const list = games.filter((g) => picks[g.id]).map((g) => {
      const side = picks[g.id], other = side === "home" ? "away" : "home";
      return { p: label(g[side]), o: label(g[other]), a: g[side].abbr };
    });
    const r = record();
    return {
      id: entryId(), kind: league, title: `${CFG.name} · Week ${week}`, sub: `${list.length} of ${games.length} picked`,
      result: r.graded ? `${r.right}-${r.wrong}` : "", url: CFG.url, data: { picks: list },
      shareText: league === "nfl" ? `My NFL picks for Week ${week} are in on Last Four In. Think you can beat me?` : `My college football picks for Week ${week} are in on Last Four In. Think you can beat me?`,
    };
  }

  $("days").addEventListener("click", (e) => {
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
    if (!isOpen(g)) { toast("That game has kicked off. Picks are locked."); return; }
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
    renderStrip(); renderSummary();
    if (picks[g.id]) toast(`${label(g[side])} saved. Locks at kickoff.`);
  });
  $("submitBtn").addEventListener("click", () => {
    const had = !!entries.get(entryId());
    const e = entries.put(entry());
    renderSummary();
    LFI.share(e, { updated: had });
  });
  $("weekSel").addEventListener("change", (e) => load(+e.target.value));

  load().catch(() => { $("days").innerHTML = `<p class="empty">Couldn't load this week's games. Refresh to try again.</p>`; });
  setInterval(() => { if (games.some((g) => g.status === "in")) load(week); }, 60000);
})();
