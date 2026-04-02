import { AgentRunner } from './runner';
import { prisma } from '../lib/prisma';
const runner = new AgentRunner();

/**
 * TaskRouter — picks the best available agent for each unassigned task.
 *
 * Routing logic (priority order):
 * 1. If task has explicit required capabilities, prefer agents that have all of them.
 * 2. Prefer agents with the fewest active tasks (load balancing).
 * 3. Respect maxParallelTasks per agent.
 * 4. Skip paused or error-state agents.
 */
export class TaskRouter {
  /**
   * Route all unassigned todo tasks to available agents.
   * Call this on every scheduler tick.
   */
  async routeAll(): Promise<void> {
    const unassigned = await prisma.task.findMany({
      where: {
        status: 'todo',
        assigneeId: null,
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: 20,
    });

    for (const task of unassigned) {
      const agent = await this.pickAgent(task.labels);
      if (!agent) continue;

      await prisma.task.update({
        where: { id: task.id },
        data: { assigneeId: agent.id, status: 'in_progress' },
      });

      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          content: `Assigned to **${agent.name}** by task router.`,
          isSystem: true,
        },
      });

      // Fire-and-forget the run (scheduler manages concurrency)
      runner.run(agent, task).catch(async (err) => {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: 'blocked',
            blockedReason: `Agent run failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        });
      });
    }
  }

  private async pickAgent(requiredLabels: string[]) {
    const agents = await prisma.agent.findMany({
      where: { status: { in: ['idle', 'running'] } },
      include: {
        _count: { select: { tasks: { where: { status: 'in_progress' } } } },
      },
    });

    // Filter by capacity
    const available = agents.filter(
      (a) => a._count.tasks < a.maxParallelTasks,
    );

    if (available.length === 0) return null;

    // Score by capability match + load
    const scored = available.map((a) => {
      const capabilityMatch =
        requiredLabels.length === 0
          ? 1
          : requiredLabels.filter((l) => a.capabilities.includes(l)).length /
            requiredLabels.length;
      const load = 1 - a._count.tasks / a.maxParallelTasks;
      return { agent: a, score: capabilityMatch * 0.7 + load * 0.3 };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.agent ?? null;
  }
}
