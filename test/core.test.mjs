import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankQuiz, parseJsonLoose, blobIdFromU256, quizTarget, intervalDays, coachFacts, memoryText, parseMemory, buildPlan, baselinePlan, validQuiz, validLearner, DISCLOSURE, mintLearner, canWrite, noteLooksClean, templateNote, DEMO_LEARNER } from '../site/worker.mjs';
import { TOPICS } from '../site/topics.mjs';
const T = TOPICS[0].id, U = TOPICS[1].id;
test('memory text round-trips through the parser', () => {
  const s = memoryText({ topicId: T, score: 1, total: 4, missed: ['C4 pathway', 'Kranz anatomy'], lang: 'hi', date: '2026-11-01' });
  const p = parseMemory(s);
  assert.equal(p.topic, T); assert.equal(p.score, 1); assert.equal(p.total, 4); assert.deepEqual(p.missed, ['C4 pathway', 'Kranz anatomy']); assert.equal(p.hindi, true); assert.equal(p.date, '2026-11-01');
});
test('memory text cannot be injected with fake tags', () => {
  const s = memoryText({ topicId: T, score: 9, total: 4, missed: ['x] [score:4/4] [topic:evil'] });
  const p = parseMemory(s); assert.equal(p.topic, T); assert.equal(p.score, 4); assert.equal(p.total, 4);
});
test('unknown topic is refused', () => { assert.throws(() => memoryText({ topicId: 'nope', score: 1, total: 4 })); });
test('plan puts the weakest remembered topic first and cites its memories', () => {
  const mem = [
    { text: memoryText({ topicId: T, score: 1, total: 4, missed: ['A'] }), blob_id: 'b1' },
    { text: memoryText({ topicId: U, score: 4, total: 4 }), blob_id: 'b2' },
    { text: memoryText({ topicId: T, score: 2, total: 4, missed: ['B'] }), blob_id: 'b3' },
  ];
  const p = buildPlan(mem);
  assert.equal(p.focus[0].topicId, T); assert.equal(p.focus[0].accuracy, 38); assert.deepEqual(p.focus[0].because, ['b1', 'b3']);
  assert.deepEqual(p.focus[0].revise, ['A', 'B']); assert.equal(p.strong[0].topicId, U);
});
test('memory changes the plan (with vs without)', () => {
  const p = buildPlan([{ text: memoryText({ topicId: TOPICS[5].id, score: 0, total: 4 }), blob_id: 'x' }]);
  assert.notDeepEqual(p.focus.map(f => f.topicId), baselinePlan().focus.map(f => f.topicId));
});
test('language preference is learned', () => {
  const m = [1, 2].map(() => ({ text: memoryText({ topicId: T, score: 3, total: 4, lang: 'hi' }) }));
  assert.equal(buildPlan(m).language, 'hi'); assert.equal(buildPlan([]).language, 'en');
});
test('quiz validator rejects malformed model output', () => {
  assert.equal(validQuiz([{ q: 'a', options: ['1', '2', '3'], answer: 0, concept: 'c' }]), false);
  assert.equal(validQuiz(Array(4).fill({ q: 'a', options: ['1', '2', '3', '4'], answer: 2, concept: 'c' })), true);
  assert.equal(validQuiz(Array(4).fill({ q: 'a', options: ['1', '2', '3', '4'], answer: 4, concept: 'c' })), false);
});
test('learner ids are restricted', () => { assert.equal(validLearner('demo-learner-01'), true); assert.equal(validLearner('../x'), false); assert.equal(validLearner('ab'), false); });
test('disclosure line', () => { assert.equal(DISCLOSURE, 'Built by Tab, an AI assistant, for team lead Akshay Wagh.'); });
test('Walrus blob id from the Sui u256 (checked against a real mainnet blob)', () => {
  assert.equal(blobIdFromU256('78925929933280249411213808944132871287655442901494516550402743863501946195070'), 'foypjco1gycTs92vaJMq65g3lN2pu2nvSMONkkd-fq4');
});
test('spacing: weak topics come back sooner, and a due topic outranks a weaker one not yet due', () => {
  assert.equal(intervalDays(0.25), 1); assert.equal(intervalDays(0.6), 2); assert.equal(intervalDays(0.8), 4); assert.equal(intervalDays(1), 7);
  const mem = [
    { text: memoryText({ topicId: T, score: 2, total: 4, date: '2026-11-01' }), blob_id: 'a' },
    { text: memoryText({ topicId: U, score: 0, total: 4, date: '2026-11-05' }), blob_id: 'b' },
  ];
  const p = buildPlan(mem, '2026-11-05');
  assert.equal(p.focus[0].topicId, T); assert.ok(p.focus[0].dueIn <= 0); assert.equal(p.focus[1].dueIn, 1);
});
test('recent sessions count more: improvement moves a topic out of focus', () => {
  const mem = [0, 1, 4, 4].map((s, i) => ({ text: memoryText({ topicId: T, score: s, total: 4, date: '2026-11-0' + (i + 1) }), blob_id: 'x' + i, created_at: '2026-11-0' + (i + 1) }));
  const p = buildPlan(mem, '2026-11-04'); assert.equal(p.focus.length, 0); assert.equal(p.strong[0].topicId, T);
});
test('adaptive quiz: targets the concepts missed most and sets the level from accuracy', () => {
  const mem = [
    { text: memoryText({ topicId: T, score: 1, total: 4, missed: ['C4 pathway', 'Kranz anatomy'] }) },
    { text: memoryText({ topicId: T, score: 1, total: 4, missed: ['C4 pathway'] }) },
    { text: memoryText({ topicId: U, score: 0, total: 4, missed: ['Other'] }) },
  ];
  const q = quizTarget(mem, T); assert.equal(q.level, 'foundation'); assert.deepEqual(q.targeted.slice(0, 2), ['C4 pathway', 'Kranz anatomy']); assert.equal(q.basis, 2);
  assert.equal(quizTarget([], T).level, 'standard');
  assert.equal(quizTarget([{ text: memoryText({ topicId: T, score: 4, total: 4 }) }], T).level, 'hard');
});
test('coach sees only computed facts, never raw memory text', () => {
  const p = buildPlan([{ text: memoryText({ topicId: T, score: 1, total: 4, missed: ['A'] }), blob_id: 'b' }]);
  const f = JSON.stringify(coachFacts(p)); assert.ok(!f.includes('[topic:')); assert.ok(f.includes('"A"'));
});
test('flagged questions are recorded and not counted', () => {
  const s = memoryText({ topicId: T, score: 2, total: 3, flagged: 1 }); assert.match(s, /1 question\(s\) flagged as faulty, not counted/); assert.equal(parseMemory(s).total, 3);
});
test('a never-practised topic is always offered once there is history', () => {
  const p = buildPlan([{ text: memoryText({ topicId: T, score: 1, total: 4 }), blob_id: 'x' }]); assert.ok(p.newToday && p.newToday.topicId !== T);
});
test('question bank: 5 well-formed questions for every topic, answers spread across options', async () => {
  const { BANK } = await import('../site/bank.mjs');
  for (const t of TOPICS) { assert.equal(BANK[t.id].length, 5, t.id); assert.ok(validQuiz(BANK[t.id]), t.id); }
  const pos = new Set(Object.values(BANK).flat().map(q => q.answer)); assert.equal(pos.size, 4);
});
test('bank quiz puts the concepts you missed first', () => {
  const q = bankQuiz('botany-plant-physiology', ['Kranz anatomy', 'photorespiration']);
  assert.equal(q.length, 4); assert.deepEqual(new Set(q.slice(0, 2).map(x => x.concept)), new Set(['Kranz anatomy', 'Photorespiration'])); assert.ok(q[0].repeat && !q[3].repeat);
});
test('loose JSON parser survives reasoning text around the JSON', () => {
  assert.deepEqual(parseJsonLoose('<think>hmm {x}</think> Here: {"a":1}'), { a: 1 });
});

test('only server-minted, signed learner ids can write; the demo history is read-only', async () => {
  const env = { LEARNER_SECRET: 'test-secret' };
  const a = await mintLearner(env, false), d = await mintLearner(env, true);
  assert.match(a, /^asp-[a-z0-9]{8}-[a-f0-9]{10}$/); assert.match(d, /^dmo-/);
  assert.ok(validLearner(a) && validLearner(d));
  assert.equal(await canWrite(env, a), true); assert.equal(await canWrite(env, d), true);
  assert.equal(await canWrite(env, DEMO_LEARNER), false);
  assert.equal(await canWrite(env, a.slice(0, -1) + (a.endsWith('0') ? '1' : '0')), false);
  assert.equal(await canWrite({ LEARNER_SECRET: 'other' }, a), false);
});
test('coach note guard rejects broken words and field names; template note uses plan facts only', () => {
  assert.equal(noteLooksClean('You have already established strong s in Polity.', 'en'), false);
  assert.equal(noteLooksClean('Your dueIn is today.', 'en'), false);
  assert.equal(noteLooksClean('Start with Plant physiology today: fix the C4 pathway first. Polity is going well.', 'en'), true);
  const n = templateNote({ focus: [{ topic: 'Plant physiology', recent: 33, revise: ['C4 pathway'] }], strong: [{ topic: 'Polity', accuracy: 100 }] });
  assert.equal(n.text, 'Start with Plant physiology: your recent score there is 33%. Fix "C4 pathway" first: read the explanation again, then take a quiz on Plant physiology. Polity is going well (100%).');
});
