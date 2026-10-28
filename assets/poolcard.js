/* "Your pools" card on the pick'em pages: the pools you're in for this league with where you stand, plus
   Start a pool and Join with a code. The pool itself (standings, everyone's picks) lives on /pools/.
   The page sets window.PICKS = { league } before loading this file. */
(function () {
  const { $, esc, toast } = LFI;
  const league = window.PICKS.league;
  const box = $("pools");
  if (!box) return;
  const here = encodeURIComponent(location.pathname);
  const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  let open = "";   // which inline form is showing: "", "new" or "join"

  function forms() {
    if (open === "new") return `<form class="pool-form" data-new autocomplete="off">
        <input name="name" maxlength="40" placeholder="Pool name, e.g. The Office" aria-label="Pool name" required>
        <button class="btn gold" type="submit">Start</button></form>
      <p class="hint-s">You'll get a link to send your friends. Everyone's regular picks count, nothing extra to fill in.</p>`;
    if (open === "join") return `<form class="pool-form" data-join autocomplete="off">
        <input name="code" maxlength="8" placeholder="6-letter code" aria-label="Pool code" autocapitalize="characters" spellcheck="false" required>
        <button class="btn gold" type="submit">Join</button></form>`;
    return "";
  }
  const buttons = () => `<div class="pool-acts"><button class="btn${open === "new" ? " navy" : ""}" type="button" data-open="new"><span class="em" aria-hidden="true">➕</span> Start a pool</button>
    <button class="btn${open === "join" ? " navy" : ""}" type="button" data-open="join"><span class="em" aria-hidden="true">🤝</span> Join with a code</button></div>${forms()}`;

  let pools = [];
  function draw() {
    const cloud = LFI.cloud;
    if (!cloud || !cloud.on) { box.innerHTML = `<p class="empty">👥 Pools with friends switch on with sign-in.</p>`; return; }
    if (!cloud.user || !cloud.profile || !cloud.profile.onboarded) {
      box.innerHTML = `<p class="empty" style="margin-top:0;color:var(--ink-2)">Start a private pool, send the link, and see who's really calling it. Your normal picks count, nothing extra to fill in.</p>
        <a class="btn gold block" href="/signin/?next=${here}"><span class="em" aria-hidden="true">👥</span> ${cloud.user ? "Finish your profile" : "Sign in to start a pool"}</a>`;
      return;
    }
    box.innerHTML = (pools.length ? `<ul class="pool-list">${pools.map((p) => `<li><a href="/pools/?id=${p.id}">
        <b>${esc(p.name)}</b><span>${p.rank === 1 ? "🏆 " : ""}${p.rank ? `${ord(p.rank)} of ${p.members}` : `${p.members} ${p.members === 1 ? "player" : "players"}`} · ${p.correct}-${p.wrong}</span></a></li>`).join("")}</ul>`
      : `<p class="empty" style="margin-top:0;color:var(--ink-2)">🏆 Play your friends all season. Start a pool and send the link, or join one with a code.</p>`) + buttons();
    const f = box.querySelector("input"); if (f) f.focus();
  }

  async function load() {
    const cloud = LFI.cloud;
    if (cloud && cloud.on && cloud.profile && cloud.profile.onboarded) {
      try { pools = await cloud.myPools(league); } catch (e) { pools = []; }
    }
    draw();
  }

  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) { open = open === b.dataset.open ? "" : b.dataset.open; draw(); }
  });
  box.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("button"); btn.disabled = true;
    try {
      if (f.matches("[data-new]")) {
        const r = await LFI.cloud.poolCreate(league, f.name.value);
        location.href = `/pools/?id=${r.id}&new=1`;
      } else {
        const id = await LFI.cloud.poolJoin(f.code.value);
        location.href = `/pools/?id=${id}`;
      }
    } catch (err) { toast(err.message); btn.disabled = false; }
  });

  // cloud.js loads after lfi.js; wait for it, then redraw on sign-in / sign-out.
  (function wait(n) {
    if (LFI.cloud) { LFI.cloud.ready.then(() => { load(); LFI.cloud.onChange((c, what) => { if (what !== "entries") load(); }); }); }
    else if (n < 100) setTimeout(() => wait(n + 1), 50);
    else draw();
  })(0);
})();
