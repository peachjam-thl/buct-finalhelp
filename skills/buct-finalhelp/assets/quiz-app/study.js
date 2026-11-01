/* Local right/wrong checks for objective answers; no numeric scores or model calls. */
(function (root) {
  'use strict';
  const Banks=root.FinalHelpBank||(typeof require==='function'?require('./bank.js'):null);
  function reference(q) {
    if (q.type === 'choice') return q.answer.map(id => `${id}. ${q.options.find(o => o.id === id).text}`).join('；');
    if (q.type === 'fill') return q.answer.map((aliases, i) => `第 ${i + 1} 空：${q.answer_display?.[i] || aliases.join(' / ')}`).join('\n');
    if (q.type === 'boolean') return q.answer ? '正确' : '错误';
    return q.answer;
  }
  const objective = q => ['choice', 'fill', 'boolean'].includes(q.type);
  // Fold fullwidth ASCII only; preserve case, symbols, internal spaces and superscripts.
  const normalizeAnswer = value => String(value ?? '').normalize('NFC').replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ').trim();
  const fresh = bank => ({version: 5, bank_id:bank.id, fingerprint: bank.fingerprint,
    question_fingerprints:Object.fromEntries(bank.questions.map(q=>[q.id,Banks.questionFingerprint(bank,q)])),
    drafts: {}, revealed: {}, viewed: {}, marks: {}, judgments: {}, history: []});
  function validDraft(q, a) {
    if (q.type === 'choice') return Array.isArray(a) && new Set(a).size === a.length && a.every(id => q.options.some(o => o.id === id)) && (q.multiple || a.length <= 1);
    if (q.type === 'boolean') return typeof a === 'boolean';
    if (q.type === 'fill') return Array.isArray(a) && a.length === q.answer.length && a.every(s => typeof s === 'string' && s.length <= 20000);
    return typeof a === 'string' && a.length <= 20000;
  }
  function restore(bank, raw) {
    const modern=raw?.version===5;
    if (!raw || (modern?raw.bank_id!==bank.id:(![3,4].includes(raw.version)||raw.fingerprint!==bank.fingerprint))) throw new Error('需要同一课程的学习进度；不同课程不能混用。');
    const state = fresh(bank); const ids = new Set(bank.questions.filter(q=>!modern||raw.question_fingerprints?.[q.id]===state.question_fingerprints[q.id]).map(q => q.id));
    for (const q of bank.questions) {
      if(!ids.has(q.id))continue;
      if (validDraft(q, raw.drafts?.[q.id])) state.drafts[q.id] = raw.drafts[q.id];
      if (raw.revealed?.[q.id] === true) state.revealed[q.id] = true;
      if (raw.viewed?.[q.id] === true || state.revealed[q.id]) state.viewed[q.id] = true;
      if (['mastered', 'review'].includes(raw.marks?.[q.id])) {state.marks[q.id] = raw.marks[q.id]; state.viewed[q.id] = true;}
      const saved = raw.judgments?.[q.id];
      if (objective(q) && saved?.answerKey === JSON.stringify(state.drafts[q.id])) {
        const result = judge(q, state.drafts[q.id]);
        if (result) {state.judgments[q.id] = {...result, answerKey: saved.answerKey}; delete state.marks[q.id];}
      }
    }
    state.history = [...new Set((Array.isArray(raw.history) ? raw.history : []).filter(id => ids.has(id)))];
    for (const [id, mark] of Object.entries(state.marks)) if (mark === 'review' && !state.history.includes(id)) state.history.push(id);
    for (const [id, result] of Object.entries(state.judgments)) if (!result.correct && !state.history.includes(id)) state.history.push(id);
    return state;
  }
  function ready(q, answer) {
    if (!validDraft(q, answer)) return false;
    if (q.type === 'choice') return answer.length > 0;
    if (q.type === 'fill') return answer.every(value => normalizeAnswer(value).length > 0);
    return true;
  }
  function judge(q, answer) {
    if (!objective(q) || !ready(q, answer)) return null;
    if (q.type === 'choice') {
      const actual = [...answer].sort(), expected = [...q.answer].sort();
      return {correct: JSON.stringify(actual) === JSON.stringify(expected), details: []};
    }
    if (q.type === 'boolean') return {correct: answer === q.answer, details: []};
    const details = q.answer.map((aliases, i) => ({blank: i + 1, correct: aliases.some(alias => normalizeAnswer(alias) === normalizeAnswer(answer[i]))}));
    return {correct: details.every(d => d.correct), details};
  }
  function submit(state, q, answer) {
    const result = judge(q, answer);
    if (!validDraft(q, answer) || (objective(q) && !result)) return false;
    state.drafts[q.id] = answer; state.revealed[q.id] = true; state.viewed[q.id] = true;
    if (result) {
      state.judgments[q.id] = {...result, answerKey: JSON.stringify(answer)}; delete state.marks[q.id];
      if (!result.correct && !state.history.includes(q.id)) state.history.push(q.id);
    }
    return true;
  }
  function edit(state, q, answer) {
    if (!validDraft(q, answer)) return;
    state.drafts[q.id] = answer;
    delete state.revealed[q.id]; delete state.marks[q.id]; delete state.judgments[q.id];
  }
  function mark(state, id, value) {
    if (!['mastered', 'review'].includes(value)) throw new Error('无效的自评状态');
    state.marks[id] = value; state.revealed[id] = true; state.viewed[id] = true;
    if (value === 'review' && !state.history.includes(id)) state.history.push(id);
  }
  function retry(state) {
    state.history.forEach(id => {delete state.drafts[id]; delete state.revealed[id]; delete state.viewed[id]; delete state.marks[id]; delete state.judgments[id];});
  }
  function stats(state) {
    const mastered = id => state.judgments[id] ? state.judgments[id].correct : state.marks[id] === 'mastered';
    const ids = new Set([...Object.keys(state.judgments), ...Object.keys(state.marks)]);
    return {viewed: Object.values(state.viewed).filter(Boolean).length,
      mastered: [...ids].filter(mastered).length,
      review: state.history.filter(id => !mastered(id)).length};
  }
  root.FinalHelpStudy = {reference, fresh, validDraft, restore, mark, retry, stats, objective, normalizeAnswer, ready, judge, submit, edit};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FinalHelpStudy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
