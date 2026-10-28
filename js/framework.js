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

  var DISCLAIMER = "Educational analysis only. Communication patterns can suggest rhetorical manipulation, but they cannot establish the existence of a psychological operation, its intent, coordination, or authorship. The scoring index is illustrative and has not been scientifically validated. Think before you share.";
  var METHOD_NOTICE = "This score indicates the intensity of observable communication signals, not the probability of a PSYOP.";

  var api = {
    INDICATORS: INDICATORS,
    QUESTIONS: QUESTIONS,
    MEDIA_QUESTION: MEDIA_QUESTION,
    ORIGIN_QUESTION: ORIGIN_QUESTION,
    DISCLAIMER: DISCLAIMER,
    METHOD_NOTICE: METHOD_NOTICE
  };

  root.MSA = root.MSA || {};
  root.MSA.framework = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
