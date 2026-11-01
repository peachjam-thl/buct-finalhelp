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
  const s=S.fresh(bank); S.mark(s,'short-1','review'); S.mark(s,'short-1','review');
  assert.deepEqual(s.history,['short-1']); assert.equal(S.stats(s).review,1);
  S.mark(s,'short-1','mastered'); assert.equal(S.stats(s).mastered,1); assert.equal(S.stats(s).review,0);
  assert.deepEqual(s.history,['short-1']);
});
test('choice checks exact option sets, including missing and excess selections', () => {
  assert.equal(S.judge(q('choice-1'),['A']).correct,true);
  assert.equal(S.judge(q('choice-1'),['B']).correct,false);
  assert.equal(S.judge(q('choice-2'),['D','B','A']).correct,true);
  assert.equal(S.judge(q('choice-2'),['A','B']).correct,false);
  assert.equal(S.judge(q('choice-2'),['A','B','C','D']).correct,false);
  assert.deepEqual(q('choice-2').answer,['A','B','D']);
});
test('fill checks each preset answer or alias, allowing fullwidth ASCII and edge whitespace', () => {
  const right=[' 敏感元件 ','转换元件','转换电路'];
  assert.equal(S.judge(q('fill-1'),right).correct,true);
  const wrong=S.judge(q('fill-1'),['敏感元件','1','基本转换电路']);
  assert.equal(wrong.correct,false); assert.deepEqual(wrong.details.map(d=>d.correct),[true,false,true]);
  assert.equal(S.judge(q('fill-2'),['ＩＲ']).correct,true);
  assert.equal(S.judge(q('fill-2'),['ir']).correct,false);
  assert.equal(S.judge(q('fill-2'),['I R']).correct,false);
  assert.notEqual(S.normalizeAnswer('x²'),S.normalizeAnswer('x2'));
});
test('false is a valid boolean answer; unanswered inputs never become automatic mistakes', () => {
  assert.equal(S.judge(q('bool-1'),false).correct,true);
  assert.equal(S.judge(q('bool-1'),true).correct,false);
  for(const [id,a] of [['bool-1',undefined],['bool-1','false'],['choice-1',[]],['fill-1',['','','']]]) {
    const s=S.fresh(bank); assert.equal(S.judge(q(id),a),null); assert.equal(S.submit(s,q(id),a),false); assert.deepEqual(s.history,[]);
  }
});
test('incorrect objective answers join history automatically and corrected answers clear pending review', () => {
  const s=S.fresh(bank); S.submit(s,q('choice-1'),['B']); S.submit(s,q('choice-1'),['B']);
  assert.deepEqual(s.history,['choice-1']); assert.equal(S.stats(s).review,1);
  S.edit(s,q('choice-1'),['A']); assert.equal(s.judgments['choice-1'],undefined); assert.equal(S.stats(s).mastered,0);
  S.submit(s,q('choice-1'),['A']); assert.equal(S.stats(s).mastered,1); assert.equal(S.stats(s).review,0); assert.deepEqual(s.history,['choice-1']);
  S.retry(s); assert.equal(s.judgments['choice-1'],undefined); assert.equal(s.revealed['choice-1'],undefined);
});
test('short and calculation answers keep reference-only behavior without automatic wrong entries', () => {
  const s=S.fresh(bank);
  for(const id of ['short-1','calc-1']) {assert.equal(S.judge(q(id),'随意回答'),null); assert.equal(S.submit(s,q(id),'随意回答'),true);}
  assert.deepEqual(s.history,[]); assert.deepEqual(s.judgments,{}); assert.equal(S.stats(s).mastered,0);
});
test('restoring recomputes cached correctness and does not attach old judgement to an edited answer', () => {
  const s=S.fresh(bank); S.submit(s,q('bool-1'),true); s.judgments['bool-1'].correct=true;
  const restored=S.restore(bank,JSON.parse(JSON.stringify(s)));
  assert.equal(restored.judgments['bool-1'].correct,false); assert.equal(S.stats(restored).review,1);
  const changed=JSON.parse(JSON.stringify(s)); changed.drafts['bool-1']=false;
  assert.equal(S.restore(bank,changed).judgments['bool-1'],undefined);
  const legacy={...s,version:3}; delete legacy.judgments;
  assert.equal(S.restore(bank,legacy).drafts['bool-1'],true);
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
