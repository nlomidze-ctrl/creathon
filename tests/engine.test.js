// Run with: node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const fw = require("../js/framework.js");
const engine = require("../js/engine.js");
const { PRESETS } = require("../js/presets.js");

const byKey = Object.fromEntries(PRESETS.map((p) => [p.key, engine.analyze({ text: p.text, meta: p.meta })]));

test("framework has the 20 V8.3 indicators in order", () => {
  assert.strictEqual(fw.INDICATORS.length, 20);
  fw.INDICATORS.forEach((d, i) => assert.strictEqual(d.id, i + 1));
});

test("every finding obeys the output contract", () => {
  for (const r of Object.values(byKey)) {
    assert.strictEqual(r.indicators.length, 20);
    for (const f of r.indicators) {
      assert.ok(["Observed", "Not observed", "Cannot assess"].includes(f.status));
      if (f.status === "Cannot assess") assert.strictEqual(f.score, null);
      else assert.ok(Number.isInteger(f.score) && f.score >= 1 && f.score <= 5);
      if (f.status === "Observed") assert.ok(f.score >= 2);
      if (f.status === "Not observed") assert.strictEqual(f.score, 1);
      if (f.status === "Cannot assess") assert.ok(f.missingContext);
      if (f.evidenceQuote) assert.strictEqual(r.text.slice(f.evidenceStart, f.evidenceEnd), f.evidenceQuote, "quote must be verbatim");
      assert.strictEqual(f.guidingQuestion, fw.INDICATORS[f.id - 1].guidingQuestion);
    }
  }
});

test("signal intensity index uses only assessed indicators", () => {
  for (const r of Object.values(byKey)) {
    const assessed = r.indicators.filter((f) => f.score !== null);
    const avg = assessed.reduce((a, f) => a + f.score, 0) / assessed.length;
    assert.strictEqual(r.summary.signalIntensityIndex, Math.round(((avg - 1) / 4) * 100));
    assert.strictEqual(r.summary.assessedCount + r.summary.naCount, 20);
  }
});

test("presets separate clearly: case study and crisis above the neutral wire report", () => {
  const w = byKey.wwiii.summary.signalIntensityIndex;
  const c = byKey.crisis.summary.signalIntensityIndex;
  const n = byKey.wire.summary.signalIntensityIndex;
  assert.ok(n < 15, "wire " + n);
  assert.ok(w >= 35, "wwiii " + w);
  assert.ok(c >= 50, "crisis " + c);
});

test("WWIII case study scores high on its teaching indicators", () => {
  const s = Object.fromEntries(byKey.wwiii.indicators.map((f) => [f.id, f.score]));
  for (const id of [2, 5, 8, 9, 17]) assert.ok(s[id] >= 4, "indicator " + id + " = " + s[id]);
});

test("external indicators are Cannot assess without cues", () => {
  const s = Object.fromEntries(byKey.wire.indicators.map((f) => [f.id, f.score]));
  for (const id of [1, 3, 13, 19, 20]) assert.strictEqual(s[id], null, "indicator " + id);
});

test("too-short or empty text yields Insufficient Evidence", () => {
  const r = engine.analyze({ text: "Wow!" });
  assert.strictEqual(r.summary.signalIntensityIndex, null);
  assert.strictEqual(r.summary.assessedCount, 0);
});

test("markup in input is kept as plain text, never interpreted", () => {
  const r = engine.analyze({ text: "<img src=x onerror=alert(1)> BREAKING: share this everywhere right now before they take it down!" });
  assert.ok(r.text.includes("<img"));
});

test("reworked worksheet covers every indicator exactly once", () => {
  const ids = fw.GROUPS.flatMap((g) => g.ids).sort((a, b) => a - b);
  assert.deepStrictEqual(ids, fw.INDICATORS.map((d) => d.id));
  fw.INDICATORS.forEach((d) => assert.ok(fw.WORKSHEET[d.id].plain && fw.WORKSHEET[d.id].modern && fw.WORKSHEET[d.id].lookFor));
  assert.strictEqual(fw.SCORE_GUIDE.length, 5);
});
