(function (root) {
  'use strict';
  const text = value => String(value ?? '').normalize('NFKC').trim();
  const normalize = value => text(value).toLocaleLowerCase();
  const score = (q, points, provisional = false, details = []) => ({
    score: Math.abs(points - q.points) < 1e-8 ? q.points : Number(points.toFixed(8)), max: q.points, provisional,
    method: provisional ? 'rule-preliminary' : 'local', details
  });
  function numeric(q, input) {
    const raw = text(input?.value);
    const valid = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw);
    const value = Number(raw);
    const a = q.answer;
    const unit = text(input?.unit); // SI units are case-sensitive: m != M.
    const unitOK = [a.unit, ...(a.unit_aliases || [])].some(u => text(u) === unit);
    const tolerance = Math.max(a.absolute_tolerance, a.relative_tolerance * Math.abs(a.value));
    const rounding = Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(a.value)) * 4;
    return {ok: valid && Number.isFinite(value) && Math.abs(value - a.value) <= tolerance + rounding && unitOK,
      note: !valid || !Number.isFinite(value) ? '请输入有限数值，支持科学计数法。' : !unitOK ? '单位不匹配；请按题目要求填写单位。' : '已按题库设置的误差范围核对数值。'};
  }
  function grade(q, input) {
    if (q.type === 'choice') {
      const actual = Array.isArray(input) ? [...new Set(input)].sort() : [];
      const expected = [...q.answer].sort();
      return score(q, JSON.stringify(actual) === JSON.stringify(expected) ? q.points : 0);
    }
    if (q.type === 'boolean') return score(q, typeof input === 'boolean' && input === q.answer ? q.points : 0);
    if (q.type === 'fill') {
      const details = q.answer.map((aliases, i) => ({label: `第 ${i + 1} 空`, ok: aliases.some(alias => normalize(alias) === normalize(input?.[i]))}));
      return score(q, details.filter(d => d.ok).length / details.length * q.points, false, details);
    }
    if (q.type === 'calculation' && !q.rubric) {
      const result = numeric(q, input);
      return score(q, result.ok ? q.points : 0, false, [{label: result.note, ok: result.ok}]);
    }
    // Keyword hits are an explicitly provisional aid, never semantic certification.
    const answer = normalize(q.type === 'short' ? input : input?.steps);
    const details = q.rubric.map(r => ({id: r.id, label: r.description,
      ok: r.keywords.some(k => answer.includes(normalize(k))), points: r.points}));
    const result = score(q, details.reduce((sum, d) => sum + (d.ok ? d.points : 0), 0), true, details);
    if (q.type === 'calculation') result.numeric = numeric(q, input);
    return result;
  }
  root.FinalHelpGrading = {grade, numeric, normalize};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FinalHelpGrading;
})(typeof globalThis !== 'undefined' ? globalThis : this);
