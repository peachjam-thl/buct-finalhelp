# BUCT FinalHelp

**把课程资料变成能答题、能批改、能看解析的互动刷题系统。**

这是可复用的 Codex Skill，附带实际可运行的网页模板。把课件、教材或笔记交给智能体后，可自动梳理知识点，也可指定章节、题型、数量和难度。支持 **选择、填空、判断、简答、计算** 五类题。

页面参考“期末综合互动刷题中心”的交互结构：顶部完成数、当前答对、历史错题；题型标签、章节与知识点筛选；逐题批改并在下方显示参考答案、解析和来源。进度保存在浏览器，可导出、导入、重练历史错题。桌面和手机均可使用。

![实际答题与题下解析界面](docs/preview.jpg)

## 直接体验

下载或克隆仓库，直接双击 [`docs/index.html`](docs/index.html)，即可离线练习 10 道原创演示题。也可以用本地服务器：

```sh
python skills/buct-finalhelp/scripts/serve_quiz.py examples/demo-bank.json
```

然后打开 <http://127.0.0.1:8765>。基础功能只需 Python 3.10+，无第三方运行依赖、无需 API 密钥。Node.js 仅用于开发时运行评分测试。

## 安装 Skill

```sh
git clone https://github.com/peachjam-thl/buct-finalhelp.git
cd buct-finalhelp
python scripts/install_skill.py
```

安装器默认写入当前环境使用的 `$CODEX_HOME/skills`，未设置时使用 `~/.codex/skills`，并保护已存在的同名目录。采用 `.agents/skills` 目录的客户端可显式指定：

```sh
python scripts/install_skill.py --target /absolute/path/to/.agents/skills
```

也可以直接将 `skills/buct-finalhelp` 文件夹放入客户端支持的 Skill 目录。安装后在 Codex 中输入 `$buct-finalhelp`；如列表未刷新，重新打开对话或重启客户端。目录以你的客户端版本为准，参见 [官方 Skill 文档](https://learn.chatgpt.com/docs/build-skills)。

## 使用方式

把资料提交给智能体，并输入类似下面的请求：

> 使用 $buct-finalhelp 分析这些课件，先列出知识点与资料出处，再生成 20 道互动题，覆盖选择、填空、判断、简答和计算。每题提交后在下方给出解析。

> 只分析第三章电容式传感器，出 8 道填空、6 道判断和 6 道计算题，难度以基础为主，公式和术语严格按课件。

> 根据我的错题记录找出薄弱知识点，再出 10 道不同情境的题。把尚未语义复核的简答题单独列出来。

Skill 的产物为 `analysis.md`（范围与知识点映射）、`bank.json`（可复查题库）、`index.html`（单文件练习页面）。**资料由智能体分析，页面不是把任意 PDF 拖入后就自动解析的独立应用。** 扫描资料需要调用环境有可用的 PDF/OCR 能力。

## 即时批改范围

| 题型 | 离线网页 | 可选 AI 模式 |
| --- | --- | --- |
| 单选/多选、判断 | 提交后即时判分 | 无需调用 AI |
| 填空 | 逐空别名匹配、按空给分 | 等价答案可交给智能体复核 |
| 数值计算 | 数值容差与显式单位核对 | 无需调用 AI |
| 简答、计算步骤 | **规则初评，待语义复核** | 按 rubric 语义批改、部分给分和解释 |

初评不计入“当前答对”和“历史错题”，避免关键词命中被误认为掌握。AI 失败时保留初评并明确提示失败。静态页面不直接调用模型，也不存储密钥。

需要 AI 时，在启动本地服务的环境配置 `OPENAI_API_KEY` 和 `BUCT_MODEL`，再运行上述服务命令。`BUCT_MODEL` 必须是你有权限使用、支持 Responses API 和 Structured Outputs 的模型；没有配置时服务保持本地模式。模型调用可能产生 API 费用。详见 [AI 批改说明](skills/buct-finalhelp/references/ai-grading.md)。

主观题提交时，服务将发送当前回答、题干、评分点和对应资料摘录到配置的 AI 端点。用户资料和学习记录默认留在本地；导出文件也包含学生回答，请按自己的需要保管。整个页面内有参考答案，适用于个人练习，不适用于正式考试认证。项目名称不代表北京化工大学官方项目或背书。

## 生成自己的页面

让 Skill 生成题库，或参考 [`examples/demo-bank.json`](examples/demo-bank.json) 和 [题库格式](skills/buct-finalhelp/references/bank-format.md) 编辑，然后执行：

```sh
python skills/buct-finalhelp/scripts/build_quiz.py private/bank.json --output private/index.html
```

`private/` 已被忽略，不会默认上传到 GitHub。构建时拒绝缺少来源、类型错误、错误引用、重复 ID、不正确容差或评分点总分不一致的题库。内容真实性和教学质量仍须按原始资料复核。

题干支持纯文本、换行与 Unicode 公式；本模板未附带完整 LaTeX 渲染器。计算题填写纯数值和独立单位，不执行输入表达式，也不自动换算单位。

## 结构与验证

```text
skills/buct-finalhelp/    Skill 入口、规则、构建器、服务和页面模板
examples/                原创教学示例题库
docs/index.html          可直接打开的单文件示例
scripts/install_skill.py 本地安装器
tests/                   评分、题库校验、API 契约和本地服务测试
```

```sh
python -m unittest discover -s tests -v
node --test tests/grading.test.cjs
```

仓库附 GitHub Actions 验证流程。API 测试使用模拟响应，不发送真实学生答案、不消耗模型额度。真实 API 的凭据、网络和模型权限须在使用环境验证。可选择将 `docs/` 发布到 GitHub Pages；静态托管只提供离线规则批改，AI 本地服务不随之部署。

具体完成项与验证边界见 [QA.md](QA.md)。

MIT License。欢迎通过 Issue 报告可复现问题，或提交改进评分规则、题型和资料处理流程的 PR。请勿提交无权公开的课件、完整教材、私有试卷、密钥或学生学习记录。
