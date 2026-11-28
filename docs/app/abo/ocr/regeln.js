/* Tabellenheld Abo-Tracker: Vertragstext auslesen (28.11.2026).
   Einfache Regeln, keine KI, läuft komplett im Browser. Eingabe: Text aus PDF oder Texterkennung.
   Ausgabe: Vorschläge für Anbieter, Betrag, Rhythmus, Laufzeit, Kündigungsfrist, Beginn, Ende, Kategorie, kündbar bis.
   Jeder Vorschlag hat eine Fundstelle (q), damit der Kunde sieht, woher er kommt. */
(function (root) {
  "use strict";

  /* Kategorien wie in der App: 0 Wohnen, 1 Energie, 2 Handy/Internet, 3 Versicherung, 4 Streaming/Medien, 5 Mobilität, 6 Sport/Freizeit, 7 Finanzen, 8 Sonstiges */
  var CAT_WORDS = [
    [0, /\b(miete|mietvertrag|kaltmiete|warmmiete|nebenkosten|hausverwaltung|vermieter|wohnung|stellplatz|garage)\b/g],
    [1, /\b(strom|gas|erdgas|fernwärme|kwh|energie|stadtwerke|ökostrom|abschlag|zählernummer|arbeitspreis|wärmepumpe)\w*/g],
    [2, /\b(mobilfunk|handy|smartphone|sim|dsl|glasfaser|internet|festnetz|tarif|datenvolumen|router|tkg|mbit|telekommunikation|rufnummer|telekom|vodafone|o2|telefónica|telefonica|1&1|congstar|freenet|drillisch|aldi talk|lebara|klarmobil|winsim|unitymedia|pyur|kabel)\w*/g],
    [3, /\b(versicherung|versicherungsschein|police|haftpflicht|hausrat|kasko|kfz-versicherung|rechtsschutz|berufsunfähigkeit|zahnzusatz|krankenzusatz|unfallversicherung|versicherungsnehmer|prämie|allianz|huk|ergo|axa|generali|debeka|signal iduna|devk|provinzial|lvm|r\+v|gothaer|barmenia|cosmos)\w*/g],
    [4, /\b(netflix|spotify|disney|dazn|sky|wow|rtl\+|joyn|paramount|apple tv|apple music|youtube premium|deezer|audible|kindle|zeitung|zeitschrift|magazin|abonnement|streaming|rundfunk|e-paper|epaper|prime video)\w*/g],
    [5, /\b(deutschlandticket|d-ticket|bahncard|monatskarte|jobticket|leasing|carsharing|e-scooter|fahrrad-abo|swapfiller|swapfiets|autoabo|auto-abo|parkplatz)\w*/g],
    [6, /\b(fitness|fitnessstudio|studio|mitgliedschaft|verein|mcfit|clever fit|fitx|john reed|urban sports|kieser|schwimmbad|tanzschule|yoga)\w*/g],
    [7, /\b(girokonto|kontoführung|kreditkarte|depot|bausparvertrag|bauspar|darlehen|kredit|ratenkredit|sparplan|kontomodell)\w*/g]
  ];

  /* Bekannte Anbieter (nur zum Erkennen des Namens im Text). */
  var KNOWN = ["Telekom", "Vodafone", "O2", "1&1", "congstar", "freenet", "Telefónica", "PYUR", "Netflix", "Spotify", "Disney+", "DAZN", "Sky", "WOW", "RTL+", "Joyn",
    "Paramount+", "Apple", "YouTube Premium", "Amazon Prime", "Audible", "Deezer", "E.ON", "EnBW", "Vattenfall", "RWE", "Yello", "EWE", "Lichtblick", "Octopus Energy",
    "Tibber", "Naturstrom", "Allianz", "HUK-COBURG", "HUK24", "ERGO", "AXA", "Generali", "Debeka", "Signal Iduna", "DEVK", "Provinzial", "LVM", "R+V", "Gothaer", "Barmenia",
    "CosmosDirekt", "Check24", "McFit", "clever fit", "FitX", "John Reed", "Urban Sports Club", "Kieser", "BahnCard", "ADAC", "ShareNow", "Swapfiets", "Sixt", "Deutsche Bahn"];

  var NUMW = { ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, zwölf: 12, vierundzwanzig: 24 };
  var NUM = "(\\d{1,3}|ein|eine|einen|einem|einer|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|zwölf|vierundzwanzig)";
  function n(w) { w = String(w).toLowerCase(); return NUMW[w] || parseInt(w, 10) || 0; }

  function pad(x) { return (x < 10 ? "0" : "") + x; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function dateOf(s) {
    var m = /(\d{1,2})\s?\.\s?(\d{1,2})\s?\.\s?(\d{2,4})/.exec(s);
    if (m) { var y = +m[3]; if (y < 100) y += 2000; var d = new Date(y, +m[2] - 1, +m[1]); if (d.getMonth() === +m[2] - 1 && y > 1990 && y < 2100) return d; }
    var MON = { januar: 0, jan: 0, februar: 1, feb: 1, märz: 2, maerz: 2, mär: 2, april: 3, apr: 3, mai: 4, juni: 5, jun: 5, juli: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8, oktober: 9, okt: 9, november: 10, nov: 10, dezember: 11, dez: 11 };
    m = /(\d{1,2})\.?\s+(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+(\d{4})/i.exec(s);
    if (m) return new Date(+m[3], MON[m[2].toLowerCase()], +m[1]);
    return null;
  }
  function addMonths(d, k) { var r = new Date(d.getFullYear(), d.getMonth() + k, d.getDate()); if (r.getDate() !== d.getDate()) r.setDate(0); return r; }

  /* Text glätten: typische Fehler der Texterkennung und PDF-Zeilen. */
  function clean(t) {
    return String(t || "")
      .replace(/\r/g, "\n").replace(/[   ]/g, " ").replace(/[ \t]+/g, " ")
      .replace(/(\d) ?, ?(\d\d)\b/g, "$1,$2")            /* 24 ,99 -> 24,99 */
      .replace(/(\d),(\d\d) ?(?:EUR|Euro|EURO|€|E\b|C\b)/g, "$1,$2 €")
      .replace(/€ ?(\d)/g, "€ $1")
      .replace(/\b[Ee]uro\b/g, "€");
  }

  function amountsIn(line) {
    var out = [], re = /(?:€\s?)?(\d{1,3}(?:\.\d{3})*|\d+)[,.](\d{2})(?!\d)(?:\s?€)?/g, m;
    while ((m = re.exec(line))) {
      var hasEur = /€/.test(m[0]) || /€|EUR/i.test(line.slice(Math.max(0, m.index - 6), m.index + m[0].length + 6));
      var whole = m[1].replace(/\./g, ""), v = parseFloat(whole + "." + m[2]);
      if (!(v > 0) || v > 20000) continue;
      if (/[.,]\d{2}[.,]\d/.test(line.slice(m.index, m.index + m[0].length + 2))) continue; /* Datum 01.03.2026 */
      if (/\d\.\d{2}\.\d{2,4}/.test(line.slice(Math.max(0, m.index - 3), m.index + m[0].length + 5)) && !hasEur) continue;
      out.push({ v: v, eur: hasEur, i: m.index, raw: m[0] });
    }
    return out;
  }

  var RX = {
    month: /(monatlich|mtl\.?|monatl\.?|pro monat|je monat|im monat|\/ ?monat|\/ ?mon\.?|monatsbeitrag|monatspreis|monatliche|abschlag|grundgebühr|rate\b|p\.\s?m\.)/i,
    year: /(jährlich|jährl\.?|pro jahr|je jahr|im jahr|\/ ?jahr|jahresbeitrag|jahresprämie|jahrespreis|p\.\s?a\.|jahresgebühr|jahresabo)/i,
    quarter: /(vierteljährlich|quartal|vierteljährl)/i,
    half: /(halbjährlich|halbjährl|halbjahr)/i,
    good: /(gesamt|summe|zu zahlen|zahlbetrag|beitrag|preis|kosten|abschlag|grundgebühr|tarif|monatlich|jährlich|abbuchung|lastschrift)/i,
    after: /(danach|anschließend|ab dem \d+\. ?monat|ab monat|regulär|regulärer|normalpreis|ab dem \d+\. ?vertragsmonat)/i,
    promo: /(aktion|in den ersten|erste[nr]? \d+ monat|monate? \d+[-–]\d+|rabatt|ersparnis|gutschrift|bonus|sparen sie|statt)/i,
    bad: /(einmalig|anschluss|bereitstellung|aktivierung|versand|einrichtung|kaution|mahngebühr|rücklastschrift|gebühr für|pfand|ct\/kwh|cent\/kwh|ct pro|\/ ?kwh|je kwh|pro kwh|mwst\.? ?\(|davon mwst|umsatzsteuer|ust\.?|gerät|endgerät|hardware|zuzahlung|selbstbeteiligung|versicherungssumme|deckungssumme|bis zu)/i
  };

  function findAmount(lines) {
    var best = null, promoSeen = false;
    lines.forEach(function (L, li) {
      var list = amountsIn(L); if (!list.length) return;
      var ctx = (lines[li - 1] || "") + " " + L + " " + (lines[li + 1] || "");
      list.forEach(function (a) {
        var near = L.slice(Math.max(0, a.i - 60), a.i + a.raw.length + 40);
        var s = a.eur ? 2 : -1, rh = null;
        if (RX.month.test(near)) { s += 4; rh = "m"; } else if (RX.quarter.test(near)) { s += 4; rh = "q"; } else if (RX.half.test(near)) { s += 4; rh = "h"; } else if (RX.year.test(near)) { s += 4; rh = "j"; }
        else if (RX.month.test(ctx)) { s += 1.5; rh = "m"; } else if (RX.year.test(ctx)) { s += 1.5; rh = "j"; }
        if (RX.good.test(near)) s += 1.5;
        if (/(gesamt|summe|zu zahlen|zahlbetrag)/i.test(near)) s += 1.5;
        if (RX.after.test(near)) s += 3;
        if (RX.promo.test(near) && !RX.after.test(near)) { s -= 2.5; promoSeen = true; }
        if (RX.bad.test(near)) s -= 5;
        if (a.v < 1) s -= 2;
        if (!best || s > best.s || (s === best.s && a.v > best.v)) best = { s: s, v: a.v, r: rh, q: L.trim() };
      });
    });
    if (!best || best.s < 1.5) return null;
    best.promo = promoSeen;
    return best;
  }

  function months(numStr, unit) { var k = n(numStr); return /jahr/i.test(unit) ? k * 12 : k; }

  function findTerm(t) {
    var m;
    if ((m = /(keine (mindest)?(vertrags)?laufzeit|ohne (mindest)?laufzeit|monatlich kündbar|jederzeit kündbar|täglich kündbar)/i.exec(t))) return { v: 0, q: m[0] };
    var res = [
      new RegExp("(?:mindest)?(?:vertrags)?laufzeit(?:\\s*(?:von|beträgt|:|-|\\s)){0,3}[^\\d\\n]{0,20}?" + NUM + "\\s*(monat|monate|monaten|jahr|jahre|jahren)\\b", "i"),
      new RegExp(NUM + "\\s*(monat|monate|monaten|jahr|jahre|jahren)\\s*(?:mindest)?(?:vertrags)?laufzeit", "i"),
      new RegExp("(?:mindest)?(?:vertrags)?dauer(?:\\s*(?:von|beträgt|:|\\s)){0,3}[^\\d\\n]{0,15}?" + NUM + "\\s*(monat|monate|monaten|jahr|jahre|jahren)\\b", "i"),
      new RegExp("(?:läuft|abgeschlossen)\\s(?:zunächst\\s)?(?:für|auf)\\s(?:die dauer von\\s)?" + NUM + "\\s*(monat|monate|monaten|jahr|jahre|jahren)\\b", "i")
    ];
    for (var i = 0; i < res.length; i++) { m = res[i].exec(t); if (m) { var v = months(m[1], m[2]); if (v > 0 && v <= 120) return { v: v, q: m[0] }; } }
    return null;
  }

  function findNotice(t) {
    var m, res = [
      new RegExp("kündigungsfrist(?:\\s*(?:von|beträgt|:|-|\\s)){0,3}[^\\d\\n]{0,25}?" + NUM + "\\s*(woche|wochen|monat|monate|monaten|tag|tage|tagen)\\b", "i"),
      new RegExp("(?:mit|unter einhaltung) einer frist von " + NUM + "\\s*(woche|wochen|monat|monate|monaten|tag|tage|tagen)\\b", "i"),
      new RegExp("(?:spätestens|bis spätestens)\\s" + NUM + "\\s*(woche|wochen|monat|monate|monaten|tag|tage|tagen)\\s*(?:vor|zum)", "i"),
      new RegExp(NUM + "\\s*(woche|wochen|monat|monate|monaten|tag|tage|tagen)\\s*(?:vor|zum)\\s*(?:dem\\s)?(?:ende|ablauf)", "i"),
      new RegExp("kündbar\\s(?:mit|unter einhaltung)\\s(?:einer frist von\\s)?" + NUM + "\\s*(woche|wochen|monat|monate|monaten|tag|tage|tagen)", "i")
    ];
    for (var i = 0; i < res.length; i++) { m = res[i].exec(t); if (m) { var k = n(m[1]); if (k > 0 && k <= 24) return { v: k, u: /woch/i.test(m[2]) ? "w" : /tag/i.test(m[2]) ? "t" : "m", q: m[0] }; } }
    if ((m = /monatlich kündbar|jederzeit (zum monatsende )?kündbar/i.exec(t))) return { v: 1, u: "m", q: m[0], soft: true };
    return null;
  }

  function findDate(lines, rx) {
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i], m = rx.exec(L);
      if (!m) continue;
      var rest = L.slice(m.index) + " " + (lines[i + 1] || ""), d = dateOf(rest);
      if (d) return { v: iso(d), d: d, q: L.trim() };
    }
    return null;
  }

  function findProvider(t, lines) {
    var low = t.toLowerCase(), hit = null;
    KNOWN.forEach(function (k) { var i = low.indexOf(k.toLowerCase()); if (i < 0) return;
      var before = low.charAt(i - 1), after = low.charAt(i + k.length);
      if (/[a-zäöüß]/.test(before) || (/[a-zäöüß]/.test(after) && !/[+]/.test(k))) return;
      if (!hit || i < hit.i) hit = { v: k, i: i, q: k }; });
    var lf = /([A-ZÄÖÜ0-9][\wÄÖÜäöüß&.+\-]*(?: [A-ZÄÖÜ0-9&][\wÄÖÜäöüß&.+\-]*){0,4}) (GmbH & Co\. KG|GmbH|AG|SE|KGaA|KG|eG|e\. ?V\.|Ltd\.?|B\.V\.|S\.à r\.l\.|VVaG|a\. ?G\.)(?![\wäöü])/;
    var stw = /\b(Stadtwerke [A-ZÄÖÜ][\wäöüß\-]+)/;
    for (var i = 0; i < Math.min(lines.length, 80); i++) {
      var L = lines[i], m = stw.exec(L) || lf.exec(L);
      if (!m) continue;
      var name = (m[1] + (m[2] ? " " + m[2] : "")).trim().replace(/^(Ihr|Ihre|Die|Der|Das|bei der|bei|von der|von) /i, "");
      if (/^(Sitz|Registergericht|Amtsgericht|Geschäftsführ|Vorstand|USt|HRB)/i.test(name)) continue;
      var short = m[1].replace(/^(Ihr|Ihre|Die|Der|Das) /i, "").replace(/\s+(GmbH(\s*&\s*Co\.?)?|AG|SE|KG|mbH)$/i, "").trim();
      if (hit && short.toLowerCase().indexOf(hit.v.toLowerCase()) >= 0) return { v: hit.v, q: L.trim() };
      if (!hit) return { v: short.length > 34 ? short.slice(0, 34).trim() : short, q: L.trim() };
      break;
    }
    if (hit) return { v: hit.v, q: hit.q };
    var w = /(?:www\.|@)([a-z0-9\-]{3,30})\.(?:de|com|eu|net|at)\b/i.exec(t);
    if (w) return { v: w[1].charAt(0).toUpperCase() + w[1].slice(1), q: w[0], weak: true };
    return null;
  }

  function findCategory(t) {
    var low = t.toLowerCase(), best = 8, bs = 0;
    CAT_WORDS.forEach(function (c) { var k = (low.match(c[1]) || []).length; if (k > bs) { bs = k; best = c[0]; } });
    return { v: best, sure: bs >= 2 };
  }

  function parse(text, today) {
    var t = clean(text), lines = t.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean), flat = lines.join("\n");
    today = today || new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var r = { textLen: t.replace(/\s/g, "").length, hints: [] };
    r.anbieter = findProvider(flat, lines);
    r.betrag = findAmount(lines);
    if (r.betrag) { r.rhythmus = { v: r.betrag.r || "m", sure: !!r.betrag.r }; if (r.betrag.promo) r.hints.push("Im Vertrag steht ein Aktionspreis. Prüf, welcher Betrag später abgebucht wird."); }
    r.laufzeit = findTerm(flat);
    r.frist = findNotice(flat);
    r.beginn = findDate(lines, /(vertragsbeginn|versicherungsbeginn|lieferbeginn|vertragsstart|beginn des vertrags|beginn der mitgliedschaft|mitglied seit|laufzeitbeginn|startdatum|aktivierungsdatum|gültig ab|beginn\s*:|beginnt am|ab dem)/i);
    r.ende = findDate(lines, /(vertragsende|laufzeitende|ende der (mindest)?laufzeit|endet am|läuft bis|mindestlaufzeit bis|gültig bis|ablauf am|ablauf\b)/i);
    r.kategorie = findCategory(flat);

    /* Ende der Laufzeit und „kündbar bis“ ausrechnen */
    var end = r.ende ? r.ende.d : null;
    if (!end && r.beginn && r.laufzeit && r.laufzeit.v > 0) { end = addMonths(r.beginn.d, r.laufzeit.v); end.setDate(end.getDate() - 1); r.endeCalc = iso(end); }
    if (end && r.frist && !r.frist.soft) {
      var k = new Date(end); if (r.frist.u === "m") k = addMonths(end, -r.frist.v); else k.setDate(k.getDate() - r.frist.v * (r.frist.u === "w" ? 7 : 1));
      if (k >= today) r.kuendbar = { v: iso(k) };
      else r.hints.push("Die Mindestlaufzeit ist schon vorbei (" + pad(end.getDate()) + "." + pad(end.getMonth() + 1) + "." + end.getFullYear() + "). Welche Frist jetzt gilt, steht im Vertrag.");
    }
    if (r.beginn && r.rhythmus && r.rhythmus.v !== "m") r.monat = r.beginn.d.getMonth() + 1;
    return r;
  }

  var api = { parse: parse, clean: clean };
  if (typeof module === "object" && module.exports) module.exports = api; else root.VertragRegeln = api;
})(typeof self !== "undefined" ? self : this);
