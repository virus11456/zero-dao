# zero-dao

> 零人全自動公司框架 — A Decentralized Autonomous Organization (DAO) engine for running software companies without human day-to-day intervention.

**Repo:** https://github.com/virus11456/zero-dao
**Current version:** v0.3
**Status:** Framework complete — deployment pending

---

## 核心理念

你只需要定義**目標**，公司自己運作。

```
老闆定義 Goal（目標）
  ↓
GoalDecomposer (Claude AI) 自動拆解成任務
  ↓
TaskRouter 依能力+負載自動分配給 Agent
  ↓
AgentRunner 執行（Claude AI heartbeat）
  ↓
AutonomousLoop 監控：完成通知 / 卡住自愈
  ↓
老闆收到 Telegram 通知，不用做任何事
```

收入進來時：

```
老闆記錄收入 → ProfitDistributor 自動計算分紅
  → 按 Constitution 規則分配（再投資 / 儲備金 / 董事分紅）
  → Telegram 通知明細
```

重大決策時：

```
任何人提案 → 董事投票（72小時）
  → GovernanceEngine 自動結算
  → 通過即執行 → CEO Agent 落實
```

---

## 系統架構

```
┌──────────────────────────────────────────────────────────────┐
│                 Board（人類老闆）                             │
│  只做三件事：定 Goal / 記錄收入 / 重大決策投票              │
│  溝通管道：Telegram + REST API                               │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                      zero-dao Core                            │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  AutonomousLoop（每10分鐘）                             │ │
│  │  · 新 Goal → GoalDecomposer 拆解任務                    │ │
│  │  · 全部完成 → 標記 done，Telegram 通知                  │ │
│  │  · 全部卡住 → 自愈，重新生成替代任務                   │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                     │
│  ┌──────────────────────▼──────────────────────────────────┐ │
│  │  TaskRouter（每5分鐘）                                  │ │
│  │  · 能力匹配 + 負載平衡 → 自動分配                      │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                     │
│  ┌──────────────────────▼──────────────────────────────────┐ │
│  │  Agent Pool（Claude claude-sonnet-4-6）                          │ │
│  │  CEO · Founding Engineer · Backend Engineer · SEO Expert │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  GovernanceEngine（每小時 tally）                       │ │
│  │  · 提案管理 · 投票結算 · 自動執行通過的決議            │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  ProfitDistributor（收入記錄時觸發）                    │ │
│  │  · 按 Constitution 規則自動分配利潤                     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  PostgreSQL（Prisma）· GitHub API · Telegram Bot             │
└──────────────────────────────────────────────────────────────┘
```

---

## 核心模組

| 模組 | 說明 | 觸發時機 |
|---|---|---|
| **GoalDecomposer** | Claude 拆解目標 → milestone + tasks | Goal 建立時 |
| **AutonomousLoop** | 監控目標進度，自動自愈 | 每10分鐘 |
| **TaskRouter** | 能力匹配 + 負載平衡分配任務 | 每5分鐘 |
| **AgentRunner** | Claude heartbeat 執行器 | 任務分配時 |
| **GovernanceEngine** | 提案投票結算與執行 | 每小時 |
| **ProfitDistributor** | 利潤按比例自動分配 | 記錄收入時 |
| **Scheduler** | Cron 驅動所有上述模組 | 持續運行 |

---

## 快速開始

### 1. 安裝

```bash
git clone https://github.com/virus11456/zero-dao
cd zero-dao
npm install
cp .env.example .env
# 填入 DATABASE_URL, ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN
```

### 2. 資料庫初始化

```bash
npx prisma migrate dev --name init
npx prisma db seed
# 自動建立 Genesis Constitution + 預設 Agents
```

### 3. 啟動

```bash
npm run dev
# API server: http://localhost:3200
```

### 4. 定義你的第一個目標（這是你唯一需要做的事）

```bash
curl -X POST http://localhost:3200/api/goals \
  -H "Content-Type: application/json" \
  -d '{
    "title": "在 Bali 島度假村 SEO 每月帶來 10,000 次有機流量",
    "description": "目標市場：巴厘島豪華度假村。關鍵字：best luxury resorts bali。每週發布2篇文章。",
    "status": "planning"
  }'
```

10分鐘內，系統自動：拆解任務 → 分配給 SEO Expert → 開始執行 → Telegram 通知你進度

---

## API 總覽

| 端點 | 方法 | 說明 |
|---|---|---|
| `/health` | GET | 健康檢查 |
| `/api/dashboard` | GET | 目標 + 任務 + Agent 概覽 |
| **目標管理** | | |
| `/api/goals` | GET | 列出所有目標 |
| `/api/goals` | POST | 建立目標（觸發自動分解） |
| `/api/goals/:id` | PATCH | 更新目標狀態 |
| `/api/goals/:id/decompose` | POST | 手動觸發任務分解 |
| **任務管理** | | |
| `/api/tasks` | GET | 列出所有任務 |
| `/api/tasks` | POST | 手動建立任務 |
| `/api/tasks/:id` | GET | 任務詳情 + 留言 + 子任務 |
| `/api/tasks/:id` | PATCH | 更新任務 |
| **Agent 管理** | | |
| `/api/agents` | GET | 列出 Agents + 當前任務數 |
| `/api/agents` | POST | 新增 Agent |
| `/api/agents/:id` | PATCH | 更新 Agent 設定 |
| **治理** | | |
| `/api/constitution` | GET | 查看當前創世法規 |
| `/api/proposals` | GET/POST | 列出 / 提交提案 |
| `/api/proposals/:id` | GET | 提案詳情 + 投票 |
| `/api/proposals/:id/vote` | POST | 投票（yes/no/abstain） |
| **財務** | | |
| `/api/income` | GET/POST | 查看 / 記錄收入（自動觸發分配） |
| `/api/distributions` | GET | 查看所有利潤分配紀錄 |
| `/api/distributions/:id/line-items/:itemId/pay` | PATCH | 標記已付款 |

---

## 創世法規（Genesis Constitution）預設內容

公司啟動時自動建立，可透過提案修改：

| 條款 | 預設值 |
|---|---|
| 利潤再投資 | 40% |
| 儲備金 | 20% |
| 董事分紅 | 40% |
| 投票 Quorum | 51% 董事 |
| 投票通過門檻 | 51% 贊成票 |
| 投票窗口 | 72 小時 |
| CEO 自主上限 | 10,000 TWD/月 |

---

## Telegram 指令

| 指令 | 說明 |
|---|---|
| `/status` | 所有進行中任務 |
| `/agents` | Agent 狀態與任務數 |

---

## 技術棧

| 層級 | 技術 |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| AI | Anthropic Claude claude-sonnet-4-6 |
| ORM | Prisma + PostgreSQL |
| 排程 | node-cron |
| API | Express |
| GitHub | Octokit |
| 通知 | Telegram Bot API |
| 部署 | Railway + GitHub Actions |

---

## 部署（Railway）

1. 建立 Railway 專案 → 加入 PostgreSQL + Redis 服務
2. 設定環境變數（見 `.env.example`）
3. 在 GitHub repo Secrets 設定 `RAILWAY_TOKEN`
4. 推送到 `main` → GitHub Actions 自動部署

---

## ⚠️ 現階段問題與不足

> 誠實評估：以下是目前框架尚未完善的地方。

### 🔴 嚴重問題（影響核心功能）

1. **AgentRunner 缺少實際工具調用能力**
   - 目前 Agent 用 Claude 生成 JSON 動作（更新狀態、留言、建子任務），但**無法真正執行程式碼、呼叫 API、寫檔案**。
   - 缺少 Tool Use（function calling）整合，Agent 只能「說」要做什麼，不能真正「做」。
   - **修復方向**：整合 Anthropic Tool Use API，給每個 Agent 配置對應工具集（GitHub CLI、shell executor、web fetch）。

2. **GoalDecomposer 無法感知外部環境**
   - 拆解任務時沒有讀取現有程式碼庫、現有 Paperclip 任務、或市場資料的能力。
   - 可能產生已經完成的任務，或脫離實際的任務。
   - **修復方向**：在 decompose 前先抓取 GitHub repo 狀態、現有任務清單作為 context。

3. **AutonomousLoop 的 Goal.tasks 關聯尚未正確連結**
   - `GoalDecomposer.decompose()` 建立 Task 時沒有設定 `goalId`，導致 `goal.tasks` 永遠為空，AutonomousLoop 判斷邏輯失效。
   - **修復方向**：在 `prisma.task.create` 加入 `goalId: opts.goalId`。

### 🟡 中等問題（功能不完整）

4. **Governance quorum 邏輯過於簡化**
   - 目前 quorum 只檢查「至少1票」，不是真正的「51% 董事參與」。
   - 因為沒有「董事會成員清單」資料表，無法計算真實 quorum。
   - **修復方向**：新增 `BoardMember` 資料表，quorum 計算改為 `votedMembers / totalMembers >= quorumPercent`。

5. **沒有 Agent 認證機制**
   - REST API 完全無認證，任何人知道 URL 就能操作所有資源。
   - **修復方向**：加入 API key 或 JWT 認證 middleware。

6. **利潤分配只能手動記錄收入**
   - 需要老闆手動 `POST /api/income`，不能自動偵測收入（Stripe webhook、銀行通知等）。
   - **修復方向**：整合 Stripe webhook 或定期爬取收入報表。

7. **AgentMemory 尚未被 AgentRunner 使用**
   - `AgentMemory` 資料表已建立，但 AgentRunner 建立 context 時只讀取最近10筆，且沒有向量搜尋，記憶品質低。
   - **修復方向**：整合 `qmd` 或 pgvector 做語意搜尋。

### 🟢 輕微問題（體驗不佳）

8. **沒有 Web UI**
   - 目前只有 REST API，操作需要用 curl 或 Postman。
   - **修復方向**：加入 Next.js dashboard（目標 + 任務 + 治理 + 財務四個視圖）。

9. **Telegram 指令回應尚未實作**
   - `/status` 和 `/agents` 指令的 handler 只 emit 事件但沒有實際回應邏輯。
   - **修復方向**：在 `startCommandListener` 加入實際的 DB 查詢回應。

10. **CI/CD 只有 typecheck，沒有測試**
    - 目前 GitHub Actions 只跑 `tsc --noEmit`，沒有任何 unit/integration test。
    - **修復方向**：加入 Vitest + Prisma test client。

---

## 下一步優先順序

| 優先 | 項目 | 影響 |
|---|---|---|
| P0 | 修復 `goalId` 未設定的 bug | AutonomousLoop 才能運作 |
| P0 | 整合 Tool Use（讓 Agent 能真正執行） | 核心能力 |
| P1 | 新增 BoardMember 資料表 + 修復 quorum | 治理正確性 |
| P1 | API 認證 middleware | 安全 |
| P2 | Telegram 指令實作 | 可用性 |
| P2 | Web UI dashboard | 可用性 |
| P3 | Stripe webhook 自動收入偵測 | 自動化 |
| P3 | 測試覆蓋 | 品質 |
