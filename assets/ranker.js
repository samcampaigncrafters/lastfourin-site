/* Top 25 ranker shared by the AP poll page and the CFP bracket.
   Phone-first: tap a row to open its actions (up, down, move to a spot, swap, remove), drag the
   handle to reorder, and one button that never changes its label: "Add or swap a team".
   When the list is full, picking a team asks which team it replaces instead of refusing. */
(function () {
  const { esc, toast } = LFI;
  const HANDLE = '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="3.5" r="1.4"/><circle cx="10.5" cy="3.5" r="1.4"/><circle cx="5.5" cy="8" r="1.4"/><circle cx="10.5" cy="8" r="1.4"/><circle cx="5.5" cy="12.5" r="1.4"/><circle cx="10.5" cy="12.5" r="1.4"/></svg>';

  // opts: { order(): [ids], setOrder(ids), team(id): {name, logo, color, sub}, pool(): [ids not ranked],
  //         max, cut: { after, label }, right(id, i): html, poolTag(id): text, onAct(act, i, btn): bool, locked(): bool }
  function Ranker(root, opts) {
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
      return `${cut}<li class="rk-row${i === open ? " open" : ""}" data-i="${i}" style="--tc:${esc(t.color)}">
        <div class="rk-main" data-tap>
          <button class="rk-handle" type="button" data-drag aria-label="Drag ${esc(t.name)} to reorder">${HANDLE}</button>
          <span class="rk-n">${i + 1}</span>
          ${t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy">` : "<span></span>"}
          <span class="rk-name"><b>${esc(t.name)}</b><small>${esc(t.sub || "")}</small></span>
          <span class="rk-right">${opts.right ? opts.right(id, i) : ""}</span>
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
      list.innerHTML = ids.map(row).join("");
      root.querySelector(".count-lbl").textContent = `${ids.length} of ${max} ranked`;
      root.querySelector("[data-add]").hidden = !!locked;
      root.classList.toggle("is-locked", !!locked);
    }

    const set = (ids) => { opts.setOrder(ids); };
    function move(from, to) {
      const ids = opts.order().slice(); const [t] = ids.splice(from, 1); ids.splice(to, 0, t);
      open = to; set(ids);
    }

    list.addEventListener("click", (e) => {
      if (opts.locked && opts.locked()) return;
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
      if (e.target.closest("[data-drag]") || e.target.closest("select")) return;
      if (e.target.closest(".rk-right button")) { const b = e.target.closest(".rk-right button"); if (opts.onAct) opts.onAct(b.dataset.act, i, b); return; }
      if (e.target.closest("[data-tap]")) { open = open === i ? -1 : i; render(); }
    });
    list.addEventListener("change", (e) => {
      const s = e.target.closest('select[data-act="to"]'); if (!s) return;
      const i = +s.closest(".rk-row").dataset.i; move(i, +s.value);
    });

    // Pointer drag on the handle: works with a thumb on phones, not just a mouse.
    let drag = null;
    list.addEventListener("pointerdown", (e) => {
      const h = e.target.closest("[data-drag]"); if (!h || (opts.locked && opts.locked())) return;
      const li = h.closest(".rk-row");
      e.preventDefault(); h.setPointerCapture(e.pointerId);
      drag = { li, from: +li.dataset.i, y0: e.clientY };
      li.classList.add("dragging");
    });
    list.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const li = drag.li;
      li.style.transform = `translateY(${e.clientY - drag.y0}px)`;
      const rows = [...list.querySelectorAll(".rk-row")].filter((r) => r !== li);
      for (const r of rows) {
        const b = r.getBoundingClientRect(), mid = b.top + b.height / 2;
        const ri = [...list.querySelectorAll(".rk-row")].indexOf(r), li_i = [...list.querySelectorAll(".rk-row")].indexOf(li);
        if (ri < li_i && e.clientY < mid) { const before = li.getBoundingClientRect().top; r.before(li); drag.y0 += li.getBoundingClientRect().top - before; li.style.transform = `translateY(${e.clientY - drag.y0}px)`; break; }
        if (ri > li_i && e.clientY > mid) { const before = li.getBoundingClientRect().top; r.after(li); drag.y0 += li.getBoundingClientRect().top - before; li.style.transform = `translateY(${e.clientY - drag.y0}px)`; break; }
      }
    });
    const endDrag = () => {
      if (!drag) return;
      const to = [...list.querySelectorAll(".rk-row")].indexOf(drag.li), from = drag.from;
      drag.li.style.transform = ""; drag.li.classList.remove("dragging"); drag = null;
      if (to !== from) move(from, to); else render();
    };
    list.addEventListener("pointerup", endDrag);
    list.addEventListener("pointercancel", endDrag);

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
        plist.innerHTML = ids.map((id, i) => [id, i]).reverse().map(([id, i]) => { const x = opts.team(id); return `<li><button type="button" data-rep="${i}"><img src="${esc(x.logo)}" alt=""><span><b>${esc(x.name)}</b><small>${esc(x.sub || "")}</small></span><span class="tag">#${i + 1}</span></button></li>`; }).join("");
        return;
      }
      search.hidden = false;
      if (target != null) { k.textContent = `Swap #${target + 1}`; h.textContent = `Replace ${opts.team(ids[target]).name}`; note.innerHTML = ""; }
      else if (ids.length < max) { k.textContent = `${ids.length} of ${max} ranked`; h.textContent = `Add a team at #${ids.length + 1}`; note.innerHTML = ""; }
      else { k.textContent = `${max} of ${max} ranked`; h.textContent = "Swap in a team"; note.innerHTML = `<div class="sheet-note">Pick the team you want in. Next you choose who it replaces.</div>`; }
      const q = search.value.trim().toLowerCase();
      const pool = opts.pool().filter((id) => !q || opts.team(id).name.toLowerCase().includes(q));
      plist.innerHTML = pool.map((id) => { const x = opts.team(id); return `<li><button type="button" data-pick="${esc(id)}"><img src="${esc(x.logo)}" alt=""><span><b>${esc(x.name)}</b><small>${esc(x.sub || "")}</small></span><span class="tag">${esc(opts.poolTag ? opts.poolTag(id) : "")}</span></button></li>`; }).join("")
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
