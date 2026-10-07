# Tibo Reset WeChat

一个面向 Codex / ChatGPT Work 用户的无人值守额度重置提醒器。

它每 5 分钟检查一次 Tibo（[@thsottiaux](https://x.com/thsottiaux)）的公开动态，识别真正与额度有关的 reset 信号，并把时间统一换算为中国标准时间（Asia/Shanghai, UTC+8）后，通过微信通知。

## 目标

- 监控唯一主信源：Tibo / @thsottiaux
- 无需普通用户申请 X API Token：默认读取公开 Feed
- 区分：
  - **已执行重置**：reset processed / propagated / limits reset
  - **计划重置**：给出明确日期、时间、相对时间
  - **Banked reset**：备用重置额度
  - **模糊线索**：默认只记录，不打扰
- 所有时间统一显示为 **北京时间**
- 去重：同一帖子同一版本最多提醒一次
- GitHub Actions 每 5 分钟无人值守运行
- 微信通知支持：
  - Server酱
  - WxPusher
- Token 只放 GitHub Actions Secrets，不写进仓库

## 设计原则

本项目不是简单关键词匹配。只有“与 Codex / ChatGPT Work 用量有关”且“已经重置、明确计划重置或 banked reset”时才触发。

如果 Tibo 只说 “soon”“maybe”“I need to come up with something” 一类模糊内容，默认不通知，避免误报。

## 数据源

默认读取：

`https://tibo-reset-reminder-skill.vercel.app/api/feed`

该 Feed 由第三方项目维护，用于标准化 Tibo 的公开 X 内容。本项目不复制其未授权源码，只消费其公开 HTTP Feed。

可选：配置 `X_BEARER_TOKEN` 后，可在未来扩展为官方 X API 备用源。

## 微信通知配置

任选一种即可。

### 方案 A：Server酱

在仓库 Settings → Secrets and variables → Actions 中添加：

- `SERVERCHAN_SENDKEY`

项目会调用 Server酱接口，把提醒推送到绑定的微信。

### 方案 B：WxPusher

添加：

- `WXPUSHER_APP_TOKEN`
- `WXPUSHER_UIDS`

`WXPUSHER_UIDS` 多个 UID 用英文逗号分隔。

如果两种方式都配置，会同时发送；只要至少一个通道发送成功，就会记录为已通知，避免下一轮重复轰炸。

## 通知示例

```text
🔥 Tibo Reset：已执行

Tibo：the reset has been processed. Enjoy!

发帖时间（北京时间）：2026-10-07 11:35
重置时间（北京时间）：已执行（以该帖时间为确认时间）
类型：Global / Completed

原帖：https://x.com/thsottiaux/status/...
现在可以安排烧额度了。
```

计划重置示例：

```text
⏰ Tibo Reset：计划重置

Tibo：Global reset landing tomorrow 10am PST...

发帖时间（北京时间）：2026-10-02 10:14
预计重置（北京时间）：2026-10-03 01:00
原始表述：tomorrow 10am PST

原帖：https://x.com/thsottiaux/status/...
```

> 对 Tibo 常见的 “PST/PT” 口语，本项目按美国太平洋当地时间 `America/Los_Angeles` 换算，自动处理夏令时，再转换为北京时间。

## 首次运行

首次运行不会把历史记录全部轰炸给你。

默认行为：

1. 把当前 Feed 内容建立为基线；
2. 如果最新一个明确 reset 信号在最近 24 小时内，只提醒最新这一条；
3. 之后只处理新帖子或帖子新版本。

可通过环境变量调整：

- `BOOTSTRAP_NOTIFY_LATEST=false`：首次完全不提醒历史消息
- `BOOTSTRAP_MAX_AGE_HOURS=24`：首次允许提醒的最大消息年龄
- `ALERT_ON_HINTS=true`：连模糊 reset 线索也通知（默认 false）

## 手动运行

```bash
npm test
npm run monitor
```

本地测试推送前请先设置对应环境变量。

## GitHub Actions

工作流：`.github/workflows/monitor.yml`

- 定时：每 5 分钟
- 支持手动触发
- 同一时刻只允许一个监控任务运行
- 只有状态真的变化时才提交 `state/notified.json`
- Secrets 不会写入日志或仓库

## 状态文件

`state/notified.json`

只保存公开帖子 ID、文本哈希和通知状态，不保存微信 Token、账号信息或聊天内容。

## 运行边界

- GitHub Actions 的 cron 是“尽力执行”，高峰时可能出现几分钟延迟。
- 公共 Feed 不可用时，本轮直接失败并保持静默，不把“抓取失败”当成“没有 reset”。
- 任何第三方 Feed 都不是 OpenAI 官方保证；通知中始终附原帖链接供你核对。

## 项目结构

```text
.
├── .github/workflows/monitor.yml
├── src/
│   ├── classify.js
│   ├── monitor.js
│   ├── notifiers.js
│   └── time.js
├── test/
│   ├── classify.test.js
│   └── time.test.js
├── state/notified.json
└── package.json
```
