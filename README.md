# UPSC Recall Coach

**A UPSC practice coach that remembers your weak topics across sessions.** Each quiz result is stored as a memory with **Walrus Memory** on **Sui mainnet**, and every memory is checked on-chain through **Tatum's Sui RPC**.

Built by Tab, an AI assistant, for team lead Akshay Wagh.

- Live demo: https://upsc-recall-coach.vercel.app (open **Load demo learner** to see a learner with history)
- Hackathon: Total Recall (Walrus × Tatum), track **Smart Agents for Real Life**

## The problem

A UPSC aspirant practises dozens of topics over months. Most practice apps forget you the moment you close them, so every session starts with the same generic list. A human coach remembers: "you keep missing C4 photosynthesis and soil CEC, start there today."

## What it does

1. **Quiz.** Pick a topic (Agriculture, Botany or General Studies, 26 syllabus topics). Questions come from a bank of 130 MCQs written by Tab (5 per topic), each checked against a cited source and re-solved blind by two other models (see [CHECKS.csv](CHECKS.csv)), with **the concepts you missed before served first**. Tick "fresh AI questions" (or pick Hindi) and an open-weight model writes 6 new ones aimed at your missed concepts, at a level set by your past accuracy; a **second, different model re-solves each one blind** and any it disagrees with is dropped. If a question still looks wrong, **flag it** and it is not counted in your memory.
2. **Remember.** The result becomes one short memory, written by code, not by the model or the user: date, topic, score, the concepts you missed and your language. It is stored with Walrus Memory through the managed relayer, encrypted, in the learner's own namespace (`coach-<learner-id>`).
3. **Recall.** Next session, the coach recalls the learner's memories and builds today's plan **in plain code**: topics due for review first (spaced repetition: a topic comes back after 1, 2, 4 or 7 days depending on your recent accuracy), then the weakest; the concepts you missed (repeat misses highlighted), your trend since the first session, videos from [UPSC Tube](https://upsc-tube.vercel.app), one never-practised topic so you don't get stuck, and a chip for every memory a line came from.
4. **Coach's note.** An AI coach reads only the computed facts (never raw memory text) and writes three sentences: where to start today, the one concept to fix first, and what is going well.
5. **Before / after.** The plan page shows the same day *without memory* (everyone gets the most-recommended topics) beside *with your Walrus memory*. After a quiz it says how the plan changed.
6. **Prove.** The Memory receipts panel reads Sui mainnet through Tatum's gRPC gateway: the MemWal account object (type, version, owner, delegate keys) and, for each memory, the Walrus **Blob object** on Sui (object ID, the transaction that created it, size, certified epoch and storage end epoch), with Suiscan links.

Your learner ID is the memory key: type the same ID on another phone and your history follows you. IDs are minted and signed by the server (`asp-…`), so only IDs this app issued can save; nobody can write into a learner by guessing a name. **Load demo learner** gives each visitor a private copy (`dmo-…`): it reads the seeded demo history (read-only) plus that copy's own quizzes, so one judge's quiz never changes another judge's plan.

## How Walrus and Tatum are used

| Piece | What we use | Where |
|---|---|---|
| Walrus Memory (MemWal SDK `@mysten-incubation/memwal`) | `remember` + `waitForRememberJob` for each quiz result; `recall` for the plan; one namespace per learner | `site/worker.mjs` → `/api/remember`, `/api/plan` |
| Sui mainnet | MemWal account `0x42f9…4710`; every memory is a Walrus `Blob` object owned by the account owner | |
| Tatum Sui RPC (gRPC, `sui-mainnet-grpc.gateway.tatum.io:443`) | `getObject` (account), `getChainIdentifier`, `listOwnedObjects` filtered to the Walrus `blob::Blob` type with JSON content; we convert each Blob's `u256` blob_id to the Walrus base64url ID and match it to the recalled memory | `/api/receipts` |

Walrus blob IDs are the little-endian bytes of the `blob_id` u256 on the Sui `Blob` object, base64url-encoded. A unit test checks this against a real mainnet blob.

## Learning, made inspectable

The model never decides what you know. Memories carry machine-readable tags (`[topic:…] [score:3/4] [lang:hi]`) written by code; the planner parses them and ranks topics by accuracy. Tags cannot be injected: the only free-ish text (missed concept labels) has brackets stripped (tested).

## Fact-checking the question bank (CHECKS.csv)

On 1 Nov 2026 every one of the 130 bank questions was checked three ways, and every row is in [CHECKS.csv](CHECKS.csv):

1. **Source check.** For each question Tab searched for a primary or authoritative source (government, ICAR, PIB, RBI, Census, NCERT-based, university or standard reference), fetched the page and confirmed it states the marked answer; the URL and an excerpt are logged. 121 rows cite a government body, international body, journal, university or standard reference; 2 cite Wikipedia and 2 cite an NCERT-notes study site (labelled in the `source_type` column); the 5 arithmetic questions were recomputed in code. A source counts as checked only when the fetched page text contains the marked answer's key terms; Tab then read the excerpt.
2. **Concept check.** Tab re-read each stem and option: one defensible answer, every distractor wrong, no trick wording, nothing outdated.
3. **Blind re-solve.** Two other models (NVIDIA Nemotron 3 Ultra and DeepSeek V4.1 Flash) answered all 130 without seeing the key. Both agreed with the key on 130 of 130 and flagged none as ambiguous.

Result: 130 checked, 3 fixed, 0 dropped, 0 open. Fixed: the Forest (Conservation) Act question now gives its 2023 name (Van (Sanrakshan Evam Samvardhan) Adhiniyam, 1980); the RBI inflation-target explanation adds the March 2026 renewal; one concept label ("Soil pH buffering") was renamed "Acid soil liming" to match what the question tests.

## Free models, used carefully

Every AI call goes through a chain of free models on separate limits (Groq, Cloudflare Workers AI, Gemini, OpenRouter, NVIDIA) with per-call timeouts and one overall deadline. When all are busy, the quiz falls back to the checked question bank and the coach note falls back to a short note written in code from the same facts, because the plan never depends on a model. AI coach notes pass an output guard (no broken words, field names or repeated words) or are replaced by the code-written note.

## Privacy and limits

- Only quiz results are stored (date, topic, score, missed concepts, language), written by code; never a name, email or free text.
- In the SDK's default relayer mode (the one this app uses), the Walrus Memory relayer SEAL-encrypts each memory before it is uploaded to Walrus and decrypts it on recall for this app's delegate key (see the SDK's `memwal.js`: "Rust server (TEE). All data processing (encryption, embedding, Walrus)…"). The bytes on Walrus are ciphertext. Anyone who knows a learner ID can ask the app for that ID's plan, so keep it private; only signed IDs can write.
- Receipts prove that each memory exists on Sui mainnet, who owns it and how long it is stored. They cannot show the text, because it is encrypted; the text shown beside a receipt is what the SDK decrypted from that blob ID on recall.
- Memory writes are real mainnet writes, so they are rate-limited (12 per hour per network address; the limit lives in each server instance, so it is a speed bump, not a hard wall).
- Bank questions were written by Tab, an AI, and each was checked against a cited source (CHECKS.csv lists the URL, an excerpt, a concept check and two blind re-solves per question). Fresh AI questions are checked only by a second model, not against sources, and the quiz says so. Every question shows a one-line explanation and can be flagged.
- The demo learner (`demo-aspirant-01`) holds 9 practice results that Tab seeded on 1 Nov 2026 to show a plan with history; the UI says so.

## Run it

```
npm install
npm test                                   # 21 unit tests
MEMWAL_KEY=… TATUM_KEY=… GROQ_API_KEY=… node scripts/e2e.mjs demo-aspirant-01
```

`site/worker.mjs` is a standard `fetch(request, env)` handler. On Vercel it runs as one Node function under `/api/*`; `site/index.html`, `app.js` and `styles.css` are static. Keys live only in an encrypted Vercel environment variable, never in the browser or this repo.

## Rounds

See [ROUNDS.md](ROUNDS.md): v1 → two outside critics → v2 → critics → v3.

---
Built by Tab, an AI assistant, for team lead Akshay Wagh. MIT licence.
