/* Last Four In — accounts. Sign-in (Google + email link) through Supabase, picks and entries saved to the
   account, public profiles, posts, comments and moderation. Loaded on every page by lfi.js.
   Until SUPABASE_URL is filled in, the site keeps working exactly as before: everything stays in this browser.
   The key below is Supabase's public "anon" key. It is meant to be in the page; the database's row rules
   decide what it can do. Never put the service_role key here. */
(function () {
  if (!window.LFI || LFI.cloud) return;
  const SUPABASE_URL = "https://qojwjpdxxrbtuwcrfflh.supabase.co";
  const SUPABASE_KEY = "sb_publishable_3Zmtc_IUFi77Kcx8JjYOXw_4l3N2N_2";
  const SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";

  const { local, entries, esc, toast } = LFI;
  const on = !!(SUPABASE_URL && SUPABASE_KEY);
  if (!document.querySelector('link[href="/assets/social.css"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/assets/social.css"; document.head.appendChild(l);
  }
  window.LFI_CLOUD_ON = on;
  const listeners = [];
  const AGE_BLOCK = "lfi-age-block";

  const cloud = {
    on, sb: null, user: null, profile: null,
    onChange(fn) { listeners.push(fn); if (cloud.ready.done) fn(cloud); },
  };
  LFI.cloud = cloud;
  const emit = () => { LFI.setMe(cloud.profile); listeners.forEach((fn) => { try { fn(cloud); } catch (e) { console.error(e); } }); };

  let readyResolve;
  cloud.ready = new Promise((r) => { readyResolve = r; });
  const markReady = () => { if (!cloud.ready.done) { cloud.ready.done = true; readyResolve(cloud); } };

  // ---- "Create account" pop-up: what a signed-out visitor sees when they reach for something that needs one ----
  // LFI.needAccount(reason, next) is true when the action can go ahead; otherwise it opens the pop-up and is false.
  // Any button or link with data-account="<reason>" gets the same check before its own click handler runs.
  // Sam, 2026-10-28: every game needs an account. Signed out, any play control on a game page (buttons, fields,
  // anything clickable outside the nav and pop-ups) opens the pop-up instead; plain links still browse.
  const WHY = {
    picks: ["📋", "Save your picks", "Make a free account to keep your picks on every device, get graded and climb the leaderboard."],
    post: ["📣", "Post it to your profile", "Make a free account to post your picks, keep a record friends can follow and get on the leaderboard."],
    contest: ["🏆", "Enter the contest", "Make a free account to enter, get graded and see where you finish on the leaderboard."],
    challenge: ["⚔️", "Challenge your friends", "Make a free account so the site can referee. Then send the link and play live."],
    leaderboard: ["🏆", "See the leaderboard", "Make a free account to get on the leaderboard and see how you stack up against your friends."],
    friends: ["👋", "Add friends", "Make a free account to add friends, follow their picks and challenge them."],
    comment: ["💬", "Join the conversation", "Make a free account to comment on picks and posts."],
    pool: ["👥", "Start a pool", "Make a free account to start a private pool with your friends. Your normal picks count."],
    money: ["💰", "Get your $1,000", "Make a free account to get your $1,000 for the week and place bets. Pretend money, no prize."],
    play: ["🎮", "Make your free account to play", "Every game on Last Four In runs on a free account. It takes 30 seconds, then you're straight back in."],
  };
  const accountReady = () => !on || !!(cloud.profile && cloud.profile.onboarded);
  let pop;
  function accountPop(reason, next) {
    const [emo, title, body] = WHY[reason] || ["🔑", "Make a free account", reason || "Make a free account to keep your picks on every device and get on the leaderboard."];
    const half = !!cloud.user; // signed in, handle not picked yet
    if (!pop) {
      pop = document.createElement("div");
      pop.className = "ov acct-pop"; pop.hidden = true;
      pop.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="apH">
        <div class="dlg-h"><div><div class="kicker">Free account · 30 seconds <span class="em" aria-hidden="true">⚡</span></div><h2 class="disp" id="apH"></h2></div>
          <button class="dlg-x" type="button" data-x aria-label="Close">×</button></div>
        <div class="dlg-b"><div class="acct-emo" aria-hidden="true"></div><p class="acct-why"></p>
          <div class="share-acts"><a class="btn gold big" data-go></a><button class="btn" type="button" data-x>Not now</button></div>
          <p class="acct-fine">Free forever. Sign in with Google or an email link, no password.</p></div></div>`;
      document.body.appendChild(pop);
      pop.addEventListener("click", (ev) => { if (ev.target === pop || ev.target.closest("[data-x]")) closePop(); });
      document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && pop && !pop.hidden) closePop(); });
    }
    pop.querySelector("#apH").textContent = half ? "Finish your profile" : title;
    pop.querySelector(".acct-emo").textContent = emo;
    pop.querySelector(".acct-why").textContent = half ? "Pick a handle and you're in. It takes a few seconds." : body;
    const go = pop.querySelector("[data-go]");
    go.href = `/signin/?next=${encodeURIComponent(next || location.pathname + location.search + location.hash)}`;
    go.innerHTML = half ? `Finish my profile <span class="em" aria-hidden="true">✅</span>` : `Create account <span class="em" aria-hidden="true">🚀</span>`;
    pop.lastFocus = document.activeElement;
    pop.hidden = false; document.body.style.overflow = "hidden";
    setTimeout(() => go.focus(), 30);
  }
  function closePop() {
    pop.hidden = true;
    if (!document.querySelector(".ov:not([hidden])")) document.body.style.overflow = "";
    if (pop.lastFocus && pop.lastFocus.focus) pop.lastFocus.focus();
  }
  LFI.needAccount = (reason, next) => {
    if (accountReady()) return true;
    // Still finding out who this is (first moment after load): ask once we know, so a signed-in player never sees it.
    if (!cloud.ready.done) { cloud.ready.then(() => { if (!accountReady()) accountPop(reason, next); }); return false; }
    accountPop(reason, next);
    return false;
  };
  // Pages anyone can use signed out; everything else is a game.
  const OPEN = /^\/(signin|account|terms|privacy|mod|404)(\/|\.html|$)/;
  const PAGE_WHY = [[/^\/(pickem|college|nba|nhl|mlb|ncaab|pools)\//, "picks"], [/^\/money\//, "money"], [/^\/(bracket|ap-poll)\//, "contest"],
                    [/^\/(friends|challenges)\//, "friends"]];
  const CHROME = "header, footer, .nav, .nav-leagues, .mmenu, .dd-panel, .ov, .toast, [data-free]";
  const PLAY = "button, input, select, textarea, label, summary, [role=button], [tabindex], [contenteditable], [draggable=true]";
  // Before the account check finishes, a saved session in this browser counts as signed in, so nobody signed in gets nagged.
  const SESSION = `sb-${(SUPABASE_URL.match(/\/\/([^.]+)/) || [])[1]}-auth-token`;
  const signedOut = () => {
    if (!on) return false;
    if (cloud.ready.done) return !accountReady(); // includes signed in without a handle yet
    try { return !localStorage.getItem(SESSION); } catch (e) { return true; }
  };
  function walled(t) {
    if (!t || !t.closest || OPEN.test(location.pathname) || t.closest(CHROME)) return null;
    const a = t.closest("a[href]");
    if (a && !a.matches("[data-account]")) return null; // links still browse
    const el = t.closest(PLAY);
    if (el) return el;
    for (let e = t, i = 0; e && e !== document.body && i < 6; e = e.parentElement, i++) if (getComputedStyle(e).cursor === "pointer") return e;
    return null;
  }
  const why = () => (PAGE_WHY.find(([re]) => re.test(location.pathname)) || [])[1] || "play";
  function stop(ev, el) {
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (document.activeElement && document.activeElement !== document.body && !document.activeElement.closest(CHROME)) document.activeElement.blur();
    if (ev.type !== "click") { if (!pop || pop.hidden) accountPop(el.dataset.account || why(), el.dataset.next); return; }
    LFI.needAccount(el.dataset.account || why(), el.dataset.next);
  }
  document.addEventListener("click", (ev) => {
    if (!signedOut()) return;
    const el = (ev.target.closest && ev.target.closest("[data-account]")) || walled(ev.target);
    if (el) stop(ev, el);
  }, true);
  // Fields and drop-downs react before a click (focus, opening the list, dragging), so catch those too.
  document.addEventListener("pointerdown", (ev) => {
    const el = signedOut() && walled(ev.target);
    if (el && (el.matches("input, select, textarea, [contenteditable], [draggable=true]") || el.closest("[draggable=true]"))) stop(ev, el);
  }, true);
  document.addEventListener("focusin", (ev) => {
    const el = signedOut() && walled(ev.target);
    if (el && el.matches("input, select, textarea, [contenteditable]")) stop(ev, el);
  }, true);

  if (!on) { markReady(); return; }

  // Visitor counter (supabase/60_visits.sql): one anonymous ping per page view on the live site. No cookies,
  // nothing kept in the browser; the database counts people with a daily-salted hash and never stores an IP.
  if (location.hostname === "lastfourin.com" && !navigator.webdriver) {
    let ref = "";
    try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { /* bad referrer */ }
    fetch(SUPABASE_URL + "/rest/v1/rpc/log_visit", {
      method: "POST", keepalive: true, headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
      body: JSON.stringify({ p_path: location.pathname, p_ref: ref || null }),
    }).catch(() => {});
  }

  // Surface a Supabase error as one plain sentence. Our own database messages are already written for people.
  function fail(error, fallback) {
    if (!error) return;
    const m = error.message || "";
    const err = new Error(/^[A-Z][^{}]*[.!?]$/.test(m) && m.length < 140 ? m : fallback || "Something went wrong. Try again.");
    err.cause = error;
    throw err;
  }
  const need = () => { if (!cloud.user) throw new Error("Sign in first."); };
  const here = () => location.pathname + location.search;

  function loadSdk() {
    return new Promise((res, rej) => {
      if (window.supabase && window.supabase.createClient) return res();
      const s = document.createElement("script"); s.src = SDK; s.onload = res; s.onerror = () => rej(new Error("Couldn't reach the sign-in service."));
      document.head.appendChild(s);
    });
  }

  async function loadProfile() {
    if (!cloud.user) { cloud.profile = null; return; }
    const { data } = await cloud.sb.from("profiles").select("*").eq("id", cloud.user.id).maybeSingle();
    cloud.profile = data || null;
    await countInbox();
  }
  // How many friend requests are waiting on me (the badge on the Friends button).
  async function countInbox() {
    cloud.inbox = 0;
    if (!cloud.profile || !cloud.profile.onboarded) return;
    const { count } = await cloud.sb.from("friendships").select("requester", { count: "exact", head: true })
      .eq("addressee", cloud.user.id).eq("status", "pending");
    cloud.inbox = count || 0;
  }

  // ---- Sign-in ----
  cloud.signInGoogle = async (next) => {
    const { error } = await cloud.sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/signin/?next=${encodeURIComponent(next || "/account/")}` } });
    fail(error, "Couldn't start Google sign-in.");
  };
  cloud.signInEmail = async (email, next) => {
    const { error } = await cloud.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/signin/?next=${encodeURIComponent(next || "/account/")}` } });
    if (error && /rate|seconds/i.test(error.message)) throw new Error("Too many sign-in emails just now. Wait a minute and try again.");
    fail(error, "Couldn't send the sign-in email. Check the address and try again.");
  };
  cloud.signOut = async () => {
    await cloud.sb.auth.signOut();
    // Shared phones: don't leave this account's picks behind for the next person.
    local.set("lfi-entries", []);
    local.set("lfi-cloud-synced", null);
  };
  cloud.ageBlocked = () => !!local.get(AGE_BLOCK, null);
  cloud.finishSignup = async ({ username, display, year, month }) => {
    need();
    const { data, error } = await cloud.sb.rpc("finish_signup", { p_username: username, p_display_name: display || null, p_birth_year: +year, p_birth_month: +month });
    fail(error);
    if (data === "under13") {
      local.set(AGE_BLOCK, new Date().toISOString());
      await cloud.sb.auth.signOut();
      local.set("lfi-entries", []);
      return "under13";
    }
    await loadProfile(); emit();
    await cloud.syncEntries();
    return "ok";
  };
  cloud.updateProfile = async (fields) => {
    need();
    const { error } = await cloud.sb.from("profiles").update(fields).eq("id", cloud.user.id);
    if (error && error.code === "23505") throw new Error("That handle is taken. Try another.");
    fail(error);
    await loadProfile(); emit();
  };
  cloud.deleteAccount = async () => {
    need();
    const { error } = await cloud.sb.rpc("delete_my_account");
    fail(error);
    await cloud.signOut();
  };

  // ---- Entries: this browser's list stays the fast copy; the account keeps the real one ----
  const toRow = (e) => ({ key: e.id, kind: e.kind, title: e.title || null, sub: e.sub || null, result: e.result || null, url: e.url || null,
                          data: e.data || {}, saved_at: e.saved || new Date().toISOString(), posted: !!e.posted, caption: e.caption || null });
  const fromRow = (r) => ({ id: r.key, kind: r.kind, title: r.title, sub: r.sub, result: r.result, url: r.url, data: r.data,
                            saved: r.saved_at, posted: r.posted, caption: r.caption, cloudId: r.id, postedAt: r.posted_at, hidden: r.hidden });
  const KINDS = ["nfl", "cfb", "nba", "nhl", "cbb", "mlb", "ap", "bracket", "trivia"];

  async function pushEntry(e) {
    if (!cloud.profile || !cloud.profile.onboarded || !KINDS.includes(e.kind)) return null;
    const { data, error } = await cloud.sb.from("entries").upsert(toRow(e), { onConflict: "user_id,key" }).select().single();
    fail(error, "Couldn't save that to your account.");
    entries.patch(e.id, { cloudId: data.id, postedAt: data.posted_at });
    return data;
  }
  // Merge both ways: newer copy wins, anything only on one side is copied to the other.
  cloud.syncEntries = async () => {
    if (!cloud.profile || !cloud.profile.onboarded) return;
    const { data, error } = await cloud.sb.from("entries").select("*").eq("user_id", cloud.user.id);
    if (error) return;
    const remote = new Map(data.map((r) => [r.key, fromRow(r)]));
    const merged = new Map(remote);
    const up = [];
    for (const e of entries.all()) {
      const r = remote.get(e.id);
      if (!r || new Date(e.saved) > new Date(r.saved)) { merged.set(e.id, { ...r, ...e, posted: r ? r.posted : !!e.posted, caption: r ? r.caption : e.caption }); up.push(e.id); }
    }
    const list = [...merged.values()].sort((a, b) => new Date(b.saved) - new Date(a.saved));
    local.set("lfi-entries", list);
    for (const id of up) { try { await pushEntry(entries.get(id)); } catch (e) { console.warn(e); } }
    local.set("lfi-cloud-synced", cloud.user.id);
    listeners.forEach((fn) => { try { fn(cloud, "entries"); } catch {} });
  };

  // Every save on any page also goes to the account. Wrap the store once, so no page has to change.
  const orig = { put: entries.put, patch: entries.patch, remove: entries.remove };
  const pending = {};
  const later = (id) => { clearTimeout(pending[id]); pending[id] = setTimeout(() => { const e = entries.get(id); if (e) pushEntry(e).catch((x) => console.warn(x)); }, 600); };
  entries.put = (e) => { const r = orig.put(e); if (cloud.profile && cloud.profile.onboarded) later(r.id); return r; };
  entries.patch = (id, f) => {
    const before = entries.get(id);
    orig.patch(id, f);
    // Only push real changes (results, picks), not our own bookkeeping fields.
    if (cloud.profile && cloud.profile.onboarded && before && Object.keys(f).some((k) => !["cloudId", "postedAt"].includes(k) && JSON.stringify(before[k]) !== JSON.stringify(f[k]))) later(id);
  };
  entries.remove = (id) => {
    const e = entries.get(id);
    orig.remove(id);
    if (cloud.user && e) cloud.sb.from("entries").delete().eq("user_id", cloud.user.id).eq("key", id).then(() => {});
  };

  cloud.setPosted = async (id, posted, caption) => {
    need();
    const e = entries.get(id); if (!e) throw new Error("That entry isn't saved yet.");
    const next = { ...e, posted, caption: posted ? (caption ?? e.caption ?? "").trim() || null : e.caption };
    const row = await pushEntry(next);
    orig.patch(id, { posted, caption: next.caption, cloudId: row && row.id, postedAt: row && row.posted_at });
    return row;
  };

  // ---- Pick'em: taps also go to the graded, kickoff-locked picks table ----
  // Taps are batched: everything tapped within ~0.7s goes up in one call (null = cleared).
  const pickTimers = {}, pickQueue = {};
  cloud.savePicks = (league, map) => {
    if (!cloud.profile || !cloud.profile.onboarded) return;
    pickQueue[league] = { ...pickQueue[league], ...map };
    clearTimeout(pickTimers[league]);
    pickTimers[league] = setTimeout(async () => {
      const batch = pickQueue[league]; delete pickQueue[league];
      const { error } = await cloud.sb.rpc("save_picks", { p_league: league, p_picks: batch });
      if (error) console.warn("save_picks", error.message);
    }, 700);
  };
  cloud.myPicks = async (league, ids) => {
    if (!cloud.profile || !cloud.profile.onboarded || !ids.length) return {};
    const { data, error } = await cloud.sb.rpc("my_picks", { p_league: league, p_ids: ids });
    return error ? {} : data || {};
  };

  // ---- Profiles, feed, comments ----
  cloud.profileByHandle = async (h) => {
    const { data, error } = await cloud.sb.from("profiles").select("id,username,display_name,bio,avatar_url,created_at,onboarded,banned").ilike("username", h.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    fail(error); return data;
  };
  cloud.stats = async (uid) => { const { data } = await cloud.sb.rpc("profile_stats", { p_user: uid }); return data || {}; };
  cloud.feed = async (uid, before) => {
    let q = cloud.sb.from("entries").select("id,key,kind,title,sub,result,url,data,caption,posted_at,user_id,comments(count)")
      .eq("user_id", uid).eq("posted", true).order("posted_at", { ascending: false }).limit(20);
    if (before) q = q.lt("posted_at", before);
    const { data, error } = await q; fail(error); return data || [];
  };
  cloud.comments = async (entryId) => {
    const { data, error } = await cloud.sb.from("comments").select("id,body,created_at,user_id,hidden,profiles(username,display_name,avatar_url)")
      .eq("entry_id", entryId).order("created_at").limit(200);
    fail(error); return data || [];
  };
  cloud.addComment = async (entryId, body) => {
    need();
    const { data, error } = await cloud.sb.from("comments").insert({ entry_id: entryId, body }).select("id,body,created_at,user_id,hidden").single();
    fail(error, "Couldn't post that comment."); return data;
  };
  cloud.deleteComment = async (id) => { need(); const { error } = await cloud.sb.from("comments").delete().eq("id", id); fail(error); };
  cloud.hideComment = async (id, hidden = true) => { need(); const { error } = await cloud.sb.rpc("hide_comment", { p_id: id, p_hidden: hidden }); fail(error); };
  cloud.report = async (type, id, reason, note) => {
    need();
    const { error } = await cloud.sb.from("reports").insert({ target_type: type, target_id: String(id), reason, note: note || null });
    if (error && error.code === "23505") return; // already reported it
    fail(error);
  };
  cloud.blocks = async () => {
    if (!cloud.user) return [];
    const { data } = await cloud.sb.from("blocks").select("blocked"); return (data || []).map((r) => r.blocked);
  };
  cloud.block = async (uid) => { need(); const { error } = await cloud.sb.from("blocks").insert({ blocked: uid }); if (error && error.code !== "23505") fail(error); };
  cloud.unblock = async (uid) => { need(); const { error } = await cloud.sb.from("blocks").delete().eq("blocked", uid); fail(error); };

  // ---- Friends: mutual, by request. Every change goes through a database call that checks blocks and limits ----
  const afterFriendChange = async () => { await countInbox(); LFI.setMe(cloud.profile); };
  cloud.friendStatus = async (uid) => {
    if (!cloud.profile || !cloud.profile.onboarded) return "none";
    const { data } = await cloud.sb.rpc("friend_status", { p_user: uid }); return data || "none";
  };
  // Returns 'sent', 'accepted' (they had already asked you), 'already' or 'pending'.
  cloud.friendRequest = async (handle) => {
    need(); const { data, error } = await cloud.sb.rpc("friend_request", { p_handle: handle });
    fail(error, "Couldn't send that request."); await afterFriendChange(); return data;
  };
  cloud.friendRespond = async (uid, accept) => {
    need(); const { error } = await cloud.sb.rpc("friend_respond", { p_user: uid, p_accept: accept });
    fail(error); await afterFriendChange();
  };
  cloud.friendRemove = async (uid) => { need(); const { error } = await cloud.sb.rpc("friend_remove", { p_user: uid }); fail(error); await afterFriendChange(); };
  cloud.friendRequests = async () => { need(); const { data, error } = await cloud.sb.rpc("friend_requests"); fail(error); return data || []; };
  cloud.friendsBoard = async () => { need(); const { data, error } = await cloud.sb.rpc("friends_board"); fail(error); return data || []; };
  // Handle search for the "Add a friend" box: finished profiles whose handle starts with what's typed.
  cloud.findPeople = async (q) => {
    q = q.replace(/^@/, "").trim(); if (!/^[A-Za-z0-9_]{1,20}$/.test(q)) return [];
    const { data } = await cloud.sb.from("profiles").select("id,username,display_name,avatar_url")
      .ilike("username", q.replace(/_/g, "\\_") + "%").eq("onboarded", true).eq("banned", false).limit(6);
    return (data || []).filter((p) => p.id !== cloud.user.id);
  };

  // ---- Pools: private pick'em groups. Members' normal picks are what a pool ranks ----
  const rpc = async (fn, args, fallback) => { const { data, error } = await cloud.sb.rpc(fn, args); fail(error, fallback); return data; };
  cloud.myPools = async (league) => { need(); return (await rpc("my_pools", { p_league: league || null })) || []; };
  cloud.poolCreate = async (league, name) => { need(); return rpc("pool_create", { p_league: league, p_name: name }, "Couldn't start that pool."); };
  cloud.poolPeek = async (code) => rpc("pool_peek", { p_code: code });
  cloud.poolJoin = async (code) => { need(); return rpc("pool_join", { p_code: code }, "Couldn't join that pool."); };
  cloud.poolBoard = async (id, stype, period) => { need(); return rpc("pool_board", { p_id: id, p_season_type: stype ?? null, p_period: period ?? null }); };
  cloud.poolLeave = async (id) => { need(); await rpc("pool_leave", { p_id: id }); };
  cloud.poolRename = async (id, name) => { need(); await rpc("pool_rename", { p_id: id, p_name: name }); };
  cloud.poolRemove = async (id, uid) => { need(); await rpc("pool_remove", { p_id: id, p_user: uid }); };
  cloud.poolDelete = async (id) => { need(); await rpc("pool_delete", { p_id: id }); };

  // ---- Moderators ----
  cloud.isAdmin = async () => { if (!cloud.user) return false; const { data } = await cloud.sb.rpc("is_admin"); return !!data; };
  // Visitor numbers for /mod/stats/ (admins only; the database refuses everyone else).
  cloud.siteStats = async (days) => {
    const [d, p, r] = await Promise.all(["site_stats", "site_top_pages", "site_top_refs"].map((f) => cloud.sb.rpc(f, { p_days: days })));
    [d, p, r].forEach((x) => fail(x.error, "Couldn't load the visitor numbers."));
    return { days: d.data || [], pages: p.data || [], refs: r.data || [] };
  };
  cloud.modQueue = async () => { const { data, error } = await cloud.sb.rpc("mod_queue"); fail(error); return data || []; };
  cloud.modBan = async (uid, banned) => { const { error } = await cloud.sb.rpc("mod_ban", { p_user: uid, p_banned: banned }); fail(error); };
  cloud.modHideEntry = async (id, hidden) => { const { error } = await cloud.sb.rpc("mod_hide_entry", { p_id: id, p_hidden: hidden }); fail(error); };
  cloud.modResolve = async (type, id) => { const { error } = await cloud.sb.rpc("mod_resolve", { p_target_type: type, p_target_id: String(id) }); fail(error); };

  // ---- The "post it" moment: the share pop-up after every submit ----
  LFI.onShareOpen = (e, slot) => {
    const p = cloud.profile;
    if (!p || !p.onboarded) {
      // Same box a signed-in player gets; tapping Post asks them to make an account first.
      slot.innerHTML = `<div class="post-box"><p><b>Post it to your profile</b> so friends can see it, comment and follow your record.</p>
        <a class="btn navy" href="/signin/?next=${encodeURIComponent(here())}" data-account="post"><span class="em" aria-hidden="true">📣</span> Post to my profile</a></div>`;
      return;
    }
    const draw = () => {
      const cur = entries.get(e.id) || e;
      if (cur.posted) {
        slot.innerHTML = `<div class="post-box"><p><b>Posted to your profile.</b> ${cur.caption ? `“${esc(cur.caption)}”` : ""}</p>
          <div class="post-acts"><a class="btn" href="/u/?h=${encodeURIComponent(p.username)}">View my profile</a><button class="btn" type="button" data-unpost>Take it down</button></div></div>`;
      } else {
        slot.innerHTML = `<form class="post-box" data-post><p><b>Post it to your profile</b> so friends can see it and comment.</p>
          <textarea maxlength="280" rows="2" placeholder="Add a take (optional)" aria-label="Caption">${esc(cur.caption || "")}</textarea>
          <button class="btn navy" type="submit">Post to my profile</button></form>`;
      }
    };
    draw();
    slot.onsubmit = async (ev) => {
      ev.preventDefault();
      const btn = slot.querySelector("button[type=submit]"); btn.disabled = true;
      try { await cloud.setPosted(e.id, true, slot.querySelector("textarea").value); toast("Posted to your profile"); draw(); }
      catch (err) { toast(err.message); btn.disabled = false; }
    };
    slot.onclick = async (ev) => {
      if (!ev.target.closest("[data-unpost]")) return;
      try { await cloud.setPosted(e.id, false); toast("Taken down"); draw(); } catch (err) { toast(err.message); }
    };
  };

  // ---- Start ----
  (async () => {
    try {
      await loadSdk();
      cloud.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } });
      const { data } = await cloud.sb.auth.getSession();
      cloud.user = data.session ? data.session.user : null;
      await loadProfile();
      markReady(); emit();
      if (cloud.profile && cloud.profile.onboarded) cloud.syncEntries();
      cloud.sb.auth.onAuthStateChange((event, session) => {
        const uid = session ? session.user.id : null;
        if (uid === (cloud.user && cloud.user.id) && event !== "USER_UPDATED") return;
        // Don't call Supabase inside this callback (it can deadlock the client); hop out first.
        setTimeout(async () => {
          cloud.user = session ? session.user : null;
          await loadProfile(); emit();
          if (cloud.profile && cloud.profile.onboarded) cloud.syncEntries();
        }, 0);
      });
    } catch (err) {
      console.warn("Sign-in unavailable:", err);
      cloud.error = err;
      markReady(); emit();
    }
  })();
})();
