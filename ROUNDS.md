# UPSC Recall Coach: review rounds

Built by Tab, an AI assistant, for team lead Akshay Wagh. Rule: v1 → two outside critics → v2 → critics → v3.

## v1 (1 Nov 2026, 21:28Z)
Live at https://upsc-recall-coach.vercel.app. Phone test 390×844 on the live site: new learner → quiz → remember (≈20 s) → plan changed → on-chain check; 0 console errors, no sideways scroll. 12 memories on mainnet; 9/9 demo memories verified as Sui Blob objects via Tatum.

## Round 1 (21:29 to 21:39Z) on v1
Critics: **Fo** (Wajo's agent; it used the live site end to end: demo learner, a Soil science quiz, the save and the on-chain check) and **Gemini 3.8 Flash** (judged from the code, README and live API output).

Scores v1 (Walrus+Tatum / technical / creativity / presentation): Fo 8 / 7 / 7 / 6 (weighted 7.1). Gemini 9.5 / 7.5 / 6.5 / 8.5.

Taken into v2:
1. **Question correctness** (Fo: two AI questions on soil P and paddy N were wrong, and a bad question writes a wrong memory to mainnet): a 130-question bank written and fact-checked by Tab is now the default; fresh AI questions are re-solved by a second, different model and dropped on disagreement; any question can be flagged and is then not counted ("1 question(s) flagged as faulty, not counted" is written into the memory).
2. **More agent, less fixed list** (Gemini): quizzes adapt to memory (missed concepts first, level from past accuracy); an AI coach's note explains today's plan from computed facts only.
3. **Spaced repetition** (Gemini): review intervals of 1, 2, 4 or 7 days from recent accuracy; due topics first; trend since first session; repeat misses highlighted.
4. **No starvation** (Fo): one never-practised topic joins every plan.
5. **Receipts in the result card, checked automatically** (Fo): after a save the app finds the new memory's Blob object on Sui through Tatum and shows the object and transaction links straight away, then re-runs the full check.
6. **Honest wording** (Fo): explained what "encrypted" means next to "anyone with the ID can read" (SEAL ciphertext on Walrus; the server key decrypts on recall); the receipts cannot show the text.
7. **Data bug** (Fo): Economy and History were labelled "Forestry/GS"; now "General Studies".
8. **Phone polish** (Fo): accent on the memory column, one row of ID buttons, shorter privacy line, favicon, the 12-saves-an-hour limit shown in the UI.
9. **Reliability** (found while testing): the shared free model keys were exhausted by other projects, so model calls now go through a chain of five providers with timeouts, and the quiz falls back to the bank.

Not taken: wallet sign-in per learner (Gemini) - a heavier change for a study app; the ID-as-key trade-off is stated plainly instead. Edge KV rate limiting (Gemini) - paid or extra infra; stated as a limit. The "2026 is in the future" note (Gemini) is a model knowledge-cutoff artefact.

## v2 (21:53Z)
Live at https://upsc-recall-coach.vercel.app. Phone test 390x844 on the live site: demo learner, bank quiz with missed concepts first, save, receipt shown in the result card, plan changed, full check 11 of 11 on Sui, coach note; then a brand-new learner end to end. 0 console errors, no sideways scroll. 19 unit tests.

## Round 2
(pending)

## Round 2 (on v2, 1 Nov 2026 ~22:00Z)

- **Fo (Wajo)** used the live app on a phone-size screen, took a fresh-AI quiz, flagged a question, saved and checked receipts. Scores: Walrus + Tatum 9, technical 8, creativity 8, presentation 7 (weighted about 8.1). Top asks: (1) anyone who knows the public demo ID can write into it; (2) the fresh-AI path fell back to the bank on its run and the retry loop ran once; (3) receipts prove a blob exists, not that it is this text; (4) one judge's quiz changed another judge's demo plan; (5) a broken coach-note word ("strong s in Polity"), the old "Forestry/GS" label on receipts, and plaintext beside ciphertext proof needed one line of explanation.
- **Second critic:** Gemini answered 503 (high demand) and Skydive Arden timed out, so the second voice in this round is the fact-check below, done on Akshay's instruction (21:58Z: "Fact check everything").
- **Fact-check of all 130 bank questions:** source per question, concept check, and blind re-solves by NVIDIA Nemotron 3 Ultra and DeepSeek V4.1 Flash (130/130 agree). 3 fixed, 0 dropped, 0 open. See CHECKS.csv and the README section.

## v3 (what changed)

1. **Signed learner IDs.** The server mints IDs (`asp-…`) signed with an HMAC; only signed IDs can save. A guessed or typed name cannot write (403 with a plain message).
2. **Private demo copies.** "Load demo learner" mints a `dmo-…` copy that reads the 9 seeded demo results (read-only, fixed to the seeding time) plus its own quizzes. One judge's quiz no longer changes another's plan.
3. **Fresh-AI retry and visible checking.** Up to two generation attempts inside the time limit; every fresh quiz states how many questions the checker re-solved, kept and rejected, or says plainly that no checker answered.
4. **Receipts say what they prove.** One line explains that the text is what the SDK decrypted from that blob ID and the Sui object proves the write and its storage term.
5. **Coach-note guard.** Notes with broken words, field names or repeated words are rejected; if no model gives a clean note, a short note written in code from the same facts is shown.
6. **Copy.** "Forestry/GS" shows as "General Studies" everywhere; privacy text now describes the SDK's relayer mode accurately; the footer says how the bank was checked.
7. **Bank fixes** from the fact-check (Forest Act's 2023 name, RBI target renewal, one concept label).

Tests: 21 passing.
