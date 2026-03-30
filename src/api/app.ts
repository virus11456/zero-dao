import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { TaskRouter } from '../tasks/router';

const prisma = new PrismaClient();
const router = new TaskRouter();

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
    const [inProgress, blocked, done, todo, agents] = await Promise.all([
      prisma.task.count({ where: { status: 'in_progress' } }),
      prisma.task.count({ where: { status: 'blocked' } }),
      prisma.task.count({ where: { status: 'done' } }),
      prisma.task.count({ where: { status: 'todo' } }),
      prisma.agent.groupBy({ by: ['status'], _count: true }),
    ]);

    res.json({
      tasks: { inProgress, blocked, done, todo },
      agents: Object.fromEntries(agents.map((a) => [a.status, a._count])),
    });
  });

  // ── Error handler ────────────────────────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Error]', err);
    res.status(500).json({ error: err.message });
  });

  return app;
}
