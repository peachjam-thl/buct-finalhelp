# AI 语义批改（可选）

基础页面完全离线运行。资料分析与出题由调用 Skill 的智能体完成；浏览器不是通用 PDF/OCR 上传解析器。用户将原始资料提交给智能体，智能体建立新题库。

语义批改由本机 Python 标准库服务调用 OpenAI Responses API，使用严格 JSON Schema 返回分点评分。先在运行服务的环境中配置 `OPENAI_API_KEY`、`BUCT_MODEL`（用户有权限、支持 Responses/Structured Outputs 的模型名称），然后运行：

```text
python <skill>/scripts/serve_quiz.py <bank.json> --port 8765
```

浏览器打开打印的 `http://127.0.0.1:8765`。模型不写死；默认端点为 `https://api.openai.com/v1`。兼容服务可设置 `OPENAI_BASE_URL`，必须实现同样的 Responses 与 Structured Outputs 协议。可用 `BUCT_GRADING_TIMEOUT` 设置 5–120 秒超时，默认 45 秒。不支持的模型、连接失败或拒绝均返回待复核提示。

服务只绑定回环地址，固定提供生成的页面，不开放任意文件目录。每次启动生成随机请求令牌，校验 Host/Origin、输入大小、题目 ID 和返回分值。密钥只存在服务进程环境与发往配置端点的 Authorization 头，不放入页面、日志或导出。不要向不可信端点发送密钥。

提交的内容为：当前题干、参考答案、评分点、相关资料摘录、学生当前回答。只有主观题启用 AI；客观题不外发。它是个人练习工具，页面含答案，不是防作弊考试系统。监听外网、多用户部署、账号或收费均不在本模板范围内。

API 参考：

- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
