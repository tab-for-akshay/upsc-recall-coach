
import worker from '../site/worker.mjs';
const call = async (p, b) => { const r = await worker.fetch(new Request('http://x' + p, b ? { method: 'POST', body: JSON.stringify(b) } : {}), process.env); return [r.status, await r.json()]; };
const L = process.argv[2] || 'demo-aspirant-01';
const [s, plan] = await call('/api/plan', { learner: L });
console.log('plan', s, plan.memories.length, JSON.stringify(plan.withMemory.focus.map(f => [f.topic, f.recent, f.dueIn, f.trend, f.repeatMisses])), '\nCOACH', JSON.stringify(plan.withMemory.coach));
const [s2, q] = await call('/api/quiz', { learner: L, topicId: 'botany-plant-physiology', lang: 'en' });
console.log('quiz', s2, JSON.stringify(q.target), q.model, JSON.stringify(q.questions.map(x => [x.concept, x.q.slice(0, 90)])));
process.exit(0);
