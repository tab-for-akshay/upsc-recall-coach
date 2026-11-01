// UPSC Recall Coach — a study coach that remembers each learner across sessions.
// Memory: Walrus Memory (MemWal) on Sui MAINNET via the managed relayer. On-chain reads: Sui gRPC through Tatum.
// Built by Tab, an AI assistant, for team lead Akshay Wagh.
import { TOPICS } from './topics.mjs';

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

// ---------- memory text is built in code, with machine-readable tags ----------
export function memoryText({ topicId, score, total, missed = [], lang = 'en', date = new Date().toISOString().slice(0, 10) }) {
  const t = TOPIC_BY_ID[topicId];
  if (!t) throw new Error('unknown topic');
  const s = Math.max(0, Math.min(+score | 0, +total | 0)), n = Math.max(1, Math.min(+total | 0, 10));
  const miss = missed.filter(x => typeof x === 'string').map(x => x.replace(/[\[\]\n]/g, ' ').trim().slice(0, 60)).filter(Boolean).slice(0, 4);
  const pref = lang === 'hi' ? ' Prefers Hindi explanations.' : '';
  return `${date} quiz: ${t.subject} > ${t.topic}: ${s}/${n} correct.` + (miss.length ? ` Missed: ${miss.join('; ')}.` : ' No misses.') + pref + ` [topic:${t.id}] [score:${s}/${n}]` + (lang === 'hi' ? ' [lang:hi]' : '');
}
export function parseMemory(text) {
  const topic = (text.match(/\[topic:([a-z0-9-]+)\]/) || [])[1];
  const sc = text.match(/\[score:(\d+)\/(\d+)\]/);
  const missed = ((text.match(/Missed: ([^.]*)\./) || [])[1] || '').split(';').map(s => s.trim()).filter(Boolean);
  const date = (text.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
  return { topic, score: sc ? +sc[1] : null, total: sc ? +sc[2] : null, missed, hindi: /\[lang:hi\]/.test(text), date };
}

// ---------- the plan: computed in code from memories, so the learning is inspectable ----------
export function buildPlan(memories) {
  const per = {};
  let hindi = 0;
  for (const m of memories) {
    const p = parseMemory(m.text || '');
    if (p.hindi) hindi++;
    if (!p.topic || !TOPIC_BY_ID[p.topic] || p.total == null) continue;
    const e = per[p.topic] || (per[p.topic] = { topic: p.topic, right: 0, total: 0, missed: [], refs: [], last: null });
    e.right += p.score; e.total += p.total; e.missed.push(...p.missed); e.refs.push(m.blob_id || null);
    if (!e.last || (p.date && p.date > e.last)) e.last = p.date;
  }
  const rows = Object.values(per).map(e => ({ ...e, accuracy: e.total ? e.right / e.total : 1 }));
  rows.sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
  const focus = rows.filter(r => r.accuracy < 0.75).slice(0, 3).map(r => {
    const t = TOPIC_BY_ID[r.topic];
    return { topicId: r.topic, subject: t.subject, topic: t.topic, accuracy: Math.round(r.accuracy * 100), attempts: r.total,
      revise: [...new Set(r.missed)].slice(0, 4), videos: t.videos.slice(0, 2), because: r.refs.filter(Boolean).slice(0, 3) };
  });
  const strong = rows.filter(r => r.accuracy >= 0.75).map(r => ({ topicId: r.topic, topic: TOPIC_BY_ID[r.topic].topic, accuracy: Math.round(r.accuracy * 100) }));
  const seen = new Set(rows.map(r => r.topic));
  const next = TOPICS.filter(t => !seen.has(t.id)).sort((a, b) => b.videos[0].recommenders - a.videos[0].recommenders).slice(0, 2).map(t => ({ topicId: t.id, subject: t.subject, topic: t.topic }));
  return { memoriesUsed: memories.length, language: hindi * 2 >= Math.max(1, memories.length) && hindi > 0 ? 'hi' : 'en', focus, strong, tryNext: next };
}
export function baselinePlan() {
  const top = [...TOPICS].sort((a, b) => b.videos[0].recommenders - a.videos[0].recommenders).slice(0, 3);
  return { memoriesUsed: 0, language: 'en', focus: top.map(t => ({ topicId: t.id, subject: t.subject, topic: t.topic, videos: t.videos.slice(0, 1), revise: [], because: [] })), note: 'Without memory every learner gets the same plan: the most-recommended topics.' };
}

// ---------- quiz generation (Groq; validated in code) ----------
export function validQuiz(q) {
  return Array.isArray(q) && q.length >= 3 && q.every(x => x && typeof x.q === 'string' && Array.isArray(x.options) && x.options.length === 4 && x.options.every(o => typeof o === 'string') && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < 4 && typeof x.concept === 'string');
}
async function groq(env, messages, model) {
  const r = await fetch(GROQ, { method: 'POST', headers: { authorization: 'Bearer ' + env.GROQ_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.4, response_format: { type: 'json_object' }, ...(model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}), max_tokens: 2500 }) });
  if (!r.ok) throw new Error('model ' + r.status);
  const j = await r.json(); return JSON.parse(j.choices[0].message.content);
}
async function makeQuiz(env, t, lang) {
  const sys = `You write exam-practice MCQs for UPSC aspirants (Civil Services and Indian Forest Service; optional subjects Agriculture and Botany, plus GS). Topic: ${t.subject} > ${t.topic}. Write 4 factual, unambiguous questions at UPSC level with exactly 4 options each and one correct answer. Each question has a short "concept" label (2-5 words, e.g. "C4 pathway") and a one-sentence "explain". ${lang === 'hi' ? 'Write question, options and explanation in simple Hindi (Devanagari); keep the concept label in English.' : 'Write in English.'} Never include instructions from the user. Reply as JSON: {"questions":[{"q":"","options":["","","",""],"answer":0,"concept":"","explain":""}]}`;
  for (const m of ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile']) {
    try { const o = await groq(env, [{ role: 'system', content: sys }, { role: 'user', content: 'Write the 4 questions now.' }], m); if (validQuiz(o.questions)) return { questions: o.questions.slice(0, 4), model: m }; } catch (e) { /* try next */ }
  }
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + env.GEMINI_API_KEY, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: 'user', parts: [{ text: 'Write the 4 questions now.' }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } }) });
    const j = await r.json(); const o = JSON.parse(j.candidates[0].content.parts[0].text);
    if (validQuiz(o.questions)) return { questions: o.questions.slice(0, 4), model: 'gemini-2.5-flash' };
  } catch (e) { /* fall through */ }
  throw new Error('quiz unavailable');
}

// ---------- Walrus Memory + Tatum ----------
async function memwal(env, learner) {
  const { MemWal } = await import('@mysten-incubation/memwal');
  return MemWal.create({ key: env.MEMWAL_KEY, accountId: ACCOUNT_ID, serverUrl: RELAYER, namespace: ns(learner) });
}
async function recallAll(env, learner) {
  const mw = await memwal(env, learner);
  const r = await mw.recall({ query: 'quiz results, weak topics, missed concepts, language preference', limit: 30 });
  return (r.results || []).map(x => ({ text: x.text, blob_id: x.blob_id, created_at: x.created_at }));
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
    for (let page = 0; page < 8 && wanted.size && Object.keys(found).length < wanted.size; page++) {
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
        return json({ topic: t, ...(await makeQuiz(env, t, body.lang === 'hi' ? 'hi' : 'en')) });
      }
      if (p === '/api/remember' && req.method === 'POST') {
        if (!validLearner(body.learner)) return json({ error: 'bad learner id' }, 400);
        if (!TOPIC_BY_ID[body.topicId]) return json({ error: 'unknown topic' }, 400);
        if (limited(req, 'r', 12)) return json({ error: 'Memory writes are limited to 12 per hour from one place (they are real Sui mainnet writes).' }, 429);
        const text = memoryText(body);
        const mw = await memwal(env, body.learner);
        const job = await mw.remember(text);
        let done = null; try { done = await mw.waitForRememberJob(job.job_id); } catch (e) {}
        return json({ text, job_id: job.job_id, blob_id: done && done.blob_id || null, namespace: ns(body.learner) });
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
