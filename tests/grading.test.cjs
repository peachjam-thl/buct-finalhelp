const test = require('node:test');
const assert = require('node:assert/strict');
const bank = require('../examples/demo-bank.json');
const {grade} = require('../skills/buct-finalhelp/assets/quiz-app/grading.js');
const q = id => bank.questions.find(question => question.id === id);

test('single and multiple choices use exact option sets without mutating expected answers', () => {
  assert.equal(grade(q('choice-1'), ['A']).score, 2);
  assert.equal(grade(q('choice-1'), ['B']).score, 0);
  assert.equal(grade(q('choice-2'), ['D', 'A', 'B']).score, 3);
  assert.equal(grade(q('choice-2'), ['A', 'B']).score, 0);
  assert.equal(grade(q('choice-2'), ['A', 'B', 'C', 'D']).score, 0);
  assert.deepEqual(q('choice-2').answer, ['A', 'B', 'D']);
});
test('false is a valid boolean answer but a string is not', () => {
  assert.equal(grade(q('bool-1'), false).score, 1);
  assert.equal(grade(q('bool-1'), 'false').score, 0);
  assert.equal(grade(q('bool-1'), undefined).score, 0);
});
test('fill aliases give proportional credit and preserve blank order', () => {
  assert.equal(grade(q('fill-1'), ['敏感元件', '转换元件', '转换电路']).score, 3);
  assert.equal(grade(q('fill-1'), ['转换元件', '敏感元件', '转换电路']).score, 1);
  assert.equal(grade(q('fill-2'), [' ｉｒ ']).score, 1);
  assert.equal(grade(q('fill-1'), ['', '', '']).score, 0);
});
test('numeric grading supports tolerance, scientific notation, fullwidth, units and rejects code/nonfinite', () => {
  for (const value of ['2', '2e0', '２', '1.99', '2.01']) assert.equal(grade(q('calc-1'), {value, unit: 'A'}).score, 3, value);
  for (const value of ['', 'NaN', 'Infinity', '2+0', '2 A', '2.02', '1e309']) assert.equal(grade(q('calc-1'), {value, unit: 'A'}).score, 0, value);
  assert.equal(grade(q('calc-1'), {value: '2', unit: 'a'}).score, 0);
  assert.equal(grade(q('calc-1'), {value: '2', unit: '安培'}).score, 3);
});
test('zero answer uses absolute tolerance; relative tolerance scales with magnitude', () => {
  const zero = {...q('calc-1'), answer: {value: 0, unit: '', absolute_tolerance: 0.1, relative_tolerance: 0.01}};
  assert.equal(grade(zero, {value: '0.05', unit: ''}).score, 3);
  assert.equal(grade(zero, {value: '1', unit: ''}).score, 0);
  const relative = {...zero, answer: {...zero.answer, value: 100, absolute_tolerance: 0, relative_tolerance: 0.01}};
  assert.equal(grade(relative, {value: '101', unit: ''}).score, 3);
  assert.equal(grade(relative, {value: '102', unit: ''}).score, 0);
});
test('subjective keyword matches remain provisional even when keywords appear in negations', () => {
  const result = grade(q('short-1'), '敏感元件不感受被测量，转换元件不转换信号');
  assert.equal(result.provisional, true);
  assert.equal(result.method, 'rule-preliminary');
  assert.equal(grade(q('short-1'), '').score, 0);
  const calc = grade(q('calc-2'), {value: '24', unit: 'W', steps: 'P=U²/R=12²/6=24 W'});
  assert.equal(calc.provisional, true);
  assert.equal(calc.numeric.ok, true);
});
