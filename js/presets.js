/*
 * Educational presets for live workshop demonstrations.
 * Preset 1 is an educational recreation of a real-world case (not a verbatim copy of the post).
 * Presets 2 and 3 are fictional; the town, companies and people do not exist.
 */
(function (root) {
  "use strict";

  var PRESETS = [
    {
      key: "wwiii",
      short: "Preset 1",
      title: "Creathon Case Study — Viral “World War III” Panic Post",
      tag: "Real-world case adaptation",
      blurb: "Viral X/Twitter post during the April 13, 2024 Iran–Israel drone and missile attack, paired with a dramatic “explosions” video.",
      reveal: "Fact-checkers found the video was a 2021 YouTube upload created in Blender 3D software and did not match real events.",
      text:
        "BREAKING: MASSIVE EXPLOSIONS RIGHT NOW! WORLD WAR III HAS OFFICIALLY STARTED! 🚨🚨\n\n" +
        "Share this everywhere before they take it down! Wake up, everyone is panicking and nobody is telling you what is really happening. " +
        "Look at this video, the whole sky is on fire. This is it. Pray for everyone over there.\n\n" +
        "RETWEET NOW!!!",
      meta: {
        source: "Matt Wallace (@MattWallace888) — Viral WWIII Alert Post (educational recreation)",
        platform: "X/Twitter",
        date: "April 13, 2024",
        notes:
          "Posted during the Iran–Israel drone and missile attack of April 13, 2024, with a dramatic video of massive explosions. " +
          "13M views in 1 day; 22M+ total views across X, Instagram, Facebook and TikTok. " +
          "Fact-checkers later showed the video was a 2021 YouTube upload created in Blender 3D software that did not match real events."
      },
      // Pre-ticked answers revealed in the 3-step verification companion.
      verification: {
        1: "Reverse search traced the clip to a YouTube upload from 2021, years before the attack.",
        2: "The visuals did not match verified reports or the geography of the April 13 events.",
        3: "The footage was rendered in Blender, a 3D computer graphics program — CGI, not a real recording."
      }
    },
    {
      key: "crisis",
      short: "Preset 2",
      title: "Fictional Sensational Crisis Article",
      tag: "High manipulation signals",
      blurb: "A fictional, sensationalised report blaming outsiders for an “unprecedented catastrophe”.",
      text:
        "UNPRECEDENTED CATASTROPHE: Riverton's Water Is Poisoning Our Children\n\n" +
        "This is the worst disaster in our town's history, and make no mistake: it was entirely avoidable. Crying children, dying fish floating in the river, terrified families — this is what happens when outsiders are allowed to run our town.\n\n" +
        "The out-of-state developers at Crestline Holdings are solely responsible. Contamination has skyrocketed by 400%, and experts say the water may never be safe again. Nobody needs to ask how those numbers were measured; the truth is obvious to anyone with a brain.\n\n" +
        "Of course, the usual deniers and out-of-touch elites on the council want us to “wait for test results.” They would say that. Real locals know better. Either you stand with the families of this town, or you stand with the polluters.\n\n" +
        "Conveniently, this all came to light just days before the council vote on the emergency cleanup contract — a contract PureFlow Solutions has been lobbying for all year. Everyone in town is already adding blue water-droplet emojis to their profile pictures. Join us. Donate now, share this before it's too late, and demand action now! #SaveRiverton #SaveRiverton",
      meta: {
        source: "“Riverton Truth Now” — Unprecedented Catastrophe (fictional)",
        platform: "Facebook",
        date: "Fictional example",
        notes: "Fictional article written for the workshop. Shared widely in local community groups."
      }
    },
    {
      key: "wire",
      short: "Preset 3",
      title: "Fictional Neutral Wire Report",
      tag: "Low manipulation signals",
      blurb: "A balanced, multi-source report on the same fictional event, with attribution and acknowledged uncertainty.",
      text:
        "RIVERTON, Oct. 14 (Wire) — Riverton city officials issued a precautionary boil-water advisory on Tuesday after routine testing detected elevated nitrate levels at one of the city's three treatment intakes, according to a statement from the Riverton Water Department.\n\n" +
        "The department said readings at the north intake measured 12 milligrams per liter, above the federal limit of 10 mg/L, while the other two intakes remained within limits. Officials said the cause has not been determined. Possible contributors under review include agricultural runoff after last week's heavy rainfall and a nearby industrial site operated by Crestline Holdings, the department said.\n\n" +
        "A Crestline spokesperson said the company was cooperating with regulators and that its own monitoring had not shown any discharge above permitted levels. State environmental regulators said independent samples would be analyzed this week and cautioned that preliminary results could change.\n\n" +
        "Dr. Ana Morales, a water-quality researcher at Riverton State University who is not involved in the investigation, said nitrate spikes after heavy rain are not unusual in the region but that a single reading is not enough to identify a source. The city council is scheduled to discuss response options at its regular meeting on Oct. 21. Residents can find testing updates on the department's website.",
      meta: {
        source: "Wire Service — Riverton issues precautionary boil-water advisory (fictional)",
        platform: "News Outlet",
        date: "Fictional example",
        notes: ""
      }
    }
  ];

  var api = { PRESETS: PRESETS };
  root.MSA = root.MSA || {};
  root.MSA.presets = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
