// UPSC Recall Coach front end. Built by Tab, an AI assistant, for team lead Akshay Wagh.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DEMO = 'demo-aspirant-01';
const okId = (s) => /^[a-z0-9-]{6,40}$/.test(s);
const newId = () => 'aspirant-' + Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 7);
let learner = new URLSearchParams(location.search).get('learner') || localStorage.getItem('rc_learner') || newId();
if (!okId(learner)) learner = newId();
let topics = [], plan = null, memories = [], quiz = null;

async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({ error: 'Bad answer from server (' + r.status + ')' }));
  if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}
function setLearner(id) {
  learner = id; localStorage.setItem('rc_learner', id); $('#learner').value = id;
  history.replaceState(null, '', id === DEMO ? '?learner=' + DEMO : location.pathname);
  loadPlan();
}
const vid = (v) => `<a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.title)}</a>`;
const chips = (ids) => (ids || []).map((b) => `<span class="chip" title="Walrus blob ${esc(b)}" data-blob="${esc(b)}">mem ${esc(b.slice(0, 6))}…</span>`).join('');

function renderPlan(prev) {
  const off = plan.withoutMemory, on = plan.withMemory;
  $('#planOff').innerHTML = off.focus.map((f, i) => `<div class="item"><b>${i + 1}. ${esc(f.topic)}</b><span class="small">${esc(f.subject)}</span><br>${f.videos.map(vid).join('<br>')}</div>`).join('') + `<p class="small">${esc(off.note)}</p>`;
  let h = '';
  if (on.focus.length) h += on.focus.map((f, i) => `<div class="item"><b>${i + 1}. ${esc(f.topic)} <span class="acc">${f.accuracy}% over ${f.attempts} Qs</span></b>` +
    (f.revise.length ? `<span class="small">Revise: ${f.revise.map(esc).join(' · ')}</span><br>` : '') + f.videos.map(vid).join('<br>') +
    `<div>${chips(f.because)}</div></div>`).join('');
  else h += `<p class="small">${on.memoriesUsed ? 'No weak topic yet: everything you practised is at 75% or better.' : 'No memories yet for this ID. Take one quiz below and watch this column change.'}</p>`;
  if (on.strong.length) h += `<p class="small">Strong: ${on.strong.map((s) => `${esc(s.topic)} <span class="acc good">${s.accuracy}%</span>`).join(' ')}</p>`;
  if (on.tryNext.length) h += `<p class="small">Not practised yet: ${on.tryNext.map((t) => esc(t.topic)).join(', ')}</p>`;
  if (on.language === 'hi') h += `<p class="small">Remembered: you prefer Hindi, so quizzes start in Hindi.</p>`;
  $('#planOn').innerHTML = h;
  $('#planStatus').textContent = `${on.memoriesUsed} memor${on.memoriesUsed === 1 ? 'y' : 'ies'} recalled from Walrus for ${learner}.` + (learner === DEMO ? ' (Demo learner: Tab seeded 9 practice results on 1 Nov 2026 so you can see a plan with history. Take a quiz to add your own.)' : '');
  if (prev) {
    const a = prev.focus.map((f) => f.topic + ' ' + f.accuracy + '%').join(', ') || 'nothing', b = on.focus.map((f) => f.topic + ' ' + f.accuracy + '%').join(', ') || 'nothing';
    const d = $('#planDiff'); d.hidden = false;
    d.textContent = a === b ? `Plan re-checked against ${on.memoriesUsed} memories: focus unchanged (${b}).` : `Your plan changed after this quiz. Before: ${a}. Now: ${b}.`;
  }
  const first = on.focus[0] || on.tryNext[0]; if (first && !quiz) $('#topic').value = first.topicId;
  if (on.language === 'hi') $('#lang').value = 'hi';
}
function renderMems(found) {
  $('#mems').innerHTML = memories.map((m) => {
    const f = found && found[m.blob_id];
    const chain = !found ? '' : f ? `<br><span class="ok">✓ on Sui mainnet</span> · object <a class="mono" href="https://suiscan.xyz/mainnet/object/${esc(f.suiObject)}" target="_blank" rel="noopener">${esc(f.suiObject.slice(0, 10))}…</a> · tx <a class="mono" href="https://suiscan.xyz/mainnet/tx/${esc(f.tx)}" target="_blank" rel="noopener">${esc(String(f.tx).slice(0, 8))}…</a> · ${f.size} bytes · certified epoch ${esc(f.certifiedEpoch)}, stored to epoch ${esc(f.storedUntilEpoch)}`
      : `<br><span class="no">not found in the first pages of Blob objects yet</span>`;
    return `<li id="m-${esc(m.blob_id)}">${esc(m.text.replace(/\s*\[[^\]]*\]/g, ''))}<br><span class="mono small">blob ${esc(m.blob_id)}</span>${chain}</li>`;
  }).join('') || '<li class="small">No memories yet.</li>';
}
async function loadPlan(prevOn) {
  $('#planStatus').innerHTML = '<span class="spin"></span>Recalling memories from Walrus…';
  try {
    plan = await api('/api/plan', { learner });
    memories = (plan.memories || []).filter((m) => m.blob_id);
    renderPlan(prevOn); renderMems(); $('#chain').textContent = '';
  } catch (e) { $('#planStatus').textContent = 'Could not recall memories: ' + e.message; }
}
async function verify() {
  const b = $('#verify'); b.disabled = true; $('#chain').innerHTML = '<span class="spin"></span>Reading Sui mainnet through Tatum…';
  try {
    const r = await api('/api/receipts', { blobIds: memories.map((m) => m.blob_id) });
    $('#chain').innerHTML = `Read via ${esc(r.via)} in ${r.ms} ms. Chain ${esc(r.chainIdentifier)}. MemWal account <a class="mono" href="https://suiscan.xyz/mainnet/object/${esc(r.account.objectId)}" target="_blank" rel="noopener">${esc(r.account.objectId.slice(0, 10))}…</a> (version ${esc(r.account.version)}, ${r.account.active ? 'active' : 'inactive'}, ${r.account.delegateKeys} delegate key). <b>${r.blobs.verified} of ${r.blobs.asked}</b> memories found as Blob objects on Sui.`;
    renderMems(r.blobs.found);
  } catch (e) { $('#chain').textContent = 'Check failed: ' + e.message; }
  b.disabled = false;
}
async function startQuiz() {
  const b = $('#start'); b.disabled = true; $('#result').hidden = true;
  const f = $('#quiz'); f.hidden = false; f.innerHTML = '<p><span class="spin"></span>Writing 4 questions…</p>';
  try {
    quiz = await api('/api/quiz', { topicId: $('#topic').value, lang: $('#lang').value });
    f.innerHTML = quiz.questions.map((q, i) => `<div class="q"><p>${i + 1}. ${esc(q.q)}</p>` + q.options.map((o, j) =>
      `<label class="opt"><input type="radio" name="q${i}" value="${j}" required> <span>${esc(o)}</span></label>`).join('') + `</div>`).join('') +
      `<button type="submit">Check answers and remember</button> <span class="small">Questions by ${esc(quiz.model)}</span>`;
  } catch (e) { f.innerHTML = `<p class="no">${esc(e.message)}. Try again in a moment.</p>`; quiz = null; }
  b.disabled = false;
}
async function submitQuiz(ev) {
  ev.preventDefault(); if (!quiz) return;
  const f = $('#quiz'); let score = 0; const missed = [];
  quiz.questions.forEach((q, i) => {
    const pick = +f.querySelector(`input[name=q${i}]:checked`).value;
    const opts = f.querySelectorAll(`input[name=q${i}]`);
    opts.forEach((o, j) => { o.disabled = true; const l = o.closest('.opt'); if (j === q.answer) l.classList.add('right'); else if (j === pick) l.classList.add('wrong'); });
    if (pick === q.answer) score++; else missed.push(q.concept);
    opts[0].closest('.q').insertAdjacentHTML('beforeend', `<p class="explain">${pick === q.answer ? '✓' : '✗'} ${esc(q.explain || '')}</p>`);
  });
  f.querySelector('button[type=submit]').remove();
  const r = $('#result'); r.hidden = false;
  r.innerHTML = `<p><b>${score}/4.</b> ${missed.length ? 'Missed: ' + missed.map(esc).join(', ') + '.' : 'No misses.'}</p><p><span class="spin"></span>Saving this to Walrus Memory on Sui mainnet (about 20 s)…</p>`;
  const prevOn = plan && plan.withMemory;
  try {
    const m = await api('/api/remember', { learner, topicId: quiz.topic.id, score, total: quiz.questions.length, missed, lang: $('#lang').value });
    r.innerHTML = `<p><b>${score}/4.</b> Remembered: “${esc(m.text.replace(/\s*\[[^\]]*\]/g, ''))}”</p><p class="small">Walrus blob <span class="mono">${esc(m.blob_id || 'pending')}</span></p>`;
    quiz = null; await loadPlan(prevOn); $('#planCard').scrollIntoView({ behavior: 'smooth' });
  } catch (e) { r.innerHTML += `<p class="no">Not saved: ${esc(e.message)}</p>`; }
}
document.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) { const el = document.getElementById('m-' + c.dataset.blob); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); verify(); } } });
$('#use').onclick = () => { const v = $('#learner').value.trim().toLowerCase(); if (okId(v)) setLearner(v); else alert('Use 6–40 characters: a–z, 0–9 and dashes.'); };
$('#demo').onclick = () => setLearner(DEMO);
$('#fresh').onclick = () => setLearner(newId());
$('#start').onclick = startQuiz; $('#quiz').onsubmit = submitQuiz; $('#verify').onclick = verify;
(async () => {
  $('#learner').value = learner; localStorage.setItem('rc_learner', learner);
  try { topics = (await api('/api/topics')).topics; } catch (e) { topics = []; }
  const g = {}; topics.forEach((t) => (g[t.subject] ||= []).push(t));
  $('#topic').innerHTML = Object.entries(g).map(([s, ts]) => `<optgroup label="${esc(s)}">${ts.map((t) => `<option value="${esc(t.id)}">${esc(t.topic)}</option>`).join('')}</optgroup>`).join('');
  loadPlan();
})();
