# BUCT FinalHelp

**把资料交给 AI，由它分析、出题、备好答案和解析，再生成可直接打开的专属练习页。**

[查看练习页效果](https://peachjam-thl.github.io/buct-finalhelp/) · [Skill 使用说明](skills/buct-finalhelp/SKILL.md)

支持选择、填空、判断、简答和计算五类题。选择/填空/判断按原 AI 给定答案本地核对，答错自动加入错题；简答/计算自行对照。没有分数、模型接口、密钥或在线批改等待。

![规范数学公式与题下解析](docs/preview.jpg)

## 学生怎么用

1. 在支持 Skill 的 AI 客户端安装 `skills/buct-finalhelp`，或把其中的说明与题库格式交给能生成 HTML 文件的 AI。
2. 把课件、笔记或复习资料发给该 AI，说明需要的章节、题型和数量；也可让它自动分析。
3. AI 读取资料，生成题目、固定答案与详细解析，交付**已经装入题目的专属练习页**。有本地工具时自动在系统默认浏览器打开；其他场景交付可下载的 HTML 文件或可访问地址。
4. 打开即可答题、查看题下解析和重练错题。无需自己导入题库、粘贴 JSON 或运行程序。

题目与答案来自接收资料的 AI，不另接模型服务。GitHub 网页是原创示例的效果展示；实际资料在 AI 对话中提交。各 AI 产品的文件生成、资料识别和 Skill 安装能力不同；只能输出文字的产品无法完成练习页交付，不能宣称已经生成或打开页面。

点击 **保存练习页** 可得到带当前课程、数学排版资源和字体的单文件 HTML。答题记录保存在当前浏览器，可单独导出和恢复；分享的页面不会自动包含你的答题记录。

## 继续出题和更新

- 让 AI 继续生成下一批或修正答案，由它合并、复核并重新生成原专属页。
- 同一课程和题目使用稳定 ID；未修改题目的进度仍保留，修改过的题目单独重置。
- 题型、章节、知识点和错题筛选保留，浏览器刷新可继续练习；更换浏览器或地址时可用进度备份恢复。

## 数学公式

题干、选项、参考答案、解题步骤和解析均使用随页面打包的 KaTeX 排版，支持积分上下限、真正的分式、上下标、根号、矩阵、科学计数法等。例如：

$$E=\int_{0}^{\infty} e^{-4t}\,\mathrm{d}t=\frac{1}{4}$$

公式和字体都在单文件内，离线可用，不需要连接 CDN。AI 应输出行内 `\(...\)` 或独立 `\[...\]` 公式；JSON 中反斜杠要转义。不支持的命令、缺失括号等由出题 AI 在交付前修正。

对 `E=∫₀^∞ e^(-4t)dt=1/4` 这一明确的旧式模式也做了有限的无损展示转换；不会猜测任意混合简写的含义。填空用于判定的普通答案与数学展示可分开设置，排版不会改变可接受答案。

## 给 AI 的使用要求

支持 Skill 的客户端可安装 `skills/buct-finalhelp`。普通聊天场景可把 `SKILL.md` 与 [题库格式](skills/buct-finalhelp/references/bank-format.md) 提交给具备文件生成能力的 AI，让它直接交付专属 HTML。

> 使用 buct-finalhelp 分析这些资料，按章节和知识点出题，同时备好固定答案、详细解法、自查要点和易错点。公式用规范数学排版。直接生成已装入题目的专属练习 HTML，能使用本地工具时在系统默认浏览器打开。我打开就能答题，不显示分数，选择、填空和判断题答错自动加入错题。

> 继续生成下一批，沿用相同课程 ID 和来源 ID，给新增题分配新 ID。请合并进原有专属页，让我打开就能继续练习。

Skill 还会生成 `analysis.md`，记录真实读取范围和“知识点—资料出处—题目”的映射；`bank.json` 是附带复查文件，不能替代练习页。扫描件需要宿主 AI 有可用的识别能力，题库答案应按原资料复核。

## 安装与构建（由宿主 AI 或开发者执行）

```sh
git clone https://github.com/peachjam-thl/buct-finalhelp.git
cd buct-finalhelp
python scripts/install_skill.py
```

已安装时执行 `python scripts/install_skill.py --update`。默认写入 `$CODEX_HOME/skills`，未设置时为 `~/.codex/skills`；也可指定 `--target <skills目录>`。其他 AI 客户端使用其支持的 Skill 目录，不保证所有聊天产品支持目录安装。

宿主 AI 生成完整题库后，构建已装入该课程的独立页面，或本地启动：

```sh
python skills/buct-finalhelp/scripts/build_quiz.py private/bank.json --output private/index.html
python skills/buct-finalhelp/scripts/serve_quiz.py private/bank.json
```

服务通过系统默认浏览器打开，不指定 Chrome/Edge、不改系统设置。自动验证或无桌面环境可加 `--no-open`。静态文件也可通过 `browser_open.py <index.html>` 打开。学生不需要执行这些步骤。

## 检查与边界

```sh
python -m unittest discover -s tests -v
node --test tests/*.test.cjs
```

Python 3.10+，无第三方 Python 运行依赖。KaTeX 浏览器资源已随包提供；Node.js 仅用于开发验证。不是完整 LaTeX 文档编译器，不支持外部宏包或任意 HTML。

仓库包含原创示例，不代表真实课程考试范围，也不代表北京化工大学官方项目或背书。私有资料、课程题库和学习记录默认不上传仓库。验证范围见 [QA.md](QA.md)，第三方许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。MIT License。
