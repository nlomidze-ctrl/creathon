/*
 * App controller: wires the input workspace, the engines and the dashboard together.
 */
(function (root) {
  "use strict";

  var fw = root.MSA.framework, engine = root.MSA.engine, presets = root.MSA.presets.PRESETS;
  var ai = root.MSA.ai, D = root.MSA.dashboard, h = D.h;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    text: $("textInput"), words: $("wordCount"), chars: $("charCount"),
    source: $("metaSource"), platform: $("metaPlatform"), date: $("metaDate"), notes: $("metaNotes"),
    analyze: $("analyzeBtn"), compare: $("compareBtn"), clear: $("clearBtn"),
    results: $("results"), comparePanel: $("comparePanel"), aiBox: $("aiBox"), aiKey: $("aiKey"), aiModel: $("aiModel"),
    scan: $("scan"), scanStages: $("scanStages"), scanBar: $("scanBar"), toast: $("toast")
  };

  var state = {
    engine: "heuristic",
    result: null,
    presetKey: null,
    sort: "order",
    filter: "all",
    busy: false,
    verify: {},
    sheet: {}
  };

  // ---------- static text ----------
  document.querySelectorAll("[data-disclaimer]").forEach(function (el) { el.textContent = fw.DISCLAIMER; });
  document.querySelectorAll("[data-method]").forEach(function (el) { el.textContent = fw.METHOD_NOTICE; });

  // ---------- presets ----------
  var presetBox = $("presets");
  presets.forEach(function (p, i) {
    var b = h("button", { type: "button", class: "preset", "data-key": p.key }, [
      h("span", { class: "preset-num", text: p.short }),
      h("span", { class: "preset-title", text: p.title }),
      h("span", { class: "preset-tag tag-" + p.key, text: p.tag })
    ]);
    b.addEventListener("click", function () { loadPreset(p.key, true); });
    presetBox.appendChild(b);
  });

  function presetBy(key) { return presets.filter(function (p) { return p.key === key; })[0]; }

  function loadPreset(key, run) {
    var p = presetBy(key);
    if (!p) return;
    els.text.value = p.text;
    els.source.value = p.meta.source || "";
    els.platform.value = p.meta.platform || "";
    els.date.value = p.meta.date || "";
    els.notes.value = p.meta.notes || "";
    state.presetKey = key;
    markPreset();
    updateCounts();
    if (run) analyze();
  }

  function markPreset() {
    presetBox.querySelectorAll(".preset").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-key") === state.presetKey); });
  }

  // Editing the text detaches it from the preset (so the case-study reveal no longer applies).
  function checkPresetDrift() {
    var p = presetBy(state.presetKey);
    if (p && els.text.value !== p.text) { state.presetKey = null; markPreset(); }
  }

  // ---------- counters ----------
  function updateCounts() {
    var n = engine.countWords(els.text.value);
    els.words.textContent = n + (n === 1 ? " word" : " words");
    els.chars.textContent = els.text.value.length.toLocaleString() + " / 20,000 characters";
  }
  els.text.addEventListener("input", function () { updateCounts(); checkPresetDrift(); });

  // ---------- engine switch ----------
  document.querySelectorAll(".engine-switch .seg").forEach(function (b) {
    b.addEventListener("click", function () {
      state.engine = b.getAttribute("data-engine");
      document.querySelectorAll(".engine-switch .seg").forEach(function (o) {
        var on = o === b; o.classList.toggle("active", on); o.setAttribute("aria-checked", on ? "true" : "false");
      });
      els.aiBox.hidden = state.engine !== "ai";
      if (state.engine === "ai") els.aiKey.focus();
    });
  });

  // ---------- scanning animation ----------
  var STAGES = [
    "Tokenizing text & measuring intensity",
    "Scanning emotional & urgency lexicons",
    "Testing 20 PSYOPS V8.3 indicators",
    "Auditing what needs external context",
    "Building the signal dashboard"
  ];

  function runScan(work) {
    var fast = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var stepMs = fast ? 60 : 380;
    D.clear(els.scanStages);
    var lis = STAGES.map(function (t) { var li = h("li", { text: t }); els.scanStages.appendChild(li); return li; });
    els.scan.hidden = false;
    els.scanBar.style.width = "0%";
    var i = 0;
    return new Promise(function (resolve) {
      function tick() {
        lis.forEach(function (li, k) { li.className = k < i ? "done" : k === i ? "now" : ""; });
        els.scanBar.style.width = Math.round(i / STAGES.length * 100) + "%";
        if (i < STAGES.length) { i++; setTimeout(tick, stepMs); }
        else resolve();
      }
      tick();
    }).then(function () {
      return Promise.all([work(), new Promise(function (r) { setTimeout(r, fast ? 0 : 150); })]);
    }).then(function (out) {
      els.scan.hidden = true;
      return out[0];
    }, function (err) {
      els.scan.hidden = true;
      throw err;
    });
  }

  // ---------- analysis ----------
  function readInput() {
    return {
      text: els.text.value,
      meta: { source: els.source.value.trim(), platform: els.platform.value.trim(), date: els.date.value.trim(), notes: els.notes.value.trim() }
    };
  }

  function analyze() {
    if (state.busy) return;
    var input = readInput();
    if (!input.text.trim()) { toast("Paste some text or load a preset first."); els.text.focus(); return; }
    state.busy = true;
    els.analyze.disabled = true;
    var useAI = state.engine === "ai";
    var key = els.aiKey.value.trim();
    if (useAI && !key) { toast("No API key entered — using the offline engine."); useAI = false; }

    runScan(function () {
      if (!useAI) return Promise.resolve(engine.analyze(input));
      return ai.analyze({ text: input.text, meta: input.meta, apiKey: key, model: els.aiModel.value }).catch(function (err) {
        toast("AI analysis failed (" + String(err && err.message || err).slice(0, 120) + "). Showing the offline engine instead.", 6000);
        var r = engine.analyze(input);
        r.engineLabel += " — AI fallback";
        return r;
      });
    }).then(function (res) {
      state.result = res;
      state.verify = {};
      resetSheet();
      render();
      els.results.hidden = false;
      els.results.scrollIntoView({ behavior: "smooth", block: "start" });
    }).finally(function () {
      state.busy = false;
      els.analyze.disabled = false;
    });
  }

  els.analyze.addEventListener("click", analyze);
  els.text.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyze(); });

  // ---------- render ----------
  function render() {
    var r = state.result;
    if (!r) return;
    $("reportTitle").textContent = r.meta.source || "Untitled content";
    var bits = [r.meta.platform, r.meta.date, r.wordCount + " words", r.engineLabel + (r.aiModel ? " · " + r.aiModel : "")].filter(Boolean);
    $("reportMeta").textContent = bits.join("  ·  ");

    D.renderGauge($("gauge"), r);
    $("coverage").textContent = r.summary.coverage;
    D.renderKpis($("kpis"), r);
    $("interpText").textContent = r.summary.interpretation;
    var band = r.summary.band;
    $("interpretation").style.setProperty("--band", band ? band.color : "#64748B");

    D.renderAnnotated($("annotated"), r, pickFromText);
    renderLegend(r);
    renderBars();
    D.renderDistribution($("dist"), r);
    D.renderQuestions($("questions"), r);
    D.renderCards($("cards"), r, quoteFromCard);
    renderSheet();
    D.renderMissing($("missingList"), r);
    renderVerify();
  }

  function renderLegend(r) {
    var el = $("hlLegend"); D.clear(el);
    var n = r.indicators.filter(function (f) { return f.evidenceQuote; }).length;
    el.appendChild(h("span", { class: "muted", text: n + " evidence span" + (n === 1 ? "" : "s") + " · colour = score:" }));
    [2, 3, 4, 5].forEach(function (s) {
      var sw = h("span", { class: "sw" }); sw.style.background = D.SCORE_COLORS[s];
      el.appendChild(h("span", { class: "lg" }, [sw, String(s)]));
    });
  }

  function renderBars() {
    D.renderBars($("bars"), state.result, { sort: state.sort, filter: state.filter, onClick: openCard });
  }

  document.querySelectorAll("[data-sort]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.sort = b.getAttribute("data-sort");
      document.querySelectorAll("[data-sort]").forEach(function (o) { o.classList.toggle("active", o === b); });
      renderBars();
    });
  });
  document.querySelectorAll("[data-filter]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.filter = b.getAttribute("data-filter");
      document.querySelectorAll("[data-filter]").forEach(function (o) { o.classList.toggle("active", o === b); });
      renderBars();
    });
  });

  function openCard(id) {
    var card = $("card-" + id);
    if (!card) return;
    D.setCard(card, true);
    card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    D.highlightQuote($("annotated"), id);
    var head = card.querySelector(".card-head");
    if (head) head.focus({ preventScroll: true });
  }

  function pickFromText(ids) { openCard(ids[0]); }

  function quoteFromCard(id, quiet) {
    var found = D.highlightQuote($("annotated"), id);
    if (!quiet && found) $("annotated").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  $("expandAll").addEventListener("click", function () { document.querySelectorAll("#cards .card").forEach(function (c) { D.setCard(c, true); }); });
  $("collapseAll").addEventListener("click", function () { document.querySelectorAll("#cards .card").forEach(function (c) { D.setCard(c, false); }); });

  // ---------- PSYOPS V8.3 scoring checklist ----------
  function resetSheet() {
    state.sheet = {};
    if (state.result) state.result.indicators.forEach(function (f) { state.sheet[f.id] = f.score; });
  }
  function renderSheet() {
    D.renderSheet($("sheetTable"), $("sheetTotal"), state.result, state.sheet, function (id, v) { state.sheet[id] = v; renderSheet(); });
  }
  $("sheetReset").addEventListener("click", function () { resetSheet(); renderSheet(); });

  // ---------- F. verification companion ----------
  var STEPS = [
    { n: 1, title: "Origin & reverse archive check", q: "Could this photo/video be older footage repurposed for a new crisis?",
      ex: "Example: checking whether a “breaking” war video was actually uploaded to YouTube in 2021.",
      how: "Take screenshots of key frames and run a reverse image search (Google Lens, TinEye, InVID); look for the earliest upload date." },
    { n: 2, title: "Ground-truth & event cross-check", q: "Do the visuals, geography, and claims match verified reports from reliable independent sources?",
      ex: "Compare landmarks, weather, time of day and reported locations with wire services and official statements.",
      how: "Cross-check with at least two independent, reliable outlets and geolocate visible landmarks." },
    { n: 3, title: "Synthetic AI & 3D CGI inspection", q: "Could this content be generated by AI or rendered using 3D computer graphics software like Blender?",
      ex: "Look for unnatural physics, repeating textures, too-perfect lighting, warped text or hands, and missing camera shake.",
      how: "Check for AI/CGI artefacts and search for the clip with terms like “Blender”, “CGI” or “simulation”." }
  ];

  function renderVerify() {
    var box = $("verifySteps"); D.clear(box);
    var p = presetBy(state.presetKey);
    STEPS.forEach(function (st) {
      var id = "verify-" + st.n;
      var cb = h("input", { type: "checkbox", id: id });
      cb.checked = !!state.verify[st.n];
      cb.addEventListener("change", function () { state.verify[st.n] = cb.checked; updateVerify(); });
      var item = h("div", { class: "vstep" + (cb.checked ? " checked" : "") }, [
        h("label", { class: "vcheck", for: id }, [cb, h("span", { class: "vbox", "aria-hidden": "true" })]),
        h("div", { class: "vbody" }, [
          h("p", { class: "vtitle" }, [h("span", { class: "vnum", text: String(st.n) }), st.title]),
          h("p", { class: "vq", text: st.q }),
          h("p", { class: "vex", text: st.ex }),
          h("p", { class: "vhow", text: st.how }),
          p && p.verification ? h("p", { class: "vcase", hidden: true, "data-step": st.n }, [h("b", { text: "Case finding: " }), p.verification[st.n]]) : null
        ])
      ]);
      box.appendChild(item);
    });
    var reveal = $("verifyReveal"); D.clear(reveal);
    if (p && p.verification) {
      reveal.hidden = false;
      var btn = h("button", { type: "button", class: "btn small accent", text: "Reveal what fact-checkers found" });
      btn.addEventListener("click", function () {
        STEPS.forEach(function (st) { state.verify[st.n] = true; });
        renderVerify();
        document.querySelectorAll(".vcase").forEach(function (el) { el.hidden = false; });
        var verdict = $("verdict"); if (verdict) verdict.hidden = false;
        btn.disabled = true;
      });
      reveal.appendChild(btn);
      reveal.appendChild(h("div", { class: "verdict", id: "verdict", hidden: true }, [
        h("p", { class: "verdict-h", text: "Later, the video was checked and found to be fake." }),
        h("p", { class: "verdict-sub", text: "How was it verified?" }),
        h("ol", { class: "verdict-list" }, [
          h("li", { text: "An older version of the video was found on YouTube. It had been created in 2021." }),
          h("li", { text: "The content of the video did not match the real events." }),
          h("li", { text: "The video had been created using Blender, a 3D computer graphics software." })
        ]),
        h("div", { class: "verdict-stats" }, [
          h("div", null, [h("b", { text: "13M" }), h("span", { text: "Speed of spread: views in just one day" })]),
          h("div", null, [h("b", { text: "22M+" }), h("span", { text: "Reach: total views, shared on X, Instagram, Facebook and TikTok" })])
        ]),
        h("p", { class: "verdict-foot", text: "The warning signs were in the post itself: fear, urgency, \u201cshare before they take it down\u201d and no sources." })
      ]));
    } else reveal.hidden = true;
    updateVerify();
  }

  function updateVerify() {
    var n = STEPS.filter(function (st) { return state.verify[st.n]; }).length;
    var el = $("verifyProgress");
    el.textContent = n + " / 3 checked" + (n === 3 ? " — now decide: share, don’t share, or share with context" : "");
    el.classList.toggle("done", n === 3);
    document.querySelectorAll(".vstep").forEach(function (v, i) { v.classList.toggle("checked", !!state.verify[i + 1]); });
  }

  // ---------- compare ----------
  var CUSTOM = "__current";
  var selA = $("compareSelA"), selB = $("compareSelB");
  function fillSelect(sel, def) {
    D.clear(sel);
    presets.forEach(function (p) { sel.appendChild(h("option", { value: p.key, text: p.short + ": " + p.title })); });
    sel.appendChild(h("option", { value: CUSTOM, text: "Current input" }));
    sel.value = def;
  }
  fillSelect(selA, "wwiii");
  fillSelect(selB, "wire");

  function analysisFor(key) {
    if (key === CUSTOM) {
      if (state.result) return { r: state.result, label: state.result.meta.source || "Current input" };
      var inp = readInput();
      if (!inp.text.trim()) return null;
      return { r: engine.analyze(inp), label: inp.meta.source || "Current input" };
    }
    var p = presetBy(key);
    return { r: engine.analyze({ text: p.text, meta: p.meta }), label: p.short + ": " + p.title };
  }

  function renderCompare() {
    [[selA, $("compareA")], [selB, $("compareB")]].forEach(function (pair) {
      var body = pair[1].querySelector(".compare-body");
      var a = analysisFor(pair[0].value);
      if (!a) { D.clear(body).appendChild(h("p", { class: "muted", text: "Paste text in the input workspace to compare it." })); return; }
      D.renderCompareColumn(body, a.r, a.label);
    });
  }
  selA.addEventListener("change", renderCompare);
  selB.addEventListener("change", renderCompare);

  els.compare.addEventListener("click", function () {
    var on = els.comparePanel.hidden;
    els.comparePanel.hidden = !on;
    els.compare.setAttribute("aria-pressed", on ? "true" : "false");
    els.compare.classList.toggle("on", on);
    if (on) { renderCompare(); els.comparePanel.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });

  // ---------- clear ----------
  els.clear.addEventListener("click", function () {
    [els.text, els.source, els.platform, els.date, els.notes].forEach(function (e) { e.value = ""; });
    state.result = null; state.presetKey = null; state.verify = {};
    markPreset(); updateCounts();
    els.results.hidden = true;
    D.hideTip();
    if (!els.comparePanel.hidden) renderCompare();
    root.scrollTo({ top: 0, behavior: "smooth" });
    els.text.focus();
  });

  // ---------- export ----------
  $("copyBtn").addEventListener("click", function () {
    if (!state.result) return;
    var md = D.toMarkdown(state.result, state.sheet);
    copyText(md).then(function () { toast("✓ Structured report copied to clipboard"); }, function () { toast("Copy failed — your browser blocked clipboard access."); });
  });

  function copyText(t) {
    if (navigator.clipboard && root.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (resolve, reject) {
      var ta = h("textarea", { class: "offscreen", "aria-hidden": "true" });
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject();
    });
  }

  $("printBtn").addEventListener("click", function () {
    document.querySelectorAll("#cards .card").forEach(function (c) { D.setCard(c, true); });
    root.print();
  });

  var toastTimer = null;
  function toast(msg, ms) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    els.toast.classList.remove("show"); void els.toast.offsetWidth; els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, ms || 2600);
  }

  // Deep link: index.html#preset=wwiii loads and runs a preset (handy for stage demos).
  var m = /preset=([a-z]+)/.exec(location.hash || "");
  if (m && presetBy(m[1])) loadPreset(m[1], true);

  updateCounts();
  root.MSA.app = { state: state, analyze: analyze, loadPreset: loadPreset };
})(window);
