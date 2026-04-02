import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { prisma } from '../lib/prisma';

/**
 * GoalDecomposer — the autonomous planning brain of the DAO.
 *
 * Given a high-level goal, uses Claude to:
 * 1. Break it into concrete milestones
 * 2. Generate actionable tasks for each milestone
 * 3. Assign required capabilities/labels to each task
 * 4. Create the tasks in the database
 *
 * This is what makes the DAO truly autonomous: humans only define GOALS,
 * not tasks. The system figures out what to do.
 */
export class GoalDecomposer {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl,
    });
  }

  /**
   * Decompose a goal into tasks and create them in the DB.
   * Returns the number of tasks created.
   */
  async decompose(opts: {
    goalId: string;
    goalTitle: string;
    goalDescription?: string;
    projectId?: string;
    existingTaskTitles?: string[]; // to avoid duplicates
  }): Promise<number> {
    const systemPrompt = `You are the strategic planning brain of a fully autonomous AI company.
Given a high-level business goal, you break it down into concrete, actionable tasks.

Rules:
- Each task must be completable by a single AI agent in one work session.
- Tasks must be specific enough that an AI agent can execute them without asking questions.
- Do NOT create tasks that require human approval (the company is zero-human).
- Assign capabilities from: typescript, python, react, nextjs, seo, content, devops, github, postgresql, redis, research, analytics, design.
- Avoid duplicating existing tasks.`;

    const existingStr =
      opts.existingTaskTitles && opts.existingTaskTitles.length > 0
        ? `\n\nAlready existing tasks (do NOT create duplicates):\n${opts.existingTaskTitles.map((t) => `- ${t}`).join('\n')}`
        : '';

    const userMessage = `Goal: ${opts.goalTitle}
${opts.goalDescription ? `Description: ${opts.goalDescription}` : ''}
${existingStr}

Decompose this goal into 3-8 actionable tasks. Return ONLY valid JSON, no markdown:

{
  "milestones": [
    {
      "name": "Milestone name",
      "tasks": [
        {
          "title": "Specific task title",
          "description": "Clear description of exactly what to do",
          "priority": "critical|high|medium|low",
          "capabilities": ["typescript", "react"],
          "estimatedSessions": 1
        }
      ]
    }
  ]
}`;

    let raw: string;
    try {
      const response = await this.client.messages.create({
        model: config.ai.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      raw = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');
    } catch (err) {
      console.error('[GoalDecomposer] Claude API error:', err);
      return 0;
    }

    // Parse JSON (may be wrapped in code block)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[GoalDecomposer] No JSON in response');
      return 0;
    }

    let plan: {
      milestones: Array<{
        name: string;
        tasks: Array<{
          title: string;
          description?: string;
          priority?: string;
          capabilities?: string[];
        }>;
      }>;
    };

    try {
      plan = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('[GoalDecomposer] JSON parse error:', err);
      return 0;
    }

    let tasksCreated = 0;

    for (const milestone of plan.milestones || []) {
      for (const task of milestone.tasks || []) {
        // Get next task number
        const seq = await prisma.taskSequence.update({
          where: { id: 'singleton' },
          data: { nextNum: { increment: 1 } },
        });

        const created = await prisma.task.create({
          data: {
            identifier: `ZD-${seq.nextNum}`,
            title: task.title,
            description: task.description,
            priority: (task.priority as 'critical' | 'high' | 'medium' | 'low') || 'medium',
            projectId: opts.projectId,
            goalId: opts.goalId,
            labels: task.capabilities || [],
            status: 'todo',
          },
        });

        await prisma.taskComment.create({
          data: {
            taskId: created.id,
            content: `Auto-generated from goal: **${opts.goalTitle}**\nMilestone: ${milestone.name}`,
            isSystem: true,
          },
        });

        tasksCreated++;
      }
    }

    console.log(`[GoalDecomposer] Created ${tasksCreated} tasks for goal: ${opts.goalTitle}`);
    return tasksCreated;
  }
}
