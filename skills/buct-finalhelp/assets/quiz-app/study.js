/* Reference display and learner self-assessment only; no scoring or model calls. */
(function (root) {
  'use strict';
  function reference(q) {
    if (q.type === 'choice') return q.answer.map(id => `${id}. ${q.options.find(o => o.id === id).text}`).join('；');
    if (q.type === 'fill') return q.answer.map((aliases, i) => `第 ${i + 1} 空：${aliases.join(' / ')}`).join('\n');
    if (q.type === 'boolean') return q.answer ? '正确' : '错误';
    return q.answer;
  }
  const fresh = bank => ({version: 3, fingerprint: bank.fingerprint, drafts: {}, revealed: {}, viewed: {}, marks: {}, history: []});
  function validDraft(q, a) {
    if (q.type === 'choice') return Array.isArray(a) && new Set(a).size === a.length && a.every(id => q.options.some(o => o.id === id)) && (q.multiple || a.length <= 1);
    if (q.type === 'boolean') return typeof a === 'boolean';
    if (q.type === 'fill') return Array.isArray(a) && a.length === q.answer.length && a.every(s => typeof s === 'string' && s.length <= 20000);
    return typeof a === 'string' && a.length <= 20000;
  }
  function restore(bank, raw) {
    if (!raw || raw.version !== 3 || raw.fingerprint !== bank.fingerprint) throw new Error('需要同一题库的新版自评进度；旧评分或批改记录不能直接导入。');
    const state = fresh(bank); const ids = new Set(bank.questions.map(q => q.id));
    for (const q of bank.questions) {
      if (validDraft(q, raw.drafts?.[q.id])) state.drafts[q.id] = raw.drafts[q.id];
      if (raw.revealed?.[q.id] === true) state.revealed[q.id] = true;
      if (raw.viewed?.[q.id] === true || state.revealed[q.id]) state.viewed[q.id] = true;
      if (['mastered', 'review'].includes(raw.marks?.[q.id])) {state.marks[q.id] = raw.marks[q.id]; state.viewed[q.id] = true;}
    }
    state.history = [...new Set((Array.isArray(raw.history) ? raw.history : []).filter(id => ids.has(id)))];
    for (const [id, mark] of Object.entries(state.marks)) if (mark === 'review' && !state.history.includes(id)) state.history.push(id);
    return state;
  }
  function mark(state, id, value) {
    if (!['mastered', 'review'].includes(value)) throw new Error('无效的自评状态');
    state.marks[id] = value; state.revealed[id] = true; state.viewed[id] = true;
    if (value === 'review' && !state.history.includes(id)) state.history.push(id);
  }
  function retry(state) {
    state.history.forEach(id => {delete state.drafts[id]; delete state.revealed[id]; delete state.viewed[id]; delete state.marks[id];});
  }
  function stats(state) {
    return {viewed: Object.values(state.viewed).filter(Boolean).length,
      mastered: Object.values(state.marks).filter(m => m === 'mastered').length,
      review: state.history.filter(id => state.marks[id] !== 'mastered').length};
  }
  root.FinalHelpStudy = {reference, fresh, validDraft, restore, mark, retry, stats};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FinalHelpStudy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
