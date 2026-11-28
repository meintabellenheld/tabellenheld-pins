/* Tabellenheld Bonus-Apps: Kassenbon, Rechnung oder Angebot auslesen (28.11.2026).
   Einfache Regeln, keine KI, läuft im Browser. Ausgabe: Betrag (Summe), Datum, Laden/Anbieter, Art (für die Kategorie).
   Jeder Vorschlag hat eine Fundstelle (q). mode: "bon" (Kassenbon) oder "rechnung" (Rechnung, Angebot, Kostenvoranschlag). */
(function (root) {
  "use strict";

  /* Ladenketten und typische Händler (nur zum Erkennen des Namens). Reihenfolge egal, längster Treffer zuerst gefunden. */
  var SHOPS = [
    ["REWE", "lebensmittel"], ["EDEKA", "lebensmittel"], ["E center", "lebensmittel"], ["Marktkauf", "lebensmittel"], ["ALDI", "lebensmittel"], ["LIDL", "lebensmittel"],
    ["Kaufland", "lebensmittel"], ["PENNY", "lebensmittel"], ["Netto", "lebensmittel"], ["NORMA", "lebensmittel"], ["Globus", "lebensmittel"], ["real", "lebensmittel"],
    ["tegut", "lebensmittel"], ["Combi", "lebensmittel"], ["famila", "lebensmittel"], ["K+K", "lebensmittel"], ["HIT", "lebensmittel"], ["Denns", "lebensmittel"],
    ["Alnatura", "lebensmittel"], ["Bio Company", "lebensmittel"], ["Bäckerei", "lebensmittel"], ["Metzgerei", "lebensmittel"], ["Fleischerei", "lebensmittel"],
    ["dm-drogerie markt", "drogerie"], ["dm", "drogerie"], ["ROSSMANN", "drogerie"], ["Müller", "drogerie"], ["Budni", "drogerie"],
    ["Aral", "tanken"], ["Shell", "tanken"], ["ESSO", "tanken"], ["JET", "tanken"], ["TotalEnergies", "tanken"], ["Total", "tanken"], ["Agip", "tanken"], ["Avia", "tanken"],
    ["Star", "tanken"], ["HEM", "tanken"], ["Westfalen", "tanken"], ["Raiffeisen", "tanken"],
    ["H&M", "kleidung"], ["C&A", "kleidung"], ["Zara", "kleidung"], ["Primark", "kleidung"], ["Deichmann", "kleidung"], ["KiK", "kleidung"], ["Takko", "kleidung"],
    ["Ernsting's family", "kleidung"], ["s.Oliver", "kleidung"], ["Esprit", "kleidung"], ["New Yorker", "kleidung"], ["Peek & Cloppenburg", "kleidung"], ["Galeria", "kleidung"],
    ["MediaMarkt", "elektronik"], ["Media Markt", "elektronik"], ["Saturn", "elektronik"], ["expert", "elektronik"], ["Euronics", "elektronik"], ["Cyberport", "elektronik"],
    ["OBI", "baumarkt"], ["BAUHAUS", "baumarkt"], ["Hornbach", "baumarkt"], ["toom", "baumarkt"], ["hagebau", "baumarkt"], ["Hellweg", "baumarkt"], ["Globus Baumarkt", "baumarkt"],
    ["IKEA", "wohnen"], ["Poco", "wohnen"], ["Roller", "wohnen"], ["JYSK", "wohnen"], ["Dänisches Bettenlager", "wohnen"], ["Depot", "wohnen"], ["XXXLutz", "wohnen"], ["porta", "wohnen"],
    ["Apotheke", "gesundheit"], ["Optiker", "gesundheit"], ["Fielmann", "gesundheit"], ["Apollo", "gesundheit"],
    ["Thalia", "freizeit"], ["Hugendubel", "freizeit"], ["Decathlon", "freizeit"], ["Intersport", "freizeit"], ["SportScheck", "freizeit"], ["Kino", "freizeit"], ["Cinemaxx", "freizeit"],
    ["Smyths", "spielzeug"], ["Toys", "spielzeug"], ["myToys", "spielzeug"], ["Spielwaren", "spielzeug"],
    ["Douglas", "drogerie"], ["Tchibo", "sonstiges"], ["Action", "sonstiges"], ["TEDi", "sonstiges"], ["Woolworth", "sonstiges"], ["Thomas Philipps", "sonstiges"], ["Nanu-Nana", "deko"],
    ["Butlers", "deko"], ["Strauss", "deko"], ["Blumen", "deko"], ["Floristik", "deko"], ["Gärtnerei", "deko"], ["Dehner", "deko"], ["Pflanzen-Kölle", "deko"],
    ["McDonald's", "gastro"], ["Burger King", "gastro"], ["KFC", "gastro"], ["Subway", "gastro"], ["Starbucks", "gastro"], ["Restaurant", "gastro"], ["Pizzeria", "gastro"],
    ["Ristorante", "gastro"], ["Gaststätte", "gastro"], ["Café", "gastro"], ["Imbiss", "gastro"], ["Vapiano", "gastro"],
    ["Deutsche Bahn", "bahn"], ["DB Fernverkehr", "bahn"], ["moBiel", "bahn"], ["Post", "porto"], ["Deutsche Post", "porto"], ["DHL", "porto"], ["Hermes", "porto"],
    ["Amazon", "sonstiges"], ["Otto", "sonstiges"], ["Zalando", "kleidung"]
  ];
  var ART_WORDS = [
    ["lebensmittel", /\b(milch|brot|butter|käse|joghurt|banane|apfel|tomate|nudeln|kaffee|eier|wurst|fleisch|gemüse|obst|pfand|backwaren|tk |molkerei)/g],
    ["drogerie", /\b(shampoo|duschgel|zahnpasta|deo|waschmittel|spülmittel|toilettenpapier|windeln|creme|kosmetik|seife)/g],
    ["tanken", /\b(super e10|super e5|e10|diesel|benzin|liter|zapfsäule|säule \d|kraftstoff|tankstelle)/g],
    ["gastro", /\b(tisch \d|bedienung|trinkgeld|menü|pizza|burger|pommes|getränk|cappuccino|latte|bewirtung)/g],
    ["gesundheit", /\b(rezept|zuzahlung|apotheke|arznei|tabletten|pzn)/g],
    ["kleidung", /\b(hose|jacke|pullover|shirt|kleid|schuhe|socken|größe [smlx]+|gr\. \d)/g],
    ["deko", /\b(kerze|lichterkette|kugel|weihnachtsbaum|tannenbaum|tanne|nordmann|kranz|deko|geschenkpapier|schleife|stern)/g],
    ["spielzeug", /\b(lego|playmobil|puppe|spiel|puzzle|spielzeug)/g],
    ["porto", /\b(porto|briefmarke|paket|päckchen|einschreiben|sendungsnummer)/g]
  ];
  /* Hochzeit: Art aus Rechnung/Angebot */
  var WED = [
    ["location", /\b(location|saal|raummiete|festsaal|scheune|gut |schloss|hotel|übernachtung|miete)/g],
    ["essen", /\b(catering|menü|buffet|büfett|getränkepauschale|getränke|speisen|fingerfood|sektempfang|bewirtung)/g],
    ["foto", /\b(fotograf|fotografie|foto|video|videograf|hochzeitsreportage|bilder|album|shooting)/g],
    ["outfit", /\b(brautkleid|kleid|anzug|brautmode|schleier|friseur|frisur|make-?up|styling|änderungsschneiderei)/g],
    ["ringe", /\b(trauring|eheringe|ringe|juwelier|goldschmied|gravur)/g],
    ["musik", /\b(dj|band|musik|sänger|sängerin|tontechnik|lichttechnik)/g],
    ["blumen", /\b(blumen|brautstrauß|floristik|florist|tischdeko|dekoration|deko|anstecker|blumenschmuck)/g],
    ["torte", /\b(torte|hochzeitstorte|konditorei|candybar|cupcakes)/g],
    ["papeterie", /\b(einladung|einladungskarten|save the date|druckerei|papeterie|menükarten|tischkarten|danksagung)/g],
    ["trauung", /\b(standesamt|trauung|trauredner|freie trauung|kirche|gebühr standesamt|eheschließung)/g],
    ["reise", /\b(flitterwochen|reise|flug|hochzeitsreise|reisebüro)/g]
  ];

  function pad(x) { return (x < 10 ? "0" : "") + x; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function clean(t) {
    return String(t || "").replace(/\r/g, "\n").replace(/[\u00a0\u2009\u202f]/g, " ").replace(/[ \t]+/g, " ")
      .replace(/(\d) ?, ?(\d\d)\b/g, "$1,$2")
      .replace(/\b(EUR|Eur|EURO|Euro)\b/g, "€");
  }
  function amounts(L) {
    var out = [], re = /(-?\d{1,3}(?:\.\d{3})+|-?\d+),(\d{2})(?!\d)|(-?\d+)\.(\d{2})(?![\d.])/g, m;
    while ((m = re.exec(L))) {
      var before = L.slice(Math.max(0, m.index - 3), m.index), after = L.slice(m.index + m[0].length, m.index + m[0].length + 4);
      if (/\d\.$/.test(before) || /^\.\d/.test(after)) continue;            /* Datum */
      if (/^\s?%/.test(after)) continue;                                     /* Prozent */
      var v = m[1] != null ? parseFloat(m[1].replace(/\./g, "") + "." + m[2]) : parseFloat(m[3] + "." + m[4]);
      if (!(Math.abs(v) > 0) || Math.abs(v) > 50000) continue;
      out.push({ v: v, i: m.index });
    }
    return out;
  }

  var TOTAL = /(summe|gesamt|zu zahlen|zahlbetrag|endbetrag|total|rechnungsbetrag|bruttobetrag|gesamtbetrag|angebotssumme|gesamtpreis|gesamtsumme|betrag)/i;
  var TOTAL_STRONG = /(zu zahlen|gesamtbetrag|rechnungsbetrag|endbetrag|summe brutto|gesamt brutto|bruttobetrag|angebotssumme|gesamtsumme|^summe|\bsumme\s*(eur|€)?\s*$|^\s*total)/i;
  var NOT_TOTAL = /(zwischensumme|netto|mwst|ust\.?|umsatzsteuer|steuer|gegeben|rückgeld|zurück|wechselgeld|bar\b|rabatt|gutschein|pfand|ersparnis|gespart|anzahlung|abschlag|teilzahlung|bonus|punkte|payback|trinkgeld|tip\b|einzelpreis|stück|stk|je )/i;
  var CARD = /(ec[- ]?karte|girocard|kartenzahlung|visa|mastercard|maestro|kreditkarte|betrag eur|zahlung|bezahlt)/i;

  function findTotal(lines, mode) {
    var best = null;
    lines.forEach(function (L, i) {
      var a = amounts(L); if (!a.length) {
        /* Summe steht oft in der Zeile darüber, Betrag eine Zeile tiefer */
        return; }
      var prev = lines[i - 1] || "", s = 0, v = a[a.length - 1].v;
      if (TOTAL_STRONG.test(L)) s += 6; else if (TOTAL.test(L)) s += 4;
      else if (TOTAL.test(prev) && !amounts(prev).length && !NOT_TOTAL.test(prev)) s += 3;
      else if (CARD.test(L)) s += 2;
      if (NOT_TOTAL.test(L)) s -= 6;
      if (/€/.test(L)) s += .5;
      if (/brutto/i.test(L)) s += 1.5;
      if (mode === "rechnung" && /netto/i.test(L) && !/brutto/i.test(L)) s -= 2;
      if (v <= 0) s -= 8;
      s += i / lines.length;           /* Summe steht eher unten */
      if (s > 0 && (!best || s > best.s || (s === best.s && v > best.v))) best = { s: s, v: v, q: L.trim() };
    });
    if (best && best.s >= 2) return best;
    if (mode === "bon") {             /* Notlösung: größter Betrag, der kein Bargeld/Rückgeld ist */
      var mx = null; lines.forEach(function (L) { if (NOT_TOTAL.test(L)) return; amounts(L).forEach(function (a) { if (a.v > 0 && (!mx || a.v > mx.v)) mx = { v: a.v, q: L.trim(), weak: true }; }); });
      return mx;
    }
    return null;
  }

  function findDate(lines, today, mode) {
    var re = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/g, best = null;
    lines.forEach(function (L, i) {
      var m; re.lastIndex = 0;
      while ((m = re.exec(L))) {
        var y = +m[3]; if (y < 100) y += 2000; var d = new Date(y, +m[2] - 1, +m[1]);
        if (d.getMonth() !== +m[2] - 1 || y < 2000 || y > 2100) continue;
        var s = 0, diff = (d - today) / 864e5;
        if (mode === "bon") { if (diff > 1) s -= 5; if (diff < -730) s -= 3; }
        if (/(datum|rechnungsdatum|belegdatum|angebotsdatum|vom|bon|kasse|uhr|\d\d:\d\d)/i.test(L)) s += 3;
        if (/(fällig|zahlbar bis|gültig bis|liefer|leistungs|veranstaltung|hochzeit am|termin|geburts)/i.test(L)) s -= 1;
        if (!best || s > best.s) best = { s: s, v: iso(d), q: L.trim(), d: d };
      }
    });
    return best;
  }
  function findDue(lines) {
    for (var i = 0; i < lines.length; i++) { var L = lines[i];
      if (!/(fällig|zahlbar bis|zahlungsziel|bitte überweisen bis|spätestens)/i.test(L)) continue;
      var m = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(L + " " + (lines[i + 1] || "")); if (!m) continue;
      var y = +m[3]; if (y < 100) y += 2000; return { v: iso(new Date(y, +m[2] - 1, +m[1])), q: L.trim() }; }
    return null;
  }
  function findDeposit(lines) {
    for (var i = 0; i < lines.length; i++) { var L = lines[i]; if (!/anzahlung/i.test(L)) continue;
      var a = amounts(L); if (a.length) return { v: a[a.length - 1].v, q: L.trim() }; }
    return null;
  }

  function findShop(lines, flat) {
    var low = flat.toLowerCase(), top = lines.slice(0, 8).join("\n").toLowerCase(), hit = null;
    SHOPS.forEach(function (s) {
      var k = s[0].toLowerCase(), i = -1, from = 0;
      while ((i = low.indexOf(k, from)) >= 0) {
        var b = low.charAt(i - 1), a = low.charAt(i + k.length);
        if (!/[a-zäöüß0-9]/.test(b) && !/[a-zäöüß]/.test(a)) break;
        from = i + 1;
      }
      if (i < 0) return;
      if (k.length <= 3 && top.indexOf(k) < 0) return;        /* kurze Namen (dm, JET, HIT) nur im Kopf zählen */
      var score = (top.indexOf(k) >= 0 ? 10 : 0) + k.length - i / 1000;
      if (!hit || score > hit.score) hit = { v: s[0], art: s[1], score: score, q: s[0] };
    });
    if (hit) return hit;
    var lf = /([A-ZÄÖÜ][\wÄÖÜäöüß&.+\-']*(?: [A-ZÄÖÜ0-9&][\wÄÖÜäöüß&.+\-']*){0,4}) (GmbH & Co\. KG|GmbH|AG|SE|KG|e\.K\.|eK|OHG|GbR|UG)(?![\wäöü])/;
    for (var i = 0; i < Math.min(lines.length, 25); i++) { var m = lf.exec(lines[i]); if (m) return { v: m[1].replace(/^(Ihr|Ihre|Die|Der|Das) /, "").slice(0, 34), q: lines[i].trim() }; }
    for (var j = 0; j < Math.min(lines.length, 4); j++) {           /* erste lesbare Zeile im Kopf */
      var L = lines[j].trim();
      if (L.length >= 3 && L.length <= 40 && /[A-Za-zÄÖÜäöü]{3,}/.test(L) && !/(kassenbon|beleg|rechnung|quittung|angebot|willkommen|datum|tel|str\.|straße|\d{5})/i.test(L)) return { v: L.replace(/[^\wÄÖÜäöüß&.+\-' ]/g, "").trim().slice(0, 34), q: L, weak: true };
    }
    var w = /(?:www\.|@)([a-z0-9\-]{3,30})\.(?:de|com|eu|net|at)\b/i.exec(flat);
    if (w) return { v: w[1].charAt(0).toUpperCase() + w[1].slice(1), q: w[0], weak: true };
    return null;
  }
  function findArt(flat, table) {
    var low = flat.toLowerCase(), best = null, bs = 0;
    table.forEach(function (c) { var k = (low.match(c[1]) || []).length; if (k > bs) { bs = k; best = c[0]; } });
    return best ? { v: best, n: bs } : null;
  }

  function parse(text, mode, today) {
    mode = mode === "rechnung" ? "rechnung" : "bon";
    today = today || new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var t = clean(text), lines = t.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean), flat = lines.join("\n");
    var r = { textLen: t.replace(/\s/g, "").length, hints: [], mode: mode };
    r.betrag = findTotal(lines, mode);
    r.datum = findDate(lines, today, mode);
    r.laden = findShop(lines, flat);
    var art = findArt(flat, ART_WORDS);
    r.art = r.laden && r.laden.art && r.laden.art !== "sonstiges" ? { v: r.laden.art } : art;
    r.hochzeit = findArt(flat, WED);
    if (mode === "rechnung") { r.faellig = findDue(lines); r.anzahlung = findDeposit(lines); }
    if (r.betrag && r.betrag.weak) r.hints.push("Keine Zeile „Summe“ gefunden. Bitte den Betrag prüfen.");
    if (mode === "rechnung" && /angebot|kostenvoranschlag/i.test(flat)) r.hints.push("Das ist ein Angebot. Der Betrag ist noch nicht bezahlt.");
    if (r.anzahlung) r.hints.push("Anzahlung im Dokument: " + r.anzahlung.v.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €.");
    if (r.faellig) r.hints.push("Zahlbar bis " + r.faellig.v.split("-").reverse().join(".") + ".");
    return r;
  }

  var api = { parse: parse };
  if (typeof module === "object" && module.exports) module.exports = api; else root.BonRegeln = api;
})(typeof self !== "undefined" ? self : this);
