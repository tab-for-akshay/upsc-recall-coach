# UPSC Recall Coach

**A UPSC practice coach that remembers your weak topics across sessions.** Each quiz result is stored as a memory with **Walrus Memory** on **Sui mainnet**, and every memory is checked on-chain through **Tatum's Sui RPC**.

Built by Tab, an AI assistant, for team lead Akshay Wagh.

- Live demo: https://upsc-recall-coach.vercel.app (open **Load demo learner** to see a learner with history)
- Hackathon: Total Recall (Walrus × Tatum), track **Smart Agents for Real Life**

## The problem

A UPSC aspirant practises dozens of topics over months. Most practice apps forget you the moment you close them, so every session starts with the same generic list. A human coach remembers: "you keep missing C4 photosynthesis and soil CEC, start there today."

## What it does

1. **Quiz.** Pick a topic (Agriculture, Botany or GS, 26 syllabus topics) and language (English or Hindi). An open-weight model writes 4 MCQs; the code checks their shape before showing them.
2. **Remember.** The result becomes one short memory, written by code, not by the model or the user: date, topic, score, the concepts you missed and your language. It is stored with Walrus Memory through the managed relayer, encrypted, in the learner's own namespace (`coach-<learner-id>`).
3. **Recall.** Next session, the coach recalls the learner's memories and builds today's plan **in plain code**: weakest topic first (accuracy over all attempts), the exact concepts you missed, videos for them from [UPSC Tube](https://upsc-tube.vercel.app), and a chip for every memory the line came from.
4. **Before / after.** The plan page shows the same day *without memory* (everyone gets the most-recommended topics) beside *with your Walrus memory*. After a quiz it says how the plan changed.
5. **Prove.** The Memory receipts panel reads Sui mainnet through Tatum's gRPC gateway: the MemWal account object (type, version, owner, delegate keys) and, for each memory, the Walrus **Blob object** on Sui (object ID, the transaction that created it, size, certified epoch and storage end epoch), with Suiscan links.

Your learner ID is the memory key: type the same ID on another phone and your history follows you.

## How Walrus and Tatum are used

| Piece | What we use | Where |
|---|---|---|
| Walrus Memory (MemWal SDK `@mysten-incubation/memwal`) | `remember` + `waitForRememberJob` for each quiz result; `recall` for the plan; one namespace per learner | `site/worker.mjs` → `/api/remember`, `/api/plan` |
| Sui mainnet | MemWal account `0x42f9…4710`; every memory is a Walrus `Blob` object owned by the account owner | |
| Tatum Sui RPC (gRPC, `sui-mainnet-grpc.gateway.tatum.io:443`) | `getObject` (account), `getChainIdentifier`, `listOwnedObjects` filtered to the Walrus `blob::Blob` type with JSON content; we convert each Blob's `u256` blob_id to the Walrus base64url ID and match it to the recalled memory | `/api/receipts` |

Walrus blob IDs are the little-endian bytes of the `blob_id` u256 on the Sui `Blob` object, base64url-encoded. A unit test checks this against a real mainnet blob.

## Learning, made inspectable

The model never decides what you know. Memories carry machine-readable tags (`[topic:…] [score:3/4] [lang:hi]`) written by code; the planner parses them and ranks topics by accuracy. Tags cannot be injected: the only free-ish text (missed concept labels) has brackets stripped (tested).

## Privacy and limits

- Only quiz results are stored, never a name, email or free text from the learner.
- Anyone who knows a learner ID can read its results; pick an ID without personal details.
- Memory writes are real mainnet writes, so they are rate-limited (12 per hour per network address).
- Practice questions are AI-written and can be wrong; each shows a one-line explanation. Check anything important against a standard text.
- The demo learner (`demo-aspirant-01`) holds 9 practice results that Tab seeded on 1 Nov 2026 to show a plan with history; the UI says so.

## Run it

```
npm install
npm test                                   # 10 unit tests
MEMWAL_KEY=… TATUM_KEY=… GROQ_API_KEY=… node scripts/e2e.mjs demo-aspirant-01
```

`site/worker.mjs` is a standard `fetch(request, env)` handler. On Vercel it runs as one Node function under `/api/*`; `site/index.html`, `app.js` and `styles.css` are static. Keys live only in an encrypted Vercel environment variable, never in the browser or this repo.

## Rounds

See [ROUNDS.md](ROUNDS.md): v1 → two outside critics → v2 → critics → v3.

---
Built by Tab, an AI assistant, for team lead Akshay Wagh. MIT licence.
