/* Read-only scores and posted pregame prices. No wagers, saved picks or performance claims. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BubbleLiveBoard = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const ENDPOINT = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
  const REFRESH_MS = 30000;
  const number = value => value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  const signed = value => value == null ? '—' : (value > 0 ? '+' : value < 0 ? '−' : '') + Math.abs(value);
  const quote = side => side && (side.current || side.close || side.open) || {};
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const teamCircle = (code, color) => typeof LFI !== 'undefined' && LFI.scoreMark ? LFI.scoreMark(code, '', 's', color) : `<b>${esc(code)}</b>`;

  function read(event) {
    const c = event.competitions && event.competitions[0];
    if (!c) return null;
    const home = c.competitors.find(x => x.homeAway === 'home');
    const away = c.competitors.find(x => x.homeAway === 'away');
    if (!home || !away) return null;
    const s = event.status || c.status || {}, t = s.type || {};
    const state = t.completed ? 'final' : t.state === 'in' ? 'live' : t.state === 'pre' ? 'upcoming' : 'off';
    const o = (c.odds || [])[0] || {};
    const ps = o.pointSpread || {}, total = o.total || {}, moneyline = o.moneyline || {};
    const price = (group, side) => number(quote(group[side]).odds);
    let spread = number(quote(ps.home).line);
    if (spread == null) spread = number(o.spread);
    if (spread == null && o.details) {
      const m = /^([A-Z]+)\s+([+-]?[\d.]+)$/.exec(o.details);
      if (m) spread = Math.abs(Number(m[2])) * (m[1] === home.team.abbreviation ? -1 : 1);
      else if (/even|pick|pk/i.test(o.details)) spread = 0;
    }
    const totalQuote = quote(total.over).line;
    const lineTotal = number(o.overUnder) ?? (totalQuote ? number(String(totalQuote).replace(/^[ou]/i, '')) : null);
    const openTotal = total.over && total.over.open && total.over.open.line;
    const hScore = number(home.score), aScore = number(away.score);
    const hasScore = state === 'live' || state === 'final';
    const homeMargin = hasScore && hScore != null && aScore != null ? hScore - aScore : null;
    return { id: String(event.id), state, detail: t.shortDetail || t.detail || t.description || 'Status unavailable',
      date: event.date, home: home.team.abbreviation, away: away.team.abbreviation, hColor: home.team.color, aColor: away.team.color,
      hScore: hasScore ? hScore : null, aScore: hasScore ? aScore : null,
      spread, total: lineTotal, hML: price(moneyline, 'home') ?? number((o.homeTeamOdds || {}).moneyLine),
      aML: price(moneyline, 'away') ?? number((o.awayTeamOdds || {}).moneyLine),
      openSpread: number(ps.home && ps.home.open && ps.home.open.line),
      openTotal: openTotal ? number(String(openTotal).replace(/^[ou]/i, '')) : null,
      spreadPrice: price(ps, 'home'), overPrice: price(total, 'over'), underPrice: price(total, 'under'),
      homeMargin, totalPoints: homeMargin == null ? null : hScore + aScore,
      coverMargin: homeMargin == null || spread == null ? null : homeMargin + spread };
  }

  function card(g) {
    const score = x => x == null ? '—' : x;
    const margin = g.coverMargin == null ? '' : g.coverMargin > 0 ? `${g.home} ${g.state === 'final' ? 'covered' : 'covering'} by ${Math.abs(g.coverMargin)}`
      : g.coverMargin < 0 ? `${g.away} ${g.state === 'final' ? 'covered' : 'covering'} by ${Math.abs(g.coverMargin)}` : g.state === 'final' ? 'Spread push' : 'Level with spread';
    const change = g.spread != null && g.openSpread != null ? g.spread - g.openSpread : null;
    const spread = g.spread == null ? 'Unavailable' : `${g.home} ${g.spread === 0 ? 'PK' : signed(g.spread)}`;
    return `<article class="lb-game" data-state="${g.state}">
      <div class="lb-game-head"><span class="lb-state ${g.state}">${g.state === 'live' ? '● Live' : g.state === 'final' ? 'Final' : g.state === 'upcoming' ? 'Upcoming' : 'Not active'}</span><span>${esc(g.detail)}</span></div>
      <div class="lb-score"><div>${teamCircle(g.away,g.aColor)}<strong>${score(g.aScore)}</strong></div><span>@</span><div>${teamCircle(g.home,g.hColor)}<strong>${score(g.hScore)}</strong></div></div>
      <div class="lb-quotes">
        <div><span>Pregame spread</span><b>${esc(spread)}</b><small>${g.openSpread == null ? 'Opening quote unavailable' : `Opened ${esc(g.home)} ${signed(g.openSpread)}${change ? ` · moved ${signed(change)} pts` : ''}`}</small></div>
        <div><span>Pregame total</span><b>${g.total == null ? 'Unavailable' : `O/U ${g.total}`}</b><small>${g.openTotal == null ? 'Opening quote unavailable' : `Opened ${g.openTotal}`}</small></div>
        <div><span>Pregame moneyline</span><b>${esc(g.away)} ${signed(g.aML)} · ${esc(g.home)} ${signed(g.hML)}</b><small>Latest posted quote</small></div>
      </div>
      ${g.homeMargin == null ? '' : `<div class="lb-progress"><span>${esc(margin || 'Spread unavailable')}</span><span>${g.totalPoints} total points${g.total == null ? '' : ` / ${g.total} line`}</span><small>${g.state === 'final' ? 'Against the displayed pregame line.' : 'Current score against the pregame line; the game is not final.'}</small></div>`}
      <button type="button" class="lb-analysis" data-analysis="${esc(g.id)}" aria-haspopup="dialog" aria-label="${esc(g.away)} at ${esc(g.home)}: View model analysis">View model analysis ↗</button>
    </article>`;
  }

  function mount(el, options = {}) {
    if (!el || el.dataset.mounted) return;
    el.dataset.mounted = 'true';
    if(options.embedded){
      let busy=false,timer;
      const update=async()=>{if(busy||document.hidden)return;busy=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
        try{const response=await fetch(ENDPOINT,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();const data=await response.json();if(!Array.isArray(data.events))throw Error();const games=data.events.map(read).filter(Boolean);options.onUpdate?.(games);el.textContent='Scores and game clocks refresh every 30 seconds · Last received '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+'. Odds shown are pregame lines.';}
        catch(_){el.textContent='Score update unavailable. Showing the last scores received; retrying automatically.';}finally{clearTimeout(timeout);busy=false;}
      };
      const start=()=>{if(!timer)timer=setInterval(update,REFRESH_MS);update();};start();window.addEventListener('pagehide',()=>{clearInterval(timer);timer=null;});window.addEventListener('pageshow',e=>{if(e.persisted)start();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});return;
    }

    const snapshot = new URLSearchParams(location.search).get('review') === '1';
    el.innerHTML = `<div class="lb-heading"><div><div class="kicker">🏈 Scores + lines</div><h2 class="disp">Game tracker</h2></div><button type="button" class="btn" data-refresh>Refresh scores</button></div>
      <p class="lb-explain">Scores and game clock update while this page is open. Opening and latest pregame quotes sit beside each game. In-game odds are not connected.</p>
      <div class="lb-tools"><div class="modes" role="group" aria-label="Filter game tracker">${[['all','All games'],['live','Live'],['upcoming','Upcoming'],['final','Final']].map(([key,name])=>`<button type="button" data-filter="${key}" aria-pressed="${key==='all'}">${name}</button>`).join('')}</div><span class="lb-status" role="status" aria-live="polite">Loading scores…</span></div>
      <div class="lb-grid"></div>`;
    const grid = el.querySelector('.lb-grid'), status = el.querySelector('.lb-status'), refresh = el.querySelector('[data-refresh]');
    let games = [], selected = 'all', busy = false, timer, lastUpdate = null, failed = false;
    let dialog, activeGameId = null, previousOverflow = '';
    function modalScore(game) {
      return `<div class="lb-modal-score"><span>${esc(game.detail)}</span><b>${esc(game.away)} ${game.aScore == null ? '—' : game.aScore}<i> @ </i>${esc(game.home)} ${game.hScore == null ? '—' : game.hScore}</b></div>`;
    }
    function openAnalysis(id) {
      const game = games.find(g => g.id === id);
      if (!game) return;
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.className = 'lb-modal';
        dialog.setAttribute('role','dialog');
        dialog.setAttribute('aria-modal','true');
        dialog.setAttribute('aria-labelledby','lb-modal-title');
        dialog.setAttribute('data-free','');
        document.body.appendChild(dialog);
        dialog.addEventListener('click',event=>{
          if (event.target.closest('[data-close-analysis]')) return dialog.close();
          if (event.target === dialog) {
            const r=dialog.getBoundingClientRect();
            if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
          }
        });
        dialog.addEventListener('close',()=>{
          document.documentElement.style.overflow=previousOverflow;
          const trigger=[...el.querySelectorAll('[data-analysis]')].find(b=>b.dataset.analysis===activeGameId);
          if(trigger)trigger.focus({preventScroll:true});
          activeGameId=null;
        });
      }
      activeGameId=id;
      dialog.innerHTML=`<div class="lb-modal-top"><div><div class="lb-modal-kicker">Pregame model analysis</div><h2 id="lb-modal-title">${esc(game.away)} <span>@</span> ${esc(game.home)}</h2></div><button type="button" class="lb-modal-close" data-close-analysis aria-label="Close model analysis">✕</button></div>
        <div data-modal-score>${modalScore(game)}</div>
        <div class="lb-modal-key"><span class="lb-key-lean">● Model lean</span><span class="lb-key-caution">● Caution</span></div>
        <p class="lb-modal-note">Green marks the model's lean; red marks cautions or misses. Prices may have moved since this analysis was loaded.</p>
        <div class="lb-modal-content"></div>`;
      const target=dialog.querySelector('.lb-modal-content');
      const source=document.getElementById('g'+id);
      if(source) {
        const copy=source.cloneNode(true);
        copy.removeAttribute('id');
        copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
        copy.querySelectorAll('summary').forEach(node=>node.setAttribute('tabindex','0'));
        copy.querySelectorAll('.gm-top,.gm-teams').forEach(node=>node.remove());
        target.appendChild(copy);
      } else target.innerHTML='<p class="lb-analysis-pending">Model analysis has not loaded for this game. Close this window and try again once the model cards appear.</p>';
      previousOverflow=document.documentElement.style.overflow;
      document.documentElement.style.overflow='hidden';
      dialog.showModal();
      dialog.querySelector('[data-close-analysis]').focus();
    }
    grid.addEventListener('click',event=>{
      const button=event.target.closest('[data-analysis]');
      if(button)openAnalysis(button.dataset.analysis);
    });
    const paint = () => {
      const visible = games.filter(g => selected === 'all' || g.state === selected);
      grid.innerHTML = visible.length ? visible.map(card).join('') : `<p class="lb-empty">${selected==='live' ? 'No NFL games are live right now.' : selected==='all' ? 'No games available.' : `No ${selected} games in this slate.`}</p>`;
    };
    function showStatus() {
      const time = lastUpdate && lastUpdate.toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'});
      status.classList.toggle('lb-stale', failed);
      status.textContent = snapshot ? 'Preview snapshot • not a live feed' : failed ? `Update failed. ${time ? `Showing the last feed received at ${time}.` : 'Retrying automatically.'}`
        : document.hidden ? `Updates paused while this tab is hidden${time ? ` · Last received ${time}` : ''}` : `Received ${time} · refreshes every 30 sec`;
    }
    async function update() {
      if (busy || document.hidden) return;
      busy = true; refresh.disabled = true;
      const controller = new AbortController(), timeout = setTimeout(()=>controller.abort(),12000);
      try {
        const response = await fetch(ENDPOINT,{cache:'no-store',signal:controller.signal});
        if (!response.ok) throw new Error('Score feed unavailable');
        const data = await response.json();
        if (!Array.isArray(data.events)) throw new Error('Invalid score feed');
        games = data.events.map(read).filter(Boolean).sort((a,b)=>(a.state==='live' ? 0 : a.state==='upcoming' ? 1 : 2)-(b.state==='live' ? 0 : b.state==='upcoming' ? 1 : 2)||new Date(a.date)-new Date(b.date));
        if(dialog && dialog.open) {
          const current=games.find(g=>g.id===activeGameId);
          if(current)dialog.querySelector('[data-modal-score]').innerHTML=modalScore(current);
        }
        failed = false; lastUpdate = new Date(); paint(); showStatus();
      } catch (_) {
        failed = true; showStatus();
        if (!games.length) grid.innerHTML='<p class="lb-empty">Scores could not load. Use Refresh scores to retry.</p>';
      } finally {clearTimeout(timeout); busy=false; refresh.disabled=false;}
    }
    el.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
      selected=button.dataset.filter;
      el.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      paint();
    }));
    refresh.addEventListener('click',update);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();else if(lastUpdate)showStatus();});
    const startTimer=()=>{if(!timer)timer=setInterval(update,REFRESH_MS);};
    window.addEventListener('pagehide',()=>{clearInterval(timer);timer=null;});
    window.addEventListener('pageshow',event=>{if(event.persisted){startTimer();update();}});
    startTimer();
    update();
  }
  return { read, card, signed, mount };
});
