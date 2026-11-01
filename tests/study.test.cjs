const test = require('node:test');
const assert = require('node:assert/strict');
const bank = {...require('../examples/demo-bank.json'), fingerprint:'1234567890abcdef12345678'};
const S = require('../skills/buct-finalhelp/assets/quiz-app/study.js');
const q = id => bank.questions.find(q => q.id === id);
test('fixed answers for all types come straight from the authored bank', () => {
  assert.match(S.reference(q('fill-1')), /第 1 空：敏感元件/);
  assert.equal(S.reference(q('bool-1')), '错误');
  assert.equal(S.reference(q('choice-1')), 'A. 敏感元件');
  for(const id of ['short-1','calc-1','calc-2']) assert.equal(S.reference(q(id)),q(id).answer);
});
test('viewing explanations does not imply mastery or manufacture a judgement', () => {
  const s=S.fresh(bank); s.revealed['short-1']=true; s.viewed['short-1']=true;
  assert.deepEqual(S.stats(s),{viewed:1,mastered:0,review:0});
  assert.equal(s.score,undefined); assert.equal(s.results,undefined);
});
test('self-assessment maintains a unique mistake history and mastery can be revised', () => {
  const s=S.fresh(bank); S.mark(s,'fill-1','review'); S.mark(s,'fill-1','review');
  assert.deepEqual(s.history,['fill-1']); assert.equal(S.stats(s).review,1);
  S.mark(s,'fill-1','mastered'); assert.equal(S.stats(s).mastered,1); assert.equal(S.stats(s).review,0);
  assert.deepEqual(s.history,['fill-1']);
});
test('retry clears only historical mistakes and hides their prepared explanations', () => {
  const s=S.fresh(bank); S.mark(s,'fill-1','review'); S.mark(s,'short-1','mastered'); s.drafts['fill-1']=['a','b','c'];
  S.retry(s); assert.equal(s.revealed['fill-1'],undefined); assert.equal(s.drafts['fill-1'],undefined);
  assert.equal(s.marks['short-1'],'mastered'); assert.equal(S.stats(s).review,1);
});
test('restoring keeps false and partial drafts but rejects old scores and a different bank', () => {
  const s=S.fresh(bank); s.drafts['bool-1']=false; s.drafts['fill-1']=['','','']; S.mark(s,'fill-1','mastered'); delete s.revealed['fill-1'];
  const restored=S.restore(bank,JSON.parse(JSON.stringify(s)));
  assert.equal(restored.drafts['bool-1'],false); assert.equal(restored.revealed['fill-1'],undefined); assert.equal(S.stats(restored).viewed,1);
  assert.throws(()=>S.restore(bank,{...s,version:1})); assert.throws(()=>S.restore(bank,{...s,fingerprint:'other'}));
});
