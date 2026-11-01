
import worker from '../site/worker.mjs';
const call = async (p, b) => { const r = await worker.fetch(new Request('http://x' + p, b ? { method: 'POST', body: JSON.stringify(b), headers: { 'x-forwarded-for': '1.2.3.' + Math.floor(Math.random()*200) } } : {}), process.env); return [r.status, await r.json()]; };
const [s1, m] = await call('/api/learner', { demo: true }); console.log('mint', s1, m.learner);
const [s2, w] = await call('/api/remember', { learner: 'demo-aspirant-01', topicId: 'agriculture-soil-science', score: 1, total: 4, missed: [] }); console.log('demo write', s2, w.error);
const [s3, w3] = await call('/api/remember', { learner: 'asp-abcdefgh-0123456789', topicId: 'agriculture-soil-science', score: 1, total: 4, missed: [] }); console.log('forged write', s3, w3.error);
const [s4, p] = await call('/api/plan', { learner: m.learner }); console.log('copy plan', s4, p.memories && p.memories.length, (p.memories||[]).map(x=>x.from).slice(0,3), p.withMemory && p.withMemory.focus.map(f => f.topic).join(' | '));
const [s5, c] = await call('/api/coach', { learner: m.learner }); console.log('coach', s5, JSON.stringify(c).slice(0, 500));
process.exit(0);
