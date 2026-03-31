/**
 * Demo seed — populates the zero-dao database with realistic-looking data
 * so the dashboard and all pages appear as a real, active company.
 *
 * Run: npx tsx prisma/demo-seed.ts
 * (requires DATABASE_URL in env / .env)
 */

import { PrismaClient } from '@prisma/client';
import { DEFAULT_CONSTITUTION, DEFAULT_CONSTITUTION_RULES } from '../src/governance/constitution';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../src/finance/chart-of-accounts';

const prisma = new PrismaClient();

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 3_600_000);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding demo data for zero-dao...\n');

  // ── 1. TaskSequence ──────────────────────────────────────────────────────────
  await prisma.taskSequence.upsert({
    where: { id: 'singleton' },
    update: { nextNum: 50 },
    create: { id: 'singleton', nextNum: 50 },
  });

  // ── 2. Constitution ──────────────────────────────────────────────────────────
  const existingConstitution = await prisma.constitution.findFirst({ where: { isActive: true } });
  const constitution = existingConstitution ?? await prisma.constitution.create({
    data: {
      version: 1,
      body: DEFAULT_CONSTITUTION,
      rules: DEFAULT_CONSTITUTION_RULES,
      isActive: true,
      ratifiedAt: daysAgo(60),
    },
  });
  console.log('✅ Constitution ready.');

  // ── 3. Chart of Accounts ─────────────────────────────────────────────────────
  const accountCount = await prisma.account.count();
  if (accountCount === 0) {
    for (const acct of DEFAULT_CHART_OF_ACCOUNTS) {
      await prisma.account.create({
        data: {
          code: acct.code,
          name: acct.name,
          nameEn: acct.nameEn,
          type: acct.type as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'cogs',
          isActive: true,
        },
      });
    }
    console.log(`✅ Chart of Accounts seeded (${DEFAULT_CHART_OF_ACCOUNTS.length} accounts).`);
  }

  // ── 4. Board member ──────────────────────────────────────────────────────────
  await prisma.boardMember.upsert({
    where: { userId: 'board-founder-001' },
    update: {},
    create: {
      userId: 'board-founder-001',
      name: 'Founder',
      email: 'founder@zerodao.ai',
      voteWeight: 1,
      isActive: true,
      joinedAt: daysAgo(60),
    },
  });
  console.log('✅ Board member ready.');

  // ── 5. Agents ────────────────────────────────────────────────────────────────
  const ceo = await prisma.agent.upsert({
    where: { id: 'agent-ceo' },
    update: { status: 'running', lastHeartbeatAt: new Date() },
    create: {
      id: 'agent-ceo',
      name: 'CEO',
      role: 'ceo',
      status: 'running',
      model: 'claude-sonnet-4-6',
      capabilities: ['strategy', 'delegation', 'planning', 'hiring'],
      maxParallelTasks: 3,
      heartbeatIntervalSec: 3600,
      lastHeartbeatAt: new Date(),
      systemPrompt: `You are the CEO of a zero-person, fully automated company.
Your role: set strategy, delegate tasks to the right agents, unblock issues, monitor overall company health.
You report to the board (human owners). You own the P&L and all hiring decisions.
Be direct. Lead with action. When in doubt, delegate and verify.`,
    },
  });

  const foundingEng = await prisma.agent.upsert({
    where: { id: 'agent-founding-eng' },
    update: { status: 'running', lastHeartbeatAt: daysAgo(0) },
    create: {
      id: 'agent-founding-eng',
      name: 'Founding Engineer',
      role: 'engineer',
      status: 'running',
      model: 'claude-sonnet-4-6',
      capabilities: ['typescript', 'python', 'react', 'nextjs', 'prisma', 'devops', 'github'],
      maxParallelTasks: 2,
      heartbeatIntervalSec: 3600,
      reportsToId: ceo.id,
      lastHeartbeatAt: new Date(),
      systemPrompt: `You are the Founding Engineer. Implement features, fix bugs, manage deployments.`,
    },
  });

  const backendEng = await prisma.agent.upsert({
    where: { id: 'agent-backend-eng' },
    update: { status: 'idle', lastHeartbeatAt: daysAgo(1) },
    create: {
      id: 'agent-backend-eng',
      name: 'Backend Engineer',
      role: 'engineer',
      status: 'idle',
      model: 'claude-sonnet-4-6',
      capabilities: ['python', 'fastapi', 'postgresql', 'redis', 'celery', 'railway'],
      maxParallelTasks: 2,
      heartbeatIntervalSec: 3600,
      reportsToId: ceo.id,
      lastHeartbeatAt: daysAgo(1),
      systemPrompt: `You are a Backend Engineer specializing in Python/FastAPI services.`,
    },
  });

  const seoAgent = await prisma.agent.upsert({
    where: { id: 'agent-seo' },
    update: { status: 'running', lastHeartbeatAt: new Date() },
    create: {
      id: 'agent-seo',
      name: 'SEO Expert',
      role: 'researcher',
      status: 'running',
      model: 'claude-sonnet-4-6',
      capabilities: ['seo', 'content', 'keyword-research', 'analytics', 'wordpress'],
      maxParallelTasks: 2,
      heartbeatIntervalSec: 3600,
      reportsToId: ceo.id,
      lastHeartbeatAt: new Date(),
      systemPrompt: `You are the SEO Expert. Drive organic traffic through content and keyword strategy.`,
    },
  });

  const cfo = await prisma.agent.upsert({
    where: { id: 'agent-cfo' },
    update: { status: 'idle', lastHeartbeatAt: daysAgo(2) },
    create: {
      id: 'agent-cfo',
      name: 'CFO',
      role: 'analyst',
      status: 'idle',
      model: 'claude-sonnet-4-6',
      capabilities: ['finance', 'accounting', 'analytics', 'reporting', 'postgresql'],
      maxParallelTasks: 2,
      heartbeatIntervalSec: 3600,
      reportsToId: ceo.id,
      lastHeartbeatAt: daysAgo(2),
      systemPrompt: `You are the CFO. Maintain accurate financial records and generate statements.`,
    },
  });

  console.log('✅ Agents seeded.');

  // ── 6. Projects ───────────────────────────────────────────────────────────────
  const projectCore = await prisma.project.upsert({
    where: { id: 'zero-dao-default' },
    update: { status: 'active' },
    create: {
      id: 'zero-dao-default',
      name: 'zero-dao Core',
      description: 'The zero-dao framework — autonomous company OS',
      repoUrl: 'https://github.com/virus11456/zero-dao',
      status: 'active',
    },
  });

  const projectSEO = await prisma.project.upsert({
    where: { id: 'project-luxstay' },
    update: {},
    create: {
      id: 'project-luxstay',
      name: 'LuxStay.world',
      description: 'SEO affiliate hotel platform focusing on Southeast Asia island resorts',
      repoUrl: 'https://github.com/virus11456/luxstay',
      status: 'active',
      targetDate: hoursFromNow(24 * 60),
    },
  });

  const projectPolybot = await prisma.project.upsert({
    where: { id: 'project-polybot' },
    update: {},
    create: {
      id: 'project-polybot',
      name: 'Polybot',
      description: 'Polymarket arbitrage bot — Python/FastAPI/Celery',
      repoUrl: 'https://github.com/virus11456/polybot',
      status: 'active',
    },
  });

  console.log('✅ Projects seeded.');

  // ── 7. Goals ──────────────────────────────────────────────────────────────────
  const goalSEO = await prisma.goal.upsert({
    where: { id: 'goal-seo-q1' },
    update: {},
    create: {
      id: 'goal-seo-q1',
      title: 'Q1 SEO：東南亞島嶼度假村內容覆蓋 100 篇',
      description: '在 Bali、Phuket、Maldives、Koh Samui、Lombok 等地，各寫 20 篇高質量英文文章，鎖定長尾關鍵字。',
      status: 'active',
      projectId: projectSEO.id,
      tasksCreated: 12,
      tasksDone: 7,
      selfHealCount: 1,
      targetDate: hoursFromNow(24 * 45),
    },
  });

  const goalPolybot = await prisma.goal.upsert({
    where: { id: 'goal-polybot-v2' },
    update: {},
    create: {
      id: 'goal-polybot-v2',
      title: 'Polybot v2：遷移至 VPS + 策略優化',
      description: '從 Railway 遷移到自管 VPS，增加 3 個新套利策略，降低延遲至 < 200ms。',
      status: 'active',
      projectId: projectPolybot.id,
      tasksCreated: 8,
      tasksDone: 3,
      selfHealCount: 0,
      targetDate: hoursFromNow(24 * 30),
    },
  });

  const goalZeroDAO = await prisma.goal.upsert({
    where: { id: 'goal-zerodao-mvp' },
    update: {},
    create: {
      id: 'goal-zerodao-mvp',
      title: 'zero-dao MVP 完整功能',
      description: '完成財務模組、治理投票、知識庫、任務看板，並部署到 Vercel + Railway。',
      status: 'completed',
      projectId: projectCore.id,
      tasksCreated: 20,
      tasksDone: 20,
      selfHealCount: 2,
      completedAt: daysAgo(5),
    },
  });

  const goalMarketing = await prisma.goal.upsert({
    where: { id: 'goal-social-media' },
    update: {},
    create: {
      id: 'goal-social-media',
      title: '社群媒體自動化：Twitter + LinkedIn 每日發文',
      description: '建立自動化 pipeline，每天從知識庫生成 2 則推文和 1 篇 LinkedIn 貼文。',
      status: 'planning',
      tasksCreated: 5,
      tasksDone: 0,
      selfHealCount: 0,
      targetDate: hoursFromNow(24 * 20),
    },
  });

  console.log('✅ Goals seeded.');

  // ── 8. Tasks ──────────────────────────────────────────────────────────────────
  const tasksData = [
    // in_progress
    {
      id: 'task-001', identifier: 'ZD-1',
      title: '撰寫 Bali 奢華海景別墅評測文章 (5000字)',
      status: 'in_progress' as const, priority: 'high' as const,
      projectId: projectSEO.id, goalId: goalSEO.id,
      assigneeId: seoAgent.id,
      labels: ['seo', 'content', 'bali'],
      createdAt: daysAgo(3), updatedAt: daysAgo(0),
    },
    {
      id: 'task-002', identifier: 'ZD-2',
      title: '修復 Polybot Telegram 接收指令 bug',
      status: 'in_progress' as const, priority: 'critical' as const,
      projectId: projectPolybot.id, goalId: goalPolybot.id,
      assigneeId: backendEng.id,
      labels: ['bug', 'telegram', 'python'],
      createdAt: daysAgo(2), updatedAt: daysAgo(0),
    },
    {
      id: 'task-003', identifier: 'ZD-3',
      title: '實作 zero-dao 財務看板月度圖表',
      status: 'in_progress' as const, priority: 'medium' as const,
      projectId: projectCore.id, goalId: goalZeroDAO.id,
      assigneeId: foundingEng.id,
      labels: ['frontend', 'finance', 'nextjs'],
      createdAt: daysAgo(4), updatedAt: daysAgo(1),
    },
    // todo
    {
      id: 'task-004', identifier: 'ZD-4',
      title: '研究 Phuket 四季飯店競品分析',
      status: 'todo' as const, priority: 'medium' as const,
      projectId: projectSEO.id, goalId: goalSEO.id,
      assigneeId: seoAgent.id,
      labels: ['research', 'phuket', 'seo'],
      createdAt: daysAgo(2), updatedAt: daysAgo(1),
    },
    {
      id: 'task-005', identifier: 'ZD-5',
      title: '設定 Polybot VPS 環境（Docker + PostgreSQL）',
      status: 'todo' as const, priority: 'high' as const,
      projectId: projectPolybot.id, goalId: goalPolybot.id,
      assigneeId: backendEng.id,
      labels: ['devops', 'docker', 'vps'],
      createdAt: daysAgo(1), updatedAt: daysAgo(1),
    },
    {
      id: 'task-006', identifier: 'ZD-6',
      title: '新增知識庫搜尋 API（全文搜尋支援）',
      status: 'todo' as const, priority: 'medium' as const,
      projectId: projectCore.id,
      assigneeId: foundingEng.id,
      labels: ['backend', 'api', 'search'],
      createdAt: daysAgo(1), updatedAt: daysAgo(0),
    },
    {
      id: 'task-007', identifier: 'ZD-7',
      title: '撰寫 Maldives Overwater Bungalows 比較指南',
      status: 'todo' as const, priority: 'medium' as const,
      projectId: projectSEO.id, goalId: goalSEO.id,
      assigneeId: seoAgent.id,
      labels: ['content', 'maldives', 'seo'],
      createdAt: daysAgo(0), updatedAt: daysAgo(0),
    },
    {
      id: 'task-008', identifier: 'ZD-8',
      title: '整合 Booking.com Affiliate API',
      status: 'todo' as const, priority: 'high' as const,
      projectId: projectSEO.id,
      assigneeId: foundingEng.id,
      labels: ['integration', 'affiliate', 'api'],
      createdAt: daysAgo(0), updatedAt: daysAgo(0),
    },
    // blocked
    {
      id: 'task-009', identifier: 'ZD-9',
      title: 'Polybot VPS SSH 遷移',
      status: 'blocked' as const, priority: 'critical' as const,
      projectId: projectPolybot.id, goalId: goalPolybot.id,
      assigneeId: backendEng.id,
      labels: ['vps', 'migration', 'devops'],
      blockedReason: '等待 Board 提供 VPS SSH 存取憑證。目前無法繼續遷移流程。',
      createdAt: daysAgo(5), updatedAt: daysAgo(1),
    },
    // done
    {
      id: 'task-010', identifier: 'ZD-10',
      title: '部署 Hypeboss.cc 到 Vercel',
      status: 'done' as const, priority: 'high' as const,
      projectId: projectCore.id,
      assigneeId: foundingEng.id,
      labels: ['deployment', 'vercel', 'nextjs'],
      completedAt: daysAgo(1),
      createdAt: daysAgo(7), updatedAt: daysAgo(1),
    },
    {
      id: 'task-011', identifier: 'ZD-11',
      title: '修復 FastAPI + Starlette 1.0.0 breaking change',
      status: 'done' as const, priority: 'critical' as const,
      projectId: projectPolybot.id,
      assigneeId: backendEng.id,
      labels: ['bug', 'fastapi', 'python'],
      completedAt: daysAgo(3),
      createdAt: daysAgo(10), updatedAt: daysAgo(3),
    },
    {
      id: 'task-012', identifier: 'ZD-12',
      title: '實作 CEO 雇用 + 任務指派 API',
      status: 'done' as const, priority: 'high' as const,
      projectId: projectCore.id, goalId: goalZeroDAO.id,
      assigneeId: foundingEng.id,
      labels: ['backend', 'api', 'agents'],
      completedAt: daysAgo(5),
      createdAt: daysAgo(14), updatedAt: daysAgo(5),
    },
    {
      id: 'task-013', identifier: 'ZD-13',
      title: '建立 LuxStay SEO 策略：東南亞島嶼度假村定位',
      status: 'done' as const, priority: 'high' as const,
      projectId: projectSEO.id, goalId: goalSEO.id,
      assigneeId: seoAgent.id,
      labels: ['strategy', 'seo', 'research'],
      completedAt: daysAgo(7),
      createdAt: daysAgo(14), updatedAt: daysAgo(7),
    },
    {
      id: 'task-014', identifier: 'ZD-14',
      title: '完成雙式記帳系統（Chart of Accounts + Journal）',
      status: 'done' as const, priority: 'medium' as const,
      projectId: projectCore.id, goalId: goalZeroDAO.id,
      assigneeId: cfo.id,
      labels: ['finance', 'accounting', 'backend'],
      completedAt: daysAgo(10),
      createdAt: daysAgo(20), updatedAt: daysAgo(10),
    },
    {
      id: 'task-015', identifier: 'ZD-15',
      title: '撰寫 El Nido 潛水度假村深度評測',
      status: 'done' as const, priority: 'medium' as const,
      projectId: projectSEO.id, goalId: goalSEO.id,
      assigneeId: seoAgent.id,
      labels: ['content', 'palawan', 'seo'],
      completedAt: daysAgo(4),
      createdAt: daysAgo(12), updatedAt: daysAgo(4),
    },
    {
      id: 'task-016', identifier: 'ZD-16',
      title: '社群行銷系統側欄 UI 修復（SIM-61）',
      status: 'done' as const, priority: 'low' as const,
      projectId: projectCore.id,
      assigneeId: foundingEng.id,
      labels: ['bug', 'frontend', 'ui'],
      completedAt: daysAgo(6),
      createdAt: daysAgo(9), updatedAt: daysAgo(6),
    },
  ];

  for (const t of tasksData) {
    await prisma.task.upsert({
      where: { id: t.id },
      update: { status: t.status, updatedAt: t.updatedAt },
      create: {
        id: t.id,
        identifier: t.identifier,
        title: t.title,
        status: t.status,
        priority: t.priority,
        projectId: t.projectId ?? null,
        goalId: t.goalId ?? null,
        assigneeId: t.assigneeId ?? null,
        labels: t.labels,
        blockedReason: (t as { blockedReason?: string }).blockedReason ?? null,
        completedAt: (t as { completedAt?: Date }).completedAt ?? null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      },
    });
  }

  // A few task comments for realism
  const commentCount = await prisma.taskComment.count();
  if (commentCount === 0) {
    await prisma.taskComment.createMany({
      data: [
        { taskId: 'task-001', content: 'SEO Expert：關鍵字已確認，目標 "best luxury villas bali beachfront"，開始撰寫初稿。', isSystem: false, createdAt: daysAgo(2) },
        { taskId: 'task-001', content: '初稿完成 60%，預計明天完稿後送審。', isSystem: false, createdAt: daysAgo(1) },
        { taskId: 'task-002', content: 'Backend Engineer：已確認問題根源在 updater.start_polling() 未被呼叫。修復中。', isSystem: false, createdAt: daysAgo(1) },
        { taskId: 'task-009', content: 'Backend Engineer：已備妥 Docker Compose 配置，等待 Board 提供 VPS root SSH access。', isSystem: false, createdAt: daysAgo(3) },
        { taskId: 'task-009', content: '⚠️ Blocked：SSH 憑證尚未收到。VPS IP 和 SSH key 請 Board 提供。', isSystem: true, createdAt: daysAgo(1) },
        { taskId: 'task-010', content: 'Founding Engineer：Vercel 部署成功，NEXT_PUBLIC_API_URL 已設定，前端已連線後端 Railway 服務。', isSystem: false, createdAt: daysAgo(1) },
        { taskId: 'task-011', content: '已將 starlette 固定在 <1.0.0，Railway 服務重新啟動成功。', isSystem: false, createdAt: daysAgo(3) },
      ],
    });
  }

  console.log('✅ Tasks seeded (16 tasks across all statuses).');

  // ── 9. Agent Memory (Knowledge Base) ─────────────────────────────────────────
  const memCount = await prisma.agentMemory.count();
  if (memCount === 0) {
    await prisma.agentMemory.createMany({
      data: [
        {
          agentId: ceo.id, type: 'lesson', key: 'luxstay-pivot',
          title: 'LuxStay 策略轉向：全球豪華 → 東南亞島嶼度假村',
          body: '2026-03-28 決定，從全球豪華轉向東南亞島嶼（Bali, Phuket, Maldives, Koh Samui）。非 SEA 頁面改為 noindex 保留。理由：競爭較小，搜尋量穩定。',
          tags: ['strategy', 'seo', 'luxstay'],
          accessCount: 8, updatedAt: daysAgo(3),
        },
        {
          agentId: ceo.id, type: 'feedback', key: 'cost-opt-heartbeat',
          title: '成本優化：SEO Expert heartbeat 5min → 60min',
          body: 'SEO Expert 佔 ~75% token 預算。已調整：heartbeat 60min，maxTurns 30，cooldown 600s。每月節省約 $25。',
          tags: ['cost', 'optimization', 'agents'],
          accessCount: 5, updatedAt: daysAgo(2),
        },
        {
          agentId: seoAgent.id, type: 'reference', key: 'el-nido-priority',
          title: 'El Nido (Palawan) 優先內容目標',
          body: 'El Nido 搜尋量高、競爭相對低，是最強有機潛力目標。每月至少 2 篇深度文章。目標關鍵字：el nido dive resort, best resorts el nido palawan。',
          tags: ['seo', 'palawan', 'content'],
          accessCount: 12, updatedAt: daysAgo(1),
        },
        {
          agentId: backendEng.id, type: 'lesson', key: 'railway-migration-bug',
          title: 'Railway FastAPI: starlette 1.0.0 breaking change',
          body: 'fastapi>=0.111.0 會安裝 starlette>=1.0.0，移除了 @app.on_event()。修復：在 requirements.txt 加 starlette<1.0.0。此 bug 已在 Polybot 觸發，修復後正常。',
          tags: ['bug', 'fastapi', 'railway', 'python'],
          accessCount: 7, updatedAt: daysAgo(3),
        },
        {
          agentId: foundingEng.id, type: 'pattern', key: 'vercel-pnpm-monorepo',
          title: 'Vercel pnpm monorepo 部署設定',
          body: '需設定：Root Directory → packages/web；ENABLE_EXPERIMENTAL_COREPACK=1；NEXT_PUBLIC_API_URL 要在 Railway backend 部署後才能填入。',
          tags: ['deployment', 'vercel', 'monorepo'],
          accessCount: 4, updatedAt: daysAgo(5),
        },
        {
          agentId: cfo.id, type: 'reference', key: 'affiliate-income-q1',
          title: 'Q1 聯盟行銷收入預測',
          body: 'Booking.com 佣金約 4%，Agoda 約 5%。目前流量不足，預計 Q1 末開始產生收入。目標：月收入 NT$5,000 以上。',
          tags: ['finance', 'affiliate', 'forecast'],
          accessCount: 3, updatedAt: daysAgo(7),
        },
      ],
    });
    console.log('✅ Knowledge base facts seeded.');
  }

  // ── 10. Income Events ─────────────────────────────────────────────────────────
  const incomeCount = await prisma.incomeEvent.count();
  if (incomeCount === 0) {
    const incomeData = [
      { source: 'affiliate', description: 'Booking.com 3月佣金', amountCents: 340000, recordedAt: daysAgo(1) },
      { source: 'affiliate', description: 'Agoda 3月佣金', amountCents: 186000, recordedAt: daysAgo(3) },
      { source: 'saas', description: 'zero-dao 工具授權', amountCents: 500000, recordedAt: daysAgo(10) },
      { source: 'affiliate', description: 'Booking.com 2月佣金', amountCents: 210000, recordedAt: daysAgo(32) },
      { source: 'consulting', description: '顧問服務：AI 公司架構', amountCents: 1200000, recordedAt: daysAgo(40) },
      { source: 'affiliate', description: 'Klook 2月佣金', amountCents: 88000, recordedAt: daysAgo(35) },
      { source: 'affiliate', description: 'Booking.com 1月佣金', amountCents: 155000, recordedAt: daysAgo(62) },
    ];

    for (const inc of incomeData) {
      await prisma.incomeEvent.create({ data: { ...inc, currency: 'TWD' } });
    }
    console.log('✅ Income events seeded (7 events).');
  }

  // ── 11. Proposals ─────────────────────────────────────────────────────────────
  const propCount = await prisma.proposal.count();
  if (propCount === 0) {
    // Open proposal
    const openProp = await prisma.proposal.create({
      data: {
        constitutionId: constitution.id,
        type: 'budget_allocation',
        title: 'Q2 預算分配：Polybot VPS 伺服器費用',
        description: '申請每月 NT$1,200 用於 2vCPU/4GB VPS，部署 Polybot + Hypeliquid 服務，取代 Railway Hobby 方案（上限 5 服務已達）。',
        status: 'open',
        proposedByUserId: 'board-founder-001',
        votingDeadline: hoursFromNow(72),
        quorumPercent: 51,
        passThreshold: 51,
      },
    });

    // Passed proposal
    const passedProp = await prisma.proposal.create({
      data: {
        constitutionId: constitution.id,
        type: 'strategic_pivot',
        title: 'LuxStay 策略轉向：全球豪華 → 東南亞島嶼度假村',
        description: '將 LuxStay.world 的 SEO 策略從全球豪華市場聚焦至東南亞島嶼度假村（Bali、Phuket、Maldives）。全球頁面改為 noindex 但保留。',
        status: 'passed',
        proposedByUserId: 'board-founder-001',
        votingDeadline: daysAgo(1),
        quorumPercent: 51,
        passThreshold: 51,
      },
    });

    // Vote on the passed proposal
    await prisma.vote.create({
      data: {
        proposalId: passedProp.id,
        voterUserId: 'board-founder-001',
        choice: 'yes',
        rationale: '聚焦策略正確，競爭相對低，有利於 SEO 早期排名。',
        weight: 1,
      },
    });

    // Executed proposal
    const executedProp = await prisma.proposal.create({
      data: {
        constitutionId: constitution.id,
        type: 'agent_hire',
        title: '雇用 CFO Agent：自動財務報表與利潤分配',
        description: '新增 CFO Agent，負責每月財務報表（P&L、資產負債表）、雙式記帳維護、及利潤分配計算。',
        status: 'executed',
        proposedByUserId: 'board-founder-001',
        votingDeadline: daysAgo(20),
        quorumPercent: 51,
        passThreshold: 51,
        executedAt: daysAgo(18),
        executionNote: 'CFO Agent 已建立並上線，完成首份月度財務報表。',
      },
    });

    await prisma.vote.create({
      data: {
        proposalId: executedProp.id,
        voterUserId: 'board-founder-001',
        choice: 'yes',
        rationale: '財務自動化是零人公司核心需求。',
        weight: 1,
      },
    });

    console.log('✅ Proposals seeded (1 open, 1 passed, 1 executed).');
  }

  // ── 12. Archive entries ───────────────────────────────────────────────────────
  const archiveCount = await prisma.archiveEntry.count();
  if (archiveCount === 0) {
    await prisma.archiveEntry.createMany({
      data: [
        {
          type: 'board_decision',
          title: 'LuxStay 策略轉向決議通過',
          summary: '董事會一致通過將 LuxStay.world 聚焦於東南亞島嶼度假村，非 SEA 頁面設 noindex。',
          body: '## 決議內容\n\n2026-03-28 董事會決議：\n1. LuxStay.world 主要 SEO 目標從全球豪華轉向東南亞島嶼度假村\n2. 目標地區：Bali、Phuket、Maldives、Koh Samui、Lombok、Langkawi、Palawan、Phu Quoc、Da Nang\n3. 非 SEA 頁面設 noindex（保留，不刪除）\n4. 聯盟合作夥伴：Booking.com、Agoda、Hotels.com + Klook + KKday\n\n## 理由\n- 全球豪華競爭過激，難以在短期取得有機排名\n- 東南亞搜尋量穩定增長，競爭相對低\n- El Nido (Palawan) 為最優先目標，有機潛力最強',
          tags: ['strategy', 'luxstay', 'seo', 'board'],
          authorUserId: 'board-founder-001',
          isAutoGenerated: false,
          occurredAt: daysAgo(3),
        },
        {
          type: 'incident',
          title: 'API Key 洩漏事件（SIM-58）',
          summary: 'Board 誤將 Anthropic API Key 貼入 issue 留言，已立即標記並要求撤銷。',
          body: '## 事件說明\n\n2026-03-29 Board 在 SIM-58 留言中貼入完整 Anthropic API Key。\n\n## 處置\n1. CEO Agent 立即發現並標記\n2. Board 被要求立即前往 Anthropic Console 撤銷該 Key\n3. 新規則已建立：**禁止在 issue 留言中貼入任何 API Key**\n\n## 改善措施\n- 所有密鑰改存於 Railway 環境變數或 task 描述中\n- AGENTS.md 新增安全規則',
          tags: ['incident', 'security', 'api-key'],
          isAutoGenerated: false,
          occurredAt: daysAgo(2),
        },
        {
          type: 'goal_completion',
          title: 'zero-dao MVP 功能完整達成',
          summary: '所有 20 個 MVP 任務完成，含財務模組、治理投票、知識庫、任務看板，並部署至生產環境。',
          body: '## 完成紀錄\n\n2026-03-26 zero-dao MVP 全部功能完成：\n\n### 已完成模組\n- ✅ 任務看板（Kanban）\n- ✅ Agent 管理 + 組織架構圖\n- ✅ 目標管理 + AI 自動分解\n- ✅ 治理提案 + 投票\n- ✅ 財務模組（雙式記帳 + P&L + 利潤分配）\n- ✅ 知識庫（語義檢索）\n- ✅ 檔案庫\n- ✅ Telegram 通知\n- ✅ CEO 雇用 + 直接指派任務\n\n### 部署\n- Backend: Railway\n- Frontend: Vercel (zero-dao-two.vercel.app)',
          tags: ['milestone', 'zero-dao', 'mvp'],
          isAutoGenerated: true,
          occurredAt: daysAgo(5),
        },
        {
          type: 'policy_change',
          title: 'Agent 成本優化：SEO Expert heartbeat 5min → 60min',
          summary: 'SEO Expert 佔總 token 預算 75%，已將其 heartbeat 間隔從 5min 調整為 60min，預計節省 $25/月。',
          body: '## 政策變更\n\n2026-03-29 成本優化決策：\n\n### 問題\nSEO Expert 以 5 分鐘間隔執行，每月消耗約 $34.80（佔公司 token 總預算 75%）。\n\n### 變更\n| Agent | 項目 | 舊值 | 新值 |\n|---|---|---|---|\n| SEO Expert | heartbeat | 5min | 60min |\n| SEO Expert | maxTurns | 100 | 30 |\n| SEO Expert | cooldown | 60s | 600s |\n| CEO | maxTurns | 100 | 50 |\n\n### 新規則\n- 非關鍵 Agent 的 heartbeat 最小間隔為 60min\n- 超過 50 則留言的 task 應關閉後重開，避免 context bloat',
          tags: ['cost', 'agents', 'policy'],
          isAutoGenerated: false,
          occurredAt: daysAgo(2),
        },
        {
          type: 'financial_milestone',
          title: '3月聯盟行銷收入突破 NT$5,000',
          summary: 'Booking.com + Agoda 3月佣金合計 NT$5,260，首次達到月收入目標。',
          body: '## 財務里程碑\n\n2026-03-30 確認：\n\n| 來源 | 金額 |\n|---|---|\n| Booking.com 3月佣金 | NT$3,400 |\n| Agoda 3月佣金 | NT$1,860 |\n| **合計** | **NT$5,260** |\n\n目標達成！SEO 策略轉向後首次突破月收入 NT$5,000 門檻。\n下月目標：NT$8,000。',
          tags: ['finance', 'milestone', 'affiliate'],
          isAutoGenerated: true,
          occurredAt: daysAgo(1),
        },
        {
          type: 'meeting_minutes',
          title: '每週同步：2026-03-28',
          summary: 'CEO 與 Board 同步：Polybot VPS 遷移計劃確認、LuxStay 策略轉向、SEO Expert 成本優化。',
          body: '## 議程\n\n1. **Polybot VPS 遷移** — Board 確認計劃，SSH 憑證待提供\n2. **LuxStay 策略轉向** — 提案已通過，SEO Expert 開始執行\n3. **成本優化** — SEO Expert heartbeat 已調整\n4. **Hypeboss.cc** — Railway backend + Vercel frontend 均已部署成功\n\n## 行動項\n- [ ] Board 提供 VPS SSH access（SSH key + IP）\n- [x] SEO Expert 開始撰寫 El Nido 系列文章\n- [x] Founding Engineer 完成 Vercel 部署',
          tags: ['meeting', 'weekly-sync'],
          isAutoGenerated: false,
          occurredAt: daysAgo(3),
        },
      ],
    });
    console.log('✅ Archive entries seeded (6 entries).');
  }

  // ── 13. Agent Runs (recent activity) ─────────────────────────────────────────
  const runCount = await prisma.agentRun.count();
  if (runCount === 0) {
    await prisma.agentRun.createMany({
      data: [
        {
          agentId: ceo.id, taskId: 'task-001', status: 'completed',
          inputTokens: 4200, outputTokens: 1100, costCents: 18,
          startedAt: daysAgo(2), completedAt: daysAgo(2),
          logs: ['Checked task queue', 'Delegated SEO article to SEO Expert', 'Updated task status'],
        },
        {
          agentId: seoAgent.id, taskId: 'task-001', status: 'completed',
          inputTokens: 8300, outputTokens: 5200, costCents: 72,
          startedAt: daysAgo(1), completedAt: daysAgo(1),
          logs: ['Keyword research complete', 'Draft in progress: 60% done', 'Saved draft to knowledge base'],
        },
        {
          agentId: backendEng.id, taskId: 'task-002', status: 'running',
          inputTokens: 3100, outputTokens: 1800, costCents: 31,
          startedAt: new Date(),
          logs: ['Checked Telegram bot logs', 'Found missing start_polling() call', 'Applying fix...'],
        },
        {
          agentId: foundingEng.id, taskId: 'task-010', status: 'completed',
          inputTokens: 5600, outputTokens: 2900, costCents: 49,
          startedAt: daysAgo(1), completedAt: daysAgo(1),
          logs: ['Set Root Directory to packages/web', 'Configured ENABLE_EXPERIMENTAL_COREPACK=1', 'Deploy successful: zero-dao-two.vercel.app'],
        },
        {
          agentId: ceo.id, status: 'completed',
          inputTokens: 2800, outputTokens: 890, costCents: 14,
          startedAt: daysAgo(3), completedAt: daysAgo(3),
          logs: ['Inbox check: 3 tasks assigned', 'Cost analysis done', 'Adjusted SEO Expert heartbeat settings'],
        },
      ],
    });
    console.log('✅ Agent runs seeded (5 runs).');
  }

  console.log('\n🎉 Demo seed complete! The zero-dao dashboard now has realistic data.\n');
  console.log('   Dashboard: Tasks (8 active, 7 done, 1 blocked), Agents (3 running), Goals (2 active)');
  console.log('   Finance: NT$24,790 total income across 7 events');
  console.log('   Governance: 1 open vote, 1 passed, 1 executed');
  console.log('   Archive: 6 entries (decisions, incidents, milestones)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
