# zero-dao

> A zero-person, fully automated company orchestration framework.

zero-dao lets you run a portfolio of software projects using AI agents that autonomously pick up tasks, write code, ship features, and report back — without human intervention in the day-to-day loop.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Board (Human Owners)                │
│           Telegram /status, /agents, task creation   │
└─────────────────────┬────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────┐
│                    zero-dao Core                      │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Scheduler│  │  Task    │  │   REST API        │   │
│  │ (cron)   │→ │  Router  │  │   /api/tasks      │   │
│  └──────────┘  └────┬─────┘  │   /api/agents     │   │
│                     │        │   /api/dashboard   │   │
│  ┌──────────────────▼──────────────────────────┐ │   │
│  │               Agent Pool                    │ │   │
│  │  CEO · Founding Eng · Backend Eng · SEO     │ │   │
│  │              (Claude claude-sonnet-4-6)            │ │   │
│  └─────────────────────────────────────────────┘ │   │
│                                                   │   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │   │
│  │ PostgreSQL│  │  Redis   │  │   GitHub API  │  │   │
│  │ (Prisma) │  │ (queue)  │  │   (Octokit)   │  │   │
│  └──────────┘  └──────────┘  └───────────────┘  │   │
└──────────────────────────────────────────────────────┘
```

## Core Concepts

| Concept | Description |
|---|---|
| **Agent** | An AI persona with a role, capabilities, and system prompt. Runs Claude. |
| **Task** | A unit of work with a status lifecycle: `todo → in_progress → done / blocked` |
| **TaskRouter** | Picks the best available agent for unassigned tasks based on capabilities + load |
| **AgentRunner** | Executes a single agent heartbeat: build context → call Claude → apply actions |
| **Scheduler** | Cron-based heartbeat: routes tasks, detects stuck agents, sends daily digest |

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/virus11456/zero-dao
cd zero-dao
npm install
cp .env.example .env
# Fill in .env with your credentials
```

### 2. Database setup

```bash
# Create the database (PostgreSQL must be running)
npx prisma migrate dev --name init
npx prisma db seed
```

### 3. Run locally

```bash
npm run dev
```

The API server starts on `http://localhost:3200`.

### 4. Create your first task

```bash
curl -X POST http://localhost:3200/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Write SEO article about Bali resorts",
    "description": "Target keyword: best luxury resorts Bali 2025. 1500 words.",
    "priority": "high",
    "labels": ["seo", "content"]
  }'
```

The task gets auto-assigned to the SEO Expert agent within 5 minutes.

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/api/dashboard` | GET | Task + agent counts |
| `/api/tasks` | GET | List all tasks |
| `/api/tasks` | POST | Create a task |
| `/api/tasks/:id` | GET | Get task details |
| `/api/tasks/:id` | PATCH | Update task status/assignee |
| `/api/agents` | GET | List all agents |
| `/api/agents` | POST | Register a new agent |
| `/api/agents/:id` | PATCH | Update agent config |
| `/api/projects` | GET | List projects |
| `/api/projects` | POST | Create a project |

## Telegram Commands

| Command | Description |
|---|---|
| `/status` | Show all in-progress tasks |
| `/agents` | List agent statuses |

## Deployment (Railway)

1. Create a Railway project.
2. Add a PostgreSQL service and Redis service.
3. Set environment variables from `.env.example`.
4. Set `RAILWAY_TOKEN` in GitHub Secrets.
5. Push to `main` — GitHub Actions deploys automatically.

## Agent Task Actions

Agents respond to tasks using a structured JSON block:

```json
{
  "action": "update",
  "status": "done|in_progress|blocked",
  "comment": "What was done or what is blocking",
  "subtasks": [
    {"title": "subtask title", "description": "...", "priority": "high"}
  ]
}
```

## Stack

- **Runtime**: Node.js 20 + TypeScript
- **AI**: Anthropic Claude (claude-sonnet-4-6) via `@anthropic-ai/sdk`
- **Database**: PostgreSQL via Prisma
- **Queue**: Redis + Bull
- **Scheduler**: node-cron
- **API**: Express
- **GitHub**: Octokit
- **Notifications**: Telegram bot
- **Deploy**: Railway + Vercel (frontend)
- **CI/CD**: GitHub Actions

## License

MIT
