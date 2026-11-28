/* Tabellenheld Abo-Tracker: Vertrag lesen (28.11.2026). Wird erst geladen, wenn jemand einen Vertrag auswählt.
   PDF mit Text: pdf.js liest den Text direkt. Foto oder gescanntes PDF: Tesseract.js (Deutsch) erkennt den Text.
   Alles läuft im Browser auf dem Gerät. Die Programme kommen von unserer eigenen Seite (Ordner ocr/), kein fremder Server,
   die Datei des Kunden wird nirgendwohin geschickt. */
(function () {
  "use strict";
  var BASE = new URL("ocr/", document.baseURI).href;
  var MAX_SIDE_OCR = 2200, MAX_SIDE_SAVE = 1600, PDF_TEXT_PAGES = 6, PDF_OCR_PAGES = 3;

  function loadScript(src) {
    return new Promise(function (ok, no) {
      var s = document.createElement("script"); s.src = src; s.async = true;
      s.onload = function () { ok(); }; s.onerror = function () { no(new Error("laden")); };
      document.head.appendChild(s);
    });
  }
  function imgFromBlob(blob) {
    return new Promise(function (ok, no) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () { ok(im); setTimeout(function () { URL.revokeObjectURL(u); }, 1000); };
      im.onerror = function () { URL.revokeObjectURL(u); no(new Error("bild")); };
      im.src = u;
    });
  }
  function canvasOf(src, w, h, maxSide, gray) {
    var k = Math.min(1, maxSide / Math.max(w, h)), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
    if (gray) {
      var d = x.getImageData(0, 0, c.width, c.height), p = d.data, lo = 255, hi = 0, i, v;
      for (i = 0; i < p.length; i += 4) { v = p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114; p[i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
      var span = Math.max(40, hi - lo);
      for (i = 0; i < p.length; i += 4) { v = (p[i] - lo) * 255 / span; v = v < 0 ? 0 : v > 255 ? 255 : v; p[i] = p[i + 1] = p[i + 2] = v; }
      x.putImageData(d, 0, 0);
    }
    return c;
  }
  function toBlob(c, q) { return new Promise(function (ok) { c.toBlob(function (b) { ok(b); }, "image/jpeg", q); }); }

  /* ---------- Texterkennung (Tesseract.js) ---------- */
  var tessReady = null;
  function tesseract() {
    if (!tessReady) tessReady = (window.Tesseract ? Promise.resolve() : loadScript(BASE + "tesseract.min.js")).catch(function (e) { tessReady = null; throw e; });
    return tessReady;
  }
  function ocr(canvases, progress) {
    return tesseract().then(function () {
      var share = 1 / canvases.length, done = 0;
      return window.Tesseract.createWorker("deu", 1, {
        workerPath: BASE + (window.TH_WORKER || "worker.min.js"),  /* TH_WORKER: nur für die Vorschau-Seite */ corePath: BASE + "core", langPath: BASE + "lang",
        workerBlobURL: false, cacheMethod: "none", gzip: true,
        logger: function (m) {
          if (m.status === "recognizing text") progress("Lese Text", done * share + m.progress * share);
          else if (/loading|initializ/.test(m.status || "")) progress("Lade Texterkennung (einmalig ca. 5 MB)", -1);
        }
      }).then(function (w) {
        var out = [], chain = Promise.resolve();
        canvases.forEach(function (c) { chain = chain.then(function () { return w.recognize(c).then(function (r) { out.push(r.data.text || ""); done++; }); }); });
        return chain.then(function () { return w.terminate(); }, function (e) { w.terminate(); throw e; }).then(function () { return out.join("\n\n"); });
      });
    });
  }

  /* ---------- PDF (pdf.js) ---------- */
  var pdfReady = null;
  function pdfjs() {
    if (!pdfReady) pdfReady = import(BASE + "pdf.min.js").then(function (lib) { lib.GlobalWorkerOptions.workerSrc = BASE + "pdf.worker.min.js"; return lib; })
      .catch(function (e) { pdfReady = null; throw e; });
    return pdfReady;
  }
  function readPdf(file, progress) {
    progress("Öffne PDF", -1);
    return Promise.all([pdfjs(), file.arrayBuffer()]).then(function (a) {
      var lib = a[0];
      var task = lib.getDocument({ data: new Uint8Array(a[1]), isEvalSupported: false, enableXfa: false, disableFontFace: true, useSystemFonts: false,
        wasmUrl: BASE + "wasm/", stopAtErrors: false });
      return task.promise.then(function (doc) { doc._task = task; return doc; });
    }).then(function (doc) {
      function end() { try { if (doc._task && doc._task.destroy) doc._task.destroy(); else if (doc.destroy) doc.destroy(); } catch (e) {} }
      var n = Math.min(doc.numPages, PDF_TEXT_PAGES), texts = [], chain = Promise.resolve();
      for (var i = 1; i <= n; i++) (function (i) { chain = chain.then(function () { return doc.getPage(i).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
        var s = ""; tc.items.forEach(function (it) { if (it.str != null) s += it.str + (it.hasEOL ? "\n" : " "); }); texts.push(s); }); }); })(i);
      return chain.then(function () {
        var text = texts.join("\n");
        if (text.replace(/\s/g, "").length >= 60) { end(); return { text: text, kind: "pdf", pages: doc.numPages }; }
        /* kein Text drin: gescanntes PDF, Seiten als Bild erkennen */
        var m = Math.min(doc.numPages, PDF_OCR_PAGES), cs = [], ch = Promise.resolve();
        for (var j = 1; j <= m; j++) (function (j) { ch = ch.then(function () { progress("Bereite Seite " + j + " vor", -1); return doc.getPage(j).then(function (pg) {
          var vp1 = pg.getViewport({ scale: 1 }), sc = Math.min(3, MAX_SIDE_OCR / Math.max(vp1.width, vp1.height)), vp = pg.getViewport({ scale: sc });
          var c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
          return pg.render({ canvasContext: c.getContext("2d"), viewport: vp, background: "#ffffff" }).promise.then(function () { cs.push(c); }); }); }); })(j);
        return ch.then(function () { return ocr(cs, progress); }).then(function (t) { end(); return { text: t, kind: "pdf-ocr", pages: doc.numPages }; });
      });
    });
  }

  /* ---------- Foto ---------- */
  function readImage(file, progress) {
    progress("Bereite Foto vor", -1);
    return imgFromBlob(file).then(function (im) {
      var w = im.naturalWidth, h = im.naturalHeight;
      var c = canvasOf(im, w, h, MAX_SIDE_OCR, true);
      return Promise.all([ocr([c], progress), toBlob(canvasOf(im, w, h, MAX_SIDE_SAVE, false), .72)]);
    }).then(function (a) { return { text: a[0], kind: "foto", pages: 1, saveBlob: a[1] }; });
  }

  function isPdf(file) { return /pdf/i.test(file.type) || /\.pdf$/i.test(file.name || ""); }
  function read(file, progress) {
    progress = progress || function () {};
    var p = isPdf(file) ? readPdf(file, progress) : readImage(file, progress);
    return p.then(function (r) { r.fields = window.VertragRegeln.parse(r.text, new Date()); return r; });
  }
  window.VertragScan = { read: read, isPdf: isPdf };
})();
