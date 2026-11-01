
// local harness: node serve.mjs <path> [json-body]
import worker from '../site/worker.mjs';
const [p, b] = process.argv.slice(2);
const req = new Request('http://x' + p, b ? { method: 'POST', body: b, headers: { 'content-type': 'application/json' } } : {});
const t0 = Date.now(); const r = await worker.fetch(req, process.env);
console.log(r.status, Date.now() - t0 + 'ms', (await r.text()).slice(0, 3000));
process.exit(0);
