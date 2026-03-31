import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { TaskRouter } from '../tasks/router';
import { GovernanceEngine } from '../governance/engine';
import { ProfitDistributor } from '../governance/profit-distributor';
import { KnowledgeBase } from '../memory/knowledge-base';
import { Ledger } from '../finance/ledger';
import { FinancialReporter } from '../finance/reporter';
import { ArchiveService } from '../archive/service';
import { apiKeyAuth } from './auth';

const prisma = new PrismaClient();
const router = new TaskRouter();
const governance = new GovernanceEngine();
const profitDistributor = new ProfitDistributor();
const knowledgeBase = new KnowledgeBase();
const ledger = new Ledger();
const reporter = new FinancialReporter();
const archiveService = new ArchiveService();

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  // ── Health (no auth required) ────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Apply API key auth to all /api/* routes ──────────────────────────────────
  app.use('/api', apiKeyAuth);

  // ── Tasks ───────────────────────────────────────────────────────────────────
  app.get('/api/tasks', async (_req, res) => {
    const tasks = await prisma.task.findMany({
      include: { assignee: { select: { id: true, name: true, role: true } } },
      orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
    res.json(tasks);
  });

  app.get('/api/tasks/:id', async (req, res) => {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        assignee: { select: { id: true, name: true, role: true } },
        comments: { orderBy: { createdAt: 'asc' } },
        subtasks: true,
        documents: true,
      },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  app.post('/api/tasks', async (req: Request, res: Response) => {
    const { title, description, priority, projectId, parentId, labels } = req.body;

    const seq = await prisma.taskSequence.upsert({
      where: { id: 'singleton' },
      update: { nextNum: { increment: 1 } },
      create: { id: 'singleton', nextNum: 2 },
    });

    const task = await prisma.task.create({
      data: {
        identifier: `ZD-${seq.nextNum - 1}`,
        title,
        description,
        priority: priority || 'medium',
        projectId,
        parentId,
        labels: labels || [],
        status: 'todo',
      },
    });

    // Immediately try to route the new task
    router.routeAll().catch(console.error);

    res.status(201).json(task);
  });

  app.patch('/api/tasks/:id', async (req, res) => {
    const { status, priority, assigneeId, blockedReason, comment } = req.body;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(blockedReason !== undefined && { blockedReason }),
        ...(status === 'done' && { completedAt: new Date() }),
      },
    });

    if (comment) {
      await prisma.taskComment.create({
        data: { taskId: task.id, content: comment },
      });
    }

    res.json(task);
  });

  // ── Agents ──────────────────────────────────────────────────────────────────
  app.get('/api/agents', async (_req, res) => {
    const agents = await prisma.agent.findMany({
      include: {
        _count: {
          select: { tasks: { where: { status: 'in_progress' } } },
        },
      },
    });
    res.json(agents);
  });

  app.post('/api/agents', async (req: Request, res: Response) => {
    const { name, role, systemPrompt, capabilities, maxParallelTasks, reportsToId } = req.body;
    const agent = await prisma.agent.create({
      data: {
        name,
        role,
        systemPrompt,
        capabilities: capabilities || [],
        maxParallelTasks: maxParallelTasks || 2,
        reportsToId,
      },
    });
    res.status(201).json(agent);
  });

  app.patch('/api/agents/:id', async (req, res) => {
    const { status, maxParallelTasks, capabilities } = req.body;
    const agent = await prisma.agent.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(maxParallelTasks && { maxParallelTasks }),
        ...(capabilities && { capabilities }),
      },
    });
    res.json(agent);
  });

  // ── Goals (DAO autonomous planning) ─────────────────────────────────────────
  app.get('/api/goals', async (_req, res) => {
    const goals = await prisma.goal.findMany({
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(goals);
  });

  app.post('/api/goals', async (req: Request, res: Response) => {
    const { title, description, projectId, targetDate } = req.body;
    const goal = await prisma.goal.create({
      data: {
        title,
        description,
        projectId,
        targetDate: targetDate ? new Date(targetDate) : undefined,
        status: 'draft',
      },
    });
    res.status(201).json(goal);
  });

  app.patch('/api/goals/:id', async (req, res) => {
    const { status, title, description } = req.body;
    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(title && { title }),
        ...(description !== undefined && { description }),
      },
    });
    res.json(goal);
  });

  // Manually trigger decomposition for a goal
  app.post('/api/goals/:id/decompose', async (req, res) => {
    const { GoalDecomposer } = await import('../tasks/goal-decomposer');
    const goal = await prisma.goal.findUnique({
      where: { id: req.params.id },
      include: { tasks: { select: { title: true } } },
    });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const decomposer = new GoalDecomposer();
    const count = await decomposer.decompose({
      goalId: goal.id,
      goalTitle: goal.title,
      goalDescription: goal.description || undefined,
      projectId: goal.projectId || undefined,
      existingTaskTitles: goal.tasks.map((t) => t.title),
    });

    res.json({ tasksCreated: count });
  });

  // ── Projects ─────────────────────────────────────────────────────────────────
  app.get('/api/projects', async (_req, res) => {
    const projects = await prisma.project.findMany({
      include: { _count: { select: { tasks: true } } },
    });
    res.json(projects);
  });

  app.post('/api/projects', async (req: Request, res: Response) => {
    const { name, description, repoUrl, targetDate } = req.body;
    const project = await prisma.project.create({
      data: {
        name,
        description,
        repoUrl,
        targetDate: targetDate ? new Date(targetDate) : undefined,
      },
    });
    res.status(201).json(project);
  });

  // ── Dashboard ────────────────────────────────────────────────────────────────
  app.get('/api/dashboard', async (_req, res) => {
    const [inProgress, blocked, done, todo, agents, activeGoals, completedGoals] = await Promise.all([
      prisma.task.count({ where: { status: 'in_progress' } }),
      prisma.task.count({ where: { status: 'blocked' } }),
      prisma.task.count({ where: { status: 'done' } }),
      prisma.task.count({ where: { status: 'todo' } }),
      prisma.agent.groupBy({ by: ['status'], _count: true }),
      prisma.goal.count({ where: { status: { in: ['active', 'planning'] } } }),
      prisma.goal.count({ where: { status: 'completed' } }),
    ]);

    res.json({
      tasks: { inProgress, blocked, done, todo },
      agents: Object.fromEntries(agents.map((a) => [a.status, a._count])),
      goals: { active: activeGoals, completed: completedGoals },
    });
  });

  // ── Error handler ────────────────────────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Error]', err);
    res.status(500).json({ error: err.message });
  });

  // ── Knowledge Base ────────────────────────────────────────────────────────────
  // List all knowledge facts (optionally filtered by agent or type)
  app.get('/api/knowledge', async (req, res) => {
    const { agentId, type, q } = req.query as Record<string, string>;
    const facts = await prisma.agentMemory.findMany({
      where: {
        ...(agentId && { agentId }),
        ...(type && { type }),
        ...(q && {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
            { tags: { has: q } },
          ],
        }),
      },
      include: { agent: { select: { name: true, role: true } } },
      orderBy: [{ accessCount: 'desc' }, { updatedAt: 'desc' }],
      take: 50,
    });
    res.json(facts);
  });

  // Get knowledge for a specific agent
  app.get('/api/agents/:id/knowledge', async (req, res) => {
    const facts = await prisma.agentMemory.findMany({
      where: { agentId: req.params.id },
      orderBy: [{ accessCount: 'desc' }, { updatedAt: 'desc' }],
    });
    res.json(facts);
  });

  // Manually store a knowledge fact for an agent
  app.post('/api/agents/:id/knowledge', async (req: Request, res: Response) => {
    const { type, key, title, body, tags } = req.body;
    await knowledgeBase.store({
      agentId: req.params.id,
      type,
      key: key || `manual-${Date.now()}`,
      title,
      body,
      tags: tags || [],
    });
    const fact = await prisma.agentMemory.findUnique({
      where: { agentId_key: { agentId: req.params.id, key: key || `manual-${Date.now()}` } },
    });
    res.status(201).json(fact);
  });

  // Store feedback for an agent
  app.post('/api/agents/:id/feedback', async (req: Request, res: Response) => {
    const { feedback, context, fromUserId } = req.body;
    await knowledgeBase.storeFeedback({
      agentId: req.params.id,
      fromUserId,
      feedback,
      context,
    });
    res.status(201).json({ message: 'Feedback stored' });
  });

  // Retrieve relevant knowledge for a given task context
  app.post('/api/knowledge/retrieve', async (req: Request, res: Response) => {
    const { agentId, taskTitle, taskDescription, maxResults } = req.body;
    const facts = await knowledgeBase.retrieve({
      agentId,
      taskTitle,
      taskDescription,
      maxResults,
    });
    res.json(facts);
  });

  // ── Board Members ─────────────────────────────────────────────────────────────
  app.get('/api/board', async (_req, res) => {
    const members = await prisma.boardMember.findMany({
      where: { isActive: true },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(members);
  });

  app.post('/api/board', async (req: Request, res: Response) => {
    const { userId, name, email, voteWeight } = req.body;
    const member = await prisma.boardMember.upsert({
      where: { userId },
      update: { name, email, isActive: true },
      create: { userId, name, email, voteWeight: voteWeight ?? 1 },
    });
    res.status(201).json(member);
  });

  app.patch('/api/board/:id', async (req, res) => {
    const member = await prisma.boardMember.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(member);
  });

  // ── Constitution ──────────────────────────────────────────────────────────────
  app.get('/api/constitution', async (_req, res) => {
    const c = await prisma.constitution.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });
    res.json(c);
  });

  // ── Proposals ─────────────────────────────────────────────────────────────────
  app.get('/api/proposals', async (req, res) => {
    const status = req.query.status as string | undefined;
    const proposals = await prisma.proposal.findMany({
      where: status ? { status: status as 'open' | 'passed' | 'rejected' | 'executed' | 'expired' } : undefined,
      include: { _count: { select: { votes: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(proposals);
  });

  app.post('/api/proposals', async (req: Request, res: Response) => {
    const { type, title, description, payload, proposedByUserId, votingWindowHours } = req.body;

    const constitution = await prisma.constitution.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!constitution) return res.status(400).json({ error: 'No active constitution' });

    const proposal = await governance.createProposal({
      constitutionId: constitution.id,
      type,
      title,
      description,
      payload,
      proposedByUserId,
      votingWindowHours,
    });
    res.status(201).json(proposal);
  });

  app.get('/api/proposals/:id', async (req, res) => {
    const proposal = await prisma.proposal.findUnique({
      where: { id: req.params.id },
      include: { votes: true },
    });
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json(proposal);
  });

  app.post('/api/proposals/:id/vote', async (req: Request, res: Response) => {
    const { choice, rationale, voterUserId, voterAgentId } = req.body;
    try {
      const vote = await governance.castVote({
        proposalId: req.params.id,
        voterUserId,
        voterAgentId,
        choice,
        rationale,
      });
      res.status(201).json(vote);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── Income & Profit Distribution ──────────────────────────────────────────────
  app.get('/api/income', async (_req, res) => {
    const income = await prisma.incomeEvent.findMany({
      orderBy: { recordedAt: 'desc' },
      take: 50,
    });
    res.json(income);
  });

  app.post('/api/income', async (req: Request, res: Response) => {
    const { source, description, amountCents, currency, boardMemberIds } = req.body;

    const income = await prisma.incomeEvent.create({
      data: {
        source,
        description,
        amountCents,
        currency: currency || 'TWD',
        recordedAt: new Date(),
      },
    });

    // Auto-distribute immediately
    await profitDistributor.distribute({
      incomeEventId: income.id,
      boardMemberIds: boardMemberIds || [],
    });

    const updated = await prisma.incomeEvent.findUnique({
      where: { id: income.id },
      include: { distribution: { include: { lineItems: true } } },
    });
    res.status(201).json(updated);
  });

  app.get('/api/distributions', async (_req, res) => {
    const dists = await prisma.distribution.findMany({
      include: { lineItems: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(dists);
  });

  app.patch('/api/distributions/:distId/line-items/:itemId/pay', async (req, res) => {
    const item = await prisma.distributionLineItem.update({
      where: { id: req.params.itemId },
      data: { paid: true, paidAt: new Date(), note: req.body.note },
    });
    res.json(item);
  });

  // ── Finance: Chart of Accounts ───────────────────────────────────────────────
  app.get('/api/finance/accounts', async (_req, res) => {
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    res.json(accounts);
  });

  // ── Finance: Journal Entries ─────────────────────────────────────────────────
  app.get('/api/finance/journals', async (req, res) => {
    const { start, end } = req.query as Record<string, string>;
    const journals = await prisma.journal.findMany({
      where: {
        status: 'posted',
        ...(start || end ? {
          date: {
            ...(start && { gte: new Date(start) }),
            ...(end && { lte: new Date(end) }),
          },
        } : {}),
      },
      include: { entries: { include: { account: { select: { code: true, name: true } } } } },
      orderBy: { date: 'desc' },
      take: 100,
    });
    res.json(journals);
  });

  // Post a manual journal entry
  app.post('/api/finance/journals', async (req: Request, res: Response) => {
    const { date, description, reference, currency, entries } = req.body;
    try {
      const journalId = await ledger.post({
        date: date ? new Date(date) : undefined,
        description,
        reference,
        currency,
        entries,
      });
      const journal = await prisma.journal.findUnique({
        where: { id: journalId },
        include: { entries: { include: { account: true } } },
      });
      res.status(201).json(journal);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Record income (shortcut — also creates journal entry)
  app.post('/api/finance/income', async (req: Request, res: Response) => {
    const { amountCents, revenueAccountCode, description, reference, currency } = req.body;
    try {
      const journalId = await ledger.recordIncome({
        amountCents,
        revenueAccountCode: revenueAccountCode || '4009',
        description,
        reference,
        currency,
      });
      res.status(201).json({ journalId });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Record expense (shortcut)
  app.post('/api/finance/expenses', async (req: Request, res: Response) => {
    const { amountCents, expenseAccountCode, description, reference, currency } = req.body;
    try {
      const journalId = await ledger.recordExpense({
        amountCents,
        expenseAccountCode: expenseAccountCode || '6090',
        description,
        reference,
        currency,
      });
      res.status(201).json({ journalId });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── Finance: Reports ─────────────────────────────────────────────────────────
  // Get previously generated reports
  app.get('/api/finance/reports', async (req, res) => {
    const { type } = req.query as Record<string, string>;
    const reports = await prisma.financialReport.findMany({
      where: type ? { type: type as 'income_statement' | 'balance_sheet' | 'cash_flow' | 'trial_balance' } : undefined,
      orderBy: { generatedAt: 'desc' },
      take: 20,
      select: { id: true, type: true, periodStart: true, periodEnd: true, generatedAt: true, summary: true },
    });
    res.json(reports);
  });

  app.get('/api/finance/reports/:id', async (req, res) => {
    const report = await prisma.financialReport.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  });

  // Generate P&L
  app.post('/api/finance/reports/income-statement', async (req: Request, res: Response) => {
    const { periodStart, periodEnd } = req.body;
    const start = periodStart ? new Date(periodStart) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = periodEnd ? new Date(periodEnd) : new Date();
    try {
      const report = await reporter.generateIncomeStatement(start, end);
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Generate Balance Sheet
  app.post('/api/finance/reports/balance-sheet', async (req: Request, res: Response) => {
    const asOf = req.body.asOf ? new Date(req.body.asOf) : new Date();
    try {
      const report = await reporter.generateBalanceSheet(asOf);
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Generate Cash Flow Statement
  app.post('/api/finance/reports/cash-flow', async (req: Request, res: Response) => {
    const { periodStart, periodEnd } = req.body;
    const start = periodStart ? new Date(periodStart) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = periodEnd ? new Date(periodEnd) : new Date();
    try {
      const report = await reporter.generateCashFlow(start, end);
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Generate Trial Balance
  app.post('/api/finance/reports/trial-balance', async (req: Request, res: Response) => {
    const asOf = req.body.asOf ? new Date(req.body.asOf) : new Date();
    try {
      const report = await reporter.generateTrialBalance(asOf);
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── Archive (檔案庫 / 會議記錄) ──────────────────────────────────────────────

  // List archive entries (with search + filter)
  app.get('/api/archive', async (req, res) => {
    const { q, type, start, end, limit } = req.query as Record<string, string>;
    const entries = await archiveService.search({
      q,
      type,
      startDate: start ? new Date(start) : undefined,
      endDate: end ? new Date(end) : undefined,
      limit: limit ? parseInt(limit) : 50,
    });
    res.json(entries);
  });

  // Get a single archive entry
  app.get('/api/archive/:id', async (req, res) => {
    const entry = await prisma.archiveEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) return res.status(404).json({ error: 'Archive entry not found' });
    res.json(entry);
  });

  // Create a manual archive entry (meeting minutes, strategic notes, etc.)
  app.post('/api/archive', async (req: Request, res: Response) => {
    const { type, title, summary, body, tags, authorUserId, occurredAt } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title and body are required' });

    const entry = await prisma.archiveEntry.create({
      data: {
        type: type || 'strategic_note',
        title,
        summary: summary || body.slice(0, 200),
        body,
        tags: tags || [],
        authorUserId,
        isAutoGenerated: false,
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
    });
    res.status(201).json(entry);
  });

  // Archive stats for dashboard
  app.get('/api/archive/stats/summary', async (_req, res) => {
    const [total, byType, recent] = await Promise.all([
      prisma.archiveEntry.count(),
      prisma.archiveEntry.groupBy({ by: ['type'], _count: true }),
      prisma.archiveEntry.findMany({
        orderBy: { occurredAt: 'desc' },
        take: 5,
        select: { id: true, type: true, title: true, occurredAt: true, isAutoGenerated: true },
      }),
    ]);
    res.json({ total, byType: Object.fromEntries(byType.map((b) => [b.type, b._count])), recent });
  });

  return app;
}
