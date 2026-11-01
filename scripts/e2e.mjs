
import worker from '../site/worker.mjs';
const call = async (p, b) => { const r = await worker.fetch(new Request('http://x' + p, b ? { method: 'POST', body: JSON.stringify(b) } : {}), process.env); return [r.status, await r.json()]; };
const [s, plan] = await call('/api/plan', { learner: process.argv[2] || 'demo-aspirant-01' });
console.log('plan', s, plan.memories.length, plan.withMemory.focus.map(f => f.topic + ' ' + f.accuracy + '%').join(' | '));
const [s2, rc] = await call('/api/receipts', { blobIds: plan.memories.map(m => m.blob_id) });
console.log('receipts', s2, rc.ms + 'ms', JSON.stringify(rc.blobs).slice(0, 700));
process.exit(0);
