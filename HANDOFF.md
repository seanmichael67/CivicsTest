# HANDOFF — 2026-11-12

> ⏰ **Deadline: the registration lapses unless renewed — registrar 2026-11-23 23:41 UTC,
> 11 days out.** Re-verified by whois on 11-12. ⛔ Auto-renew state is **not visible from
> outside**: auto-renew normally fires within days of expiry, so an unchanged expiry date on
> 11-12 looks identical whether it is on or off. Only Sean's GoDaddy account shows it, and
> renewing manually makes the question moot. 💰 Money ⇒ **Sean's call**, never fire unattended.
> ⛔ The TLS cert is a **decoy** — valid to 2027-01-22 and perfectly healthy. It does not
> matter: if the registration lapses, DNS stops resolving and the site dies with a live
> certificate. **New consequence:** the quiz-video assembler paints the domain into the video
> *pixels*, and a published YouTube video cannot be edited — so **no video is published before
> the domain is renewed**, or every upload becomes a permanent ad for whoever catches the name.

- **What this is.** `CivicsTest` — USCIS 2025 128-question civics practice app whose
  differentiator is that it *speaks and listens*: browser Web Speech reads each question in
  English and grades a spoken answer. Live at **www.uscis128civicstest.com** (Vercel project
  `civicstest`). Verified 11-12: HTTP 200 and the deployed `index.html` is **byte-identical to
  `main`** (sha256 `ad1bfeb7…`). GitHub Pages is still live as an unretired fallback. This file
  is the only map; there is no `FOCUS.md`.

- **Shipped since the 08-24 handoff.** That handoff said "nothing in the code is blocking" and
  was wrong — a live test-drive found two defects, both now fixed, merged and verified in
  production. (1) **PR #1** (`027178e`): every multiple-choice button was **dead since
  `04f0d20`, 2026-05-16** — an unescaped `JSON.stringify` inside a double-quoted `onclick`
  truncated the attribute, so clicks threw and nothing happened. 16 commits shipped over it;
  the button *label* was escaped, so the bug was invisible to any screenshot check. Answers are
  now DOM-built with `addEventListener`. (2) **PR #2** (`4e6aada`): eight questions whose only
  stored answer was USCIS instructional text ("Answers will vary…", "Visit uscis.gov/…") were
  graded as **wrong** no matter what the user said, then pinned to "keep practising these" — a
  trust-breaker in a study tool. They are now excluded from the scored pools (so "12 of 20" and
  "6 of 10" stay literally true) while staying in Study All 128, where the guidance is the
  point; seven answers with PDF section headings glued on were cleaned at the same time. Also
  `85899c0` (share image) and `9af303e` (deleted `CivisTest.html` — it was a stale 61KB fork,
  **not** the byte-identical duplicate the old handoff claimed).

- **⛔ In flight right now — TWO open PRs for ONE change.** **#3** is another session's
  (`claude/gifted-volta-17qial`) and is **actively being pushed to** — `bb4ef25` landed
  2026-11-12 04:56 UTC. **#4** is mine (`pr/quiz-video-pipeline`), opened 17 seconds after #3,
  before any PR was visible on that branch; it is the same two commits plus one untracking a
  committed `.pyc`, and it is now **behind** #3. ⛔ **Merge nothing while that session is still
  pushing** — a merge mid-stream orphans the rest of its work. Once it stops, merge **exactly
  one**, and #3 is the live one: #4's only unique content is the `.pyc` removal and the
  `.gitignore` entries, and `bb4ef25` **recommitted that `.pyc`** (it keeps regenerating because
  their branch has no `.gitignore`), so the fix belongs *on* #3, not in a rival PR. ⛔ Never push
  to a `claude/*` branch — a force-push from the owning session erases your commit silently. The
  work itself (128 narration scripts + a vertical video assembler) is reviewed-by-reading only:
  `tools/make-quiz-video.py` has **never been run end-to-end** here — it needs ffmpeg, Pillow and
  faster-whisper. With `tools/videos.json` empty the generated pages are byte-identical, so
  **nothing public changes until a video is registered.**

- **Next step.** Renew the domain; everything else is downstream of it. Then **read the Vercel
  Web Analytics** — the 08-24 handoff said "give it ~2 weeks, then read it before building any
  paid tier"; the two weeks became **eleven**, the data exists, and nobody has looked. ⛔ It
  cannot be read from here: Vercel exposes **no public read API** for Web Analytics (five
  endpoints probed, all dead ends), so it needs Sean's dashboard login. That login — not a
  build — is the gate on accounts + Stripe.

- **Decisions that aren't obvious from the code.** (1) The UI translates but the **test never
  does** — questions, answers, `speak()` and `SpeechRecognition` are pinned to `en-US` on
  purpose, because the officer asks in English; do not "fix" this. (2) Monetization is
  **one-time ~$19, not a subscription** (the customer passes once and leaves); questions stay
  free forever — they are US public domain and USCIS gives them away — only the voice tier is
  paid, and signup comes *after* the first session, never at the door. (3) All 11 translations
  are **mine, not a native speaker's** — Tagalog and Haitian Creole least confident; a
  cross-script scan once caught a Russian word inside a Korean string, so re-run that check
  after any translation edit. (4) **65/20 samples 10 of the 20 starred questions and grades
  against 6**; threshold strings are parameterized with `{need}`/`{total}` so a threshold
  change edits numbers, not sentences.

- **Gotchas that will bite.** There are **three** grading entry points, not two — `pickAnswer`,
  `checkTyped` **and** `gradeSpoken` (the spoken one is the paid feature and was the worst
  offender); grep `finalize(` before touching grading. `isLookup(q)` is **derived from
  `answers[0]`**, not a hand-kept list, so appending a real answer returns a question to the
  scored pool by itself. ⛔ `tools/build-seo.mjs` **defaults its base URL to GitHub Pages** —
  running it bare rewrites all 130 canonicals; always pass
  `node tools/build-seo.mjs https://www.uscis128civicstest.com`. `vercel.json` needs
  `trailingSlash: true` to match those canonicals, and its three redirect rules must stay.
  Deployment-specific `civicstest-<hash>.vercel.app` URLs are **SSO-gated** — a 200 there is the
  login page, so check content, not status; the public alias is `civicstest-six.vercel.app`.
  Driving a browser harness with `key "Return"` delivers `key: ""` and silently fails every
  `e.key==='Enter'` guard — use `"Enter"`, and probe with a `keydown` listener before believing
  any key-handler negative.

- **Housekeeping.** ⚠️ **This file is served publicly** at `/HANDOFF.md` (HTTP 200, and
  `robots.txt` is `Allow: /`) — keep credentials, account identifiers and other projects' detail
  out of it. A stale worktree sits at `~/CivicsTest-wt-mc` on the already-merged
  `fix/multiple-choice-onclick`. The 11-language Reels ad set still lives in the **clawd** repo
  at `videos/civics-speak-listen-reel`, branch `backup/civics-reel-20260824`; its launch state
  has **not** been re-checked since 08-24, so verify before repeating that it is unlaunched.

- **Files.** `index.html` — the whole app in one file: code, the 128-question `QUESTIONS` array
  and the 11-language `I18N` object all inline. Then `tools/build-seo.mjs`, `tools/i18n.json`,
  `vercel.json`, `sitemap.xml` (130 URLs), `robots.txt`, `assets/q.css`, and `questions/**`
  (129 generated files — 128 question pages plus the hub).
