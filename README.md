# BUCT FinalHelp

**原 AI 出题时一次性备好答案与详细解析，网页点击即看，不显示分数。**

把课程资料交给运行这个 Skill 的 AI，它会自动梳理知识点，或按指定章节、题型、难度和数量出题。支持选择、填空、判断、简答、计算五类题型。

每道题生成时就同时完成固定参考答案、解题步骤、详细解释、自查要点、易错点和资料出处。选择、填空、判断题按预设答案本地核对，答错自动加入错题；简答和计算题自行对照。无需 AI 在线批改，不调用模型接口，也不要求 API 密钥或另选模型。

![固定答案与解析展示，截图来自自动核对更新前](docs/preview.jpg)

## 安装

```sh
git clone https://github.com/peachjam-thl/buct-finalhelp.git
cd buct-finalhelp
python scripts/install_skill.py
```

已安装本 Skill 时，更新仓库后执行 `python scripts/install_skill.py --update`。默认目录为 `$CODEX_HOME/skills`，未设置时是 `~/.codex/skills`；也支持 `--target <skills目录>`。其他 AI 客户端可将 `skills/buct-finalhelp` 放入该客户端支持的 Skill 目录。Skill 要求宿主能够读取其说明，不保证所有聊天平台都支持安装目录。

## 使用示例

提交资料后告诉当前 AI：

> 使用 $buct-finalhelp 分析这些课件，按知识点生成 20 道互动题。你在出题时同时准备好固定答案、解题步骤和详细解析。点击就能查看，不显示分数，在本地默认浏览器打开。

> 只分析第三章，出 8 道填空、6 道判断、6 道计算。保留原资料的术语和公式，填空逐空给答案，计算题写清公式、代入、运算、结果与单位。

交付物是 `analysis.md`（范围与知识点映射）、`bank.json`（题目与固定答案）、`index.html`（完整单文件网页）。扫描件分析需要宿主有 PDF/OCR 工具；网页本身不是 PDF 上传解析器。

## 打开网页

双击 [`docs/index.html`](docs/index.html) 即可离线使用原创演示题库。也可以运行：

```sh
python skills/buct-finalhelp/scripts/serve_quiz.py examples/demo-bank.json
```

服务自动通过系统默认浏览器打开页面，不指定 Chrome 或 Edge，不修改系统默认设置。Windows 使用 URL 关联，macOS 使用 `open`，Linux 使用 `xdg-open`。打开失败时提供本地地址供手动访问；自动验证或无桌面环境可使用 `--no-open`。

已生成的 HTML 文件也可运行：

```sh
python skills/buct-finalhelp/scripts/browser_open.py /absolute/path/to/index.html
```

## 练习方式

1. 按题型、章节或知识点筛选，先填写自己的答案。
2. 选择、填空和判断题填完后点击 **核对答案与解析**，立即显示对错；答错自动加入错题。选择题按正确选项集合，填空按每空给定答案及别名，判断按预设真假核对。空白答案不判错。
3. 简答、计算题点击 **查看答案与解析**，自行对照并选择 **我已掌握** 或 **加入错题**。五类题都立即显示原 AI 预先准备的答案、步骤和详细解析，无需网络或模型在线。
4. 筛选错题并重新练习；可保存、导入或导出学习进度。

页面不显示单题分值、总分或得分。顶部统计为已查看解析、已掌握（客观题核对正确或主观题自评）、待复习。错题改对后保留历史记录，同时不再计入待复习。填空仅忽略首尾空格和全角 ASCII，保留大小写、内部空格与有意义符号；接受的同义写法由原 AI 预先列入答案。没有模糊匹配或在线语义评判。

用户另外要求时，当前 AI 可以在对话里详细判断某个回答；这不影响网页独立练习。实际题库应忠于用户资料；固定答案仍需出题 AI 核验，不能视为绝对无误。

## 自建题库与验证

题库格式见 [说明](skills/buct-finalhelp/references/bank-format.md)，完整示例见 [demo-bank.json](examples/demo-bank.json)。

```sh
python skills/buct-finalhelp/scripts/build_quiz.py private/bank.json --output private/index.html
python -m unittest discover -s tests -v
node --test tests/study.test.cjs
```

Python 3.10+，无第三方运行依赖；Node.js 只用于开发验证。模板支持纯文本、换行和 Unicode 公式，未附完整 LaTeX 渲染器。学习进度保存在当前浏览器，导出可备份；不同题库指纹和旧版评分记录不混用。

`private/`、`study-sessions/` 和学习进度文件默认被 Git 忽略。仓库仅包含代码、Skill 与原创演示，不代表真实考试范围，也不代表北京化工大学官方项目或背书。详见 [QA.md](QA.md)。MIT License。
