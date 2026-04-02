# zero-dao

> 零人全自動公司框架 — A Decentralized Autonomous Organization (DAO) engine that runs an entire software company without human day-to-day intervention.

**Live Dashboard:** https://zero-dao-two.vercel.app
**Repo:** https://github.com/virus11456/zero-dao
**Current version:** v0.8

---

## 核心理念

你只需要定義**目標**，公司自己運作。

```
你定義目標（Goal）
  ↓ AI 自動拆解成任務
  ↓ 自動分配給最適合的 Agent
  ↓ Agent 執行（Claude AI）
  ↓ 卡住？系統自動換策略（自愈）
  ↓ 完成後 Telegram 通知你

收入進來？
  ↓ 記錄一筆 → 自動按法規分配利潤
  ↓ Telegram 通知分紅明細

重大決策？
  ↓ 發起提案 → 董事投票
  ↓ 通過即自動執行 + 歸檔

所有決策自動記錄進檔案庫
```

---

## 系統架構

```
┌────────────────────────────────────────────────────────────────┐
│                  Board（人類老闆）                              │
│  定義目標 / 記錄收入 / 重大投票 / 查看看板                     │
│  溝通：Telegram + Web Dashboard + REST API                      │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│                       zero-dao Core                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AutonomousLoop（每10分鐘）                              │  │
│  │  · 新目標 → GoalDecomposer 自動拆解                      │  │
│  │  · 全部完成 → 標記完成 + 歸檔 + Telegram 通知           │  │
│  │  · 全卡住 → 自愈（重新生成替代任務）                    │  │
│  └─────────────────────────┬────────────────────────────────┘  │
│                            │                                     │
│  ┌─────────────────────────▼────────────────────────────────┐  │
│  │  TaskRouter（每5分鐘）                                   │  │
│  │  · 能力匹配 + 負載平衡 → 自動分配                       │  │
│  └─────────────────────────┬────────────────────────────────┘  │
│                            │                                     │
│  ┌─────────────────────────▼────────────────────────────────┐  │
│  │  Agent Pool（Claude claude-sonnet-4-6）                          │  │
│  │  CEO · Founding Eng · Backend Eng · SEO · CFO            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │GovernanceEngine│  │ProfitDistributor│  │  ArchiveService  │  │
│  │ 提案投票結算  │  │  利潤自動分配  │  │  決策自動歸檔     │  │
│  │ 每小時 tally  │  │  收入記錄觸發  │  │  永久機構記憶     │  │
│  └─────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  KnowledgeBase│  │  Ledger      │  │  Scheduler           │  │
│  │  Agent 學習  │  │  雙式記帳    │  │  所有定時任務         │  │
│  │  累積經驗    │  │  財務報表    │  │  cron 驅動           │  │
│  └─────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                                  │
│  PostgreSQL（Prisma）· GitHub API · Telegram Bot               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 核心模組

| 模組 | 功能 | 觸發時機 |
|---|---|---|
| **GoalDecomposer** | Claude 拆解目標 → milestone + tasks | 新 Goal 建立 |
| **AutonomousLoop** | 監控進度、自愈、完成歸檔 | 每10分鐘 |
| **TaskRouter** | 能力匹配 + 負載平衡分配任務 | 每5分鐘 |
| **AgentRunner** | Claude heartbeat 執行器 + 知識庫整合 | 任務分配時 |
| **KnowledgeBase** | 從任務沉澱教訓，跨 Agent 共享 | 任務完成/失敗後 |
| **GovernanceEngine** | 提案投票結算與自動執行 | 每小時 |
| **ProfitDistributor** | 收入按 Constitution 自動分配 | 收入記錄時 |
| **ArchiveService** | 決議/完成/事件自動歸檔 | 關鍵事件發生時 |
| **Ledger** | 雙式記帳，借貸必須平衡 | 財務事件時 |
| **FinancialReporter** | 損益表/資產負債表/現金流量表 | 按需/月初自動 |
| **Scheduler** | 所有 cron 驅動的定時邏輯 | 持續運行 |

---

## 快速開始

### 1. 安裝

```bash
git clone https://github.com/virus11456/zero-dao
cd zero-dao
npm install
cp .env.example .env
# 填入必要的環境變數
```

### 2. 資料庫初始化

```bash
npx prisma migrate dev --name init
npx prisma db seed
# 自動建立：Genesis Constitution、預設 Chart of Accounts、5個預設 Agent
```

### 3. 啟動後端

```bash
npm run dev
# API server: http://localhost:3200
```

### 4. 啟動前端看板

```bash
cd web
npm install
npm run dev
# Dashboard: http://localhost:3201
```

### 5. 定義你的第一個目標（這是你唯一需要做的事）

```bash
curl -X POST http://localhost:3200/api/goals \
  -H "Content-Type: application/json" \
  -d '{
    "title": "建立一個 SEO 部落格並在 Bali 島度假村關鍵字排名前三",
    "description": "目標：英文部落格，攻佔 Bali luxury resort 相關長尾關鍵字。每週2篇。",
    "status": "planning"
  }'
```

10分鐘內系統自動：拆解任務 → 分配 SEO Expert → 執行 → Telegram 通知你。

---

## 完整 API 總覽

### 目標管理
| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/goals` | GET | 列出所有目標（含任務數） |
| `/api/goals` | POST | 建立目標（觸發10分鐘內自動分解） |
| `/api/goals/:id` | PATCH | 更新目標狀態/描述 |
| `/api/goals/:id/decompose` | POST | 手動觸發 AI 任務分解 |

### 任務管理
| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/tasks` | GET | 列出所有任務（含負責 Agent） |
| `/api/tasks` | POST | 手動建立任務 |
| `/api/tasks/:id` | GET | 任務詳情 + 留言 + 子任務 |
| `/api/tasks/:id` | PATCH | 更新狀態/優先級/負責人 |

### Agent 管理
| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/agents` | GET | 所有 Agents + 當前任務負載 |
| `/api/agents` | POST | 新增 Agent |
| `/api/agents/:id` | PATCH | 更新 Agent 設定 |
| `/api/agents/:id/knowledge` | GET/POST | Agent 知識庫 |
| `/api/agents/:id/feedback` | POST | 給 Agent 回饋（影響未來行為） |

### 知識庫
| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/knowledge` | GET | 搜尋全部知識（?q=...&type=...&agentId=...） |
| `/api/knowledge/retrieve` | POST | 為指定任務取得最相關知識 |

### 治理
| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/constitution` | GET | 查看當前創世法規 |
| `/api/board` | GET/POST | 董事會成員管理 |
| `/api/proposals` | GET/POST | 列出/建立提案 |
| `/api/proposals/:id` | GET | 提案詳情 + 投票記錄 |
| `/api/proposals/:id/vote` | POST | 投票（yes/no/abstain） |

### 財務
| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/income` | GET/POST | 查看/記錄收入（自動分配利潤） |
| `/api/distributions` | GET | 所有利潤分配記錄 |
| `/api/distributions/:id/line-items/:itemId/pay` | PATCH | 標記已付款 |
| `/api/finance/accounts` | GET | 會計科目表 |
| `/api/finance/journals` | GET/POST | 日記帳查詢/手動分錄 |
| `/api/finance/income` | POST | 純記帳（不觸發分配） |
| `/api/finance/expenses` | POST | 記錄費用 |
| `/api/finance/reports/income-statement` | POST | 生成損益表 |
| `/api/finance/reports/balance-sheet` | POST | 生成資產負債表 |
| `/api/finance/reports/cash-flow` | POST | 生成現金流量表 |
| `/api/finance/reports/trial-balance` | POST | 生成試算表 |
| `/api/finance/reports` | GET | 查看歷史報表 |

### 公司檔案庫
| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/archive` | GET | 搜尋記錄（?q=...&type=...&start=...&end=...） |
| `/api/archive/:id` | GET | 單筆記錄詳情 |
| `/api/archive` | POST | 手動新增記錄（會議記錄、策略備忘等） |
| `/api/archive/stats/summary` | GET | 統計概覽 + 最近5筆 |

### 其他
| 端點 | 方法 | 說明 |
|---|---|---|
| `/health` | GET | 健康檢查（無需認證） |
| `/api/dashboard` | GET | 任務/目標/Agent 統計概覽 |
| `/api/projects` | GET/POST | 專案管理 |

---

## 創世法規（Genesis Constitution）預設內容

公司啟動時自動建立，可透過治理提案修改：

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

## 公司檔案庫（8種記錄類型）

| 類型 | 觸發時機 |
|---|---|
| 🗳️ **董事會決議** | 每次提案投票結束（含通過/否決/過期） |
| 📝 **會議記錄** | 人工新增 |
| 📜 **政策變更** | 創世法規修改時 |
| 🤖 **Agent 行動** | 重大 Agent 決策 |
| ✅ **目標達成** | 每個目標完成時（含 AI 成就摘要） |
| ⚠️ **事件記錄** | 系統事件、任務自愈 |
| 💰 **財務里程碑** | 重要財務事件 |
| 🧭 **策略備忘錄** | 人工新增 |

---

## Agent 知識庫（學習系統）

Agent 在每次任務後自動學習：

```
任務開始前：
  KB 語意檢索最相關的歷史知識 → 注入 Claude context

任務完成後：
  Claude 自動萃取 1-3 個教訓 → 存入知識庫

教訓類型：
  📚 lesson   — 從任務學到的教訓（跨 Agent 共享）
  🔁 pattern  — 反覆出現的模式（跨 Agent 共享）
  📎 reference — 有用的外部資源
  💬 feedback  — 老闆直接給的回饋

老闆給回饋：
  POST /api/agents/:id/feedback
  { "feedback": "SEO 文章要超過 1500 字" }
  → Agent 下次執行時自動看到並調整行為
```

---

## Telegram 指令

| 指令 | 功能 |
|---|---|
| `/start` | 歡迎訊息 + 所有指令列表 |
| `/status` | 任務狀態（完成/進行中/待辦/阻塞） |
| `/agents` | 所有 Agent 狀態 + 任務負載 |
| `/goals` | 目標進度（含 ASCII 進度條） |
| `/finance` | 財務摘要（現金/本月收入/待付分紅） |
| `/report` | 即時生成本月損益表 |

---

## Scheduler 定時排程

| 任務 | 頻率 |
|---|---|
| 任務路由（分配新任務） | 每5分鐘 |
| 自主循環（目標監控+自愈） | 每10分鐘 |
| 卡任務偵測（自動標記阻塞） | 每30分鐘 |
| 治理提案結算 | 每小時 |
| 每日摘要（任務+財務） | 每天早9點 |
| 月度財務報表 | 每月1日早8點 |

---

## Web Dashboard（https://zero-dao-two.vercel.app）

| 頁面 | 功能 |
|---|---|
| `/` **主看板** | 即時數字、任務分布圖、Agent 負載、目標進度 |
| `/goals` **目標** | 進度條、自愈次數、新增目標、一鍵重新分解 |
| `/tasks` **任務** | Kanban 看板（5欄）+ 列表視圖 |
| `/agents` **Agents** | 狀態卡片、負載條、技能標籤 |
| `/finance` **財務** | 月收入圖表、記錄收入、生成報表 |
| `/governance` **治理** | 投票倒數、內嵌投票、提案歷史 |
| `/archive` **檔案庫** | 雙欄介面（清單+詳情）、搜尋、新增記錄 |
| `/knowledge` **知識庫** | 搜尋篩選、類型分組、使用次數 |

每15秒自動刷新。深色設計。

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
| 前端 | Next.js 14 App Router + Tailwind CSS + SWR + recharts |
| 認證 | API Key（Bearer token 或 X-API-Key header） |
| 部署 | Railway（後端）+ Vercel（前端）|

---

## 部署

### 後端（Railway）

1. Railway 建立專案 → 加入 PostgreSQL + Redis
2. 設定環境變數（見 `.env.example`）
3. GitHub Secrets 設定 `RAILWAY_TOKEN`
4. 推送 main → 自動部署

### 前端（Vercel）

1. Import `virus11456/zero-dao` → **Root Directory: `web`**
2. 設定環境變數：
   ```
   NEXT_PUBLIC_API_URL = Railway 後端 URL
   NEXT_PUBLIC_API_KEY = 你的 API_KEY
   ```
3. Deploy

---

## 預設 Agents

| Agent | 角色 | 技能 |
|---|---|---|
| **CEO** | 策略/委派 | strategy, delegation, planning, hiring |
| **Founding Engineer** | 全端工程 | typescript, python, react, nextjs, prisma, devops |
| **Backend Engineer** | 後端/Python | python, fastapi, postgresql, redis, railway |
| **SEO Expert** | 內容行銷 | seo, content, keyword-research, analytics, wordpress |
| **CFO** | 財務管理 | finance, accounting, analytics, reporting, postgresql |

---

## 工作流程總結

```
你做：  定義目標  →  喝咖啡  →  看 Telegram 通知
系統做：拆任務 → 分配 → 執行 → 自愈 → 完成 → 歸檔 → 通知你
```

這就是 zero-dao：你只管「要什麼」，我們管「怎麼做」。

---

## 已修復的 Bug（v0.8.1）

| # | 嚴重度 | 問題 | 修復內容 |
|---|--------|------|----------|
| 1 | **嚴重** | PrismaClient 實例氾濫 — 15+ 個檔案各自 `new PrismaClient()`，會耗盡 DB 連線池 | 新增 `src/lib/prisma.ts` singleton，所有模組共用單一實例 |
| 2 | **嚴重** | Task 編號衝突 — `app.ts` 用 `ZD-${seq.nextNum - 1}`，其他模組用 `ZD-${seq.nextNum}`，導致 UNIQUE 約束違規 | 統一為 `ZD-${seq.nextNum}`，所有入口點使用相同邏輯 |
| 3 | **嚴重** | Express Error Handler 位置錯誤 — 註冊在 Knowledge/Finance/Archive 路由之前，後續路由錯誤不會被捕獲 | 移至所有路由之後（middleware chain 最末） |
| 4 | **嚴重** | Async 路由無 error handling — Promise reject 時請求永遠 pending | 安裝 `express-async-errors`，自動捕獲所有 async route handler 錯誤 |
| 5 | **中等** | API Key 比對有 timing attack 風險 — 使用 `!==` 比較字串 | 改用 `crypto.timingSafeEqual()` |
| 6 | **中等** | 收入記錄不建立會計分錄 — `POST /api/income` 只建 IncomeEvent，損益表不反映 | 自動呼叫 `ledger.recordIncome()`（Dr Cash / Cr Revenue） |
| 7 | **低** | Goal 指標從未更新 — `tasksCreated`、`tasksDone`、`selfHealCount` 欄位永遠為 0 | AutonomousLoop 中正確 increment 這些計數器 |
| 8 | **低** | Knowledge API key race condition — `Date.now()` 呼叫兩次產生不同值 | 改為一次呼叫並重用 `resolvedKey` |
