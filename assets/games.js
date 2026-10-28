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

  const G = {
    cloud,
    // Signed in with a finished profile (a handle): what every friend game needs.
    async me() { const c = await cloud(); return c && c.user && c.profile && c.profile.onboarded ? c.profile : null; },
    signInUrl: (next = location.pathname + location.search) => `/signin/?next=${encodeURIComponent(next)}`,
    link: (kind, code) => `${location.origin}${kind === "draft" ? "/drafts/" : kind === "names" ? "/trivia/race.html" : "/grid/"}?g=${code}`,

    create: (kind, o) => rpc("game_create", { p_kind: kind, p_settings: o.settings || {}, p_secret: o.secret || {}, p_total: o.total,
      p_seconds: o.seconds || null, p_host_first: o.hostFirst !== false, p_invite: o.invite || null, p_title: o.title || null }),
    join: (code) => rpc("game_join", { p_code: code }),
    start: (id, countdown) => rpc("game_start", { p_id: id, p_countdown: countdown ?? 5 }), // names races: the host says go
    get: (id) => rpc("game_get", { p_id: id }),
    move: (id, item, payload, answer) => rpc("game_move", { p_id: id, p_item: String(item), p_payload: payload || {}, p_answer: answer ?? null }),
    finish: (id, result) => rpc("game_finish", { p_id: id, p_result: result }),
    leave: (id) => rpc("game_leave", { p_id: id }),
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
    watch(id, onUpdate, ms = 1100) {
      let stopped = false, last = "", timer;
      const tick = async () => {
        if (stopped) return;
        try {
          const g = await G.get(id);
          const sig = `${g.status}|${g.moves.length}|${g.guest && g.guest.id}|${!!g.result}|${(g.players || []).map((p) => p.id + p.left).join()}`;
          if (sig !== last) { last = sig; onUpdate(g); }
          if (g.status === "done" || g.status === "cancelled") return;
        } catch (e) { /* network blip: try again */ }
        timer = setTimeout(tick, document.hidden ? ms * 4 : ms);
      };
      tick();
      return { stop() { stopped = true; clearTimeout(timer); }, poke() { clearTimeout(timer); tick(); } };
    },

    // Share a game link: the phone's share sheet where there is one, else copy.
    async shareLink(url, text) {
      if (navigator.share) {
        try { await navigator.share({ title: "Last Four In", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
      }
      LFI.toast((await LFI.copyText(url)) ? "Link copied. Send it to your friend." : "Couldn't copy. Long-press the link to share.");
    },
  };
  LFI.games = G;
})();
