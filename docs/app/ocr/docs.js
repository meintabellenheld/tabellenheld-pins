/* Tabellenheld Bonus-Apps: Belege und Dokumente hochladen, auslesen, speichern (28.11.2026).
   Gemeinsam für Haushaltsbuch, Weihnachtsplaner, Hochzeitsplaner. Liegt in app/ocr/docs.js, wird sofort geladen (klein).
   Die Texterkennung selbst (scan.js + pdf.js/Tesseract.js) kommt erst, wenn jemand ein Foto oder PDF wählt.
   Alles bleibt auf dem Gerät: Dateien in IndexedDB, in „Daten sichern“ mit drin, nichts wird hochgeladen. */
(function () {
  "use strict";
  var OCR = new URL(".", (document.currentScript && document.currentScript.src) || location.href).href;
  var MB = 1048576, MAX_IN = 25 * MB, MAX_PDF = 5 * MB, MAX_TOTAL = 15 * MB;

  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function mb(b) { if (b < 100 * 1024) return Math.max(1, Math.round(b / 1024)) + " KB"; return (b / MB).toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " MB"; }
  function say(msg) { var t = document.getElementById("toast"); if (!t) return; t.textContent = msg; t.classList.add("on"); clearTimeout(say.t); say.t = setTimeout(function () { t.classList.remove("on"); }, 2600); }

  /* ---------- Aussehen: nutzt die Farben der jeweiligen App, mit Ersatzwerten ---------- */
  var ACC = "var(--accent, var(--pri, var(--berry, #1F6F78)))";
  var CSS = [
    ".thd-box { display: grid; gap: 8px; background: var(--soft); border-radius: 14px; padding: 12px; }",
    ".thd-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; border: 0; border-radius: 14px; padding: 12px 14px; cursor: pointer; font: inherit; font-family: var(--display); font-weight: 600; font-size: 16px; background: " + ACC + "; color: var(--accent-ink, var(--pri-ink, var(--berry-ink, #fff))); }",
    ".thd-btn svg { width: 22px; height: 22px; flex: none; }",
    ".thd-btn:active { transform: scale(.98); }",
    ".thd-note { display: flex; gap: 7px; align-items: flex-start; margin: 0; font-size: 12.5px; color: var(--muted); line-height: 1.35; }",
    ".thd-note svg { width: 15px; height: 15px; flex: none; margin-top: 1px; color: var(--good, var(--pine, #2F7D52)); }",
    ".thd-prog { display: grid; gap: 6px; font-size: 13px; font-weight: 600; }",
    ".thd-bar { height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; }",
    ".thd-bar i { display: block; height: 100%; width: 0; border-radius: 999px; background: " + ACC + "; transition: width .3s; }",
    ".thd-prog.wait .thd-bar i { width: 35%; animation: thdSlide 1.2s ease-in-out infinite alternate; }",
    "@keyframes thdSlide { from { margin-left: 0; } to { margin-left: 65%; } }",
    ".thd-res { display: grid; gap: 6px; }",
    ".thd-chip { display: flex; align-items: center; gap: 8px; justify-content: space-between; background: var(--card); border-radius: 10px; padding: 7px 8px 7px 10px; font-size: 13px; font-weight: 600; min-width: 0; }",
    ".thd-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".thd-mini { font: inherit; font-size: 12.5px; padding: 6px 10px; border-radius: 999px; border: 1.5px solid var(--line); background: var(--card); color: var(--ink); cursor: pointer; font-weight: 600; white-space: nowrap; }",
    ".thd-sum { margin: 0; font-size: 13.5px; }",
    ".thd-hints { margin: 0; padding-left: 18px; font-size: 13px; color: var(--warn-ink, var(--hint-ink, #7A4300)); display: grid; gap: 3px; }",
    ".thd-hints:empty { display: none; }",
    ".thd-txt summary { cursor: pointer; font-size: 13px; font-weight: 600; color: " + ACC + "; padding: 4px 0; }",
    ".thd-txt pre { white-space: pre-wrap; word-break: break-word; font-size: 11.5px; max-height: 220px; overflow: auto; background: var(--card); border-radius: 10px; padding: 8px; margin: 6px 0 0; }",
    ".thd-src { display: block; font-size: 11.5px; color: var(--muted); line-height: 1.3; overflow-wrap: anywhere; margin-top: 2px; }",
    ".thd-src:empty { display: none; }",
    "input.thd-auto, select.thd-auto { border-color: var(--gold, #E0A23B) !important; background: var(--hint-bg, #FFF3D6) !important; }",
    ".thd-chips .thd-auto { outline: 2.5px solid var(--gold, #E0A23B); outline-offset: 1px; }",
    ".thd-clip { flex: none; border: 1.5px solid " + ACC + "; color: " + ACC + "; background: var(--card); border-radius: 999px; padding: 5px 8px; line-height: 0; cursor: pointer; }",
    ".thd-clip svg { width: 16px; height: 16px; }",
    ".thd-view { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.84); display: grid; grid-template-rows: auto 1fr; padding: max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom)); }",
    ".thd-view[hidden] { display: none; }",
    ".thd-view .bar { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; padding-bottom: 8px; align-items: center; }",
    ".thd-view .bar b { color: #fff; margin-right: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }",
    ".thd-view .bar .thd-mini { background: #fff; color: #1b2a2e; border-color: #fff; }",
    ".thd-view .body { overflow: auto; display: grid; place-items: start center; }",
    ".thd-view img { max-width: 100%; height: auto; border-radius: 8px; background: #fff; }",
    ".thd-view .pdf { background: var(--card); color: var(--ink); border-radius: 16px; padding: 18px; max-width: 420px; display: grid; gap: 10px; margin-top: 10vh; }",
    ".thd-view .pdf a { text-align: center; text-decoration: none; }",
    ".thd-view .ask { display: grid; gap: 8px; background: var(--card); color: var(--ink); border-radius: 14px; padding: 12px; margin-bottom: 8px; font-size: 14px; }",
    ".thd-store { font-size: 13.5px; margin: 0; display: grid; gap: 6px; }",
    "@media (prefers-reduced-motion: reduce) { .thd-prog.wait .thd-bar i { animation: none; } }"
  ].join("\n");
  function css() { if (document.getElementById("thd-css")) return; var s = h("style"); s.id = "thd-css"; s.textContent = CSS; document.head.appendChild(s); }

  var ICON_SCAN = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8 9h8M8 12h8M8 15h5"/></svg>';
  var ICON_LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  var ICON_CLIP = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>';

  /* ---------- Speicher (IndexedDB) ---------- */
  function store(key, getState, onReady) {
    var DBN = key + "-dokumente", cache = {}, ready = false, dbp = null, pending = {};
    function db() { if (!dbp) dbp = new Promise(function (ok, no) { if (!window.indexedDB) return no(new Error("kein idb")); var q = indexedDB.open(DBN, 1);
      q.onupgradeneeded = function () { q.result.createObjectStore("d", { keyPath: "id" }); }; q.onsuccess = function () { ok(q.result); }; q.onerror = function () { no(q.error); }; }); return dbp; }
    function tx(mode, fn) { return db().then(function (d) { return new Promise(function (ok, no) { var t = d.transaction("d", mode), out = fn(t.objectStore("d")); t.oncomplete = function () { ok(out && out.result !== undefined ? out.result : out); }; t.onerror = function () { no(t.error); }; t.onabort = function () { no(t.error || new Error("abbruch")); }; }); }); }
    function b64(blob) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(",")[1] || ""); }; r.onerror = no; r.readAsDataURL(blob); }); }
    function unb64(s, t) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: t }); }
    function total() { var s = 0; for (var k in cache) s += cache[k].s; return s; }
    function refs(st) { var o = {}; (function walk(x, d) { if (!x || typeof x !== "object" || d > 6) return; if (Array.isArray(x)) { x.forEach(function (y) { walk(y, d + 1); }); return; }
      for (var k in x) { if (k === "f" && typeof x[k] === "string" && /^d[a-z0-9]+$/.test(x[k])) o[x[k]] = 1; else if (typeof x[k] === "object") walk(x[k], d + 1); } })(st, 0); return o; }
    var api = {
      ready: function () { return ready; }, has: function (id) { return !!cache[id]; }, meta: function (id) { return cache[id]; }, total: total, max: MAX_TOTAL,
      load: function () { return tx("readonly", function (st) { return st.getAll(); }).then(function (rows) {
          return Promise.all((rows || []).map(function (r) { return b64(r.blob).then(function (d) { cache[r.id] = { n: r.n, t: r.blob.type, s: r.blob.size, d: d }; }); })); })
        .catch(function () {}).then(function () { ready = true; api.sync(); api.info(); if (onReady) onReady(); }); },
      add: function (blob, name) {
        if (total() + blob.size > MAX_TOTAL) return Promise.reject(new Error("voll"));
        var id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        pending[id] = 1;
        return tx("readwrite", function (st) { st.put({ id: id, n: name, blob: blob }); }).then(function () { return b64(blob); }).then(function (d) {
          cache[id] = { n: name, t: blob.type, s: blob.size, d: d }; api.info();
          try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
          return id; }, function (e) { delete pending[id]; throw e; });
      },
      used: function (id) { delete pending[id]; },
      del: function (id) { if (!id) return; delete cache[id]; delete pending[id]; api.info(); tx("readwrite", function (st) { st.delete(id); }).catch(function () {}); },
      get: function (id) { return tx("readonly", function (st) { return st.get(id); }).then(function (r) { return r && r.blob; }); },
      clear: function () { cache = {}; pending = {}; api.info(); tx("readwrite", function (st) { st.clear(); }).catch(function () {}); },
      sync: function () { var st = getState(); if (!ready || !st || st.example) return; var r = refs(st); Object.keys(cache).forEach(function (id) { if (!r[id] && !pending[id]) api.del(id); }); },
      pack: function (st) { var r = refs(st), docs = {}, c = JSON.parse(JSON.stringify(st)); Object.keys(r).forEach(function (id) { if (cache[id]) docs[id] = cache[id]; }); if (Object.keys(docs).length) c.docs = docs; return c; },
      restore: function (docs) { Object.keys(docs || {}).forEach(function (id) { var x = docs[id]; if (!x || typeof x.d !== "string" || !/^d[a-z0-9]+$/.test(id)) return;
          try { var bl = unb64(x.d, /^(image\/jpeg|image\/png|application\/pdf)$/.test(x.t) ? x.t : "application/octet-stream"); cache[id] = { n: String(x.n || "Beleg").slice(0, 80), t: bl.type, s: bl.size, d: x.d };
            tx("readwrite", function (st) { st.put({ id: id, n: cache[id].n, blob: bl }); }).catch(function () {}); } catch (e) {} });
        api.info(); },
      infoEl: null,
      info: function () { var e = api.infoEl; if (!e) return; var n = Object.keys(cache).length, t = total(); e.textContent = "";
        e.appendChild(h("span", null, n ? n + (n === 1 ? " Beleg" : " Belege") + " gespeichert, " + mb(t) + " von " + mb(MAX_TOTAL) + "." : "Noch keine Belege gespeichert."));
        var b = h("div", "thd-bar"), i = h("i"); i.style.width = Math.min(100, t / MAX_TOTAL * 100) + "%"; b.appendChild(i); e.appendChild(b); }
    };
    return api;
  }

  /* ---------- Feld markieren: gelb = erkannt, darunter die Fundstelle ---------- */
  function mark(el, value, quelle) {
    if (!el) return; if (value != null) el.value = value; el.classList.add("thd-auto");
    var src = el.parentNode && el.parentNode.querySelector('.thd-src[data-for="' + el.id + '"]');
    if (!src && el.parentNode) { src = h("small", "thd-src"); src.setAttribute("data-for", el.id); el.parentNode.appendChild(src); }
    if (src) src.textContent = quelle ? "Gefunden: „" + (quelle.length > 90 ? quelle.slice(0, 88) + " …" : quelle) + "“" : "";
    if (!el._thd) { el._thd = 1; el.addEventListener("input", function () { el.classList.remove("thd-auto"); }); el.addEventListener("change", function () { el.classList.remove("thd-auto"); }); }
  }
  function unmark(root) { (root || document).querySelectorAll(".thd-auto").forEach(function (x) { x.classList.remove("thd-auto"); }); (root || document).querySelectorAll(".thd-src").forEach(function (x) { x.textContent = ""; }); }

  /* ---------- Hochlade-Feld ---------- */
  var libs = {};
  function loadScript(src) { if (!libs[src]) libs[src] = new Promise(function (ok, no) { var sc = document.createElement("script"); sc.src = src; sc.onload = ok; sc.onerror = function () { delete libs[src]; no(new Error("laden")); }; document.head.appendChild(sc); }); return libs[src]; }
  function box(o) {
    /* o: mount (Element, Feld wird am Anfang eingefügt), store, kind ("bon"|"rechnung"), label, note, onResult(fields, r), onReset() */
    css();
    var wrap = h("div", "thd-box"), btn = h("button", "thd-btn"), inp = h("input"), note = h("p", "thd-note"), prog = h("div", "thd-prog"), step = h("span", null, ""), bar = h("div", "thd-bar"), bi = h("i");
    btn.type = "button"; btn.innerHTML = ICON_SCAN; btn.appendChild(document.createTextNode(o.label || "Beleg abfotografieren"));
    inp.type = "file"; inp.accept = "image/*,application/pdf,.pdf"; inp.hidden = true;
    note.innerHTML = ICON_LOCK; note.appendChild(h("span", null, o.note || "Foto oder PDF. Der Beleg bleibt auf diesem Gerät: Die App liest ihn direkt hier im Browser, nichts wird hochgeladen."));
    prog.hidden = true; bar.appendChild(bi); prog.appendChild(step); prog.appendChild(bar);
    var res = h("div", "thd-res"), chip = h("div", "thd-chip"), cname = h("span"), drop = h("button", "thd-mini", "Verwerfen"), sum = h("p", "thd-sum"), hints = h("ul", "thd-hints"), det = h("details", "thd-txt"), pre = h("pre");
    drop.type = "button"; chip.appendChild(cname); chip.appendChild(drop); det.appendChild(h("summary", null, "Erkannten Text ansehen")); det.appendChild(pre);
    res.hidden = true; [chip, sum, hints, det].forEach(function (x) { res.appendChild(x); });
    [btn, inp, note, prog, res].forEach(function (x) { wrap.appendChild(x); });
    var first = o.mount.firstElementChild;
    if (first && first.tagName === "H2") o.mount.insertBefore(wrap, first.nextSibling); else o.mount.insertBefore(wrap, first);
    var pendingId = null, busy = false;
    function progress(t, p) { prog.hidden = false; step.textContent = t + (p >= 0 ? " … " + Math.round(p * 100) + " %" : " …"); prog.classList.toggle("wait", !(p >= 0)); if (p >= 0) bi.style.width = Math.round(p * 100) + "%"; }
    function reset(keepDoc) { if (!keepDoc && pendingId) o.store.del(pendingId); pendingId = null; res.hidden = true; prog.hidden = true; unmark(o.mount); if (o.onReset) o.onReset(); }
    btn.addEventListener("click", function () { if (!busy) inp.click(); });
    drop.addEventListener("click", function () { reset(); say("Verworfen. Nichts gespeichert."); });
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0]; inp.value = ""; if (!f) return;
      var pdf = /pdf/i.test(f.type) || /\.pdf$/i.test(f.name || "");
      if (!pdf && !/^image\//i.test(f.type || "")) { say("Bitte ein Foto oder PDF wählen."); return; }
      if (f.size > MAX_IN || (pdf && f.size > MAX_PDF)) { say(pdf ? "PDF ist zu groß (max. 5 MB)." : "Bild ist zu groß (max. 25 MB)."); return; }
      reset(); busy = true; progress("Lese Beleg", -1);
      var parser = o.kind === "vertrag" ? "regeln.js" : "bon.js";
      Promise.all([loadScript(OCR + parser), loadScript(OCR + "scan.js")]).then(function () { return window.THScan.read(f, progress, o.kind); }).then(function (r) {
        var blob = pdf ? f : (r.saveBlob || f), name = f.name || (pdf ? "Beleg.pdf" : "Beleg.jpg");
        cname.textContent = (pdf ? "PDF: " : "Foto: ") + name + " (" + mb(blob.size) + ")";
        pre.textContent = (r.text || "").trim() || "(kein Text)";
        var F = r.fields, weak = (F.textLen || 0) < 25, found = [];
        try { found = o.onResult(F, r) || []; } catch (e) { try { console.warn(e); } catch (x) {} }
        sum.textContent = weak ? "Hier war kaum Text zu erkennen. Bitte selbst eintragen." : (found.length ? "Erkannt: " + found.join(", ") + "." : "Nichts sicher erkannt.") + " Bitte prüfen, dann speichern.";
        hints.innerHTML = ""; (F.hints || []).concat(weak && !pdf ? ["Tipp: Beleg flach hinlegen, gutes Licht, ganz im Bild."] : []).forEach(function (t) { hints.appendChild(h("li", null, t)); });
        prog.hidden = true; res.hidden = false;
        wrap.scrollIntoView({ behavior: "smooth", block: "start" });
        return o.store.add(blob, name).then(function (id) { pendingId = id; }, function (e) { cname.textContent += e && e.message === "voll" ? " · nicht gespeichert, Speicher voll" : " · nicht gespeichert"; });
      }).catch(function (err) {
        try { console.warn("Beleg lesen:", err && (err.stack || err.message || err)); } catch (e) {}
        prog.hidden = true;
        var pw = err && /password/i.test(err.name || err.message || "");
        say(pw ? "Das PDF hat ein Passwort. Bitte ohne Passwort speichern." : navigator.onLine === false ? "Beim ersten Mal braucht die Erkennung einmal Internet." : "Das hat nicht geklappt. Bitte selbst eintragen.");
      }).then(function () { busy = false; });
    });
    return {
      /* Beim Speichern aufrufen: gibt die Beleg-Nummer zurück (oder "") und gibt das Feld frei */
      take: function () { var id = pendingId || ""; if (id) o.store.used(id); pendingId = null; res.hidden = true; unmark(o.mount); return id; },
      reset: reset, pick: function () { if (!busy) inp.click(); }, el: wrap
    };
  }

  /* ---------- Büroklammer-Knopf und Ansicht ---------- */
  var view = null;
  function viewer() {
    if (view) return view; css();
    var v = h("div", "thd-view"), bar = h("div", "bar"), title = h("b"), sv = h("button", "thd-mini", "Speichern"), rm = h("button", "thd-mini", "Entfernen"), cl = h("button", "thd-mini", "Schließen"), body = h("div", "body");
    [sv, rm, cl].forEach(function (b) { b.type = "button"; }); v.hidden = true; v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true");
    bar.appendChild(title); bar.appendChild(sv); bar.appendChild(rm); bar.appendChild(cl); v.appendChild(bar); v.appendChild(body); document.body.appendChild(v);
    view = { v: v, title: title, sv: sv, rm: rm, cl: cl, body: body, url: null };
    function close() { v.hidden = true; body.textContent = ""; if (view.url) { var u = view.url; setTimeout(function () { URL.revokeObjectURL(u); }, 60000); } view.url = null; }
    cl.addEventListener("click", close); document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !v.hidden) close(); }); view.close = close;
    return view;
  }
  function show(D, id, label, onRemove) {
    var V = viewer(), m = D.meta(id); if (!m) return;
    D.get(id).then(function (bl) {
      if (!bl) { say("Beleg nicht gefunden."); return; }
      var u = URL.createObjectURL(bl); V.url = u; V.body.textContent = ""; V.title.textContent = label || m.n; V.v.hidden = false;
      if (/^image\//.test(bl.type)) { var im = h("img"); im.alt = "Beleg " + (label || ""); im.src = u; V.body.appendChild(im); }
      else { var bx = h("div", "pdf"); bx.appendChild(h("b", null, m.n)); bx.appendChild(h("p", null, "PDF, " + mb(bl.size) + ". Öffnet im PDF-Programm deines Geräts.")); var a = h("a", "thd-btn", "PDF öffnen"); a.href = u; a.target = "_blank"; a.rel = "noopener"; bx.appendChild(a); V.body.appendChild(bx); }
      V.sv.onclick = function () { var a = document.createElement("a"); a.href = u; a.download = m.n || "Beleg"; document.body.appendChild(a); a.click(); a.remove(); };
      V.rm.onclick = function () {   /* eigene Nachfrage statt confirm() */
        if (V.body.querySelector(".ask")) return;
        var ask = h("div", "ask"); ask.appendChild(h("span", null, "Gespeicherten Beleg entfernen? Der Eintrag bleibt."));
        var yes = h("button", "thd-btn", "Ja, Beleg entfernen"), no = h("button", "thd-mini", "Abbrechen"); yes.type = no.type = "button";
        yes.addEventListener("click", function () { D.del(id); V.close(); if (onRemove) onRemove(); say("Beleg entfernt."); }); no.addEventListener("click", function () { ask.remove(); });
        ask.appendChild(yes); ask.appendChild(no); V.body.insertBefore(ask, V.body.firstChild); };
    });
  }
  function clip(D, item, label, onRemove) {
    if (!item || !item.f || !D.has(item.f)) return null; css();
    var b = h("button", "thd-clip"); b.type = "button"; b.innerHTML = ICON_CLIP; b.title = "Beleg ansehen"; b.setAttribute("aria-label", "Beleg zu " + (label || "Eintrag") + " ansehen");
    b.addEventListener("click", function (e) { e.stopPropagation(); show(D, item.f, label, function () { delete item.f; if (onRemove) onRemove(); }); });
    return b;
  }
  /* Karte „Gespeicherte Belege“ im Mehr-Reiter, direkt vor „Deine Daten“ */
  function storeCard(D, text) {
    css(); var ex = document.getElementById("exportBtn"), card = ex && ex.closest(".card"); if (!card) return;
    var c = h("div", "card"); c.appendChild(h("h2", null, "Gespeicherte Belege")); var p = h("div", "thd-store"); c.appendChild(p);
    c.appendChild(h("p", "thd-note", text || "Belege liegen nur auf diesem Gerät und sind in „Daten sichern“ mit drin. Die Texterkennung läuft hier im Browser, dafür lädt die App beim ersten Mal einmalig ca. 5 MB von unserer Seite. Deine Belege selbst werden nie hochgeladen."));
    card.parentNode.insertBefore(c, card); D.infoEl = p; D.info();
  }

  window.THDocs = { store: store, box: box, mark: mark, unmark: unmark, clip: clip, show: show, storeCard: storeCard, mb: mb };
})();
