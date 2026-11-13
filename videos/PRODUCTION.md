# Quiz videos — how they are made

One short vertical video per official question. A tutor asks the question, the
viewer answers out loud during a 3-2-1 countdown, the accepted answer appears,
and an end card sends them to the site.

**Status (2026-11-13):** 1 of 128 made (question 2). Production stopped because
the Higgsfield account ran out of credits, not because anything is broken.

## The tutor ("Ms. Hope" — working name)

An AI avatar. Always label her as one; she must never look like a USCIS officer
(no uniform, badge, seal or flag), and never claim real credentials.

| Asset | Higgsfield ID |
|---|---|
| Character sheet | `2513532c-2533-407f-8327-381067956278` |
| Tutoring room | `8b94e0d6-81dc-47a1-985e-7f85d5ad89a0` |
| Voice reference | `903d5db9-e858-4543-803f-8caa101b7176` |
| Finished pilot, question 2 | media `d80ea579-f884-46aa-8aea-777de4aea79a` |

Narration already recorded and checked for the next two pilots (no credits
needed to reuse): question 126 = job `edcd6977-ad8c-40f1-b6fd-43039b5f6a69`,
question 30 = job `fce58ca6-d28b-4aa7-9c5f-152524072339`. Their cut question
audio: 126 = media `4921b6e4-c5ec-4195-afbf-a685ce8eb776`, 30 = media
`861e3517-3498-4f7a-aa60-86c70720b6c3`. Each needs a 7-second tutor clip.

## Steps for one video

1. **Script.** Take the question's entry from `videos/scripts.json`
   (regenerate with `node tools/build-video-scripts.mjs`).
2. **Voice.** Record the `narration` field as ONE take with `seed_audio`, using
   the voice reference as `audio_references`. Spell numbers as words
   ("Question thirty"). Do not record the short lines separately — the cloned
   voice babbles extra words in front of them.
3. **Cut.** `python3 tools/make-quiz-video.py cut --number N --narration take.mp3`
   Check that "heard" matches "expected". It writes the question audio and
   prints how long the tutor clip must be.
4. **Tutor clip.** `seedance_2_5`, mode `omni_reference`, 9:16, 720p, that many
   seconds; character sheet + room as `image_references`, the question audio as
   `audio_references`. Hands folded on the desk, static camera, closed-mouth
   smile once she finishes.
5. **Assemble.** `python3 tools/make-quiz-video.py assemble --number N
   --narration take.mp3 --tutor clip.mp4 --out qNNN.mp4`
6. **Publish.** Upload to YouTube with `youtube_title` and
   `youtube_description` from the script, then add the video to
   `tools/videos.json` and run
   `node tools/build-seo.mjs https://www.uscis128civicstest.com`.

## Cost

The tutor clip is the only real cost: 7 credits per second (measured: 35 for
5 s). Images are about 0.5 credits and a narration take about 2.

| Tutor clip | Credits | Questions that fit |
|---|---|---|
| 5 s | 35 | short questions (about 9 words or fewer) |
| 7 s | 49 | most of the rest |

Budget roughly **5,500 credits for all 128**. Cheapest sensible order: the 20
questions on the 65/20 list first (about 850 credits), then the rest.

## The eight questions with no fixed answer

23, 29, 30, 38, 39, 57, 61, 62 depend on the current officeholder or on where
the viewer lives. Their scripts never name a person, so the videos do not go
stale after an election. Do not "fix" this.
