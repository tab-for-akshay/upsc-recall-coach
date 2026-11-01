// UPSC Recall Coach — a study coach that remembers each learner across sessions.
// Memory: Walrus Memory (MemWal) on Sui MAINNET via the managed relayer. On-chain reads: Sui gRPC through Tatum.
// Built by Tab, an AI assistant, for team lead Akshay Wagh.
import { TOPICS } from './topics.mjs';
import { BANK } from './bank.mjs';

export const DISCLOSURE = 'Built by Tab, an AI assistant, for team lead Akshay Wagh.';
export const ACCOUNT_ID = '0x42f9f955fab6ce2a785d0e2bae78afdc547c58c348671dd6787d470a9bb24710';
export const AGENT_ID = '89d75cbe59dbf2433511120360bf585bc82d18c713c6209378cc42b243d92134';
const RELAYER = 'https://relayer.memory.walrus.xyz';
const TATUM_SUI_GRPC = 'sui-mainnet-grpc.gateway.tatum.io:443';
const GROQ = 'https://api.groq.com/openai/v1/chat/completions';
const TOPIC_BY_ID = Object.fromEntries(TOPICS.map(t => [t.id, t]));

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const validLearner = (s) => typeof s === 'string' && /^[a-z0-9-]{6,40}$/.test(s);
const ns = (learner) => 'coach-' + learner;
// ---------- learner ids: minted and signed by the server, so only the holder can write ----------
export const DEMO_LEARNER = 'demo-aspirant-01';
const SIGNED = /^(asp|dmo)-([a-z0-9]{8})-([a-f0-9]{10})$/;
async function sig(env, body) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode('rc-learner-v1:' + (env.LEARNER_SECRET || env.MEMWAL_KEY || 'dev')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(body)));
  return Array.from(s.slice(0, 5), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function mintLearner(env, demo) {
  const r = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join('');
  const head = (demo ? 'dmo-' : 'asp-') + r;
  return head + '-' + (await sig(env, head));
}
export async function canWrite(env, learner) {
  const m = SIGNED.exec(String(learner || ''));
  if (!m) return false;
  return (await sig(env, m[1] + '-' + m[2])) === m[3];
}

// ---------- memory text is built in code, with machine-readable tags ----------
export function memoryText({ topicId, score, total, missed = [], lang = 'en', flagged = 0, date = new Date().toISOString().slice(0, 10) }) {
  const t = TOPIC_BY_ID[topicId];
  if (!t) throw new Error('unknown topic');
  const s = Math.max(0, Math.min(+score | 0, +total | 0)), n = Math.max(1, Math.min(+total | 0, 10));
  const miss = missed.filter(x => typeof x === 'string').map(x => x.replace(/[\[\]\n]/g, ' ').trim().slice(0, 60)).filter(Boolean).slice(0, 4);
  const pref = lang === 'hi' ? ' Prefers Hindi explanations.' : '';
  return `${date} quiz: ${t.subject} > ${t.topic}: ${s}/${n} correct.` + (miss.length ? ` Missed: ${miss.join('; ')}.` : ' No misses.') + ((+flagged | 0) > 0 ? ` ${Math.min(+flagged | 0, 4)} question(s) flagged as faulty, not counted.` : '') + pref + ` [topic:${t.id}] [score:${s}/${n}]` + (lang === 'hi' ? ' [lang:hi]' : '');
}
export function parseMemory(text) {
  const topic = (text.match(/\[topic:([a-z0-9-]+)\]/) || [])[1];
  const sc = text.match(/\[score:(\d+)\/(\d+)\]/);
  const missed = ((text.match(/Missed: ([^.]*)\./) || [])[1] || '').split(';').map(s => s.trim()).filter(Boolean);
  const date = (text.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
  return { topic, score: sc ? +sc[1] : null, total: sc ? +sc[2] : null, missed, hindi: /\[lang:hi\]/.test(text), date };
}

// ---------- the plan: computed in code from memories, so the learning is inspectable ----------
// Leitner-style spacing: the weaker the topic, the sooner it comes back.
export function intervalDays(acc) { return acc < 0.5 ? 1 : acc < 0.75 ? 2 : acc < 0.9 ? 4 : 7; }
const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
const addDays = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
export function buildPlan(memories, today = new Date().toISOString().slice(0, 10)) {
  const per = {};
  let hindi = 0;
  for (const m of memories) {
    const p = parseMemory(m.text || '');
    if (p.hindi) hindi++;
    if (!p.topic || !TOPIC_BY_ID[p.topic] || p.total == null) continue;
    const e = per[p.topic] || (per[p.topic] = { topic: p.topic, right: 0, total: 0, missed: [], refs: [], last: null, sessions: [] });
    e.right += p.score; e.total += p.total; e.missed.push(...p.missed); e.refs.push(m.blob_id || null);
    e.sessions.push({ date: p.date, score: p.score, total: p.total, at: m.created_at || p.date });
    if (!e.last || (p.date && p.date > e.last)) e.last = p.date;
  }
  const rows = Object.values(per).map(e => {
    e.sessions.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const recent = e.sessions.slice(-2), rr = recent.reduce((s, x) => s + x.score, 0), rt = recent.reduce((s, x) => s + x.total, 0);
    const accuracy = e.total ? e.right / e.total : 1, recentAcc = rt ? rr / rt : accuracy;
    const due = e.last ? addDays(e.last, intervalDays(recentAcc)) : today;
    const first = e.sessions[0], lastS = e.sessions[e.sessions.length - 1];
    const trend = e.sessions.length > 1 ? Math.round(100 * (lastS.score / lastS.total - first.score / first.total)) : null;
    return { ...e, accuracy, recentAcc, due, dueIn: dayDiff(due, today), trend };
  });
  rows.sort((a, b) => ((a.dueIn > 0) - (b.dueIn > 0)) || a.recentAcc - b.recentAcc || b.total - a.total);
  const weak = rows.filter(r => r.recentAcc < 0.75);
  const focus = weak.slice(0, 3).map(r => {
    const t = TOPIC_BY_ID[r.topic];
    const counts = {}; r.missed.forEach(x => counts[x] = (counts[x] || 0) + 1);
    const revise = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 4);
    return { topicId: r.topic, subject: t.subject, topic: t.topic, accuracy: Math.round(r.accuracy * 100), recent: Math.round(r.recentAcc * 100), attempts: r.total, sessions: r.sessions.length,
      due: r.due, dueIn: r.dueIn, trend: r.trend, revise, repeatMisses: revise.filter(x => counts[x] > 1), videos: t.videos.slice(0, 2), because: r.refs.filter(Boolean).slice(0, 4) };
  });
  const strong = rows.filter(r => r.recentAcc >= 0.75).map(r => ({ topicId: r.topic, topic: TOPIC_BY_ID[r.topic].topic, accuracy: Math.round(r.recentAcc * 100), due: r.due, dueIn: r.dueIn }));
  const seen = new Set(rows.map(r => r.topic));
  const next = TOPICS.filter(t => !seen.has(t.id)).sort((a, b) => b.videos[0].recommenders - a.videos[0].recommenders).slice(0, 2).map(t => ({ topicId: t.id, subject: t.subject, topic: t.topic }));
  const newToday = memories.length ? next[0] || null : null;
  return { memoriesUsed: memories.length, today, newToday, language: hindi * 2 >= Math.max(1, memories.length) && hindi > 0 ? 'hi' : 'en', focus, strong, tryNext: next };
}
export function baselinePlan() {
  const top = [...TOPICS].sort((a, b) => b.videos[0].recommenders - a.videos[0].recommenders).slice(0, 3);
  return { memoriesUsed: 0, language: 'en', focus: top.map(t => ({ topicId: t.id, subject: t.subject, topic: t.topic, videos: t.videos.slice(0, 1), revise: [], because: [] })), note: 'Without memory every learner gets the same plan: the most-recommended topics.' };
}

// ---------- quiz generation (Groq; validated in code) ----------
export function validQuiz(q) {
  return Array.isArray(q) && q.length >= 3 && q.every(x => x && typeof x.q === 'string' && Array.isArray(x.options) && x.options.length === 4 && x.options.every(o => typeof o === 'string') && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < 4 && typeof x.concept === 'string');
}
const CF_URL = 'https://api.cloudflare.com/client/v4/accounts/9c89493fe17a6c1f5e651b2584380ef2/ai/v1/chat/completions';
const OAI = {
  groq: [GROQ, 'GROQ_API_KEY'], cf: [CF_URL, 'CF_AI_TOKEN'], or: ['https://openrouter.ai/api/v1/chat/completions', 'OPENROUTER_API_KEY'],
  nv: ['https://integrate.api.nvidia.com/v1/chat/completions', 'NVIDIA_API_KEY'], gemini: ['https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'GEMINI_API_KEY'],
};
export function parseJsonLoose(s) {
  try { return JSON.parse(s); } catch (e) {}
  const m = String(s || '').replace(/<think>[\s\S]*?<\/think>/g, '').match(/\{[\s\S]*\}/); if (!m) throw new Error('no JSON');
  return JSON.parse(m[0]);
}
async function chat(env, prov, model, sys, user, ms) {
  const [url, key] = OAI[prov]; if (!env[key]) throw new Error('no key');
  const extra = prov === 'groq' ? { response_format: { type: 'json_object' }, ...(model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}), ...(model.includes('qwen') ? { reasoning_format: 'hidden' } : {}) } : prov === 'gemini' ? { reasoning_effort: 'low' } : {};
  const r = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(ms), headers: { authorization: 'Bearer ' + env[key], 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: 0.4, max_tokens: 3000, ...extra }) });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json(); return parseJsonLoose(j.choices[0].message.content);
}
// Several free brains on separate limits, tried in order with per-call timeouts and one overall deadline.
export const BRAINS = [['groq', 'openai/gpt-oss-120b'], ['cf', '@cf/openai/gpt-oss-120b'], ['gemini', 'gemini-3.8-flash'], ['or', 'openrouter/free'], ['groq', 'qwen/qwen3.8-27b'], ['nv', 'z-ai/glm-5.3-flash']];
async function llm(env, sys, user, ok, skip, budgetMs = 40000) {
  const errs = [], end = Date.now() + budgetMs;
  for (const [p, m] of BRAINS) {
    if (m === skip) continue;
    const left = end - Date.now(); if (left < 4000) { errs.push('out of time'); break; }
    try { const o = await chat(env, p, m, sys, user, Math.min(25000, left)); if (ok(o)) return { o, model: m }; errs.push(m + ': bad shape'); } catch (e) { errs.push(m + ': ' + (e.name === 'TimeoutError' ? 'timeout' : e.message)); }
  }
  throw new Error('no model answered (' + errs.join('; ') + ')');
}
// Bank quiz: concepts the learner missed come first (spaced repetition of the same idea), then the rest in a fresh order.
export function bankQuiz(topicId, targeted = [], n = 4, rnd = Math.random) {
  const all = (BANK[topicId] || []).slice();
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const T = targeted.map(norm);
  const hit = (q) => T.some(t => t && (norm(q.concept) === t || norm(q.concept).includes(t) || t.includes(norm(q.concept))));
  const first = all.filter(hit), rest = all.filter(q => !hit(q));
  return [...first, ...rest].slice(0, n).map(q => ({ ...q, repeat: hit(q) }));
}
export function quizTarget(memories, topicId) {
  const rows = memories.map(m => parseMemory(m.text || '')).filter(p => p.topic === topicId && p.total);
  if (!rows.length) return { level: 'standard', targeted: [], basis: 0 };
  const right = rows.reduce((s, p) => s + p.score, 0), total = rows.reduce((s, p) => s + p.total, 0), acc = right / total;
  const counts = {}; rows.forEach(p => p.missed.forEach(x => counts[x] = (counts[x] || 0) + 1));
  const targeted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3);
  return { level: acc < 0.5 ? 'foundation' : acc < 0.85 ? 'standard' : 'hard', targeted, basis: rows.length, accuracy: Math.round(acc * 100) };
}
// A second, different model re-solves every question blind; we keep only questions where it agrees with the marked answer and finds them unambiguous.
async function checkQuiz(env, t, qs, genModel) {
  const sys = `You are a strict UPSC examiner checking MCQs on ${t.subject} > ${t.topic}. For each question, solve it yourself first, then decide: ok = true only if (a) exactly one option is correct by standard Indian textbooks, (b) that option is the one at index "answer", and (c) the explanation is correct and consistent. Reply as JSON: {"checks":[{"i":0,"ok":true,"why":"short reason"}]} with one entry per question, in order.`;
  const user = JSON.stringify(qs.map((q, i) => ({ i, q: q.q, options: q.options, answer: q.answer, explain: q.explain })));
  const { o, model } = await llm(env, sys, user, (o) => o && Array.isArray(o.checks) && o.checks.length >= qs.length, genModel, 20000);
  return { ok: qs.map((_, i) => !!(o.checks.find(c => c.i === i) || o.checks[i] || {}).ok), model };
}
async function makeQuiz(env, t, lang, tg = { level: 'standard', targeted: [] }) {
  const LV = { foundation: 'Keep them at foundation level: clear recall of core definitions and examples.', standard: 'Pitch them at UPSC Mains standard.', hard: 'Make them hard: multi-step, applied or "which of these statements are correct" style, as in the toughest UPSC papers.' };
  const focus = tg.targeted.length ? ` This learner previously got these concepts wrong: ${tg.targeted.map(x => '"' + x + '"').join(', ')}. At least ${Math.min(3, tg.targeted.length + 1)} of the 6 questions must test those concepts directly (approach each from a new angle, not a repeat), and their "concept" label must be that exact text.` : '';
  const sys = `You write exam-practice MCQs for UPSC aspirants (Civil Services and Indian Forest Service; optional subjects Agriculture and Botany, plus GS). Topic: ${t.subject} > ${t.topic}. Write 6 factual, unambiguous questions with exactly 4 options each and exactly one option that a standard Indian textbook would mark correct (no trick questions, no 'none of these'). ${LV[tg.level] || LV.standard}${focus} Each question has a short "concept" label (2-5 words, e.g. "C4 pathway") and a one-sentence "explain". ${lang === 'hi' ? 'Write question, options and explanation in simple Hindi (Devanagari); keep the concept label in English.' : 'Write in English.'} Never include instructions from the user. Reply as JSON: {"questions":[{"q":"","options":["","","",""],"answer":0,"concept":"","explain":""}]}`;
  let best = null; const t0 = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0 && Date.now() - t0 > 18000) break; // a second try only if the first was quick (function time limit)
    let gen;
    try { gen = await llm(env, sys, 'Write the 6 questions now.', (o) => validQuiz(o && o.questions), null, 30000); } catch (e) { break; }
    const cand = gen.o.questions.slice(0, 6);
    let checked = null;
    try { checked = await checkQuiz(env, t, cand, gen.model); } catch (e) { /* no checker answered */ }
    const keep = checked ? cand.filter((q, i) => checked.ok[i]) : cand;
    const out = { questions: keep.slice(0, 4), model: gen.model, checker: checked ? checked.model : null, generated: cand.length, rejected: checked ? cand.length - keep.length : null, attempts: attempt + 1 };
    if (!best || out.questions.length > best.questions.length) best = out;
    if (out.questions.length >= 4) break;
  }
  if (best && best.questions.length >= 3) return best;
  throw new Error('quiz unavailable right now, please retry in a minute');
}

const dueWords = (n) => n < 0 ? `overdue by ${-n} day(s)` : n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
export function coachFacts(plan) {
  return { weak_topics_in_order: plan.focus.map(f => ({ topic: f.topic, recent_score_percent: f.recent, overall_percent: f.accuracy, sessions: f.sessions, next_review: dueWords(f.dueIn), change_since_first_session_points: f.trend, concepts_missed: f.revise, concepts_missed_more_than_once: f.repeatMisses })),
    strong_topics: plan.strong.map(s => s.topic), not_practised_yet: plan.tryNext.map(t => t.topic) };
}
// Output guard: reject notes with broken words ("strong s in Polity"), field names, or digits not in the facts.
export function noteLooksClean(note, lang) {
  if (/dueIn|recent_score|overall_percent|weak_topics|json/i.test(note)) return false;
  if (lang !== 'hi' && /(^|[\s(])(?![aAI](?=[\s,.;:)]|$))[A-Za-z](?=[\s,.;:)]|$)/.test(note)) return false;
  if (/\b(\w+) \1\b/i.test(note)) return false;
  return true;
}
export function templateNote(plan) {
  const f = plan.focus[0], s = plan.strong[0];
  if (!f && !s) return null;
  const parts = [];
  if (f) parts.push(`Start with ${f.topic}: your recent score there is ${f.recent}%.`);
  if (f && f.revise && f.revise.length) parts.push(`Fix "${f.revise[0]}" first: read the explanation again, then take a quiz on ${f.topic}.`);
  if (s) parts.push(`${s.topic} is going well (${s.accuracy}%).`);
  return { text: parts.join(' '), model: 'template written in code (AI models busy)' };
}
async function coachNote(env, plan, lang) {
  if (!plan.focus.length && !plan.strong.length) return null;
  const facts = coachFacts(plan);
  const sys = `You are a warm, direct UPSC study coach talking to the learner as "you". Using ONLY the facts in the JSON (their remembered quiz history), write exactly 3 short sentences: (1) which topic to start with today and why, (2) the one concept to fix first, preferring a concept missed more than once, with a concrete 10-minute way to fix it, (3) one thing that is going well. Never mention JSON, field names or the word 'dueIn'. No numbers that are not in the facts, no invented facts, no greetings.${lang === 'hi' ? ' Write in simple Hindi (Devanagari).' : ''} Reply as JSON: {"note":""}`;
  try { const { o, model } = await llm(env, sys, JSON.stringify(facts), (o) => o && typeof o.note === 'string' && o.note.length > 20 && noteLooksClean(o.note, lang), null, 30000); return { text: o.note.slice(0, 600), model }; } catch (e) { /* fall back to a note written in code */ }
  return templateNote(plan);
}

// ---------- Walrus Memory + Tatum ----------
async function memwal(env, learner) {
  const { MemWal } = await import('@mysten-incubation/memwal');
  return MemWal.create({ key: env.MEMWAL_KEY, accountId: ACCOUNT_ID, serverUrl: RELAYER, namespace: ns(learner) });
}
async function recallOne(env, learner, from) {
  const mw = await memwal(env, learner);
  const r = await mw.recall({ query: 'quiz results, weak topics, missed concepts, language preference', limit: 50 });
  return (r.results || []).map(x => ({ text: x.text, blob_id: x.blob_id, created_at: x.created_at, from }));
}
// The demo history is the 9 results Tab seeded at 21:26Z on 1 Nov 2026. Quizzes that judges saved into the
// shared demo ID under v2 (before it became read-only) are left out, so every demo copy starts from the same history.
export const DEMO_SEEDED_BEFORE = '2026-11-01T21:27:00Z';
export const seededOnly = (ms) => ms.filter((m) => m.created_at && m.created_at < DEMO_SEEDED_BEFORE);
// A demo copy ("dmo-…") starts from the seeded demo history (read-only) and adds its own quizzes on top,
// so each judge works on a private copy and nobody's quiz changes anyone else's plan.
async function recallAll(env, learner) {
  if (learner.startsWith('dmo-')) {
    const [base, own] = await Promise.all([recallOne(env, DEMO_LEARNER, 'demo history'), recallOne(env, learner, 'you')]);
    return seededOnly(base).concat(own);
  }
  if (learner === DEMO_LEARNER) return seededOnly(await recallOne(env, learner, 'demo history'));
  return recallOne(env, learner, 'you');
}
export const OWNER = '0x77c5588291dfccd480bac86725bf21977f66bbef8b726801f2a3baa08b807b55';
export const BLOB_TYPE = '0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77::blob::Blob';
// Walrus blob ids are the u256 on the Sui Blob object, little-endian, base64url.
export function blobIdFromU256(dec) {
  let n = BigInt(dec); const b = new Uint8Array(32);
  for (let i = 0; i < 32; i++) { b[i] = Number(n & 255n); n >>= 8n; }
  let s = ''; for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sui(env) {
  const [{ SuiGrpcClient }, { GrpcTransport }, { ChannelCredentials }] = await Promise.all([import('@mysten/sui/grpc'), import('@protobuf-ts/grpc-transport'), import('@grpc/grpc-js')]);
  const transport = new GrpcTransport({ host: TATUM_SUI_GRPC, channelCredentials: ChannelCredentials.createSsl(), meta: { 'x-api-key': env.TATUM_KEY } });
  return { client: new SuiGrpcClient({ network: 'mainnet', transport }), close: () => { try { transport.close(); } catch (e) {} } };
}
async function suiAccount(env, want = []) {
  const { client, close } = await sui(env);
  try {
    const t0 = Date.now();
    const [o, c] = await Promise.all([client.core.getObject({ objectId: ACCOUNT_ID, include: { json: true } }), client.core.getChainIdentifier()]);
    const wanted = new Set(want.filter(x => typeof x === 'string' && /^[A-Za-z0-9_-]{40,50}$/.test(x)).slice(0, 40));
    const found = {}; let cursor = null, scanned = 0;
    for (let page = 0; page < 40 && wanted.size && Object.keys(found).length < wanted.size; page++) {
      const r = await client.core.listOwnedObjects({ owner: OWNER, type: BLOB_TYPE, limit: 50, cursor, include: { json: true, previousTransaction: true } });
      for (const b of r.objects) {
        scanned++;
        const id = blobIdFromU256(b.json.blob_id);
        if (wanted.has(id)) found[id] = { suiObject: b.objectId, tx: b.previousTransaction, size: +b.json.size, registeredEpoch: b.json.registered_epoch, certifiedEpoch: b.json.certified_epoch, storedUntilEpoch: b.json.storage && b.json.storage.end_epoch };
      }
      if (!r.hasNextPage) break; cursor = r.cursor;
    }
    const acc = o.object, j = acc.json || {};
    return { via: 'Tatum Sui gRPC (sui-mainnet-grpc.gateway.tatum.io)', ms: Date.now() - t0, chainIdentifier: c.chainIdentifier,
      account: { objectId: acc.objectId, type: acc.type, version: String(acc.version), digest: acc.digest, owner: j.owner || null, active: j.active, delegateKeys: (j.delegate_keys || []).length },
      blobs: { asked: wanted.size, verified: Object.keys(found).length, scanned, found } };
  } finally { close(); }
}

const RL = new Map();
function limited(req, key, max) { const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'x').split(',')[0]; const k = key + ip + new Date().toISOString().slice(0, 13); const n = (RL.get(k) || 0) + 1; RL.set(k, n); if (RL.size > 5000) RL.clear(); return n > max; }

export default {
  async fetch(req, env) {
    const url = new URL(req.url); const p = url.pathname;
    try {
      if (p === '/api/health') return json({ ok: true, disclosure: DISCLOSURE, memwal_agent_id: AGENT_ID, memwal_account_id: ACCOUNT_ID, relayer: RELAYER, topics: TOPICS.length });
      if (p === '/api/topics') return json({ topics: TOPICS });
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      if (p === '/api/quiz' && req.method === 'POST') {
        const t = TOPIC_BY_ID[body.topicId]; if (!t) return json({ error: 'unknown topic' }, 400);
        if (limited(req, 'q', 30)) return json({ error: 'Too many quizzes this hour from here. Try again later.' }, 429);
        let tg = { level: 'standard', targeted: [], basis: 0 };
        if (validLearner(body.learner)) { try { tg = quizTarget(await recallAll(env, body.learner), t.id); } catch (e) { /* quiz still works without memory */ } }
        const lang = body.lang === 'hi' ? 'hi' : 'en';
        const wantFresh = body.fresh === true || lang === 'hi';
        let note = null;
        if (wantFresh) {
          try { return json({ topic: t, target: tg, source: 'fresh', ...(await makeQuiz(env, t, lang, tg)) }); }
          catch (e) { note = 'The free AI models are busy right now, so these questions come from the checked question bank' + (lang === 'hi' ? ' (in English)' : '') + '.'; }
        }
        return json({ topic: t, target: tg, source: 'bank', note, questions: bankQuiz(t.id, tg.targeted), model: 'question bank (written and checked by Tab)', checker: null });
      }
      if (p === '/api/coach' && req.method === 'POST') {
        if (!validLearner(body.learner)) return json({ error: 'bad learner id' }, 400);
        if (limited(req, 'c', 60)) return json({ coach: null });
        const plan = buildPlan(await recallAll(env, body.learner));
        return json({ coach: await coachNote(env, plan, body.lang === 'hi' || plan.language === 'hi' ? 'hi' : 'en').catch(() => null) });
      }
      if (p === '/api/learner' && req.method === 'POST') {
        if (limited(req, 'n', 60)) return json({ error: 'Too many new learners from one place this hour.' }, 429);
        return json({ learner: await mintLearner(env, body.demo === true) });
      }
      if (p === '/api/remember' && req.method === 'POST') {
        if (!validLearner(body.learner)) return json({ error: 'bad learner id' }, 400);
        if (!(await canWrite(env, body.learner))) return json({ error: body.learner === DEMO_LEARNER ? 'The demo history is read-only. Your quiz saves to your own copy.' : 'This learner ID was not issued by this app, so it cannot save. Start a new learner.', readOnly: true }, 403);
        if (!TOPIC_BY_ID[body.topicId]) return json({ error: 'unknown topic' }, 400);
        if (limited(req, 'r', 12)) return json({ error: 'Memory writes are limited to 12 per hour from one place (they are real Sui mainnet writes).' }, 429);
        const text = memoryText(body);
        const mw = await memwal(env, body.learner);
        const job = await mw.remember(text);
        let done = null; try { done = await mw.waitForRememberJob(job.job_id); } catch (e) {}
        const blob_id = done && done.blob_id || null;
        let onChain = null; if (blob_id) { try { onChain = (await suiAccount(env, [blob_id])).blobs.found[blob_id] || null; } catch (e) {} }
        return json({ text, job_id: job.job_id, blob_id, namespace: ns(body.learner), onChain });
      }
      if (p === '/api/plan') {
        const learner = body.learner || url.searchParams.get('learner');
        if (!validLearner(learner)) return json({ error: 'bad learner id' }, 400);
        const memories = await recallAll(env, learner);
        return json({ learner, withoutMemory: baselinePlan(), withMemory: buildPlan(memories), memories });
      }
      if (p === '/api/receipts') { if (limited(req, 'v', 120)) return json({ error: 'Too many checks this hour.' }, 429); return json(await suiAccount(env, Array.isArray(body.blobIds) ? body.blobIds : (url.searchParams.get('blobs') || '').split(',').filter(Boolean))); }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e).slice(0, 200) }, 502);
    }
  },
};
