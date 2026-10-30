/* Top 25 ranker shared by the AP poll page and the CFP bracket.
   Phone-first: hold a row and drag it to reorder (the dots drag straight away), a quick swipe still
   scrolls the page. The ⋯ button (or a double tap) opens the extra moves: up, down, move to a spot,
   swap, remove. One button never changes its label: "Add or swap a team".
   When the list is full, picking a team asks which team it replaces instead of refusing. */
(function () {
  const { esc, toast } = LFI;
  const MORE = '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.6"/><circle cx="8" cy="8" r="1.6"/><circle cx="13" cy="8" r="1.6"/></svg>';
  const HANDLE = '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="3.5" r="1.4"/><circle cx="10.5" cy="3.5" r="1.4"/><circle cx="5.5" cy="8" r="1.4"/><circle cx="10.5" cy="8" r="1.4"/><circle cx="5.5" cy="12.5" r="1.4"/><circle cx="10.5" cy="12.5" r="1.4"/></svg>';

  // opts: { order(): [ids], setOrder(ids), team(id): {name, abbr, nick, color, sub, line (html)}, pool(): [ids not ranked],
  //         max, cut: { after, label }, right(id, i): html, poolTag(id): text, onAct(act, i, btn): bool, locked(): bool }
  function Ranker(root, opts) {
    // AP Poll rows and its team picker share the same colored initials badge.
    const teamMark = (team) => {
      if (!/^\/ap-poll(?:\/|$)/.test(location.pathname)) return LFI.teamMark(team.abbr, team.nick);
      const code = String(team.abbr || ""), raw = String(team.color || "");
      const fill = /^#?[0-9a-f]{6}$/i.test(raw) ? "#" + raw.replace(/^#/, "") : "#6d28d9";
      const rgb = [1, 3, 5].map(i => parseInt(fill.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
      const ink = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .179 ? "#111827" : "#ffffff";
      return code ? `<span class="rk-team-badge${code.length > 3 ? " long" : ""}" style="--team-fill:${fill};--team-ink:${ink}">${esc(code)}</span>` : "<span></span>";
    };
    const max = opts.max || 25;
    let open = -1, target = null, pending = null;
    root.innerHTML = `<ol class="rk-list"></ol>
      <div class="rk-foot"><span class="count-lbl"></span><button class="btn navy" type="button" data-add>+ Add or swap a team</button></div>`;
    const list = root.querySelector(".rk-list");

    // Team picker sheet, created once per ranker.
    const ov = document.createElement("div");
    ov.className = "ov"; ov.hidden = true;
    ov.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-label="Pick a team">
      <div class="dlg-h"><div><div class="kicker" data-k></div><h2 class="disp" data-h></h2></div><button class="dlg-x" type="button" data-x aria-label="Close">×</button></div>
      <div class="dlg-b"><div data-note></div><input class="search" type="search" placeholder="Search teams" aria-label="Search teams" autocomplete="off"><ul class="pick-list"></ul></div></div>`;
    document.body.appendChild(ov);
    const search = ov.querySelector(".search"), plist = ov.querySelector(".pick-list");

    const row = (id, i) => {
      const t = opts.team(id), n = opts.order().length;
      const spots = Array.from({ length: n }, (_, k) => `<option value="${k}"${k === i ? " selected" : ""}>Move to #${k + 1}</option>`).join("");
      const cut = opts.cut && i === opts.cut.after ? `<li class="rk-cut" aria-hidden="true">${esc(opts.cut.label)}</li>` : "";
      return `${cut}<li class="rk-row${i === open ? " open" : ""}" data-i="${i}" data-k="${esc(id)}" style="--tc:${esc(t.color)}">
        <div class="rk-main">
          <button class="rk-handle" type="button" data-drag aria-label="Move ${esc(t.name)}, now number ${i + 1}. Drag, or use the up and down arrow keys" aria-keyshortcuts="ArrowUp ArrowDown">${HANDLE}</button>
          <span class="rk-n">${i + 1}</span>
          ${teamMark(t) || "<span></span>"}
          <span class="rk-name"><b>${esc(t.name)}</b><small>${esc(t.sub || "")}</small>${t.line ? `<small class="rk-line">${t.line}</small>` : ""}</span>
          <span class="rk-right">${opts.right ? opts.right(id, i) : ""}</span>
          <button class="rk-more" type="button" data-more aria-expanded="${i === open}" aria-label="More moves for ${esc(t.name)}">${MORE}</button>
        </div>
        <div class="rk-act">
          <button type="button" data-act="up" ${i === 0 ? "disabled" : ""}>↑ Up</button>
          <button type="button" data-act="down" ${i === n - 1 ? "disabled" : ""}>↓ Down</button>
          <select data-act="to" aria-label="Move ${esc(t.name)} to a spot">${spots}</select>
          <button type="button" data-act="swap">⇄ Swap</button>
          <button type="button" data-act="rm" class="rm">✕ Remove</button>
        </div></li>`;
    };

    function render() {
      const ids = opts.order(), locked = opts.locked && opts.locked();
      glide(() => { list.innerHTML = ids.map(row).join(""); });
      root.querySelector(".count-lbl").innerHTML = `${ids.length} of ${max} ranked` + (ids.length > 1 && !locked ? `<span class="rk-hint"> · hold and drag to move</span>` : "");
      root.querySelector("[data-add]").hidden = !!locked;
      root.classList.toggle("is-locked", !!locked);
    }

    // Rows glide to their new spots instead of jumping, keyed by team. Skipped when the device asks for less motion.
    const calm = matchMedia("(prefers-reduced-motion: reduce)");
    function glide(change) {
      if (calm.matches || !Element.prototype.animate) return change();
      const before = new Map([...list.querySelectorAll(".rk-row")].map((el) => [el.dataset.k, el.getBoundingClientRect().top]));
      change();
      list.querySelectorAll(".rk-row").forEach((el) => {
        const t = before.get(el.dataset.k);
        if (t == null || el.classList.contains("dragging")) return;
        const dy = t - el.getBoundingClientRect().top;
        if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(.22,.9,.24,1)" });
      });
    }

    const set = (ids) => { opts.setOrder(ids); };
    function move(from, to, keepOpen = true) {
      const ids = opts.order().slice(); const [t] = ids.splice(from, 1); ids.splice(to, 0, t);
      open = keepOpen ? to : -1; set(ids);
    }
    const isLocked = () => !!(opts.locked && opts.locked());
    const toggle = (i) => { open = open === i ? -1 : i; render(); };

    let dragEnd = 0;
    list.addEventListener("click", (e) => {
      if (isLocked() || Date.now() - dragEnd < 350) return;
      const li = e.target.closest(".rk-row"); if (!li) return;
      const i = +li.dataset.i;
      const act = e.target.closest("button[data-act]");
      if (act) {
        const a = act.dataset.act, ids = opts.order().slice();
        if (a === "up" && i > 0) move(i, i - 1);
        else if (a === "down" && i < ids.length - 1) move(i, i + 1);
        else if (a === "rm") { const name = opts.team(ids[i]).name; ids.splice(i, 1); open = -1; set(ids); toast(`${name} removed. ${ids.length} of ${max} ranked.`); }
        else if (a === "swap") openSheet(i);
        else if (opts.onAct && opts.onAct(a, i, act)) { /* page handled it */ }
        return;
      }
      if (e.target.closest("[data-more]")) return toggle(i);
      if (e.target.closest(".rk-right button")) { const b = e.target.closest(".rk-right button"); if (opts.onAct) opts.onAct(b.dataset.act, i, b); return; }
    });
    // Keyboard: arrow keys on a row's dots move it, and focus follows the team to its new spot.
    list.addEventListener("keydown", (e) => {
      const h = e.target.closest("[data-drag]"); if (!h || isLocked()) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      if (LFI.needAccount && !LFI.needAccount("contest")) return; // same account wall as tapping Up or Down
      const i = +h.closest(".rk-row").dataset.i, to = e.key === "ArrowUp" ? i - 1 : i + 1;
      if (to < 0 || to >= opts.order().length) return;
      move(i, to, false); toast(`${opts.team(opts.order()[to]).name} moved to #${to + 1}`);
      const nb = list.querySelector(`.rk-row[data-i="${to}"] [data-drag]`); if (nb) nb.focus(); // the page re-renders the list synchronously
    });
    list.addEventListener("dblclick", (e) => {
      const li = e.target.closest(".rk-row");
      if (li && !isLocked() && e.target.closest(".rk-main") && !e.target.closest("button")) toggle(+li.dataset.i);
    });
    list.addEventListener("change", (e) => {
      const s = e.target.closest('select[data-act="to"]'); if (!s) return;
      const i = +s.closest(".rk-row").dataset.i; move(i, +s.value);
    });

    // Drag to reorder. The dots start a drag at once; anywhere else on the row a finger has to rest
    // briefly first, so a quick swipe still scrolls the page. A mouse drags after a small nudge.
    // While dragging, touchmove is cancelled so the page stays put, and holding near the top or
    // bottom of the screen scrolls the list along.
    let drag = null, hold = null;
    const rowsNow = () => [...list.querySelectorAll(".rk-row")];
    function startDrag(li, y) {
      drag = { li, from: +li.dataset.i, y0: y, y };
      li.classList.add("dragging"); list.classList.add("is-dragging");
      if (navigator.vibrate) navigator.vibrate(8);
      drag.raf = requestAnimationFrame(tick);
    }
    function place() {
      const li = drag.li, y = drag.y, rows = rowsNow(), at = rows.indexOf(li);
      li.style.transform = `translateY(${y - drag.y0}px)`;
      const up = rows.slice(0, at).find((r) => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
      const down = rows.slice(at + 1).reverse().find((r) => { const b = r.getBoundingClientRect(); return y > b.top + b.height / 2; });
      if (!up && !down) return;
      const before = li.getBoundingClientRect().top;
      glide(() => { up ? up.before(li) : down.after(li); });
      drag.y0 += li.getBoundingClientRect().top - before;
      li.style.transform = `translateY(${y - drag.y0}px)`;
    }
    function tick() {
      if (!drag) return;
      const edge = 80, y = drag.y;
      const v = y < edge ? -(edge - y) / 5 : y > innerHeight - edge ? (y - innerHeight + edge) / 5 : 0;
      if (v) { const s0 = scrollY; scrollBy(0, v); drag.y0 -= scrollY - s0; }
      place();
      drag.raf = requestAnimationFrame(tick);
    }
    function endDrag() {
      if (hold) { clearTimeout(hold.t); hold = null; }
      if (!drag) return;
      cancelAnimationFrame(drag.raf);
      const to = rowsNow().indexOf(drag.li), from = drag.from;
      drag.li.style.transform = ""; drag.li.classList.remove("dragging"); list.classList.remove("is-dragging");
      drag = null; dragEnd = Date.now();
      if (to !== from) { move(from, to, false); toast(`Moved to #${to + 1}`); } else render();
    }
    list.addEventListener("pointerdown", (e) => {
      if (isLocked() || e.button > 0 || drag) return;
      const li = e.target.closest(".rk-row");
      if (!li || e.target.closest(".rk-act, select, button:not([data-drag])")) return;
      if (e.target.closest("[data-drag]")) { e.preventDefault(); startDrag(li, e.clientY); return; }
      hold = { li, x: e.clientX, y: e.clientY, mouse: e.pointerType === "mouse" };
      if (!hold.mouse) hold.t = setTimeout(() => { const h = hold; hold = null; if (h) startDrag(h.li, h.y); }, 260);
    });
    addEventListener("pointermove", (e) => {
      if (drag) { drag.y = e.clientY; return; }
      if (!hold) return;
      const d = Math.hypot(e.clientX - hold.x, e.clientY - hold.y);
      if (hold.mouse && d > 5) { const h = hold; hold = null; startDrag(h.li, h.y); drag.y = e.clientY; }
      else if (!hold.mouse && d > 8) { clearTimeout(hold.t); hold = null; } // it's a scroll, let it go
      else hold.y = e.clientY;
    });
    addEventListener("pointerup", endDrag);
    addEventListener("pointercancel", endDrag);
    list.addEventListener("touchmove", (e) => { if (drag) e.preventDefault(); }, { passive: false });
    list.addEventListener("contextmenu", (e) => { if (e.target.closest(".rk-row")) e.preventDefault(); });

    // ---- Add or swap sheet ----
    function openSheet(replaceIndex = null) {
      target = replaceIndex; pending = null;
      search.value = "";
      drawSheet();
      ov.hidden = false; document.body.style.overflow = "hidden";
      if (matchMedia("(pointer: fine)").matches) setTimeout(() => search.focus(), 30);
    }
    function closeSheet() { ov.hidden = true; document.body.style.overflow = ""; target = null; pending = null; }
    function drawSheet() {
      const ids = opts.order();
      const k = ov.querySelector("[data-k]"), h = ov.querySelector("[data-h]"), note = ov.querySelector("[data-note]");
      if (pending) {
        // Step 2 when the list is full: choose who the new team replaces.
        const t = opts.team(pending);
        k.textContent = "Your Top 25 is full"; h.textContent = `${t.name} replaces…`;
        note.innerHTML = `<div class="sheet-note">Tap the team ${esc(t.name)} takes the spot of. It keeps that team's rank.</div>`;
        search.hidden = true;
        plist.innerHTML = ids.map((id, i) => [id, i]).reverse().map(([id, i]) => { const x = opts.team(id); return `<li><button type="button" data-rep="${i}">${teamMark(x)}<span><b>${esc(x.name)}</b><small>${esc(x.sub || "")}</small></span><span class="tag">#${i + 1}</span></button></li>`; }).join("");
        return;
      }
      search.hidden = false;
      if (target != null) { k.textContent = `Swap #${target + 1}`; h.textContent = `Replace ${opts.team(ids[target]).name}`; note.innerHTML = ""; }
      else if (ids.length < max) { k.textContent = `${ids.length} of ${max} ranked`; h.textContent = `Add a team at #${ids.length + 1}`; note.innerHTML = ""; }
      else { k.textContent = `${max} of ${max} ranked`; h.textContent = "Swap in a team"; note.innerHTML = `<div class="sheet-note">Pick the team you want in. Next you choose who it replaces.</div>`; }
      const q = search.value.trim().toLowerCase();
      const pool = opts.pool().filter((id) => { const x = opts.team(id); return !q || [x.name, x.nick, x.abbr].join(" ").toLowerCase().includes(q); });
      plist.innerHTML = pool.map((id) => { const x = opts.team(id); return `<li><button type="button" data-pick="${esc(id)}">${teamMark(x)}<span><b>${esc(x.name)}</b><small>${esc(x.sub || "")}</small></span><span class="tag">${esc(opts.poolTag ? opts.poolTag(id) : "")}</span></button></li>`; }).join("")
        || `<li class="empty">No teams match “${esc(search.value)}”.</li>`;
    }
    search.addEventListener("input", drawSheet);
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-x]")) return closeSheet();
      const p = e.target.closest("[data-pick]"), r = e.target.closest("[data-rep]");
      const ids = opts.order().slice();
      if (p) {
        const id = p.dataset.pick, name = opts.team(id).name;
        if (target != null) { const out = opts.team(ids[target]).name; ids[target] = id; open = -1; closeSheet(); set(ids); toast(`${name} in for ${out} at #${ids.indexOf(id) + 1}`); }
        else if (ids.length < max) { ids.push(id); closeSheet(); set(ids); toast(`${name} added at #${ids.length}`); }
        else { pending = id; drawSheet(); plist.scrollTop = 0; }
      } else if (r) {
        const i = +r.dataset.rep, out = opts.team(ids[i]).name, name = opts.team(pending).name;
        ids[i] = pending; open = -1; closeSheet(); set(ids); toast(`${name} in for ${out} at #${i + 1}`);
      }
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ov.hidden) closeSheet(); });
    root.querySelector("[data-add]").addEventListener("click", () => openSheet(null));

    return { render, close() { open = -1; } };
  }

  window.LFI.Ranker = Ranker;
})();
