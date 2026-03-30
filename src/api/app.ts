import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { TaskRouter } from '../tasks/router';
import { GovernanceEngine } from '../governance/engine';
import { ProfitDistributor } from '../governance/profit-distributor';
import { KnowledgeBase } from '../memory/knowledge-base';

const prisma = new PrismaClient();
const router = new TaskRouter();
const governance = new GovernanceEngine();
const profitDistributor = new ProfitDistributor();
const knowledgeBase = new KnowledgeBase();

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

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

  return app;
}
