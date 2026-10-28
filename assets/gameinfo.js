/* "Injuries & preview" panel under each pick'em game (/pickem/ and /college/).
   Opens on tap and loads only then: ESPN's game summary (line, win chance, form, leaders, injuries, venue, recap)
   plus each team's ESPN news feed, kept to stories actually about one of the two teams.
   picks.js calls LFI.gameInfo(league, game, panelEl). Everything is cached per game for the page visit. */
(function () {
  const { esc } = LFI;
  const BASE = {
    nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl",
    cfb: "https://site.api.espn.com/apis/site/v2/sports/football/college-football",
  };
  const cache = {};
  const getJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });

  // Worst news first; anyone listed as active is left off.
  const SEV = { "Out": 0, "Injured Reserve": 1, "Physically Unable to Perform": 1, "Suspension": 2, "Doubtful": 3, "Questionable": 4, "Day-To-Day": 5, "Probable": 6 };
  const sev = (s) => (s in SEV ? SEV[s] : 7);
  const statusClass = (s) => (sev(s) <= 2 ? "out" : sev(s) === 3 ? "doubt" : "q");
  const shortStatus = (s) => ({ "Injured Reserve": "IR", "Physically Unable to Perform": "PUP", "Day-To-Day": "Day-to-day" }[s] || s);

  async function load(league, g) {
    if (cache[g.id]) return cache[g.id];
    const base = BASE[league];
    const team = (id) => getJSON(`${base}/news?team=${id}&limit=12`).catch(() => ({ articles: [] }));
    cache[g.id] = Promise.all([getJSON(`${base}/summary?event=${g.id}`), team(g.away.id), team(g.home.id)])
      .then(([sum, an, hn]) => ({ sum, news: pickNews(g, [an, hn, sum.news || {}]) }))
      .catch((e) => { delete cache[g.id]; throw e; });
    return cache[g.id];
  }

  // Keep stories tagged to one of these two teams and at most a few others (drops the 32-team power rankings).
  function pickNews(g, feeds) {
    const ids = [g.away.id, g.home.id], seen = new Set(), out = [];
    for (const f of feeds) for (const a of f.articles || []) {
      const tags = (a.categories || []).filter((c) => c.type === "team").map((c) => String(c.teamId || (c.team && c.team.id)));
      const url = a.links && a.links.web && a.links.web.href;
      if (!url || seen.has(url) || !tags.some((t) => ids.includes(t)) || tags.length > 4) continue;
      seen.add(url);
      out.push({ headline: a.headline, desc: a.description || "", url: url.replace(/^http:/, "https:"), when: new Date(a.published || a.lastModified), premium: !!a.premium });
    }
    return out.sort((x, y) => y.when - x.when).slice(0, 5);
  }

  const ago = (d) => {
    const h = Math.round((Date.now() - d) / 36e5);
    return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
  };
  const nameOf = (league, t) => (league === "nfl" ? t.nick : t.city);

  function injuries(sum, t) {
    const block = (sum.injuries || []).find((x) => x.team && String(x.team.id) === String(t.id));
    return (block ? block.injuries : [])
      .filter((i) => i.status && i.status !== "Active")
      .map((i) => ({
        name: i.athlete.displayName, pos: (i.athlete.position || {}).abbreviation || "", status: i.status,
        what: [i.details && i.details.side !== "Not Specified" ? i.details.side : "", i.details && i.details.type, i.details && i.details.detail !== "Not Specified" ? i.details.detail : ""].filter(Boolean).join(" ").toLowerCase(),
      }))
      .sort((a, b) => sev(a.status) - sev(b.status));
  }

  function form(sum, t) {
    const f = (sum.lastFiveGames || []).find((x) => String(x.team.id) === String(t.id));
    return f ? f.events.map((e) => e.gameResult).filter(Boolean) : [];
  }

  function leaders(sum, t) {
    const L = (sum.leaders || []).find((x) => String(x.team.id) === String(t.id));
    if (!L) return [];
    const want = { passingYards: "Pass", rushingYards: "Rush", receivingYards: "Rec" };
    return (L.leaders || []).filter((c) => want[c.name] && c.leaders && c.leaders[0]).map((c) => {
      const p = c.leaders[0];
      return { cat: want[c.name], name: p.athlete.shortName || p.athlete.displayName, line: p.displayValue };
    });
  }

  function line(sum) {
    const o = (sum.pickcenter && sum.pickcenter[0]) || (sum.odds && sum.odds[0]);
    return o && o.details ? { details: o.details, total: o.overUnder } : null;
  }

  // One plain-English paragraph built from the numbers above. Only facts ESPN published; no predictions of our own.
  function summary(league, g, sum, inj) {
    // NFL reads "the Packers" mid-sentence; sentences are capitalised once at the end.
    const the = (t) => (league === "nfl" ? `the ${t.nick}` : t.city);
    const A = the(g.away), H = the(g.home), s = [];
    // NFL names are plural nicknames ("the Packers have"), college names are schools ("Ohio State has").
    const have = league === "nfl" ? "have" : "has";
    if (g.status === "post" && sum.article && sum.article.headline) return null;
    const ln = line(sum), pr = sum.predictor;
    if (ln && ln.details && ln.details !== "EVEN") {
      const [fav, pts = ""] = ln.details.split(" ");
      const favName = fav === g.home.abbr ? H : fav === g.away.abbr ? A : fav;
      const n = pts.replace("-", ""), neutral = ((sum.header && sum.header.competitions) || [{}])[0].neutralSite;
      const where = neutral ? "" : favName === H ? " at home" : " on the road";
      s.push(`${favName} ${league === "nfl" ? `are ${n}-point favorites` : `is a ${n}-point favorite`}${where}${ln.total ? `, with the total set at ${ln.total}` : ""}.`);
    } else if (ln && ln.details === "EVEN") s.push(`The books have this one as a pick'em.`);
    if (pr && pr.homeTeam && pr.awayTeam) {
      const h = parseFloat(pr.homeTeam.gameProjection), a = parseFloat(pr.awayTeam.gameProjection);
      if (h || a) s.push(`ESPN's matchup predictor gives ${h >= a ? H : A} a ${Math.round(Math.max(h, a))}% chance to win.`);
    }
    const fa = form(sum, g.away), fh = form(sum, g.home);
    const w = (f) => f.filter((r) => r === "W").length;
    if (fa.length && fh.length) s.push(`${A} ${g.away.rec ? `(${g.away.rec}) ` : ""}${have} won ${w(fa)} of the last ${fa.length}; ${H} ${g.home.rec ? `(${g.home.rec}) ` : ""}${have} won ${w(fh)} of ${fh.length}.`);
    if (league === "nfl") {
      const outs = (list) => list.filter((i) => sev(i.status) <= 3);
      const oa = outs(inj.away), oh = outs(inj.home);
      const say = (n, list) => list.length ? `${n} have ${list.length === 1 ? "one player" : `${list.length} players`} out or doubtful${list.length <= 2 ? ` (${list.map((i) => `${i.pos} ${i.name}`).join(", ")})` : ""}` : `${n} have nobody ruled out yet`;
      s.push(`${say(A, oa)}; ${say(H, oh)}.`);
    }
    return s.map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(" ");
  }

  function injTable(list) {
    if (!list.length) return `<p class="gi-none">No one on the injury report.</p>`;
    return `<ul class="gi-inj">${list.map((i) => `<li><span class="gi-st ${statusClass(i.status)}">${esc(shortStatus(i.status))}</span>
      <span class="gi-pl"><b>${esc(i.name)}</b> <small>${esc(i.pos)}</small></span><span class="gi-what">${esc(i.what)}</span></li>`).join("")}</ul>`;
  }

  function render(league, g, { sum, news }) {
    const inj = { away: injuries(sum, g.away), home: injuries(sum, g.home) };
    const venue = sum.gameInfo && sum.gameInfo.venue, wx = sum.gameInfo && sum.gameInfo.weather;
    const ln = line(sum);
    const facts = [
      ln ? `Line <b>${esc(ln.details)}</b>${ln.total ? ` · O/U <b>${esc(ln.total)}</b>` : ""}` : "",
      venue ? `${esc(venue.fullName)}${venue.address && venue.address.city ? `, ${esc(venue.address.city)}` : ""}` : "",
      wx && wx.temperature != null && g.status === "pre" ? `${esc(wx.temperature)}°${wx.precipitation ? ` · ${esc(wx.precipitation)}% rain` : ""}` : "",
    ].filter(Boolean);
    const recap = g.status === "post" && sum.article && sum.article.headline
      ? `<p class="gi-sum"><b>Final.</b> ${esc(sum.article.headline)}${sum.article.description ? ". " + esc(sum.article.description.replace(/^—\s*/, "")) : ""}</p>` : "";
    const para = summary(league, g, sum, inj);

    const teamCol = (ha) => {
      const t = g[ha], f = form(sum, t), ld = leaders(sum, t);
      return `<div class="gi-team" style="--tc:${LFI.fillColor(t.color)}">
        <h4>${esc(nameOf(league, t))}${t.rec ? ` <small>${esc(t.rec)}</small>` : ""}</h4>
        ${f.length ? `<div class="gi-form" aria-label="Last ${f.length} games">${f.map((r) => `<i class="${r === "W" ? "w" : r === "L" ? "l" : ""}">${esc(r)}</i>`).join("")}<small>last ${f.length}</small></div>` : ""}
        ${ld.length ? `<ul class="gi-lead">${ld.map((p) => `<li><small>${p.cat}</small> <b>${esc(p.name)}</b> ${esc(p.line)}</li>`).join("")}</ul>` : ""}
        ${league === "nfl" ? `<div class="gi-lbl">Injury report</div>${injTable(inj[ha])}` : ""}
      </div>`;
    };

    return `${recap}${para ? `<p class="gi-sum">${esc(para)}</p>` : ""}
      ${facts.length ? `<div class="gi-facts">${facts.map((f) => `<span>${f}</span>`).join("")}</div>` : ""}
      <div class="gi-teams">${teamCol("away")}${teamCol("home")}</div>
      ${league === "nfl" ? "" : `<p class="gi-none">Injury report: colleges don't publish a public injury feed, so check the team news below.</p>`}
      <div class="gi-lbl">Latest news</div>
      ${news.length ? `<ul class="gi-news">${news.map((n) => `<li><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.headline)}</a>
          <small>ESPN · ${ago(n.when)}${n.premium ? " · ESPN+" : ""}</small></li>`).join("")}</ul>` : `<p class="gi-none">No team news this week yet.</p>`}
      <p class="gi-src">Injuries, odds and news from ESPN, updated live.</p>`;
  }

  LFI.gameInfo = async function (league, g, el) {
    if (el.dataset.loaded) return;
    el.innerHTML = `<p class="gi-none">Loading injuries and news…</p>`;
    try {
      el.innerHTML = render(league, g, await load(league, g));
      el.dataset.loaded = "1";
    } catch (e) {
      el.innerHTML = `<p class="gi-none">Couldn't load the preview. Close and open it to try again.</p>`;
    }
  };
})();
