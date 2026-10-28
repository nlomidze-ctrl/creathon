/*
 * Deterministic heuristic analysis engine.
 *
 * Runs entirely offline: it scans the supplied text (and optional context notes) for
 * lexical and structural cues tied to each of the 20 indicators, and returns one
 * structured finding per indicator plus a summary. It never fetches anything and never
 * invents quotes: every evidenceQuote is an exact substring of the analysed text.
 */
(function (root) {
  "use strict";

  var fw = (root.MSA && root.MSA.framework) ||
    (typeof require !== "undefined" ? require("./framework.js") : null);

  var MAX_CHARS = 20000;
  var MIN_WORDS = 8;

  // ---------- helpers ----------

  function P(src, w, flags) { return { src: src, w: w == null ? 1 : w, flags: flags }; }

  function compile(src, flags) {
    // Letter-boundary lookarounds work for multi-word phrases, hashtags and digits.
    return new RegExp("(?<![\\p{L}\\p{N}])(?:" + src + ")(?![\\p{L}\\p{N}])", flags || "giu");
  }

  // Returns [{index, length, text, w, label}] for every non-overlapping hit.
  function findAll(text, patterns) {
    var hits = [];
    patterns.forEach(function (p) {
      var re = p.re || (p.re = compile(p.src, p.flags));
      re.lastIndex = 0;
      var m;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        hits.push({ index: m.index, length: m[0].length, text: m[0], w: p.w });
      }
    });
    hits.sort(function (a, b) { return a.index - b.index || b.length - a.length; });
    // Drop hits fully contained in an earlier, longer one so phrases are not double counted.
    var out = [];
    hits.forEach(function (h) {
      var last = out[out.length - 1];
      if (last && h.index < last.index + last.length) {
        if (h.w > last.w && h.index === last.index) out[out.length - 1] = h;
        return;
      }
      out.push(h);
    });
    return out;
  }

  function weight(hits, cap) {
    var w = 0;
    hits.forEach(function (h) { w += h.w; });
    return cap ? Math.min(w, cap) : w;
  }

  function uniqueLabels(hits, n) {
    var seen = {}, out = [];
    hits.forEach(function (h) {
      var k = h.text.toLowerCase().replace(/\s+/g, " ");
      if (!seen[k]) { seen[k] = 1; out.push(h.text.replace(/\s+/g, " ")); }
    });
    return out.slice(0, n || 3);
  }

  function quoteList(hits, n) {
    return uniqueLabels(hits, n).map(function (t) { return "“" + t + "”"; }).join(", ");
  }

  // Weighted signal -> 1..5. Thresholds are the minimum weight for scores 2,3,4,5.
  function toScore(w, t) {
    t = t || [1, 2, 4, 7];
    if (w >= t[3]) return 5;
    if (w >= t[2]) return 4;
    if (w >= t[1]) return 3;
    if (w >= t[0]) return 2;
    return 1;
  }

  // Expand a hit to a short readable phrase (a few words either side, same clause).
  // The result is always an exact substring of `text`.
  function phraseAround(text, hit) {
    var start = hit.index, end = hit.index + hit.length;
    var stop = /[.!?\n;]/;
    var words = 0;
    while (start > 0 && words < 3) {
      var c = text[start - 1];
      if (stop.test(c) || start <= hit.index - 60) break;
      start--;
      if (/\s/.test(c) && start > 0 && !/\s/.test(text[start - 1])) words++;
    }
    words = 0;
    while (end < text.length && words < 3) {
      var d = text[end];
      if (stop.test(d) || end >= hit.index + hit.length + 60) break;
      end++;
      if (/\s/.test(d) && end < text.length && !/\s/.test(text[end])) words++;
    }
    // Include terminal punctuation run (e.g. "!!!") when we stopped on it.
    while (end < text.length && /[!?]/.test(text[end])) end++;
    while (start < end && /[\s,:\-—"'“”]/.test(text[start])) start++;
    while (end > start && /[\s,:\-—]/.test(text[end - 1])) end--;
    // Avoid a dangling partial word at the edges.
    if (start > 0 && /[\p{L}\p{N}]/u.test(text[start - 1])) {
      var sp = text.indexOf(" ", start);
      if (sp !== -1 && sp < hit.index) start = sp + 1;
    }
    return { start: start, end: end, text: text.slice(start, end) };
  }

  function strongest(hits) {
    var best = null;
    hits.forEach(function (h) { if (!best || h.w > best.w) best = h; });
    return best;
  }

  // ---------- lexicons ----------

  var L = {
    fear: [
      P("panic\\w*", 1.5), P("terrif\\w*"), P("horrif\\w*"), P("fear\\w*"), P("scar(?:ed|y|ing)"),
      P("devastat\\w*"), P("catastroph\\w*", 1.5), P("tragedy|tragic"), P("nightmare"), P("dying|die|dead|deaths?"),
      P("kill(?:ed|ing|s)?"), P("destroy\\w*|destruction"), P("massacre\\w*", 1.5), P("suffer\\w*"), P("crying|weeping|screaming"),
      P("innocent (?:children|families|people|lives)", 1.5), P("blood\\w*"), P("doom\\w*"), P("apocalyp\\w*", 1.5),
      P("massive explosions?", 1.5), P("explosions?"), P("poison\\w*"), P("toxic"), P("deadly"), P("disaster\\w*"),
      P("wake up", 1), P("we are not safe|no one is safe", 1.5), P("you(?:'|’)?ll regret"), P("ashamed|shame on")
    ],
    outrage: [
      P("outrage\\w*", 1.5), P("furious|fury|enraged|rage"), P("disgust\\w*", 1.5), P("unacceptable"), P("how dare", 1.5),
      P("shameful|disgrace\\w*"), P("betray\\w*", 1.5), P("scandal\\w*"), P("sickening|sick of"), P("criminal\\w*"),
      P("evil", 1.5), P("monsters?"), P("insane|insanity"), P("heartless|ruthless|reckless")
    ],
    attribution: [
      P("according to"), P("said|says|told|stated|explained|noted|added"), P("spokes(?:person|woman|man)"),
      P("press release"), P("in a statement"), P("reported by|reports from"), P("confirmed by"), P("data from"),
      P("published (?:by|in)"), P("researchers? at")
    ],
    balance: [
      P("however"), P("critics"), P("others? (?:say|said|argue|noted)"), P("on the other hand"), P("disputed?"),
      P("denied|denies"), P("declined to comment"), P("(?:is|was|remains) (?:not yet )?(?:clear|unclear|unknown)"),
      P("not (?:yet )?(?:been )?(?:independently )?(?:confirmed|verified)"), P("unconfirmed|unverified"),
      P("investigat\\w*"), P("preliminary"), P("it is too early"), P("may have|might have|could have"),
      P("alternative explanations?"), P("several factors|multiple factors|contributing factors"), P("cautioned")
    ],
    hiding: [
      P("they don(?:'|’)?t want you to (?:know|see)", 2), P("(?:mainstream )?media (?:won(?:'|’)?t|will not|refuses to) (?:tell|report|show)", 2),
      P("what they(?:'|’)?re not telling you", 2), P("before they take it down", 1.5), P("the truth they hide", 2),
      P("no one is talking about", 1.5), P("(?:nobody|no one) is telling you", 1.5), P("what(?:'|\u2019)?s really (?:happening|going on)|what is really (?:happening|going on)", 1.5), P("(?:being )?covered up|cover-?up", 1.5)
    ],
    simplistic: [
      P("evil", 1.5), P("villains?"), P("heroes"), P("good (?:vs\\.?|versus) evil", 2), P("pure evil", 2), P("monsters?"),
      P("entirely (?:to blame|responsible|their fault)", 2), P("solely (?:to blame|responsible)", 2), P("the only cause", 2),
      P("single-handedly"), P("(?:100%|all) (?:their|his|her) fault", 2), P("all because of", 1.5), P("plain and simple", 1.5),
      P("it(?:'|’)?s that simple", 1.5), P("black and white"), P("(?:has )?officially (?:started|begun|begun|happened)", 1.5),
      P("it(?:'|’)?s happening", 1), P("there is no doubt|no doubt about it", 1), P("undeniabl\\w*", 1), P("this is it", 1),
      P("one (?:company|man|group|country) (?:is )?(?:to blame|responsible)", 2), P("blame\\w* (?:solely|entirely)", 2)
    ],
    tribalStrong: [
      P("us (?:vs\\.?|versus|against) them", 2.5), P("those people", 1.5), P("outsiders?", 1.5), P("foreigners?", 1.5),
      P("invaders?", 2), P("traitors?", 2), P("the enemy|our enemies", 1.5), P("real (?:americans|patriots|citizens|locals)", 2),
      P("our (?:people|community|side|town) (?:against|versus)", 2), P("their side|our side", 1.5), P("people like them", 1.5),
      P("elites?", 1.5), P("they(?:'|’)?re coming for", 2), P("not one of us", 2), P("we the people", 1)
    ],
    tribalWeak: [P("they|them|their", 0.4)],
    authorityVague: [
      P("experts? (?:say|said|warn\\w*|agree|confirm\\w*|believe)", 2), P("scientists (?:say|warn|agree)", 1.5),
      P("doctors (?:say|warn|agree)", 1.5), P("sources (?:say|said|tell|claim)", 1.5), P("(?:an? )?insiders?", 1.5),
      P("(?:a )?(?:top|leading|renowned|world-renowned) (?:expert|scientist|doctor|analyst)", 2), P("studies (?:show|prove)", 1.5),
      P("research (?:shows|proves)", 1.5), P("anonymous (?:source|official|expert)s?", 2), P("self-(?:proclaimed|described) \\w+", 1.5),
      P("whistleblowers?", 1), P("influencers?", 1), P("celebrit\\w+", 1), P("so-called experts?", 1.5),
      P("(?:retired|former) \\w+ (?:officer|general|agent|insider)", 1)
    ],
    authorityNamed: [
      P("(?:Dr|Prof|Professor)\\.? [A-Z][a-z]+", 1, "gu"), P("(?:said|told)\\s+[A-Z][a-z]+ [A-Z][a-z]+", 1, "gu"),
      P("[A-Z][a-z]+ [A-Z][a-z]+, (?:a|an|the) [a-z]+", 1, "gu")
    ],
    urgent: [
      P("share (?:this|it|now|everywhere|widely|before)", 2), P("act now|act fast", 2), P("right now", 1.5), P("immediately", 1),
      P("before it(?:'|’)?s too late", 2), P("before they (?:take|delete|remove|ban)\\w*(?: it)?(?: down)?", 2),
      P("don(?:'|’)?t wait", 1.5), P("urgent\\w*", 1.5), P("call your (?:representative|senator|mp|congress\\w*)", 1.5),
      P("sign (?:the|this) petition", 1.5), P("donate (?:now|today|immediately)", 2), P("must act", 1.5), P("spread the word", 2),
      P("retweet|repost|reshare", 1.5), P("tonight|within (?:24|48) hours", 1), P("time is running out", 2), P("last chance", 1.5),
      P("wake up", 1), P("there is no time", 1.5), P("demand (?:action|answers) now", 1.5), P("now!+", 1)
    ],
    novelty: [
      P("unprecedented", 2), P("shock\\w*", 1.5), P("never (?:before|been seen)", 1.5), P("first time in (?:history|decades)", 1.5),
      P("once-in-a-(?:lifetime|generation|century)", 2), P("historic", 1), P("breaking", 1.5), P("world war (?:iii|3|three)|ww3|wwiii", 2),
      P("unbelievable|incredible|jaw-dropping|mind-blowing", 1), P("bombshell", 1.5), P("massive", 1), P("biggest (?:ever|in history)", 1.5),
      P("worst (?:ever|in history)", 1.5), P("record-breaking|record high", 1), P("of the century", 1.5), P("like nothing (?:we(?:'|’)?ve|you(?:'|’)?ve) ever seen", 2),
      P("officially", 1), P("explosive", 1)
    ],
    dissent: [
      P("deniers?", 2), P("conspiracy theorists?", 1.5), P("shills?", 2), P("trolls?", 1.5), P("paid (?:actors?|critics|agents?)", 2),
      P("(?:should|must) be (?:silenced|banned|fired|removed)", 2.5), P("shut (?:them |him |her )?up|silence (?:them|the critics)", 2),
      P("don(?:'|’)?t listen to", 1.5), P("ignore (?:the )?(?:critics|naysayers)", 2), P("naysayers?", 1.5), P("apologists?", 1.5),
      P("deplatform\\w*|ban (?:them|him|her)", 2), P("censor\\w*", 1), P("take it down", 0.75), P("traitors?", 1.5), P("enemies of the people", 2.5)
    ],
    dilemma: [
      P("either\\b[^.!?\\n]{1,90}?\\bor\\b", 2), P("you(?:'|’)?re either", 2), P("if you(?:'|’)?re not with us", 2.5),
      P("with us or against us", 2.5), P("only two (?:options|choices|ways)", 2), P("there is no (?:middle ground|other option|other choice|alternative)", 2),
      P("the only (?:option|way|solution|choice)", 1.5), P("if you don(?:'|’)?t [^.!?\\n]{1,50}?, (?:you|then you)", 2),
      P("anyone who (?:disagrees|doubts|questions)", 1)
    ],
    numbers: [
      P("\\d[\\d,.]*\\s?(?:%|percent)", 1.5), P("\\d+(?:\\.\\d+)?\\s?(?:million|billion|trillion|thousand|[MKB])", 1),
      P("\\d+\\s?(?:times|x) (?:more|higher|worse|greater|faster)", 2), P("\\d{2,}[\\d,]*", 0.5)
    ],
    dramaticStats: [
      P("skyrocket\\w*|soar\\w*|explod(?:ed|ing) by|surg(?:ed|ing) by", 1.5), P("a staggering|a whopping|an astonishing", 2),
      P("(?:up|rose|increased) (?:by )?\\d+\\s?%", 1)
    ],
    statContext: [
      P("according to"), P("data from"), P("survey of"), P("methodolog\\w*"), P("compared (?:with|to)"), P("baseline"),
      P("margin of error"), P("per capita|per \\d+"), P("out of \\d+"), P("estimate[sd]?"), P("preliminary"), P("sample"), P("(?:federal|legal|safe|permitted) limits?"), P("readings?|measured|samples?")
    ],
    fallacy: [
      P("out-of-touch", 2), P("elites?", 1), P("idiots?|morons?|clowns?|fools?", 2), P("sheep(?:le)?", 2), P("so-called", 1.5),
      P("paid shills?", 2), P("only an idiot", 2.5), P("if you (?:still )?believe", 1.5), P("everyone knows", 1.5), P("obviously", 1),
      P("what about", 1), P("they would say that", 2), P("anyone with a brain", 2), P("wake up,? (?:sheep|people)", 2),
      P("deniers?", 1), P("no real \\w+ would", 2)
    ],
    framing: [
      P("make no mistake", 2), P("the (?:real )?truth is", 1.5), P("the real story", 1.5), P("what they won(?:'|’)?t tell you", 2),
      P("let that sink in", 2), P("wake up", 1.5), P("open your eyes", 2), P("it(?:'|’)?s clear that|clearly", 1), P("obviously", 1),
      P("entirely (?:preventable|avoidable)", 2), P("avoidable (?:tragedy|disaster)", 2), P("don(?:'|’)?t be fooled", 2),
      P("the question is not whether", 1.5), P("this is what (?:happens|they)", 1.5), P("breaking", 1), P("officially", 1),
      P("they(?:'|’)?re hiding", 1.5), P("pay attention", 1), P("the narrative", 1)
    ],
    history: [
      P("just like (?:in )?\\d{4}", 2), P("history (?:is )?repeat\\w*", 2), P("remember (?:when|what happened)", 1.5),
      P("(?:the )?same thing happened", 2), P("all over again", 1.5), P("d[eé]j[aà] vu", 1.5), P("reminiscent of", 1.5),
      P("echoes of", 1.5), P("as (?:in|during) \\d{4}", 1.5), P("world war (?:iii|3|three)|ww3|wwiii", 1.5), P("pearl harbor|9/11", 1.5),
      P("cold war", 1), P("like the \\w+ (?:crisis|disaster|scandal) of \\d{4}", 2), P("we(?:'|’)?ve seen this before", 2)
    ],
    timing: [
      P("coincidental\\w*|coincid\\w*", 2), P("conveniently(?: timed)?", 2), P("just (?:days|hours|weeks) (?:before|after)", 2),
      P("right before (?:the )?(?:election|vote|hearing|trial)", 2.5), P("(?:the )?same (?:day|week) (?:as|that)", 1.5),
      P("during (?:the )?[\\p{L}\\p{N}–—-]+(?: [\\p{L}\\p{N}–—-]+){0,5}", 1.5), P("amid(?:st)? (?:the )?\\w+", 1.5),
      P("as (?:the )?\\w+ (?:unfolded|happened|began)", 1.5), P("at the same time", 1), P("timed (?:to|with)", 2)
    ],
    uniform: [
      P("all (?:the )?(?:outlets|media|networks|channels|news(?:papers)?)", 2), P("every (?:outlet|network|channel|news \\w+)", 2),
      P("everyone is saying", 1.5), P("same (?:words|phrase|message|wording|talking points)", 2), P("copy(?:-| and )paste\\w*", 2),
      P("identical (?:posts?|messages?|wording|hashtags?|videos?|captions?)", 2), P("repeated across", 2), P("talking points", 1.5),
      P("same (?:video|clip|footage|image)", 1.5), P("reposted|reshared|re-?uploaded", 1), P("across (?:all )?(?:platforms|outlets)", 1.5)
    ],
    platforms: [P("x(?=[,/ ]|$)|twitter|instagram|facebook|tiktok|youtube|telegram|reddit|whatsapp|threads", 1)],
    gain: [
      P("contracts?", 1.5), P("lobb\\w+", 2), P("profit\\w*", 1.5), P("donat\\w+", 1), P("funding|funded by|fund(?:raiser|raising)", 1.5),
      P("campaign\\w*", 1), P("election|vote for|voters", 1), P("polic(?:y|ies)", 0.75), P("\\$\\s?\\d[\\d,.]*\\s?(?:million|billion|m|bn|k)?", 1.5),
      P("(?:shares|stock) (?:price|prices|rose|jumped|soared)", 2), P("ad revenue|monetiz\\w*|revenue sharing", 2), P("sponsor\\w*", 1.5),
      P("super pac|pac", 1.5), P("investors?", 1), P("subscribe|buy now|use (?:my )?code", 1.5), P("benefit\\w* (?:from|financially)", 2)
    ],
    bandwagon: [
      P("everyone(?: is| else)?", 1.5), P("everybody", 1.5), P("millions (?:of people )?(?:are|have)", 2), P("all your friends", 2),
      P("join (?:us|the|millions|the movement)", 2), P("don(?:'|’)?t be (?:the only|left)", 2), P("trending", 1.5), P("going viral|viral", 1),
      P("the whole (?:world|internet|country)", 1.5), P("people are (?:waking up|panicking|saying|talking)", 1.5), P("share if you agree", 2),
      P("#[\\p{L}\\p{N}_]+", 0.75), P("share this everywhere", 1)
    ],
    virality: [P("\\d+(?:\\.\\d+)?\\s?(?:M|K|million|thousand|billion)\\+?\\s?(?:views|shares|likes|reposts|impressions)", 1)],
    behavior: [
      P("everyone is (?:changing|adding|wearing|buying|stockpiling|leaving|posting)", 2), P("emojis?", 1.5), P("profile (?:picture|pic|frame|photo)s?", 1.5),
      P("panic[- ]buy\\w*", 2), P("stockpil\\w*", 2), P("lining up|queues? (?:around|outside)", 1.5), P("mass (?:exodus|unfollow\\w*|boycott\\w*|deletion)", 2),
      P("boycott\\w*", 1.5), P("changed their (?:profile|name|avatar)", 2), P("suddenly (?:everyone|people|users|thousands)", 2), P("flood(?:ed|ing) (?:the|social)", 1.5)
    ],
    media: [P("video|footage|clip|photo|image|picture|livestream|camera|filmed|recorded", 1)]
  };

  var EMO_ROOTS = /(panic|terrif|horrif|fear|scar|devastat|catastroph|tragedy|tragic|nightmare|dying|dead|death|kill|destro|massacre|suffer|crying|blood|doom|apocalyp|explosion|poison|toxic|deadly|disaster|outrage|fury|furious|disgust|betray|evil|shock|war)/i;

  var ALARM_EMOJI = /[\u{1F6A8}\u{1F525}\u{26A0}\u{203C}\u{2757}\u{1F4A5}\u{1F631}\u{1F621}\u{1F92C}]/gu;

  // ---------- per-indicator analysers ----------

  function finding(def, score, explanation, evidenceHit, text, missingContext, extra) {
    var f = {
      id: def.id,
      name: def.name,
      guidingQuestion: def.guidingQuestion,
      status: score == null ? "Cannot assess" : (score >= 2 ? "Observed" : "Not observed"),
      score: score == null ? null : score,
      explanation: explanation,
      evidenceQuote: null,
      evidenceStart: null,
      evidenceEnd: null,
      missingContext: missingContext || null
    };
    if (evidenceHit && score != null && score >= 2) {
      var ph = phraseAround(text, evidenceHit);
      f.evidenceQuote = ph.text;
      f.evidenceStart = ph.start;
      f.evidenceEnd = ph.end;
    }
    if (extra) Object.keys(extra).forEach(function (k) { f[k] = extra[k]; });
    return f;
  }

  function stats(text) {
    var words = text.match(/[\p{L}\p{N}'’#@-]+/gu) || [];
    var capsWords = words.filter(function (w) { return w.length >= 3 && /\p{L}/u.test(w) && w === w.toUpperCase() && w !== w.toLowerCase(); });
    var excl = (text.match(/!/g) || []).length;
    var exclRuns = (text.match(/!{2,}/g) || []).length;
    return {
      words: words.length,
      capsRatio: words.length ? capsWords.length / words.length : 0,
      excl: excl,
      exclRuns: exclRuns
    };
  }

  function intensityBonus(st) {
    var b = 0;
    if (st.capsRatio > 0.3) b += 2; else if (st.capsRatio > 0.12) b += 1;
    if (st.excl >= 6 || st.exclRuns >= 2) b += 2; else if (st.excl >= 3) b += 1;
    return b;
  }

  function intensityNote(st) {
    var parts = [];
    if (st.capsRatio > 0.12) parts.push(Math.round(st.capsRatio * 100) + "% of words in ALL CAPS");
    if (st.excl >= 3) parts.push(st.excl + " exclamation marks");
    return parts.length ? " Typographic intensity adds to this: " + parts.join(" and ") + "." : "";
  }

  function externalMissing(def) { return def.verify; }

  function faint(hits) {
    return hits.length ? "Only faint cues appear (" + quoteList(hits, 2) + "), not enough to count as an observable signal." : "";
  }

  function analyzeHeuristic(input) {
    input = input || {};
    var text = String(input.text || "").slice(0, MAX_CHARS);
    var meta = input.meta || {};
    var notes = String(meta.notes || "").slice(0, 4000);
    var contextBlob = [meta.source, meta.platform, meta.date, notes].filter(Boolean).join(" • ");
    var st = stats(text);
    var defs = fw.INDICATORS;
    var byId = {};
    defs.forEach(function (d) { byId[d.id] = d; });

    if (st.words < MIN_WORDS) {
      var why = st.words === 0 ? "No text was supplied." : "The text is too short (" + st.words + " words) to assess reliably.";
      return buildResult(text, meta, st, defs.map(function (d) {
        return finding(d, null, why, null, text, "Provide a longer passage (at least " + MIN_WORDS + " words) or a full transcript.");
      }), "heuristic");
    }

    var fear = findAll(text, L.fear), outrage = findAll(text, L.outrage);
    var attrib = findAll(text, L.attribution), balance = findAll(text, L.balance), hiding = findAll(text, L.hiding);
    var sourcing = attrib.length + balance.length;
    var out = [];

    // 1 Timing (external)
    (function () {
      var d = byId[1];
      var tHits = findAll(text, L.timing.filter(function (p) { return p.w >= 2; }));
      var cHits = findAll(notes, L.timing);
      var w = weight(tHits) + weight(cHits);
      if (w === 0) {
        out.push(finding(d, null, "Neither the text nor the context notes link the content's appearance to other events, so timing cannot be judged from the text alone.", null, text, externalMissing(d)));
        return;
      }
      var s = Math.min(4, toScore(w, [1, 2, 3.5, 99]));
      var src = [];
      if (tHits.length) src.push("the text (" + quoteList(tHits, 2) + ")");
      if (cHits.length) src.push("the context notes (" + quoteList(cHits, 2) + ")");
      out.push(finding(d, s, "Timing cues appear in " + src.join(" and ") + ", placing the content alongside another unfolding event. Coincidence alone is not evidence of coordination.", strongest(tHits), text,
        "Signals come only from the supplied text/notes. " + externalMissing(d)));
    })();

    // 2 Emotional Manipulation
    (function () {
      var d = byId[2];
      var hits = fear.concat(outrage);
      var w = weight(hits) + (hits.length ? intensityBonus(st) : 0);
      var s = toScore(w, [1, 2.5, 5, 8]);
      if (s >= 3 && sourcing >= 4) s -= 1;
      var expl = hits.length
        ? "Found " + hits.length + " fear, outrage or guilt cue" + (hits.length > 1 ? "s" : "") + " (" + quoteList(hits) + ")." + intensityNote(st) +
          (sourcing >= 4 ? " The text does provide attribution, which tempers the score." : sourcing === 0 ? " No sources or evidence are offered to support the emotional claims." : "")
        : "No fear, outrage or guilt language was detected.";
      out.push(finding(d, s, expl, strongest(hits), text));
    })();

    // 3 Uniform Messaging (external)
    (function () {
      var d = byId[3];
      var tHits = findAll(text, L.uniform);
      var tags = text.match(/#[\p{L}\p{N}_]+/gu) || [];
      var tagCounts = {}, repeatedTag = 0;
      tags.forEach(function (t) { var k = t.toLowerCase(); tagCounts[k] = (tagCounts[k] || 0) + 1; if (tagCounts[k] === 2) repeatedTag++; });
      var cHits = findAll(notes, L.uniform);
      var plats = {};
      findAll(notes, L.platforms).forEach(function (h) { plats[h.text.toLowerCase()] = 1; });
      var platCount = Object.keys(plats).length;
      var w = weight(tHits) + weight(cHits) + repeatedTag * 1.5 + (platCount >= 2 ? platCount * 0.5 : 0);
      if (w === 0) {
        out.push(finding(d, null, "Uniform messaging is a cross-media pattern; nothing in the supplied text or notes shows the same wording appearing elsewhere.", null, text, externalMissing(d)));
        return;
      }
      var s = Math.min(4, toScore(w, [1, 2, 3.5, 99]));
      var bits = [];
      if (tHits.length) bits.push("the text refers to repetition (" + quoteList(tHits, 2) + ")");
      if (repeatedTag) bits.push("hashtags are repeated");
      if (cHits.length) bits.push("the context notes mention " + quoteList(cHits, 2));
      if (platCount >= 2) bits.push("the notes mention the content on " + platCount + " platforms");
      out.push(finding(d, s, "Cross-media repetition is suggested: " + bits.join("; ") + ".", strongest(tHits), text,
        "Whether the wording was coordinated cannot be confirmed from one text. " + externalMissing(d)));
    })();

    // 4 Missing Information
    (function () {
      var d = byId[4];
      var s;
      if (sourcing >= 6) s = 1; else if (sourcing >= 4) s = 2; else if (sourcing >= 2) s = 3; else if (sourcing === 1) s = 3; else s = 4;
      if (sourcing === 0 && hiding.length) s = 5;
      if (sourcing <= 1 && st.words < 25 && !hiding.length) s = Math.min(s, 3);
      var expl = sourcing === 0
        ? "The text offers no attribution, named sources, acknowledged uncertainty or alternative views." + (hiding.length ? " It also claims information is being hidden (" + quoteList(hiding, 2) + ") instead of supplying it." : "")
        : "The text contains " + attrib.length + " attribution marker" + (attrib.length === 1 ? "" : "s") + " and " + balance.length + " acknowledgement" + (balance.length === 1 ? "" : "s") + " of uncertainty or other views" +
          (balance.length ? " (" + quoteList(balance, 2) + ")" : "") + "." + (s >= 3 ? " That is thin for the claims being made." : " Alternative views and context appear to be represented.");
      out.push(finding(d, s, expl, hiding.length ? strongest(hiding) : null, text,
        s >= 3 ? "An absence cannot be quoted. Compare with other reports to see which timelines, causes or perspectives are left out." : null));
    })();

    // 5 Simplistic Narratives
    (function () {
      var d = byId[5];
      var hits = findAll(text, L.simplistic);
      var w = weight(hits) + (hits.length && sourcing === 0 ? 1 : 0);
      var s = toScore(w, [1, 2, 3.5, 6]);
      out.push(finding(d, s, s >= 2
        ? "The narrative is reduced to absolute or moralised terms (" + quoteList(hits) + ")" + (sourcing === 0 ? " with no nuance, qualifiers or competing explanations." : ".")
        : faint(hits) || "No good-versus-evil framing or single-cause certainty was detected.", strongest(hits), text));
    })();

    // 6 Tribal Division
    (function () {
      var d = byId[6];
      var strong = findAll(text, L.tribalStrong);
      var weak = findAll(text, L.tribalWeak);
      var weakW = Math.min(weight(weak), 1.5);
      var w = weight(strong) + (strong.length || weak.length >= 3 ? weakW : 0);
      var s = toScore(w, [1, 2.5, 4.5, 7]);
      var expl = strong.length
        ? "In-group/out-group language appears (" + quoteList(strong) + ")" + (weak.length ? ", alongside " + weak.length + " uses of an unspecified “they/them”" : "") + "."
        : weak.length >= 3 ? "The text repeatedly refers to an unspecified “they/them” (" + weak.length + " times), implying an opposing group."
        : "No clear “us vs. them” framing was detected.";
      out.push(finding(d, s, expl, strongest(strong.length ? strong : weak.length >= 3 ? weak : []), text));
    })();

    // 7 Authority Overload
    (function () {
      var d = byId[7];
      var vague = findAll(text, L.authorityVague);
      var named = findAll(text, L.authorityNamed);
      var w = Math.max(0, weight(vague) - named.length * 0.5);
      var s = toScore(w, [1, 2, 4, 6]);
      var expl = vague.length
        ? "Authority is invoked vaguely or through non-specialists (" + quoteList(vague) + ")" + (named.length ? "; some named attributions are also present." : " without names, credentials or relevant expertise.")
        : named.length ? "Authorities are cited by name, which allows them to be checked." : "The text does not lean on expert or authority claims.";
      out.push(finding(d, s, expl, strongest(vague), text, s >= 2 ? externalMissing(d) : null));
    })();

    // 8 Call for Urgent Action
    (function () {
      var d = byId[8];
      var hits = findAll(text, L.urgent);
      var w = weight(hits) + (hits.length && st.excl >= 3 ? 1 : 0);
      var s = toScore(w, [1, 2, 4, 6]);
      out.push(finding(d, s, s >= 2
        ? "The reader is pushed to act or share immediately (" + quoteList(hits) + "), leaving little room to verify first."
        : faint(hits) || "No demand for immediate action or sharing was detected.", strongest(hits), text));
    })();

    // 9 Overuse of Novelty
    (function () {
      var d = byId[9];
      var hits = findAll(text, L.novelty);
      var w = weight(hits) + (hits.length ? Math.min(intensityBonus(st), 1) : 0);
      var s = toScore(w, [1, 2, 4, 6]);
      out.push(finding(d, s, s >= 2
        ? "The event is framed as shocking, historic or unprecedented (" + quoteList(hits) + ")."
        : faint(hits) || "No shock or “unprecedented” framing was detected.", strongest(hits), text));
    })();

    // 10 Financial/Political Gain (external)
    (function () {
      var d = byId[10];
      var tHits = findAll(text, L.gain);
      var cHits = findAll(notes, L.gain);
      var w = weight(tHits) + weight(cHits) * 0.75;
      if (w < 1) {
        out.push(finding(d, null, "The text and notes do not mention who gains money, power, votes or contracts from this narrative.", null, text, externalMissing(d)));
        return;
      }
      var s = Math.min(4, toScore(w, [1, 2.5, 4.5, 99]));
      out.push(finding(d, s, "Possible beneficiaries or financial/political stakes are mentioned (" + quoteList(tHits.concat(cHits)) + "). Whether anyone benefits disproportionately needs outside evidence.", strongest(tHits), text,
        "Signals come only from the supplied text/notes. " + externalMissing(d)));
    })();

    // 11 Suppression of Dissent
    (function () {
      var d = byId[11];
      var hits = findAll(text, L.dissent);
      var s = toScore(weight(hits), [1, 2, 4, 6]);
      out.push(finding(d, s, s >= 2
        ? "Critics or opposing voices are labelled or framed as something to silence (" + quoteList(hits) + ")."
        : faint(hits) || "Critics are not labelled or dismissed in the text.", strongest(hits), text));
    })();

    // 12 False Dilemmas
    (function () {
      var d = byId[12];
      var hits = findAll(text, L.dilemma);
      var s = toScore(weight(hits), [1, 2, 4, 6]);
      out.push(finding(d, s, s >= 2
        ? "Choices are reduced to two extremes (" + quoteList(hits, 2) + ")."
        : faint(hits) || "No either/or framing was detected.", strongest(hits), text));
    })();

    // 13 Bandwagon Effect (external, but text-level social pressure is observable)
    (function () {
      var d = byId[13];
      var tHits = findAll(text, L.bandwagon);
      var vHits = findAll(notes, L.virality);
      var w = weight(tHits) + Math.min(vHits.length * 0.5, 1);
      if (w < 1) {
        out.push(finding(d, null, "No claims that “everyone” is joining in appear in the text or notes, so social pressure cannot be judged from the text alone.", null, text, externalMissing(d)));
        return;
      }
      var s = toScore(w, [1, 2.5, 4.5, 6.5]);
      out.push(finding(d, s, (tHits.length ? "The text applies social pressure (" + quoteList(tHits) + ")." : "") +
        (vHits.length ? " The context notes report rapid spread (" + quoteList(vHits, 2) + "), which can act as social proof." : ""), strongest(tHits), text,
        "Whether the crowd is real or amplified needs outside data. " + externalMissing(d)));
    })();

    // 14 Emotional Repetition
    (function () {
      var d = byId[14];
      var emo = fear.concat(outrage)
        .concat(findAll(text, L.novelty.filter(function (p) { return /shock|world war|breaking/.test(p.src); })))
        .concat(findAll(text, [P("now", 0.5), P("share", 0.5)]));
      var alarms = text.match(ALARM_EMOJI) || [];
      var counts = {}, repeats = 0, repeatHit = null, topTerm = null, topCount = 0;
      emo.sort(function (a, b) { return a.index - b.index; }).forEach(function (h) {
        var m = h.text.match(EMO_ROOTS);
        var k = (m ? m[1] : h.text).toLowerCase();
        counts[k] = (counts[k] || 0) + 1;
        if (counts[k] >= 2) repeats += h.w >= 1 ? 1.5 : 0.75;
        if (counts[k] > topCount) { topCount = counts[k]; topTerm = h.text; if (counts[k] >= 2) repeatHit = h; }
      });
      var emoCore = fear.length + outrage.length;
      var w = repeats + (st.exclRuns >= 2 ? 1 : 0) + (emoCore >= 6 ? 1 : 0) + (alarms.length >= 2 ? 1 : 0);
      var s = toScore(w, [1, 2.5, 4.5, 7]);
      var parts = [];
      if (topCount >= 2) parts.push("\u201c" + topTerm + "\u201d appears " + topCount + "\u00d7");
      if (emoCore >= 6) parts.push(emoCore + " fear/outrage cues in total");
      if (alarms.length >= 2) parts.push(alarms.length + " alarm emojis");
      if (st.exclRuns >= 2) parts.push("repeated \u201c!!\u201d runs");
      var expl = s >= 2
        ? "The same emotional or urgency triggers recur instead of new information being added (" + parts.join("; ") + ")."
        : emo.length ? "Emotional language appears but is not repeated excessively." : "No repeated emotional triggers were detected.";
      out.push(finding(d, s, expl, repeatHit, text));
    })();

    // 15 Cherry-Picked Data
    (function () {
      var d = byId[15];
      var nums = findAll(text, L.numbers);
      var drama = findAll(text, L.dramaticStats);
      var ctx = findAll(text, L.statContext);
      if (!nums.length && !drama.length) {
        out.push(finding(d, 1, "The text presents no statistics or figures.", null, text));
        return;
      }
      var w = weight(nums, 4) + weight(drama) - ctx.length * 1.25;
      var s = toScore(w, [0.5, 2, 3.5, 5]);
      if (ctx.length >= 2 && s > 2) s = 2;
      out.push(finding(d, s, s >= 2
        ? "Figures are presented (" + quoteList(nums.concat(drama), 3) + ")" + (ctx.length ? " with limited explanation of source or method." : " without sources, baselines or an explanation of how they were calculated.")
        : "Figures are presented with source or method context (" + quoteList(ctx, 2) + ").", strongest(drama.length ? drama : nums), text,
        s >= 2 ? "Check the original dataset or report behind each figure, and what baseline or comparison it omits." : null));
    })();

    // 16 Logical Fallacies
    (function () {
      var d = byId[16];
      var hits = findAll(text, L.fallacy);
      var s = toScore(weight(hits), [1, 2, 4, 6]);
      out.push(finding(d, s, s >= 2
        ? "Arguments attack or label people instead of addressing their points (" + quoteList(hits) + ")."
        : faint(hits) || "No ad hominem, straw-man or appeal-to-common-knowledge patterns were detected.", strongest(hits), text));
    })();

    // 17 Manufactured Outrage
    (function () {
      var d = byId[17];
      var hits = outrage.concat(fear.filter(function (h) { return h.w >= 1.5; }));
      var w = weight(hits) + (hits.length ? intensityBonus(st) : 0) + (hits.length && sourcing === 0 ? 1 : 0);
      var s = toScore(w, [1, 2.5, 5, 7.5]);
      if (s >= 3 && sourcing >= 4) s -= 1;
      out.push(finding(d, s, s >= 2
        ? "Alarm or anger escalates quickly (" + quoteList(hits) + ")" + (sourcing === 0 ? " with no factual context offered to justify it." : ".") + intensityNote(st)
        : faint(hits) || "No sudden escalation of anger or alarm was detected.", strongest(hits), text));
    })();

    // 18 Framing Techniques
    (function () {
      var d = byId[18];
      var hits = findAll(text, L.framing);
      var w = weight(hits) + (st.capsRatio > 0.3 ? 1 : 0);
      var s = toScore(w, [1, 2, 4, 6]);
      out.push(finding(d, s, s >= 2
        ? "The text tells the reader how to interpret events rather than letting facts speak (" + quoteList(hits) + ")."
        : faint(hits) || "No strong interpretive framing devices were detected.", strongest(hits), text));
    })();

    // 19 Rapid Behavior Shifts (external)
    (function () {
      var d = byId[19];
      var tHits = findAll(text, L.behavior);
      var cHits = findAll(notes, L.behavior);
      var w = weight(tHits) + weight(cHits);
      if (w < 1) {
        out.push(finding(d, null, "The text and notes do not describe groups suddenly adopting symbols or actions.", null, text, externalMissing(d)));
        return;
      }
      var s = Math.min(4, toScore(w, [1, 2.5, 4, 99]));
      out.push(finding(d, s, "Sudden collective behaviour is described (" + quoteList(tHits.concat(cHits)) + ").", strongest(tHits), text,
        "Signals come only from the supplied text/notes. " + externalMissing(d)));
    })();

    // 20 Historical Parallels (external)
    (function () {
      var d = byId[20];
      var hits = findAll(text, L.history);
      if (!hits.length) {
        out.push(finding(d, null, "The text does not invoke past events, so any parallel would have to come from outside research.", null, text, externalMissing(d)));
        return;
      }
      var s = Math.min(4, toScore(weight(hits), [1, 2.5, 4, 99]));
      out.push(finding(d, s, "The text invokes historical events or patterns (" + quoteList(hits, 2) + ") to shape how the present is perceived.", strongest(hits), text,
        "Whether this mirrors documented manipulative past events needs research. " + externalMissing(d)));
    })();

    var res = buildResult(text, meta, st, out, "heuristic");
    res.contextUsed = !!contextBlob;
    res.mediaMentioned = findAll(text + " " + notes, L.media).length > 0;
    return res;
  }

  // ---------- summary ----------

  var BANDS = [
    { min: 0, max: 24, key: "green", label: "Few observable signals", color: "#10B981" },
    { min: 25, max: 49, key: "yellow", label: "Some observable signals — look deeper", color: "#FACC15" },
    { min: 50, max: 74, key: "orange", label: "Several notable signals", color: "#F97316" },
    { min: 75, max: 100, key: "red", label: "Many strong observable signals", color: "#EF4444" }
  ];

  function bandFor(sii) {
    if (sii == null) return null;
    for (var i = 0; i < BANDS.length; i++) if (sii >= BANDS[i].min && sii <= BANDS[i].max) return BANDS[i];
    return BANDS[BANDS.length - 1];
  }

  function summarize(indicators, ctx) {
    var assessed = indicators.filter(function (f) { return typeof f.score === "number"; });
    var na = indicators.length - assessed.length;
    var avg = assessed.length ? assessed.reduce(function (a, f) { return a + f.score; }, 0) / assessed.length : null;
    var sii = avg == null ? null : Math.round(((avg - 1) / 4) * 100);
    var band = bandFor(sii);
    var dist = { weak: 0, moderate: 0, strong: 0, na: na };
    assessed.forEach(function (f) { if (f.score <= 2) dist.weak++; else if (f.score === 3) dist.moderate++; else dist.strong++; });

    var top = assessed.filter(function (f) { return f.score >= 3; }).sort(function (a, b) { return b.score - a.score || a.id - b.id; });
    var observed = assessed.filter(function (f) { return f.score >= 2; }).length;

    var interpretation;
    if (sii == null) {
      interpretation = "No indicator could be assessed from the supplied text. Add more text or context before drawing any conclusion.";
    } else {
      var lead = {
        green: "The text shows few observable manipulation signals.",
        yellow: "The text shows some observable signals that are worth a closer look.",
        orange: "The text shows several notable communication signals associated with manipulative rhetoric.",
        red: "The text shows many strong communication signals associated with manipulative rhetoric."
      }[band.key];
      var strongestTxt = top.length
        ? " The strongest are " + listJoin(top.slice(0, 3).map(function (f) { return f.name + " (" + f.score + "/5)"; })) + "."
        : observed ? " Signals that do appear are weak." : " Most indicators show no signal.";
      var naTxt = na ? " " + na + (na === 1 ? " indicator needs outside evidence before it" : " indicators need outside evidence before they") + " can be judged." : "";
      interpretation = lead + strongestTxt + naTxt + " These are features of how the message is written; they do not show who produced it, why, or whether it was coordinated.";
    }

    return {
      assessedCount: assessed.length,
      naCount: na,
      observedCount: observed,
      averageScore: avg == null ? null : Math.round(avg * 100) / 100,
      signalIntensityIndex: sii,
      band: band,
      distribution: dist,
      coverage: assessed.length + " of " + indicators.length + " indicators assessed from text; " + na + " require" + (na === 1 ? "s" : "") + " external context.",
      interpretation: interpretation,
      questions: buildQuestions(indicators, ctx || {})
    };
  }

  function listJoin(a) {
    if (a.length <= 1) return a.join("");
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }

  function buildQuestions(indicators, ctx) {
    var qs = [], seen = {};
    function add(q, tag) { if (q && !seen[q]) { seen[q] = 1; qs.push({ text: q, tag: tag }); } }
    var top = indicators.filter(function (f) { return f.score >= 3; }).sort(function (a, b) { return b.score - a.score || a.id - b.id; });
    top.slice(0, 3).forEach(function (f) { add(fw.QUESTIONS[f.id], f.name + " · " + f.score + "/5"); });
    if (ctx.mediaMentioned || /tiktok|instagram|youtube|x\b|twitter|facebook/i.test(ctx.platform || "")) {
      add(fw.ORIGIN_QUESTION, "Verification");
      add(fw.MEDIA_QUESTION, "Verification");
    }
    var miss = indicators.filter(function (f) { return f.id === 4 && f.score >= 3; })[0];
    if (miss) add(fw.QUESTIONS[4], "Missing Information · " + miss.score + "/5");
    indicators.filter(function (f) { return f.score == null; }).slice(0, 2).forEach(function (f) { add(fw.QUESTIONS[f.id], f.name + " · N/A"); });
    if (indicators.some(function (f) { return f.id === 10 && f.score == null; })) add(fw.QUESTIONS[10], "Financial/Political Gain · N/A");
    if (!qs.length) add(fw.QUESTIONS[4], "General");
    return qs.slice(0, 7);
  }

  function buildResult(text, meta, st, indicators, engine) {
    var res = {
      engine: engine,
      engineLabel: engine === "ai" ? "AI-assisted analysis" : "Deterministic heuristic engine (offline)",
      meta: {
        source: String(meta.source || "").slice(0, 300),
        platform: String(meta.platform || "").slice(0, 100),
        date: String(meta.date || "").slice(0, 200),
        notes: String(meta.notes || "").slice(0, 4000)
      },
      text: text,
      wordCount: st.words,
      charCount: text.length,
      analyzedAt: new Date().toISOString(),
      indicators: indicators
    };
    res.summary = summarize(indicators, { platform: res.meta.platform, mediaMentioned: false });
    return res;
  }

  function analyze(input) {
    var res = analyzeHeuristic(input);
    // Recompute questions now that media mentions are known.
    res.summary = summarize(res.indicators, { platform: res.meta.platform, mediaMentioned: res.mediaMentioned });
    return res;
  }

  function countWords(text) { return (String(text || "").match(/[\p{L}\p{N}'’#@-]+/gu) || []).length; }

  var api = {
    analyze: analyze,
    buildFromFindings: function (text, meta, findings, engine, extra) {
      var res = buildResult(String(text || "").slice(0, MAX_CHARS), meta || {}, stats(String(text || "")), findings, engine);
      if (extra) Object.keys(extra).forEach(function (k) { res[k] = extra[k]; });
      res.mediaMentioned = findAll(res.text + " " + res.meta.notes, L.media).length > 0;
      res.summary = summarize(findings, { platform: res.meta.platform, mediaMentioned: res.mediaMentioned });
      return res;
    },
    summarize: summarize,
    bandFor: bandFor,
    BANDS: BANDS,
    countWords: countWords,
    phraseAround: phraseAround,
    MAX_CHARS: MAX_CHARS,
    MIN_WORDS: MIN_WORDS
  };

  root.MSA = root.MSA || {};
  root.MSA.engine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
