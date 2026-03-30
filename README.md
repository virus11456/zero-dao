# zero-dao

> 零人全自動公司框架 — A Decentralized Autonomous Organization (DAO) for running software companies without human intervention.

zero-dao implements a true zero-human company: you define **goals**, the system figures out **tasks**, assigns them to AI agents, executes, self-heals when stuck, and reports back. No human needs to be in the loop for day-to-day operations.

## The DAO Model

```
Board (Human) defines GOALS only
        ↓
GoalDecomposer (Claude) breaks goals → tasks
        ↓
TaskRouter assigns tasks → agents (by capability + load)
        ↓
AgentRunner executes (Claude heartbeats)
        ↓
AutonomousLoop monitors + self-heals if stuck
        ↓
Telegram notifies board of outcomes
```

**Humans interact at two points only:**
1. Define a goal (`POST /api/goals`)
2. Review outcomes (Telegram digest)

Everything in between is autonomous.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Board (Human — sets goals only)              │
│              Telegram: /status /agents                    │
└──────────────────────┬───────────────────────────────────┘
                       │ POST /api/goals
┌──────────────────────▼───────────────────────────────────┐
│                    zero-dao Core                          │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Autonomous Loop (every 10min)          │ │
│  │                                                     │ │
│  │  Goal has no tasks? → GoalDecomposer (Claude)       │ │
│  │  All tasks done? → Mark goal complete, notify       │ │
│  │  All tasks blocked? → Self-heal (regenerate tasks)  │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                         │                                 │
│  ┌──────────────────────▼──────────────────────────────┐ │
│  │              TaskRouter (every 5min)                │ │
│  │  Capability matching + load balancing               │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                         │                                 │
│  ┌──────────────────────▼──────────────────────────────┐ │
│  │                 Agent Pool                          │ │
│  │  CEO · Founding Engineer · Backend Engineer · SEO   │ │
│  │  Each: Claude claude-sonnet-4-6 heartbeat executor            │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  PostgreSQL (Prisma) · Redis · GitHub API · Telegram      │
└──────────────────────────────────────────────────────────┘
```

## Core Concepts

| Concept | Description |
|---|---|
| **Goal** | High-level business objective defined by humans. Has no tasks on creation. |
| **GoalDecomposer** | Uses Claude to break a goal into milestones + actionable tasks automatically |
| **AutonomousLoop** | Continuously monitors goals: decomposes new ones, marks complete, self-heals blocked |
| **TaskRouter** | Assigns tasks to agents by capability match + current load |
| **AgentRunner** | Executes one agent heartbeat: builds context → calls Claude → applies actions |
| **Scheduler** | Cron engine: autonomous loop (10min), task routing (5min), daily digest (9am) |

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/virus11456/zero-dao
cd zero-dao
npm install
cp .env.example .env
# Fill in DATABASE_URL, ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN
```

### 2. Database setup

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 3. Run

```bash
npm run dev
```

### 4. Define your first goal (that's ALL you need to do)

```bash
curl -X POST http://localhost:3200/api/goals \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Launch LuxStay.world SEO for Bali island resorts",
    "description": "Drive organic traffic from Southeast Asia luxury resort searches. Target: Bali, Phuket, Maldives. Publish 2 articles/week.",
    "status": "planning"
  }'
```

Within 10 minutes, the AutonomousLoop will:
1. Decompose the goal into 5-8 specific tasks
2. Route tasks to the SEO Expert agent
3. Execute each task autonomously
4. Notify you on Telegram when done

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/api/dashboard` | GET | Goals + tasks + agents overview |
| **Goals** | | |
| `/api/goals` | GET | List all goals |
| `/api/goals` | POST | Create a goal (triggers auto-decomposition) |
| `/api/goals/:id` | PATCH | Update goal status |
| `/api/goals/:id/decompose` | POST | Manually trigger task decomposition |
| **Tasks** | | |
| `/api/tasks` | GET | List all tasks |
| `/api/tasks` | POST | Create a task manually |
| `/api/tasks/:id` | GET | Get task + comments + subtasks |
| `/api/tasks/:id` | PATCH | Update task |
| **Agents** | | |
| `/api/agents` | GET | List agents + active task count |
| `/api/agents` | POST | Register a new agent |
| `/api/agents/:id` | PATCH | Update agent config |
| **Projects** | | |
| `/api/projects` | GET | List projects |
| `/api/projects` | POST | Create project |

## Self-Healing

When all tasks under a goal are blocked (no human intervention available), the AutonomousLoop:
1. Detects the deadlock
2. Calls Claude with context: "All tasks blocked — generate alternative approaches"
3. Creates fresh tasks with different strategies
4. Routes them to agents automatically

This prevents the company from grinding to a halt without human input.

## Telegram Commands

| Command | Description |
|---|---|
| `/status` | All in-progress tasks across all agents |
| `/agents` | Agent statuses and active task counts |

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| AI | Anthropic Claude (claude-sonnet-4-6) |
| Database | PostgreSQL via Prisma |
| Scheduler | node-cron |
| API | Express |
| GitHub | Octokit |
| Notifications | Telegram Bot API |
| Deploy | Railway + GitHub Actions |

## Deploying to Railway

1. Create Railway project → add PostgreSQL + Redis services
2. Set env vars: `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`
3. Set `RAILWAY_TOKEN` in GitHub repo secrets
4. Push to `main` — GitHub Actions deploys automatically

## Design Philosophy

This is a **DAO (Decentralized Autonomous Organization)**, not just a task tracker:

- **Goal-driven, not task-driven**: humans think in outcomes, not work items
- **Self-healing**: stuck → automatically generates alternative paths
- **Capability routing**: right agent for the right task, automatically
- **Zero human intervention**: the loop never stops and never waits for a human to unblock it
- **Transparent**: every action logged to DB, key events pushed to Telegram

## License

MIT
