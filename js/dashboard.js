/*
 * Dashboard visualisation layer. Consumes the result object produced by the analysis
 * engine (heuristic or AI) and renders it. All user-derived strings are inserted with
 * textContent / createTextNode, never as HTML.
 */
(function (root) {
  "use strict";

  var fw = root.MSA.framework;
  var engine = root.MSA.engine;
  var SVGNS = "http://www.w3.org/2000/svg";

  var SCORE_COLORS = { 1: "#10B981", 2: "#84CC16", 3: "#F59E0B", 4: "#F97316", 5: "#EF4444" };
  var NA_COLOR = "#64748B";
  var SCORE_WORDS = { 1: "Not present", 2: "Weak signal", 3: "Moderate signal", 4: "Strong signal", 5: "Overwhelming signal" };

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "style") Object.keys(v).forEach(function (p) { el.style.setProperty(p, v[p]); });
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    });
    return el;
  }

  function s(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function scoreColor(sc) { return sc == null ? NA_COLOR : SCORE_COLORS[sc]; }
  function reducedMotion() { return root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches; }

  function statusClass(f) { return f.status === "Observed" ? "observed" : f.status === "Not observed" ? "not" : "na"; }

  function badge(f) {
    return h("span", { class: "badge " + statusClass(f), text: f.status === "Cannot assess" ? "N/A — Context Needed" : f.status });
  }

  // ---------- A. Gauge ----------

  function polar(cx, cy, r, deg) {
    var a = (deg - 180) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  function arc(cx, cy, r, d0, d1) {
    var p0 = polar(cx, cy, r, d0), p1 = polar(cx, cy, r, d1);
    return "M" + p0[0].toFixed(2) + " " + p0[1].toFixed(2) + " A" + r + " " + r + " 0 0 1 " + p1[0].toFixed(2) + " " + p1[1].toFixed(2);
  }

  function renderGauge(el, result, opts) {
    opts = opts || {};
    clear(el);
    var sum = result.summary, sii = sum.signalIntensityIndex;
    var W = 260, H = 150, cx = 130, cy = 132, r = 104;
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, class: "gauge-svg", role: "img",
      "aria-label": sii == null ? "Signal Intensity Index: insufficient evidence" : "Signal Intensity Index " + sii + " out of 100, " + sum.band.label });
    svg.appendChild(s("path", { d: arc(cx, cy, r, 0, 180), class: "gauge-track" }));
    engine.BANDS.forEach(function (b) {
      var d0 = b.min / 100 * 180 + (b.min ? 1.2 : 0), d1 = (b.max + 1) / 100 * 180 - (b.max < 100 ? 1.2 : 0);
      svg.appendChild(s("path", { d: arc(cx, cy, r, d0, Math.min(d1, 180)), stroke: b.color, class: "gauge-band" + (sum.band && sum.band.key === b.key ? " on" : "") }));
    });
    [0, 25, 50, 75, 100].forEach(function (v) {
      var p = polar(cx, cy, r - 24, v / 100 * 180);
      var t = s("text", { x: p[0].toFixed(1), y: (p[1] + 4).toFixed(1), class: "gauge-tick", "text-anchor": "middle" });
      t.textContent = String(v);
      svg.appendChild(t);
    });
    if (sii != null) {
      var g = s("g", { class: "gauge-needle" });
      g.appendChild(s("line", { x1: cx, y1: cy, x2: cx - r + 14, y2: cy }));
      g.appendChild(s("circle", { cx: cx, cy: cy, r: 7 }));
      svg.appendChild(g);
      var target = sii / 100 * 180;
      g.style.transformOrigin = cx + "px " + cy + "px";
      if (reducedMotion() || opts.instant) g.style.transform = "rotate(" + target + "deg)";
      else {
        g.style.transform = "rotate(0deg)";
        requestAnimationFrame(function () { requestAnimationFrame(function () { g.style.transform = "rotate(" + target + "deg)"; }); });
      }
    }
    el.appendChild(svg);

    var val = h("div", { class: "gauge-value" + (sii == null ? " insufficient" : "") });
    if (sii == null) {
      val.appendChild(h("span", { class: "gauge-num small", text: "Insufficient Evidence" }));
    } else {
      var num = h("span", { class: "gauge-num", text: "0" });
      num.style.color = sum.band.color;
      val.appendChild(num);
      val.appendChild(h("span", { class: "gauge-of", text: "/ 100" }));
      countUp(num, sii, opts.instant);
    }
    el.appendChild(val);
    el.appendChild(h("p", { class: "gauge-band-label", text: sii == null ? "No indicator could be assessed" : sum.band.label, style: sii == null ? null : { color: sum.band.color } }));
  }

  function countUp(el, to, instant) {
    if (instant || reducedMotion()) { el.textContent = String(to); return; }
    var t0 = null, dur = 1100;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(to * e));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderKpis(el, result) {
    clear(el);
    var sum = result.summary, d = sum.distribution;
    var cards = [
      { k: "Indicators assessed", v: sum.assessedCount + " / 20", sub: sum.naCount + " need outside context" },
      { k: "Signals observed", v: String(sum.observedCount), sub: "scored 2–5" },
      { k: "Strong / overwhelming", v: String(d.strong), sub: "scored 4–5", accent: d.strong ? "#EF4444" : null },
      { k: "Average score", v: sum.averageScore == null ? "N/A" : sum.averageScore.toFixed(2), sub: "of assessed indicators (1–5)" }
    ];
    cards.forEach(function (c, i) {
      var v = h("p", { class: "kpi-v", text: c.v });
      if (c.accent) v.style.color = c.accent;
      el.appendChild(h("div", { class: "panel kpi", style: { "animation-delay": (i * 70) + "ms" } }, [h("p", { class: "kpi-k", text: c.k }), v, h("p", { class: "kpi-sub", text: c.sub })]));
    });
  }

  // ---------- B. Annotated text ----------

  function renderAnnotated(el, result, onPick) {
    clear(el);
    var text = result.text;
    var spans = result.indicators.filter(function (f) { return f.evidenceQuote && f.evidenceStart != null; });
    var owners = new Array(text.length + 1);
    spans.forEach(function (f) { for (var i = f.evidenceStart; i < f.evidenceEnd; i++) (owners[i] = owners[i] || []).push(f); });
    var i = 0;
    while (i < text.length) {
      var set = owners[i], j = i + 1;
      var key = set ? set.map(function (f) { return f.id; }).join(",") : "";
      while (j < text.length && ((owners[j] ? owners[j].map(function (f) { return f.id; }).join(",") : "") === key)) j++;
      var chunk = text.slice(i, j);
      if (!set) el.appendChild(document.createTextNode(chunk));
      else {
        var top = set.slice().sort(function (a, b) { return b.score - a.score; })[0];
        var label = set.map(function (f) { return "#" + f.id + " " + f.name + " (" + f.score + "/5)"; }).join("; ");
        var m = h("mark", { class: "hl", tabindex: "0", role: "button", "data-ids": key, title: label, "aria-label": chunk + " — " + label });
        m.style.setProperty("--hl", scoreColor(top.score));
        m.textContent = chunk;
        (function (ids) {
          function pick() { onPick(ids); }
          m.addEventListener("click", pick);
          m.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
        })(set.map(function (f) { return f.id; }));
        el.appendChild(m);
      }
      i = j;
    }
    if (!spans.length) el.appendChild(h("p", { class: "muted note", text: "No evidence spans to highlight." }));
  }

  function highlightQuote(container, id) {
    var marks = container.querySelectorAll("mark.hl");
    var first = null;
    marks.forEach(function (m) {
      var on = m.getAttribute("data-ids").split(",").indexOf(String(id)) !== -1;
      m.classList.toggle("active", on);
      if (on && !first) first = m;
    });
    if (first) {
      var top = first.offsetTop - container.offsetTop - 40;
      container.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? "auto" : "smooth" });
    }
    return !!first;
  }

  // ---------- C. Bar chart ----------

  function sortFilter(indicators, sort, filter) {
    var list = indicators.slice();
    if (filter === "observed") list = list.filter(function (f) { return f.status === "Observed"; });
    else if (filter === "not") list = list.filter(function (f) { return f.status === "Not observed"; });
    else if (filter === "na") list = list.filter(function (f) { return f.status === "Cannot assess"; });
    if (sort === "score") list.sort(function (a, b) {
      var sa = a.score == null ? -1 : a.score, sb = b.score == null ? -1 : b.score;
      return sb - sa || a.id - b.id;
    });
    return list;
  }

  function renderBars(el, result, opts) {
    opts = opts || {};
    clear(el);
    var list = sortFilter(result.indicators, opts.sort || "order", opts.filter || "all");
    var axis = h("div", { class: "bar-row axis", "aria-hidden": "true" }, [
      h("span", { class: "bar-label" }),
      h("span", { class: "bar-axis" }, [1, 2, 3, 4, 5].map(function (n) { return h("span", { text: String(n) }); }))
    ]);
    el.appendChild(axis);
    if (!list.length) { el.appendChild(h("p", { class: "muted note", text: "No indicators match this filter." })); return; }
    list.forEach(function (f, idx) {
      var na = f.score == null;
      var fill = h("span", { class: "bar-fill" });
      fill.style.setProperty("--c", scoreColor(f.score));
      fill.style.setProperty("--w", na ? "100%" : (f.score * 20) + "%");
      fill.style.animationDelay = opts.instant ? "0ms" : (idx * 35) + "ms";
      var track = h("span", { class: "bar-track" + (na ? " na" : "") }, [fill, na ? h("span", { class: "pill-na", text: "N/A — Context Needed" }) : h("span", { class: "bar-score", text: String(f.score) })]);
      var row = h("div", {
        class: "bar-row" + (na ? " is-na" : "") + (opts.compact ? " compact" : ""), role: "listitem", tabindex: opts.compact ? null : "0",
        "aria-label": "#" + f.id + " " + f.name + ": " + (na ? "cannot assess" : "score " + f.score + " of 5")
      }, [h("span", { class: "bar-label" }, [h("span", { class: "bar-id", text: String(f.id) }), h("span", { class: "bar-name", text: f.name })]), track]);
      if (!opts.compact) {
        row.addEventListener("mouseenter", function (e) { showTip(f, e); });
        row.addEventListener("mousemove", moveTip);
        row.addEventListener("mouseleave", hideTip);
        row.addEventListener("focus", function () { showTip(f, null, row); });
        row.addEventListener("blur", hideTip);
        row.addEventListener("click", function () { hideTip(); opts.onClick && opts.onClick(f.id); });
        row.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onClick && opts.onClick(f.id); } });
      }
      el.appendChild(row);
    });
  }

  var tipEl = null;
  function tip() { return tipEl || (tipEl = document.getElementById("tooltip")); }
  function showTip(f, e, anchor) {
    var t = tip(); if (!t) return;
    clear(t);
    t.appendChild(h("p", { class: "tip-h" }, ["#" + f.id + " " + f.name + " ", badge(f)]));
    t.appendChild(h("p", { class: "tip-q", text: "“" + f.guidingQuestion + "”" }));
    t.appendChild(h("p", { class: "tip-s", text: f.score == null ? "Score: N/A — needs outside context" : "Score: " + f.score + "/5 · " + SCORE_WORDS[f.score] }));
    if (f.evidenceQuote) t.appendChild(h("p", { class: "tip-quote", text: "“" + f.evidenceQuote + "”" }));
    t.appendChild(h("p", { class: "tip-hint", text: "Click to open the finding" }));
    t.hidden = false;
    if (e) moveTip(e);
    else if (anchor) { var r = anchor.getBoundingClientRect(); place(r.left + 40, r.bottom); }
  }
  function moveTip(e) { place(e.clientX, e.clientY); }
  function place(x, y) {
    var t = tip(); if (!t || t.hidden) return;
    var w = t.offsetWidth, hh = t.offsetHeight, vw = root.innerWidth, vh = root.innerHeight;
    var left = Math.min(x + 16, vw - w - 12), top = y + 18;
    if (top + hh > vh - 8) top = y - hh - 14;
    t.style.left = Math.max(8, left) + "px";
    t.style.top = Math.max(8, top) + "px";
  }
  function hideTip() { var t = tip(); if (t) t.hidden = true; }

  // ---------- D. Distribution donut ----------

  function renderDistribution(el, result) {
    clear(el);
    var d = result.summary.distribution;
    var parts = [
      { k: "Weak / no signals", sub: "scores 1–2", n: d.weak, c: "#10B981" },
      { k: "Moderate signals", sub: "score 3", n: d.moderate, c: "#F59E0B" },
      { k: "Strong / overwhelming", sub: "scores 4–5", n: d.strong, c: "#EF4444" },
      { k: "Unassessable from text alone", sub: "N/A", n: d.na, c: NA_COLOR }
    ];
    var total = parts.reduce(function (a, p) { return a + p.n; }, 0) || 1;
    var R = 52, C = 2 * Math.PI * R, off = 0;
    var svg = s("svg", { viewBox: "0 0 140 140", class: "donut", role: "img",
      "aria-label": parts.map(function (p) { return p.k + ": " + p.n; }).join(", ") });
    svg.appendChild(s("circle", { cx: 70, cy: 70, r: R, class: "donut-track" }));
    parts.forEach(function (p) {
      if (!p.n) return;
      var len = p.n / total * C;
      var gap = parts.filter(function (q) { return q.n; }).length > 1 ? 2 : 0;
      var c = s("circle", { cx: 70, cy: 70, r: R, class: "donut-seg", stroke: p.c,
        "stroke-dasharray": Math.max(0, len - gap).toFixed(2) + " " + (C - Math.max(0, len - gap)).toFixed(2),
        "stroke-dashoffset": (-off).toFixed(2), transform: "rotate(-90 70 70)" });
      svg.appendChild(c);
      off += len;
    });
    var t1 = s("text", { x: 70, y: 68, "text-anchor": "middle", class: "donut-num" }); t1.textContent = "20";
    var t2 = s("text", { x: 70, y: 86, "text-anchor": "middle", class: "donut-lbl" }); t2.textContent = "indicators";
    svg.appendChild(t1); svg.appendChild(t2);

    var legend = h("ul", { class: "dist-legend" }, parts.map(function (p) {
      var sw = h("span", { class: "sw" }); sw.style.background = p.c;
      return h("li", null, [sw, h("span", { class: "dl-k" }, [p.k, h("small", { text: " " + p.sub })]),
        h("span", { class: "dl-v", text: p.n + " · " + Math.round(p.n / 20 * 100) + "%" })]);
    }));
    var stack = h("div", { class: "stack", "aria-hidden": "true" }, parts.filter(function (p) { return p.n; }).map(function (p) {
      var seg = h("span"); seg.style.background = p.c; seg.style.flexGrow = String(p.n); return seg;
    }));
    el.appendChild(h("div", { class: "dist-inner" }, [svg, h("div", { class: "dist-side" }, [legend, stack])]));
  }

  // ---------- E. Cards & missing context ----------

  function scoreMeter(f) {
    var m = h("span", { class: "meter", "aria-hidden": "true" });
    for (var i = 1; i <= 5; i++) {
      var seg = h("span");
      if (f.score != null && i <= f.score) seg.style.background = scoreColor(f.score);
      m.appendChild(seg);
    }
    return m;
  }

  function renderCards(el, result, onQuote) {
    clear(el);
    result.indicators.forEach(function (f) {
      var bodyId = "card-body-" + f.id;
      var head = h("button", { type: "button", class: "card-head", "aria-expanded": "false", "aria-controls": bodyId }, [
        h("span", { class: "card-id", text: String(f.id) }),
        h("span", { class: "card-name", text: f.name }),
        badge(f),
        h("span", { class: "card-score" }, [scoreMeter(f), h("b", { text: f.score == null ? "N/A" : f.score + "/5" })]),
        h("span", { class: "chev", "aria-hidden": "true" })
      ]);
      var body = h("div", { class: "card-body", id: bodyId, hidden: true }, [
        h("p", { class: "gq" }, [h("span", { class: "lbl", text: "Guiding question" }), "“" + f.guidingQuestion + "”"]),
        f.evidenceQuote ? h("blockquote", { class: "quote" }, [
          h("span", { class: "lbl", text: "Evidence (verbatim)" }), "“" + f.evidenceQuote + "”",
          h("button", { type: "button", class: "link-btn", text: "Show in text", onclick: function (e) { e.stopPropagation(); onQuote(f.id); } })
        ]) : null,
        h("p", { class: "expl" }, [h("span", { class: "lbl", text: "Analysis" }), f.explanation]),
        f.missingContext ? h("p", { class: "mc" }, [h("span", { class: "lbl", text: f.score == null ? "Missing context" : "External verification" }), f.missingContext]) : null
      ]);
      var card = h("article", { class: "card " + statusClass(f), id: "card-" + f.id }, [head, body]);
      card.style.setProperty("--c", scoreColor(f.score));
      head.addEventListener("click", function () {
        var open = head.getAttribute("aria-expanded") === "true";
        setCard(card, !open);
        if (!open && f.evidenceQuote) onQuote(f.id, true);
      });
      el.appendChild(card);
    });
  }

  function setCard(card, open) {
    var head = card.querySelector(".card-head"), body = card.querySelector(".card-body");
    head.setAttribute("aria-expanded", open ? "true" : "false");
    body.hidden = !open;
    card.classList.toggle("open", open);
  }

  function renderMissing(el, result) {
    clear(el);
    var na = result.indicators.filter(function (f) { return f.score == null; });
    var ext = result.indicators.filter(function (f) { return f.score != null && f.missingContext; });
    if (!na.length && !ext.length) { el.appendChild(h("p", { class: "muted", text: "Every indicator could be assessed from the text." })); return; }
    na.forEach(function (f) {
      el.appendChild(h("div", { class: "mc-item" }, [
        h("p", { class: "mc-h" }, [h("span", { class: "card-id", text: String(f.id) }), f.name + " ", badge(f)]),
        h("p", { class: "mc-why", text: f.explanation }),
        h("p", { class: "mc-how" }, [h("b", { text: "How to investigate: " }), f.missingContext || ""])
      ]));
    });
    if (ext.length) {
      el.appendChild(h("p", { class: "mc-sub", text: "Scored from the text, but still worth verifying outside it:" }));
      ext.forEach(function (f) {
        el.appendChild(h("div", { class: "mc-item light" }, [
          h("p", { class: "mc-h" }, [h("span", { class: "card-id", text: String(f.id) }), f.name + " · " + f.score + "/5"]),
          h("p", { class: "mc-how", text: f.missingContext })
        ]));
      });
    }
  }

  function renderQuestions(el, result) {
    clear(el);
    result.summary.questions.forEach(function (q) {
      el.appendChild(h("li", null, [h("span", { class: "q-text", text: q.text }), h("span", { class: "q-tag", text: q.tag })]));
    });
  }

  // ---------- Reworked PSYOPS V8.3 worksheet (Creathon edition) ----------

  // Score ranges from the original worksheet. It words them as PSYOP likelihood; a checklist
  // total cannot establish that, so the app shows them as signal levels.
  var SHEET_RANGES = [
    { min: 0, max: 25, label: "Few observable signals", color: "#10B981" },
    { min: 26, max: 50, label: "Some signals — look deeper", color: "#FACC15" },
    { min: 51, max: 75, label: "Several notable signals", color: "#F97316" },
    { min: 76, max: 100, label: "Many strong signals", color: "#EF4444" }
  ];

  // sheet = { scores: {1..20: n|null}, notes: {id: text}, addons: {A1..A3: n|null} }
  function sheetTotals(sheet) {
    var scores = sheet.scores || sheet;
    var vals = fw.INDICATORS.map(function (d) { return scores[d.id]; }).filter(function (v) { return typeof v === "number"; });
    var sum = vals.reduce(function (a, v) { return a + v; }, 0);
    var projected = vals.length ? Math.round(sum / vals.length * 20) : null;
    var range = projected == null ? null : SHEET_RANGES.filter(function (r) { return projected >= r.min && projected <= r.max; })[0];
    var groups = fw.GROUPS.map(function (g) {
      var gv = g.ids.map(function (id) { return scores[id]; }).filter(function (v) { return typeof v === "number"; });
      var gs = gv.reduce(function (a, v) { return a + v; }, 0);
      return { group: g, sum: gs, scored: gv.length, avg: gv.length ? gs / gv.length : null };
    });
    var add = sheet.addons || {};
    var av = fw.ADDONS.map(function (x) { return add[x.id]; }).filter(function (v) { return typeof v === "number"; });
    return { sum: sum, scored: vals.length, projected: projected, range: range, groups: groups,
      addonSum: av.reduce(function (a, v) { return a + v; }, 0), addonScored: av.length, addonFlags: av.filter(function (v) { return v >= 3; }).length };
  }

  function scorePicker(label, cur, onPick) {
    var picker = h("div", { class: "sheet-pick", role: "radiogroup", "aria-label": label });
    [1, 2, 3, 4, 5, null].forEach(function (v) {
      var on = cur === v;
      var guide = v == null ? null : fw.SCORE_GUIDE[v - 1];
      var b = h("button", { type: "button", role: "radio", "aria-checked": on ? "true" : "false", class: "sp" + (on ? " on" : "") + (v == null ? " sp-na" : ""),
        title: v == null ? "N/A — can't judge without outside evidence" : v + " — " + guide.label + ": " + guide.hint, text: v == null ? "N/A" : String(v) });
      if (on) b.style.setProperty("--c", scoreColor(v));
      b.addEventListener("click", function () { onPick(v); });
      picker.appendChild(b);
    });
    return picker;
  }

  function sheetItem(opts) {
    var noteId = "note-" + opts.key;
    var note = h("input", { type: "text", id: noteId, class: "sheet-note", maxlength: "300", placeholder: "Evidence or note (optional)", autocomplete: "off", "aria-label": "Evidence note for " + opts.name });
    note.value = opts.note || "";
    note.addEventListener("input", function () { opts.onNote(note.value); });
    return h("div", { class: "ws-item" + (opts.changed ? " changed" : ""), role: "listitem" }, [
      h("div", { class: "ws-main" }, [
        h("p", { class: "ws-title" }, [h("span", { class: "card-id", text: String(opts.num) }), h("b", { text: opts.name })]),
        h("p", { class: "ws-q", text: opts.plain }),
        opts.original ? h("p", { class: "ws-orig" }, [h("span", { class: "lbl-inline", text: "V8.3 original" }), "“" + opts.original + "”"]) : null,
        h("p", { class: "ws-ex" }, [h("span", { class: "lbl-inline", text: "Example" }), opts.modern]),
        h("p", { class: "ws-look" }, [h("span", { class: "lbl-inline", text: "Look for" }), opts.lookFor])
      ]),
      h("div", { class: "ws-side" }, [
        scorePicker(opts.name + " score", opts.cur, opts.onPick),
        h("small", { class: "sheet-eng", text: opts.engText }),
        note
      ])
    ]);
  }

  function renderSheet(tableEl, totalEl, result, sheet, onChange) {
    clear(tableEl);
    var engineScores = {};
    result.indicators.forEach(function (f) { engineScores[f.id] = f.score; });
    var t = sheetTotals(sheet);

    tableEl.appendChild(h("div", { class: "score-guide", "aria-label": "Scoring guide" },
      [h("span", { class: "sg-k", text: "Scoring guide" })].concat(fw.SCORE_GUIDE.map(function (g) {
        var b = h("span", { class: "sg-n", text: String(g.score) }); b.style.background = scoreColor(g.score);
        return h("span", { class: "sg-item" }, [b, h("span", null, [h("b", { text: g.label }), " · " + g.hint])]);
      })).concat([h("span", { class: "sg-item" }, [h("span", { class: "sg-n na", text: "N/A" }), h("span", { text: "Needs outside evidence: not counted as 0" })])])));

    var num = 0;
    fw.GROUPS.forEach(function (g, gi) {
      var gt = t.groups[gi];
      var head = h("div", { class: "ws-group-head" }, [
        h("span", { class: "ws-dot" }),
        h("div", null, [h("p", { class: "ws-gname", text: g.name }), h("p", { class: "ws-gblurb", text: g.blurb })]),
        h("span", { class: "ws-gscore", text: gt.scored ? gt.sum + " / " + (gt.scored * 5) : "N/A" })
      ]);
      var list = h("div", { class: "ws-list", role: "list" });
      g.ids.forEach(function (id) {
        num++;
        var d = fw.INDICATORS[id - 1], w = fw.WORKSHEET[id];
        var cur = sheet.scores[id], eng = engineScores[id];
        var changed = cur !== eng;
        list.appendChild(sheetItem({
          key: id, num: id, name: d.name, plain: w.plain, original: d.guidingQuestion, modern: w.modern, lookFor: w.lookFor,
          cur: cur, changed: changed, note: sheet.notes[id],
          engText: changed ? "Analyzer: " + (eng == null ? "N/A" : eng) + " · edited by you" : "Prefilled by the analyzer",
          onPick: function (v) { onChange("score", id, v); },
          onNote: function (v) { onChange("note", id, v); }
        }));
      });
      var sec = h("section", { class: "ws-group" }, [head, list]);
      sec.style.setProperty("--g", g.color);
      tableEl.appendChild(sec);
    });

    var addList = h("div", { class: "ws-list", role: "list" });
    fw.ADDONS.forEach(function (x) {
      addList.appendChild(sheetItem({
        key: x.id, num: x.id, name: x.name, plain: x.plain, modern: x.modern, lookFor: x.lookFor,
        cur: sheet.addons[x.id], changed: false, note: sheet.notes[x.id],
        engText: "Score this yourself after checking the media",
        onPick: function (v) { onChange("addon", x.id, v); },
        onNote: function (v) { onChange("note", x.id, v); }
      }));
    });
    var addSec = h("section", { class: "ws-group addon" }, [
      h("div", { class: "ws-group-head" }, [
        h("span", { class: "ws-dot" }),
        h("div", null, [h("p", { class: "ws-gname", text: "AI-era add-ons (Creathon)" }), h("p", { class: "ws-gblurb", text: "Extra checks for photos and videos. Kept separate so the 20-item total still matches the original tool." })]),
        h("span", { class: "ws-gscore", text: t.addonScored ? t.addonSum + " / " + (t.addonScored * 5) : "Not scored" })
      ]), addList
    ]);
    addSec.style.setProperty("--g", "#FACC15");
    tableEl.appendChild(addSec);

    renderSheetTotal(totalEl, t);
    return t;
  }

  function renderSheetTotal(totalEl, t) {
    clear(totalEl);
    var main = h("div", { class: "st-main" }, [
      h("p", { class: "st-k", text: "Total score (20 indicators)" }),
      h("p", { class: "st-v" }, [h("b", { text: String(t.sum) }), h("span", { text: " / " + (t.scored * 5) + " from " + t.scored + " scored" })]),
      t.scored < 20 && t.scored ? h("p", { class: "st-proj", text: "Projected to all 20: " + t.projected + " / 100 (" + (20 - t.scored) + (20 - t.scored === 1 ? " item marked N/A is" : " items marked N/A are") + " left out, not counted as 0)." }) : null,
      !t.scored ? h("p", { class: "st-proj", text: "No items scored yet." }) : null,
      h("div", { class: "st-groups" }, t.groups.map(function (gt) {
        var fill = h("span", { class: "stg-fill" });
        fill.style.width = gt.avg == null ? "0%" : (gt.avg / 5 * 100) + "%";
        fill.style.background = gt.group.color;
        return h("div", { class: "stg" }, [
          h("span", { class: "stg-name", text: gt.group.name }),
          h("span", { class: "stg-track" }, [fill]),
          h("span", { class: "stg-v", text: gt.avg == null ? "N/A" : gt.avg.toFixed(1) })
        ]);
      })),
      t.addonScored ? h("p", { class: "st-proj", text: "AI-era add-ons: " + t.addonFlags + " of " + t.addonScored + " scored 3 or higher (shown separately)." }) : null
    ]);
    var ranges = h("ul", { class: "st-ranges" }, SHEET_RANGES.map(function (r) {
      var li = h("li", { class: t.range === r ? "on" : null }, [h("span", { class: "st-r", text: r.min + "–" + r.max }), h("span", { text: r.label })]);
      li.style.setProperty("--c", r.color);
      return li;
    }));
    totalEl.appendChild(main);
    totalEl.appendChild(h("div", { class: "st-side" }, [
      h("p", { class: "st-k", text: "Score ranges" }), ranges,
      h("p", { class: "st-note", text: "The original worksheet labels these ranges as PSYOP likelihood. A checklist total cannot establish that, so they are shown here as signal levels. The theme bars show where the signals cluster." })
    ]));
  }

  // ---------- Compare column ----------

  function renderCompareColumn(el, result, label) {
    clear(el);
    var g = h("div", { class: "gauge compact" });
    el.appendChild(h("p", { class: "compare-label", text: label }));
    el.appendChild(g);
    renderGauge(g, result);
    el.appendChild(h("p", { class: "coverage", text: result.summary.coverage }));
    var bars = h("div", { class: "bars compact" });
    el.appendChild(bars);
    renderBars(bars, result, { compact: true });
  }

  // ---------- Markdown report ----------

  function toMarkdown(result, sheet) {
    var sum = result.summary, m = result.meta, L = [];
    L.push("# Media Manipulation Signal Analysis Report");
    L.push("");
    L.push("> " + fw.DISCLAIMER);
    L.push("");
    if (m.source) L.push("- **Source / title:** " + m.source);
    if (m.platform) L.push("- **Platform:** " + m.platform);
    if (m.date) L.push("- **Reference / date:** " + m.date);
    if (m.notes) L.push("- **Virality & verification notes:** " + m.notes);
    L.push("- **Engine:** " + result.engineLabel + (result.aiModel ? " (" + result.aiModel + ")" : ""));
    L.push("- **Analyzed:** " + result.wordCount + " words, " + new Date(result.analyzedAt).toLocaleString());
    L.push("");
    L.push("## Signal Intensity Index");
    L.push("");
    L.push(sum.signalIntensityIndex == null ? "**Insufficient Evidence**" : "**" + sum.signalIntensityIndex + " / 100** — " + sum.band.label);
    L.push("");
    L.push("_" + fw.METHOD_NOTICE + "_");
    L.push("");
    L.push(sum.coverage);
    L.push("");
    L.push("### What potential manipulation signals can we observe in this content?");
    L.push("");
    L.push(sum.interpretation);
    L.push("");
    L.push("## 20-indicator findings");
    L.push("");
    L.push("| # | Indicator | Status | Score |");
    L.push("|---|---|---|---|");
    result.indicators.forEach(function (f) { L.push("| " + f.id + " | " + f.name + " | " + f.status + " | " + (f.score == null ? "N/A" : f.score) + " |"); });
    L.push("");
    result.indicators.forEach(function (f) {
      L.push("### " + f.id + ". " + f.name + " — " + f.status + (f.score == null ? " (N/A)" : " (" + f.score + "/5)"));
      L.push("");
      L.push("*" + f.guidingQuestion + "*");
      L.push("");
      if (f.evidenceQuote) { L.push("> “" + f.evidenceQuote.replace(/\n+/g, " ") + "”"); L.push(""); }
      L.push(f.explanation);
      if (f.missingContext) { L.push(""); L.push("**" + (f.score == null ? "Missing context" : "External verification") + ":** " + f.missingContext); }
      L.push("");
    });
    if (sheet) {
      var t = sheetTotals(sheet);
      L.push("## Scoring worksheet (PSYOPS V8.3, Creathon edition)");
      L.push("");
      fw.GROUPS.forEach(function (g, gi) {
        var gt = t.groups[gi];
        L.push("### " + g.name + (gt.scored ? " — " + gt.sum + " / " + (gt.scored * 5) : ""));
        L.push("");
        g.ids.forEach(function (id) {
          var sc = sheet.scores[id], nt = sheet.notes[id];
          L.push("- **" + id + ". " + fw.INDICATORS[id - 1].name + ":** " + (sc == null ? "N/A" : sc + "/5") + (nt ? " — " + nt : ""));
        });
        L.push("");
      });
      L.push("**Total:** " + t.sum + " / " + (t.scored * 5) + " from " + t.scored + " scored" + (t.scored < 20 && t.scored ? " (projected to 20: " + t.projected + " / 100)" : "") + (t.range ? " — " + t.range.label : ""));
      L.push("");
      L.push("### AI-era add-ons");
      L.push("");
      fw.ADDONS.forEach(function (x) {
        var sc = sheet.addons[x.id], nt = sheet.notes[x.id];
        L.push("- **" + x.name + ":** " + (sc == null ? "not scored" : sc + "/5") + (nt ? " — " + nt : ""));
      });
      L.push("");
    }
    L.push("## Questions to ask next");
    L.push("");
    sum.questions.forEach(function (q, i) { L.push((i + 1) + ". " + q.text); });
    L.push("");
    L.push("## Before you share: 3-step verification");
    L.push("");
    L.push("1. **Origin & reverse archive check** — Could this photo/video be older footage repurposed for a new crisis?");
    L.push("2. **Ground-truth & event cross-check** — Do the visuals, geography and claims match verified reports from reliable independent sources?");
    L.push("3. **Synthetic AI & 3D CGI inspection** — Could this content be generated by AI or rendered with 3D software like Blender?");
    L.push("");
    L.push("## Analyzed text");
    L.push("");
    result.text.split(/\n/).forEach(function (line) { L.push("> " + line); });
    L.push("");
    L.push("---");
    L.push(fw.DISCLAIMER);
    return L.join("\n");
  }

  root.MSA.dashboard = {
    h: h, clear: clear, scoreColor: scoreColor,
    renderGauge: renderGauge, renderKpis: renderKpis, renderAnnotated: renderAnnotated, highlightQuote: highlightQuote,
    renderBars: renderBars, renderDistribution: renderDistribution, renderCards: renderCards, setCard: setCard,
    renderMissing: renderMissing, renderSheet: renderSheet, sheetTotals: sheetTotals, renderQuestions: renderQuestions, renderCompareColumn: renderCompareColumn,
    toMarkdown: toMarkdown, hideTip: hideTip, SCORE_COLORS: SCORE_COLORS
  };
})(typeof window !== "undefined" ? window : globalThis);
