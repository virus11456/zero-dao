import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { Task, Agent } from '@prisma/client';
import { KnowledgeBase } from '../memory/knowledge-base';

const prisma = new PrismaClient();
const kb = new KnowledgeBase();

/**
 * AgentRunner — executes a single agent heartbeat for a given task.
 *
 * Responsibilities:
 * - Build context (task details, agent memory, project state)
 * - Call Claude with the agent's system prompt and task context
 * - Parse the response for actions (status update, comment, subtask creation)
 * - Write output back to DB
 */
export class AgentRunner {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl,
    });
  }

  async run(agent: Agent, task: Task): Promise<void> {
    const runRecord = await prisma.agentRun.create({
      data: {
        agentId: agent.id,
        taskId: task.id,
        status: 'running',
      },
    });

    try {
      // --- 1. Build context ---
      const context = await this.buildContext(agent, task);

      // --- 2. Call Claude ---
      const response = await this.client.messages.create({
        model: config.ai.model,
        max_tokens: 4096,
        system: agent.systemPrompt,
        messages: [
          {
            role: 'user',
            content: context,
          },
        ],
      });

      const usage = response.usage;
      const outputText = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('\n');

      // --- 3. Parse and apply actions ---
      const actionResult = await this.applyActions(agent, task, outputText);

      // --- 4. Extract and store lessons learned ---
      if (actionResult.finalStatus === 'done' || actionResult.finalStatus === 'blocked') {
        const lessonsStored = await kb.extractLessons({
          agentId: agent.id,
          taskTitle: task.title,
          taskDescription: task.description ?? undefined,
          taskOutcome: actionResult.comment || outputText.slice(0, 800),
          taskStatus: actionResult.finalStatus as 'done' | 'blocked',
        });
        if (lessonsStored > 0) {
          console.log(`[AgentRunner] Stored ${lessonsStored} lessons from task ${task.identifier}`);
        }
      }

      // --- 5. Record run ---
      const costCents = Math.round(
        (usage.input_tokens * 0.003 + usage.output_tokens * 0.015) / 10,
      );

      await prisma.agentRun.update({
        where: { id: runRecord.id },
        data: {
          status: 'completed',
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          costCents,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await prisma.agentRun.update({
        where: { id: runRecord.id },
        data: { status: 'failed', error: errMsg, completedAt: new Date() },
      });
      throw err;
    }
  }

  private async buildContext(agent: Agent, task: Task): Promise<string> {
    // Fetch relevant knowledge from KB (semantic retrieval)
    const relevantKnowledge = await kb.retrieve({
      agentId: agent.id,
      taskTitle: task.title,
      taskDescription: task.description ?? undefined,
      maxResults: 6,
    });

    // Fetch task comments
    const comments = await prisma.taskComment.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    // Fetch subtasks
    const subtasks = await prisma.task.findMany({
      where: { parentId: task.id },
      select: { identifier: true, title: true, status: true },
    });

    const knowledgeSection = kb.formatForContext(relevantKnowledge);

    const commentSection =
      comments.length > 0
        ? `## Task Discussion\n${comments.map((c) => `- ${c.content}`).join('\n')}`
        : '';

    const subtaskSection =
      subtasks.length > 0
        ? `## Subtasks\n${subtasks.map((s) => `- [${s.status}] ${s.identifier}: ${s.title}`).join('\n')}`
        : '';

    return `# Task Assignment

**Task ID:** ${task.identifier}
**Title:** ${task.title}
**Status:** ${task.status}
**Priority:** ${task.priority}

## Description
${task.description || 'No description provided.'}

${knowledgeSection}
${commentSection}
${subtaskSection}

---

Please work on this task. When done, respond with a JSON block in this format:

\`\`\`json
{
  "action": "update",
  "status": "done|in_progress|blocked",
  "comment": "What was done or what is blocking",
  "subtasks": [
    {"title": "subtask title", "description": "...", "priority": "high|medium|low"}
  ]
}
\`\`\`

Only include fields that apply. Status must be one of: done, in_progress, blocked.`;
  }

  private async applyActions(
    _agent: Agent,
    task: Task,
    output: string,
  ): Promise<{ finalStatus: string; comment: string }> {
    // Extract JSON block from response
    const jsonMatch = output.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      // No structured action — just add as a comment
      await prisma.taskComment.create({
        data: { taskId: task.id, content: output, isSystem: false },
      });
      return { finalStatus: 'in_progress', comment: output.slice(0, 500) };
    }

    let action: {
      action?: string;
      status?: string;
      comment?: string;
      subtasks?: Array<{ title: string; description?: string; priority?: string }>;
    };

    try {
      action = JSON.parse(jsonMatch[1]);
    } catch {
      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          content: `Failed to parse action JSON.\n\n${output}`,
          isSystem: true,
        },
      });
      return { finalStatus: 'in_progress', comment: '' };
    }

    // Update task status
    if (action.status) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: action.status as
            | 'done'
            | 'in_progress'
            | 'blocked'
            | 'todo'
            | 'backlog'
            | 'in_review'
            | 'cancelled',
          blockedReason: action.status === 'blocked' ? action.comment : null,
          completedAt: action.status === 'done' ? new Date() : null,
        },
      });
    }

    // Add comment
    if (action.comment) {
      await prisma.taskComment.create({
        data: { taskId: task.id, content: action.comment, isSystem: false },
      });
    }

    // Create subtasks
    if (action.subtasks && action.subtasks.length > 0) {
      for (const sub of action.subtasks) {
        const seq = await prisma.taskSequence.update({
          where: { id: 'singleton' },
          data: { nextNum: { increment: 1 } },
        });
        await prisma.task.create({
          data: {
            identifier: `ZD-${seq.nextNum}`,
            title: sub.title,
            description: sub.description,
            priority: (sub.priority as 'high' | 'medium' | 'low' | 'critical') || 'medium',
            parentId: task.id,
            projectId: task.projectId,
            status: 'todo',
          },
        });
      }
    }

    return { finalStatus: action.status || 'in_progress', comment: action.comment || '' };
  }
}
