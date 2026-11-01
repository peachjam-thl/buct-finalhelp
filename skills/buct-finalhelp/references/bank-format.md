# 题库格式 v1

参考仓库 `examples/demo-bank.json`。Python 构建器是数据格式的可执行校验，错误时拒绝生成。

顶层必填：`version: 1`、唯一 `id`、`title`、`sources`、`questions`。

- `sources`: `id`, `title`, `locator`, `excerpt`。定位必须真实，摘录须足以支撑对应问题；可为自编教学材料，但要如实注明。
- 每题：唯一 `id`、`type`、`chapter`、非空 `knowledge` 字符串列表、`difficulty`（基础/进阶/综合）、`prompt`、正数 `points`、`source_ids`、`explanation`、`answer`。
- 不使用 HTML。题干和公式按纯文本/Unicode 显示，支持换行；复杂 LaTeX 需要另配本地渲染器并验证，模板不假装已支持完整 LaTeX。

| type | answer | 其他字段 |
| --- | --- | --- |
| choice | 非空选项 ID 列表 | `options: [{id,text},…]`；`multiple: true/false`；单选答案仅 1 个；多选全对给分 |
| fill | 每空接受答案的列表，如 `[["敏感元件"],["转换元件"],["基本转换电路","转换电路"]]` | 输入框逐空显示，不要求分隔符；按正确空比例给分；仅 NFKC、首尾空白与大小写归一，不删除有意义符号 |
| boolean | `true` 或 `false` | 不接受字符串 `"false"` |
| calculation | `{value: 2, unit: "A", absolute_tolerance: 0.01, relative_tolerance: 0}` | 可有 `unit_aliases: ["安培"]`；填写数值和单位两个框。不自动换算单位。步骤评分另加 `rubric` 与 `reference_answer` |
| short | 参考答案字符串 | 必须有 `rubric` |

`rubric: [{id, description, points, keywords: [等价关键词,…]},…]`，分值之和等于题目分值；单个评分点任一关键词命中给该点初评分，不能当作语义判分。计算题有 rubric 时按 AI/初评路径评价整个答案与步骤；数值对错仍单独提示，初评的总分不承诺可信。

数值判定：`abs(actual - expected) <= max(absolute_tolerance, relative_tolerance * abs(expected))`。不执行学生输入；不使用 `eval`，不接受 Infinity/NaN、公式和混合单位字符串。

学习记录导出包含题库指纹、题目 ID、最后答案/得分/判分方式与历史确认错题。导入仅恢复相同指纹的本机练习记录，不能用于正式考试认证。
