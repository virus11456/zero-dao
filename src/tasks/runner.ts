import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * AgentRunner — stub that records an agent run for a given task.
 * Full AI-execution is handled by external heartbeat runners (e.g. Paperclip agents).
 */
export class AgentRunner {
  async run(agent: { id: string; name: string }, task: { id: string; title: string }): Promise<void> {
    await prisma.agentRun.create({
      data: {
        agentId: agent.id,
        taskId: task.id,
        status: 'running',
        startedAt: new Date(),
        logs: [`Task "${task.title}" queued for ${agent.name}`],
      },
    });
  }
}
