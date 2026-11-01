const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../skills/buct-finalhelp/assets/quiz-app/bank.js');
const M=require('../skills/buct-finalhelp/assets/quiz-app/math.js');
const S=require('../skills/buct-finalhelp/assets/quiz-app/study.js');
const katex=require('../skills/buct-finalhelp/assets/quiz-app/vendor/katex/katex.min.js');
const original=require('../examples/demo-bank.json');
const fresh=()=>structuredClone(original);
test('complete example validates, including the prepared integral and fractions',()=>{
  const report=B.validate(original);assert.deepEqual(report.errors,[]);assert.equal(report.ok,true);
  assert.ok(original.questions.find(q=>q.id==='calc-3').answer.includes('\\frac'));
});
test('AI fenced output and surrounding prose can be imported without editing content',()=>{
  const raw=`以下是完整题库：\n\`\`\`json\n${JSON.stringify(original)}\n\`\`\`\n请直接导入。`;
  assert.deepEqual(B.parse(raw),original);assert.throws(()=>B.parse('不是题库'));
  assert.throws(()=>B.parse('```json\n{}\n```\n```json\n{}\n```'));
  const withCode=fresh();withCode.questions[0].explanation+=' 文字中的代码边界 ```json 不是导入包装。';assert.deepEqual(B.parse(JSON.stringify(withCode)),withCode);
});
test('append warns about repeated stems with different content and display math does not change fill matching',()=>{
  const base=B.prepare(fresh()),chunk=fresh();chunk.questions=[{...structuredClone(chunk.questions[0]),id:'similar-question',explanation:'另一份解释，须核查是否重复。'}];
  const report=B.merge(base,chunk);assert.equal(report.ok,true);assert.equal(report.added,1);assert.ok(report.warnings.some(w=>w.message.includes('现有题目')));
  const q={...structuredClone(original.questions[0]),answer:[['1/4','0.25']],answer_display:[String.raw`\(\frac{1}{4}\)`]};
  assert.equal(S.judge(q,['1/4']).correct,true);assert.equal(S.judge(q,['0.25']).correct,true);assert.match(S.reference(q),/\\frac/);
});
test('validator reports missing answers, explanations, duplicate IDs and invalid source references together',()=>{
  const bank=fresh();delete bank.questions[0].answer;bank.questions[1].explanation='';bank.questions[2].id=bank.questions[3].id;bank.questions[4].source_ids=['missing'];
  const result=B.validate(bank);assert.equal(result.ok,false);
  for(const message of ['答案','内容不能为空','ID 重复','来源'])assert.ok(result.errors.some(e=>e.message.includes(message)),message);
  const repair=B.repairPrompt(result);assert.match(repair,/questions\[0\]/);assert.match(repair,/不要编造/);assert.match(repair,/LaTeX/);
});
test('invalid formulas are reported with a field path and malformed display answers never crash import',()=>{
  const bank=fresh();bank.questions[0].explanation='错误公式 \\(\\frac{1}{\\)';bank.questions[0].answer_display=null;
  const report=B.validate(bank);assert.equal(report.ok,false);assert.ok(report.errors.some(e=>e.path.endsWith('explanation')&&e.message.includes('公式')));
});
test('append skips exact duplicates and leaves the existing course unchanged on an ID conflict',()=>{
  const base=B.prepare(fresh()),before=B.canonical(base);
  const same=B.merge(base,fresh());assert.equal(same.ok,true);assert.equal(same.skipped,original.questions.length);assert.equal(same.added,0);
  const conflict=fresh();conflict.questions[0].prompt+=' changed';
  const result=B.merge(base,conflict);assert.equal(result.ok,false);assert.equal(result.bank,null);assert.equal(B.canonical(base),before);
  const other=fresh();other.id='other-course';assert.equal(B.merge(base,other).ok,false);
});
test('append preserves existing progress and replacing one changed question resets only that question',()=>{
  const base=B.prepare(fresh()),s=S.fresh(base),question=base.questions.find(q=>q.id==='choice-1');S.submit(s,question,['A']);S.mark(s,'short-1','mastered');
  const chunk=fresh();const added={...structuredClone(chunk.questions[1]),id:'extra-1',prompt:'新增练习：'+chunk.questions[1].prompt};chunk.questions=[added];
  const merged=B.merge(base,chunk);assert.equal(merged.ok,true);assert.equal(merged.added,1);
  const restored=S.restore(merged.bank,JSON.parse(JSON.stringify(s)));assert.equal(restored.judgments['choice-1'].correct,true);assert.equal(restored.marks['short-1'],'mastered');
  const revised=structuredClone(merged.bank);revised.questions.find(q=>q.id==='choice-1').explanation+=' 修订。';
  const updated=S.restore(B.prepare(revised),restored);assert.equal(updated.judgments['choice-1'],undefined);assert.equal(updated.drafts['choice-1'],undefined);assert.equal(updated.marks['short-1'],'mastered');
});
test('standard mathematical rendering includes integral limits, a true fraction, matrices and scientific notation',()=>{
  const input=String.raw`\[E=\int_{0}^{\infty}e^{-4t}\,\mathrm{d}t=\frac{1}{4}\]`;
  assert.deepEqual(M.validate(input),[]);const token=M.split(input).tokens.find(t=>t.type==='math');
  const rendered=katex.renderToString(token.value,M.options(true));assert.match(rendered,/mfrac/);assert.match(rendered,/msubsup/);assert.match(rendered,/math/);
  for(const formula of [String.raw`\(2.5\times10^{-1}\)`,String.raw`\[\begin{bmatrix}1&2\\3&4\end{bmatrix}\]`,String.raw`\(\sqrt{x^{2}+y^{2}}\)`])assert.deepEqual(M.validate(formula),[]);
});
test('the user-provided legacy integral is displayed as math without changing its numbers',()=>{
  const input='E=∫₀^∞ e^(-4t)dt=1/4';const parsed=M.split(input);
  const token=parsed.tokens.find(t=>t.type==='math');assert.ok(token);assert.equal(token.display,true);assert.match(token.value,/\\frac\{1\}\{4\}/);assert.match(token.value,/e\^\{-4t\}/);assert.deepEqual(M.validate(input),[]);
});
test('plain HTML remains plain text and trusted external resource commands are not allowed',()=>{
  assert.deepEqual(M.split('<img src=x onerror=alert(1)>').tokens,[{type:'text',value:'<img src=x onerror=alert(1)>'}]);
  let result='';try{result=katex.renderToString(String.raw`\href{javascript:alert(1)}{x}`,M.options(false));}catch{}
  assert.doesNotMatch(result,/<a\s|<script|<img|href="javascript/i);
});
