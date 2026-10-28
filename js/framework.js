/*
 * PSYOPS Identification Tool V8.3 — the 20-indicator framework.
 * Names, guiding questions and reference examples are taken verbatim from the checklist.
 * `external: true` marks indicators that normally need evidence from outside the text
 * (cross-media comparison, beneficiaries, timing, crowd behaviour).
 */
(function (root) {
  "use strict";

  var INDICATORS = [
    { id: 1, name: "Timing", external: true,
      guidingQuestion: "Does the timing feel suspicious or coincidental with other events?",
      example: "A story about water contamination surfaces during a corporate scandal.",
      verify: "Build a timeline: when did the content first appear, and what other news, votes, scandals or events happened in the same window? Compare first-seen timestamps across platforms." },
    { id: 2, name: "Emotional Manipulation",
      guidingQuestion: "Does it provoke fear, outrage, or guilt without solid evidence?",
      example: "Reports show crying children and dying wildlife but avoid causes." },
    { id: 3, name: "Uniform Messaging", external: true,
      guidingQuestion: "Are key phrases or ideas repeated across media?",
      example: "All outlets use terms like “unprecedented” and “avoidable tragedy.”",
      verify: "Search distinctive phrases in quotation marks across news outlets and platforms; check whether many accounts posted identical wording or hashtags in a short window." },
    { id: 4, name: "Missing Information",
      guidingQuestion: "Are alternative views or critical details excluded?",
      example: "Few sources discuss the timeline or other possible contributors." },
    { id: 5, name: "Simplistic Narratives",
      guidingQuestion: "Is the story reduced to ‘good vs. evil’ frameworks?",
      example: "Blames one company entirely while ignoring systemic issues." },
    { id: 6, name: "Tribal Division",
      guidingQuestion: "Does it create an ‘us vs. them’ dynamic?",
      example: "Locals are victims, while outsiders are blamed." },
    { id: 7, name: "Authority Overload",
      guidingQuestion: "Are questionable ‘experts’ driving the narrative?",
      example: "Non-environmental experts dominate airtime to support policies.",
      verify: "Look up each cited expert: are they named, and is their field relevant to the claim? Check whether independent specialists agree." },
    { id: 8, name: "Call for Urgent Action",
      guidingQuestion: "Does it demand immediate decisions without reflection?",
      example: "Campaigns push for immediate donations and rapid policy changes." },
    { id: 9, name: "Overuse of Novelty",
      guidingQuestion: "Is the event framed as shocking or unprecedented?",
      example: "Media emphasizes how “shocking” and “once-in-a-lifetime” the crisis is." },
    { id: 10, name: "Financial/Political Gain", external: true,
      guidingQuestion: "Do powerful groups benefit disproportionately?",
      example: "A company offering cleanup services lobbies for government contracts.",
      verify: "Identify who gains money, attention, votes or policy wins if the narrative spreads: check contracts, lobbying records, funding disclosures and monetised engagement." },
    { id: 11, name: "Suppression of Dissent",
      guidingQuestion: "Are critics silenced or labeled negatively?",
      example: "Opponents dismissed as “deniers” or ignored." },
    { id: 12, name: "False Dilemmas",
      guidingQuestion: "Are only two extreme options presented?",
      example: "“Either you support this policy, or you don’t care about the environment.”" },
    { id: 13, name: "Bandwagon Effect", external: true,
      guidingQuestion: "Is there pressure to conform because ‘everyone is doing it’?",
      example: "Social media influencers post identical hashtags, urging followers to join in.",
      verify: "Check whether the claimed crowd is real: look at hashtag volume over time, account ages, and whether many posts share identical wording." },
    { id: 14, name: "Emotional Repetition",
      guidingQuestion: "Are the same emotional triggers repeated excessively?",
      example: "Destruction and suffering imagery looped endlessly on TV and online." },
    { id: 15, name: "Cherry-Picked Data",
      guidingQuestion: "Are statistics presented selectively or out of context?",
      example: "Dramatic figures shared without explaining how they were calculated." },
    { id: 16, name: "Logical Fallacies",
      guidingQuestion: "Are flawed arguments used to dismiss critics?",
      example: "Critics labeled “out-of-touch elites” without addressing their points." },
    { id: 17, name: "Manufactured Outrage",
      guidingQuestion: "Does outrage seem sudden or disconnected from facts?",
      example: "Viral memes escalate anger quickly with little context provided." },
    { id: 18, name: "Framing Techniques",
      guidingQuestion: "Is the story shaped to control how you perceive it?",
      example: "The crisis is framed as entirely preventable, ignoring systemic factors." },
    { id: 19, name: "Rapid Behavior Shifts", external: true,
      guidingQuestion: "Are groups adopting symbols or actions without clear reasoning?",
      example: "Social media suddenly fills with users adding water droplet emojis to their profiles.",
      verify: "Observe the platforms directly: are users suddenly adopting the same emoji, profile frame, slogan or action (panic buying, mass unfollowing) without a clear stated reason?" },
    { id: 20, name: "Historical Parallels", external: true,
      guidingQuestion: "Does the story mirror manipulative past events?",
      example: "Past environmental crises were similarly used to pass sweeping, controversial legislation.",
      verify: "Compare the narrative's structure with documented past cases (e.g. earlier hoaxes, repurposed war footage, crises used to rush legislation) using historical and fact-check archives." }
  ];

  // Critical-thinking prompts, keyed by indicator id.
  var QUESTIONS = {
    1: "What else was happening when this appeared, and who might want attention pulled toward or away from it?",
    2: "What evidence is offered for the fear or outrage this content creates?",
    3: "Are other outlets or accounts using the exact same words? Who said it first?",
    4: "Which perspectives or contextual details might be missing?",
    5: "Is any real situation this simple? Which systemic factors are left out?",
    6: "Who is cast as “us” and who as “them”, and does the evidence support that split?",
    7: "Are the cited experts named, and are they experts in this specific field?",
    8: "What happens if I wait an hour and check before acting or sharing?",
    9: "Is this really unprecedented, or does the framing just make it feel that way?",
    10: "Who benefits if this narrative goes viral across TikTok, Instagram, and X?",
    11: "Are critics answered on the merits, or just labeled and dismissed?",
    12: "Are there more than two options that the content does not mention?",
    13: "Is “everyone” really doing this, or does it only look that way in my feed?",
    14: "Is the same emotional image or phrase repeated instead of new information?",
    15: "Where do these numbers come from, and what is the baseline or comparison?",
    16: "Does the argument address what critics actually say?",
    17: "Did the anger appear faster than the facts could have been checked?",
    18: "How would a neutral reporter describe the same event?",
    19: "Why are people suddenly adopting this symbol or action, and who started it?",
    20: "Has a similar story been used before, and how did it turn out?"
  };

  var MEDIA_QUESTION = "Could this visual or claim be AI-generated or 3D CGI?";
  var ORIGIN_QUESTION = "Could this footage be older content repurposed for a new crisis? Has it been reverse-searched?";

  // ---------- Reworked worksheet (Creathon edition) ----------
  // The 20 V8.3 indicators regrouped into five themes, with plain-language questions,
  // modern (social media / AI era) examples and concrete things to look for.
  var GROUPS = [
    { key: "emotion", name: "Emotion & urgency", color: "#EF4444", ids: [2, 8, 14, 17],
      blurb: "Is the content trying to make you feel and act before you think?" },
    { key: "story", name: "Story & framing", color: "#F97316", ids: [5, 9, 12, 18],
      blurb: "Is a complex event squeezed into a dramatic, one-sided story?" },
    { key: "evidence", name: "Evidence & authority", color: "#F59E0B", ids: [4, 7, 15, 16],
      blurb: "Does it show its sources, or ask you to just trust it?" },
    { key: "division", name: "Us vs. them & social pressure", color: "#A855F7", ids: [6, 11, 13, 19],
      blurb: "Does it split people into sides and push you to join one?" },
    { key: "context", name: "Context, timing & motive", color: "#3B82F6", ids: [1, 3, 10, 20],
      blurb: "What does the bigger picture outside the post tell you?" }
  ];

  var WORKSHEET = {
    1: { plain: "Did this appear at a suspiciously convenient moment?", modern: "A shocking clip goes viral in the same hour as a real attack, borrowing its attention.", lookFor: "“Right now” claims during breaking news, posts timed before votes or trials." },
    2: { plain: "Is it trying to scare, anger or guilt you more than inform you?", modern: "“MASSIVE EXPLOSIONS RIGHT NOW!” with sirens emojis and no source.", lookFor: "Fear words, ALL CAPS, many exclamation marks, suffering images without causes." },
    3: { plain: "Is the exact same wording popping up everywhere at once?", modern: "Hundreds of accounts post the identical caption and hashtag within minutes.", lookFor: "Copy-paste captions, identical hashtags, the same clip reposted across platforms." },
    4: { plain: "What important facts or other viewpoints are left out?", modern: "A post shows a video but never says where, when or who filmed it.", lookFor: "No who/where/when, no named sources, no “it is not yet confirmed”." },
    5: { plain: "Is it a simple heroes-vs-villains story?", modern: "“One country/company is 100% to blame” for a complex crisis.", lookFor: "Absolute words: evil, solely, officially, the only cause, it’s that simple." },
    6: { plain: "Does it divide people into “us” and “them”?", modern: "“Real locals know the truth — outsiders and elites are lying to you.”", lookFor: "Outsiders, elites, traitors, a vague “they” who hide things." },
    7: { plain: "Are the “experts” unnamed, irrelevant or just influencers?", modern: "“Experts say” with no names, or a celebrity explaining military strategy.", lookFor: "Experts/insiders/sources say, anonymous officials, no credentials." },
    8: { plain: "Does it rush you to share, buy, donate or act right now?", modern: "“Share this everywhere before they take it down!”", lookFor: "Share now, act fast, before it’s too late, retweet, donate today." },
    9: { plain: "Is it sold as shocking, historic or “never seen before”?", modern: "“BREAKING: WORLD WAR III HAS OFFICIALLY STARTED!”", lookFor: "Breaking, unprecedented, shocking, once-in-a-lifetime, massive." },
    10: { plain: "Who gains money, power, votes or followers if this spreads?", modern: "An account earns ad revenue from viral panic, or a firm lobbies for contracts.", lookFor: "Donation links, products, contracts, campaigns, monetised engagement." },
    11: { plain: "Are critics mocked, labelled or silenced instead of answered?", modern: "Anyone asking for a source is called a “denier” or “paid troll”.", lookFor: "Deniers, shills, trolls, “don’t listen to them”, calls to ban." },
    12: { plain: "Are you offered only two extreme choices?", modern: "“Either you share this, or you don’t care about the victims.”", lookFor: "Either…or, with us or against us, the only option." },
    13: { plain: "Are you pushed to join in because “everyone else is”?", modern: "“Everyone is panicking — millions have already shared this!”", lookFor: "Everyone, millions, trending, join us, huge view counts as proof." },
    14: { plain: "Are the same emotional triggers repeated again and again?", modern: "The same explosion clip looped and reposted with new scary captions.", lookFor: "Repeated fear words, repeated emojis and “!!!”, the same image recycled." },
    15: { plain: "Are numbers shown without a source or comparison?", modern: "“Contamination up 400%!” with no baseline or who measured it.", lookFor: "Big percentages, “a staggering”, no data source, no baseline." },
    16: { plain: "Does it attack people instead of their arguments?", modern: "“Only idiots still trust the news” instead of explaining why.", lookFor: "Name-calling, “everyone knows”, “so-called experts”, straw men." },
    17: { plain: "Does the anger come faster than the facts?", modern: "Outrage memes spread within minutes, before anything is confirmed.", lookFor: "Instant fury, disgust, betrayal, with no facts to back it up." },
    18: { plain: "Is it telling you how to feel about the facts?", modern: "“Make no mistake: this was entirely avoidable. Wake up!”", lookFor: "Make no mistake, the truth is, wake up, let that sink in." },
    19: { plain: "Are people suddenly copying a symbol or action without a clear reason?", modern: "Feeds fill with the same emoji or profile frame overnight; panic buying starts.", lookFor: "Mass emoji or avatar changes, stockpiling, sudden boycotts." },
    20: { plain: "Does it copy a pattern from past manipulations?", modern: "Old war footage reused for a new war, as with many viral “WWIII” clips.", lookFor: "“Just like in…”, recycled crises, history used to rush decisions." }
  };

  var ADDONS = [
    { id: "A1", name: "Recycled or out-of-context media", plain: "Could the photo or video be older, or from somewhere else?",
      modern: "The viral WWIII clip was a 2021 YouTube upload reused in 2024.", lookFor: "Reverse image search hits from earlier dates or other places." },
    { id: "A2", name: "Synthetic media (AI / 3D CGI)", plain: "Could the visuals be AI-generated or rendered with 3D software like Blender?",
      modern: "Game-like explosions, warped text or hands, no camera shake.", lookFor: "Unnatural physics, too-perfect lighting, morphing objects, tool watermarks." },
    { id: "A3", name: "Untraceable source", plain: "Is it hard or impossible to trace back to an original, credible source?",
      modern: "The poster can’t say who filmed it, and no reliable outlet has it.", lookFor: "First uploader, original outlet, an official or on-the-ground confirmation." }
  ];

  var SCORE_GUIDE = [
    { score: 1, label: "Not present", hint: "No sign of it." },
    { score: 2, label: "A hint", hint: "One small or unclear sign." },
    { score: 3, label: "Clearly present", hint: "You can point to it." },
    { score: 4, label: "Strong", hint: "Several clear signs or repeated." },
    { score: 5, label: "Dominates", hint: "The whole message relies on it." }
  ];

  var DISCLAIMER = "Educational analysis only. Communication patterns can suggest rhetorical manipulation, but they cannot establish the existence of a psychological operation, its intent, coordination, or authorship. The scoring index is illustrative and has not been scientifically validated. Think before you share.";
  var METHOD_NOTICE = "This score indicates the intensity of observable communication signals, not the probability of a PSYOP.";

  var api = {
    INDICATORS: INDICATORS,
    QUESTIONS: QUESTIONS,
    MEDIA_QUESTION: MEDIA_QUESTION,
    ORIGIN_QUESTION: ORIGIN_QUESTION,
    DISCLAIMER: DISCLAIMER,
    METHOD_NOTICE: METHOD_NOTICE,
    GROUPS: GROUPS,
    WORKSHEET: WORKSHEET,
    ADDONS: ADDONS,
    SCORE_GUIDE: SCORE_GUIDE
  };

  root.MSA = root.MSA || {};
  root.MSA.framework = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
