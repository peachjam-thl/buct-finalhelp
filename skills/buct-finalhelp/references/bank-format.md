# 固定答案题库 v2

`examples/demo-bank.json` 是完整示例。题目、答案、解析均由调用 Skill 的同一个 AI 预先写好，页面只呈现内容与保存自评，不在答题时生成答案。

顶层：`version:2`、`id`、`title`、`sources`、`questions`；可选 `subtitle`、`author`。`author` 如实标记出题者；不知道确切模型名称时用“当前出题 AI”，无需选择模型。

来源：`id`、`title`、`locator`、`excerpt`，均为非空字符串。位置真实可复查，摘录支持题目。无用户资料时示例必须写明为自编材料。

每题必填：

- 唯一 `id`（字母/数字开头，后接字母、数字、短横线或下划线）、`type`、`chapter`、`knowledge` 非空列表。
- `difficulty` 为基础/进阶/综合，`prompt` 题干，`source_ids` 关联有效资料。
- `answer` 为题型对应的固定答案，`explanation` 为完整解释。
- `solution_steps` 为至少一项的必要解题步骤；`checkpoints` 为至少一项自查要点；`common_mistakes` 为至少一项具体易错点。全部是字符串列表，不带分值。

| type | answer | 其他字段 |
| --- | --- | --- |
| choice | 选项 ID 列表，如 `["A"]` | `options:[{id,text},…]`，`multiple:true/false` |
| fill | 逐空答案及等价表述，如 `[["敏感元件"],["转换元件"]]` | 网页按空分别展示参考答案，不强行判错同义表达 |
| boolean | 布尔值 `true/false` | 解析讲清命题成立或不成立的条件 |
| short | 完整参考答案字符串 | 步骤和自查要点覆盖关键结论，不只列关键词 |
| calculation | 包含数值和单位的固定答案字符串，如 `"I=2 A"` | 步骤明确公式、代入、运算、结果及单位；允许说明等价解法 |

不设置 `points`、`score`、`rubric`、`keywords` 等评分配置。网页不执行学生表达式，不请求任何模型服务。题干按纯文本/Unicode 显示，支持换行，未附完整 LaTeX 渲染器。

题库指纹随题目或答案内容变化，防止错用旧进度。进度 v3 保存草稿、已展开解析、用户自评与历史错题，不包含 AI 批改请求或得分。旧版自动评分记录不可直接导入为新自评记录。
