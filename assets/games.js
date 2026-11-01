/* Last Four In — head-to-head games between friends (live drafts, the grid race, Name Them All races) and challenges, on the accounts
   backend (supabase/50_games.sql). Pages that offer friend play load this after lfi.js; it waits for cloud.js.
   A live game is followed by polling game_get every second or so (no Realtime needed); the server is the referee. */
(function () {
  if (!window.LFI || LFI.games) return;

  // Our own database messages are written for people; anything else becomes one plain sentence.
  const plain = (error) => {
    const m = (error && error.message) || "";
    return /^[A-Z][^{}]*[.!?]$/.test(m) && m.length < 140 ? m : "Something went wrong. Try again.";
  };
  async function cloud() {
    for (let i = 0; i < 100 && !LFI.cloud; i++) await new Promise((r) => setTimeout(r, 50)); // cloud.js loads after lfi.js
    if (!LFI.cloud) return null;
    await LFI.cloud.ready;
    return LFI.cloud;
  }
  async function rpc(fn, args) {
    const c = await cloud();
    if (!c || !c.sb) throw new Error("Sign-in isn't available right now.");
    const { data, error } = await c.sb.rpc(fn, args || {});
    if (error) throw new Error(plain(error));
    return data;
  }

  const rankedCache = new Map(), aiGames = new Set();
  const aiCode = code => /^AI[0-9A-F]{32}$/i.test(code || '');
  const rememberAI = s => { if(s?.ai)aiGames.add(s.id);return s; };
  const aiGame = (id, action = 'get', payload = {}) => rpc('online_ai_game',{p_game:id,p_action:action,p_payload:payload});
  const aiState = g => ({state:g.status==='done'?'done':'matched',id:g.id,code:g.code,kind:g.kind,ai:true,uid:g.uid||g.host.id,result:g.ranked_result||g.result});
  let rankedAccount = null;
  const signature = g => `${g.overtime?.revision ?? ""}|${g.status}|${g.moves.length}|${g.guest?.id || ""}|${!!g.result}|${(g.players || []).map(p => p.id + p.left).join()}`;
  const royaleState=g=>!g?{state:'idle'}:({...g,state:g.status==='open'&&g.ranked?'waiting':!['done','cancelled'].includes(g.status)?'matched':g.status==='cancelled'?'cancelled':'done'});
  // One lightweight progress display shared by the online lobby and direct Draft Battle search.
  function searchProgress(container, deadline) {
    if (!document.querySelector('link[data-match-search-style]')) {
      const style=document.createElement('link');style.rel='stylesheet';style.href='/assets/match-search.css?v=20261101-match15';style.dataset.matchSearchStyle='';document.head.appendChild(style);
    }
    container.hidden=false;container.innerHTML='<div class="match-search"><div class="match-search-head"><span class="match-search-pulse" aria-hidden="true"></span><b class="match-search-label" role="status" aria-live="polite">Searching for an opponent…</b><span class="match-search-time"></span></div><div class="match-search-track" role="progressbar" aria-label="Finding your match" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="match-search-fill"></span></div><p>Your next matchup is on the way.</p></div>';
    const label=container.querySelector('.match-search-label'),time=container.querySelector('.match-search-time'),bar=container.querySelector('.match-search-track'),fill=container.querySelector('.match-search-fill');let last=-1,furthest=0;
    const tick=()=>{const left=Math.max(0,deadline()-Date.now()),elapsed=furthest=Math.max(furthest,0,15000-left),phase=Math.min(3,Math.floor(elapsed/5000)),progress=Math.min(96,elapsed/15000*96);
      if(phase!==last){label.textContent=['Searching for an opponent…','Finding your matchup…','Writing up the game plan…','Getting your match ready…'][phase];last=phase;}
      time.textContent=elapsed<15000&&left>0?Math.ceil(left/1000)+'s':'Almost ready';bar.setAttribute('aria-valuenow',String(Math.round(progress)));fill.style.width=progress+'%';};
    tick();const timer=setInterval(tick,200);return {stop(){clearInterval(timer);container.hidden=true;container.replaceChildren();}};
  }
  const G = {
    searchProgress,
    cloud,
    // Signed in with a finished profile (a handle): what every friend game needs.
    async me() { const c = await cloud(); return c && c.user && c.profile && c.profile.onboarded ? c.profile : null; },
    signInUrl: (next = location.pathname + location.search) => `/signin/?next=${encodeURIComponent(next)}`,
    link: (kind, code) => `${location.origin}${kind === "weekdraft" ? "/play/draft-battle/" : kind === "draft" ? "/drafts/" : kind === "names" ? "/trivia/race.html" : "/grid/"}?g=${code}`,

    create: (kind, o) => rpc("game_create", { p_kind: kind, p_settings: o.settings || {}, p_secret: o.secret || {}, p_total: o.total,
      p_seconds: o.seconds || null, p_host_first: o.hostFirst !== false, p_invite: o.invite || null, p_title: o.title || null }),
    join: async (code) => {if(aiCode(code)){const g=await rpc('online_ai_game',{p_code:code,p_action:'join'});aiGames.add(g.id);return g.id;}return rpc("game_join", { p_code: code });},
    start: (id, countdown) => rpc("game_start", { p_id: id, p_countdown: countdown ?? 5 }), // names races: the host says go
    get: async (id) => {
      const c = await cloud();
      const account = c?.profile?.id || null;
      if (account !== rankedAccount) { rankedCache.clear(); rankedAccount = account; }
      const prior = rankedCache.get(id);
      const next = aiGames.has(id) ? await aiGame(id) : prior ? await rpc("online_poll", { p_id: id, p_signature: signature(prior) }) : await rpc("game_get", { p_id: id });
      if ((c?.profile?.id || null) !== account) throw new Error("Your account changed. Reopen this game.");
      const g = next || prior;
      if (g?.settings?.onlineRanked) { if (rankedCache.size > 20) rankedCache.clear(); rankedCache.set(id, g); }
      if (g) document.dispatchEvent(new CustomEvent("bubble:game", { detail: g }));
      return g;
    },
    onlineFind: async (kind) => {const prior=await rpc('online_ai_resume',{p_kind:kind});if(prior)return rememberAI(prior);const s=await(kind==="weekdraft" ? rpc("weekdraft_find").then(royaleState) : rpc("online_find_v2", { p_kind: kind }));if(s.state!=='waiting')return s;return rememberAI({...s,...await rpc('online_ai_fallback',{p_game:s.id,p_kind:kind})});},
    onlineFallback: (id,kind) => rpc('online_ai_fallback',{p_game:id,p_kind:kind}).then(rememberAI),
    onlineState: (id = null, kind = null) => aiGames.has(id) ? aiGame(id).then(aiState) : kind==="weekdraft" ? rpc("weekdraft_state", { p_game: id }).then(royaleState) : rpc("online_state", { p_game: id }),
    overtimeMove: (id, round, item = null, answer = null) => aiGames.has(id) ? aiGame(id,'overtime',{round,answer}) : rpc("online_overtime_move", { p_game: id, p_round: round, p_item: item, p_answer: answer }),
    onlineCancel: (id, kind = 'names') => rpc('online_ai_cancel_search',{p_game:id,p_kind:kind}).then(rememberAI),
    onlineBoard: (kind) => rpc("online_player_stats", { p_kind: kind }),
    move: (id, item, payload, answer) => aiGames.has(id) ? aiGame(id,'move',{item:String(item),answer}) : rpc("game_move", { p_id: id, p_item: String(item), p_payload: payload || {}, p_answer: answer ?? null }),
    finish: (id, result) => aiGames.has(id) ? aiGame(id,'finish') : rpc("game_finish", { p_id: id, p_result: result }),
    leave: (id) => aiGames.has(id) ? aiGame(id,'leave') : rpc("game_leave", { p_id: id }),
    mine: () => rpc("my_games"),

    challenge: (handle, kind, title, url, note) => rpc("challenge_send", { p_handle: handle, p_kind: kind, p_title: title, p_url: url, p_note: note || null }),
    respond: (id, accept) => rpc("challenge_respond", { p_id: id, p_accept: accept }),
    challenges: () => rpc("challenges_list"),
    count: () => rpc("challenge_count"),
    async friends() {
      const c = await cloud();
      if (!c || !c.friendsBoard) return [];
      try { return (await c.friendsBoard()).filter((f) => !f.is_me); } catch { return []; }
    },

    // Follow a game: calls onUpdate(game) whenever anything changes, until it ends or stop() is called.
    // Slower while the tab is hidden; one failed poll is retried, not reported.
    watch(id, onUpdate, ms = 1100, onConnection = () => {}) {
      let stopped = false, last = "", timer, running = false, queued = false;
      const tick = async () => {
        if (stopped) return;
        if (running) { queued = true; return; }
        running = true;
        try {
          const g = await G.get(id);
          if (stopped) return;
          onConnection("connected");
          const sig = `${g.overtime?.revision ?? ""}|${g.status}|${g.moves.length}|${g.guest && g.guest.id}|${!!g.result}|${(g.players || []).map((p) => p.id + p.left).join()}`;
          if (sig !== last) { last = sig; onUpdate(g); }
          if (g.status === "done" || g.status === "cancelled") stopped = true;
        } catch (e) { if (!stopped) onConnection("reconnecting"); }
        finally {
          running = false;
          if (!stopped) { timer = setTimeout(tick, queued ? 0 : document.hidden ? ms * 4 : ms); queued = false; }
        }
      };
      tick();
      return { stop() { stopped = true; queued = false; clearTimeout(timer); }, poke() { if (stopped) return; clearTimeout(timer); if (running) queued = true; else tick(); } };
    },

    // Share a game link: the phone's share sheet where there is one, else copy.
    async shareLink(url, text) {
      if (navigator.share) {
        try { await navigator.share({ title: "PlayBubble", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
      }
      LFI.toast((await LFI.copyText(url)) ? "Link copied. Send it to your friend." : "Couldn't copy. Long-press the link to share.");
    },
  };
  LFI.games = G;
})();
