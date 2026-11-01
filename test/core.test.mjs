import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blobIdFromU256, memoryText, parseMemory, buildPlan, baselinePlan, validQuiz, validLearner, DISCLOSURE } from '../site/worker.mjs';
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
