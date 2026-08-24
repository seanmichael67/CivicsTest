# HANDOFF — 2026-08-24

> ⏰ **Deadline: the domain expires 2026-11-24 and GoDaddy auto-renew is off.** The TLS
> cert renews *against* the domain, so if the registration lapses the site and its
> certificate die together. This is the only dated item here.

- **What this is.** `CivicsTest` — USCIS 2025 128-question civics practice app whose
  differentiator is that it *speaks and listens*: browser Web Speech reads each question in
  English and grades a spoken answer. Live at **www.uscis128civicstest.com** (Vercel project
  `civicstest`, team `seanmichael67-gmailcoms-projects`). No `FOCUS.md` exists yet — this file
  is the only map. Companion: an 11-language Reels ad set in the **clawd** repo at
  `videos/civics-speak-listen-reel`, branch `backup/civics-reel-20260824`.

- **Where we stopped.** Feature-complete and deployed: voice answering with near-miss
  pronunciation coaching, a hands-free mic-check as the primary CTA, 11-language UI,
  browser-local progress tracking (`localStorage: civicsProgress`), 130 indexed pages from
  `tools/build-seo.mjs`, and `?lang=xx` so ads land in-language. Vercel Web Analytics was
  switched on 2026-08-24, so there is only about **one day of traffic data** — anything needing
  real usage numbers is blocked on time, not work. Ads are built but not launched.

- **Next step.** Nothing in the code is blocking — the open questions need *time* or *Sean*,
  not commits. Vercel Web Analytics started 2026-08-24; give it ~2 weeks, then read it before
  building any paid tier (accounts + Stripe is weeks of work and currently unjustified by data).
  If you want code work meanwhile, the two candidates are: delete the vestigial `CivisTest.html`
  duplicate, and polish the ad's frame 2 (the phone's lower half is empty white and the
  "waveform" reads as a red dotted line rather than audio).

- **Decisions that aren't obvious from the code.** (1) The UI translates but the **test never
  does** — questions, answers, `speak()` and `SpeechRecognition` are pinned to `en-US` on
  purpose, because the officer asks in English; do not "fix" this. (2) Monetization is
  **one-time ~$19, not a subscription** (the customer passes once and leaves); questions stay
  free forever, only the voice tier is paid, and signup comes *after* the first session, never
  at the door. (3) All 11 translations are **mine, not a native speaker's** — Tagalog and
  Haitian Creole least confident; re-run a cross-script contamination scan after any edit.
  (4) The 11 ad MP4s **were** force-added past the repo-wide `*.mp4` ignore, because that repo is
  `openclaw-workspace-backup` and excluding the deliverables from a backup repo defeats its
  purpose; they also rebuild via `tools/build-all.sh`. (5) **65/20 is fixed** — it samples 10 of
  the 20 starred questions and grades against 6, and the threshold sentences are parameterized
  with `{need}`/`{total}` so no language needed re-translating.

- **Files touched.** `index.html` (plus `CivisTest.html`, a byte-identical vestigial duplicate
  worth deleting), `tools/build-seo.mjs`, `vercel.json`, `sitemap.xml`, `robots.txt`,
  `assets/q.css`, `questions/**` (130 generated pages). In **clawd**:
  `videos/civics-speak-listen-reel/**` — `STORYBOARD.md`, `SCRIPT.md`,
  `compositions/frames/*.html` (+ `.es.html` masters), and
  `tools/{ad-strings.json, make-variant.mjs, autofit.mjs, build-all.sh}`.
