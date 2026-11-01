
import worker from '../site/worker.mjs';
const call = async (p, b) => { const r = await worker.fetch(new Request('http://x' + p, b ? { method: 'POST', body: JSON.stringify(b) } : {}), process.env); return [r.status, await r.json()]; };
for (const [t, lang] of [['agriculture-soil-science', 'en'], ['botany-plant-physiology', 'hi']]) {
  const t0 = Date.now(); const [s, q] = await call('/api/quiz', { learner: 'demo-aspirant-01', topicId: t, lang });
  console.log(t, lang, s, Date.now() - t0 + 'ms', q.error || '', q.model, q.checker, 'rejected', q.rejected, 'n', q.questions && q.questions.length, JSON.stringify((q.questions || []).map(x => [x.concept, x.q.slice(0, 70), x.options[x.answer]])));
}
process.exit(0);
