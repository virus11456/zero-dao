import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { prisma } from '../lib/prisma';

/**
 * KnowledgeBase — the learning and memory system for zero-dao agents.
 *
 * Each agent accumulates structured knowledge across all its task executions.
 * Knowledge is stored as typed facts (lessons, patterns, references, feedback)
 * and retrieved via semantic search before each task.
 *
 * This is what allows agents to:
 * - Not repeat the same mistakes
 * - Build on past successes
 * - Accumulate domain expertise over time
 * - Share relevant knowledge with other agents
 *
 * Knowledge types:
 *   lesson    — something learned from a completed task (what worked / what didn't)
 *   pattern   — a recurring pattern observed across multiple tasks
 *   reference — a useful external resource, tool, or fact
 *   feedback  — explicit feedback from board or other agents
 */

export type KnowledgeType = 'lesson' | 'pattern' | 'reference' | 'feedback';

export interface KnowledgeFact {
  id: string;
  agentId: string;
  agentName: string;
  type: KnowledgeType;
  key: string;
  title: string;
  body: string;
  tags: string[];
  accessCount: number;
  lastAccessAt: Date | null;
  createdAt: Date;
}

export class KnowledgeBase {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl,
    });
  }

  /**
   * Store a new knowledge fact for an agent.
   * If a fact with the same key exists, it is updated (upsert).
   */
  async store(opts: {
    agentId: string;
    type: KnowledgeType;
    key: string;
    title: string;
    body: string;
    tags?: string[];
  }): Promise<void> {
    await prisma.agentMemory.upsert({
      where: { agentId_key: { agentId: opts.agentId, key: opts.key } },
      update: {
        title: opts.title,
        body: opts.body,
        tags: opts.tags ?? [],
        updatedAt: new Date(),
      },
      create: {
        agentId: opts.agentId,
        type: opts.type,
        key: opts.key,
        title: opts.title,
        body: opts.body,
        tags: opts.tags ?? [],
      },
    });
  }

  /**
   * Retrieve the most relevant knowledge for a given task context.
   * Uses Claude to score relevance (simple approach without pgvector).
   */
  async retrieve(opts: {
    agentId: string;
    taskTitle: string;
    taskDescription?: string;
    maxResults?: number;
  }): Promise<KnowledgeFact[]> {
    const max = opts.maxResults ?? 8;

    // Get all memories for this agent (and cross-agent lessons)
    const all = await prisma.agentMemory.findMany({
      where: {
        OR: [
          { agentId: opts.agentId },
          { type: 'lesson' }, // lessons are shared across agents
          { type: 'pattern' }, // patterns are shared across agents
        ],
      },
      orderBy: [
        { accessCount: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: 50, // fetch candidates
      include: { agent: { select: { name: true } } },
    });

    if (all.length === 0) return [];

    // Use Claude to rank by relevance
    const query = `Task: ${opts.taskTitle}\n${opts.taskDescription ? `Description: ${opts.taskDescription}` : ''}`;

    const candidateList = all
      .map((m, i) => `[${i}] (${m.type}) ${m.title}: ${m.body.slice(0, 150)}`)
      .join('\n');

    let topIndices: number[];
    try {
      const response = await this.client.messages.create({
        model: config.ai.model,
        max_tokens: 256,
        system: 'You rank knowledge entries by relevance to a task. Return ONLY a JSON array of indices (numbers), most relevant first. Max ' + max + ' items. Example: [3, 7, 1]',
        messages: [
          {
            role: 'user',
            content: `Task context:\n${query}\n\nKnowledge entries:\n${candidateList}\n\nReturn the ${max} most relevant indices as a JSON array:`,
          },
        ],
      });

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');
      const match = text.match(/\[[\d,\s]+\]/);
      topIndices = match ? JSON.parse(match[0]) : [];
    } catch {
      // Fallback: return most accessed
      topIndices = all.slice(0, max).map((_, i) => i);
    }

    const results: KnowledgeFact[] = [];
    for (const idx of topIndices.slice(0, max)) {
      const m = all[idx];
      if (!m) continue;

      // Update access metadata
      await prisma.agentMemory.update({
        where: { id: m.id },
        data: { accessCount: { increment: 1 }, lastAccessAt: new Date() },
      });

      results.push({
        id: m.id,
        agentId: m.agentId,
        agentName: (m as typeof m & { agent: { name: string } }).agent.name,
        type: m.type as KnowledgeType,
        key: m.key,
        title: m.title,
        body: m.body,
        tags: m.tags,
        accessCount: m.accessCount + 1,
        lastAccessAt: new Date(),
        createdAt: m.createdAt,
      });
    }

    return results;
  }

  /**
   * After a task completes, extract and store lessons learned.
   * Called automatically by AgentRunner after each successful execution.
   */
  async extractLessons(opts: {
    agentId: string;
    taskTitle: string;
    taskDescription?: string;
    taskOutcome: string; // the agent's final comment / output
    taskStatus: 'done' | 'blocked';
  }): Promise<number> {
    const response = await this.client.messages.create({
      model: config.ai.model,
      max_tokens: 1024,
      system: `You extract durable lessons from completed tasks for an AI agent's knowledge base.
Focus on: what worked, what didn't, gotchas, patterns, useful facts.
Only extract genuinely reusable knowledge — skip task-specific details.
Return ONLY valid JSON, no markdown.`,
      messages: [
        {
          role: 'user',
          content: `Task: ${opts.taskTitle}
Status: ${opts.taskStatus}
${opts.taskDescription ? `Description: ${opts.taskDescription}` : ''}

Outcome / Output:
${opts.taskOutcome.slice(0, 1000)}

Extract 1-3 lessons. Return JSON:
{
  "lessons": [
    {
      "key": "unique-slug-for-this-lesson",
      "title": "Short title (< 60 chars)",
      "body": "The lesson in 2-4 sentences. Be specific and actionable.",
      "type": "lesson|pattern|reference",
      "tags": ["tag1", "tag2"]
    }
  ]
}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return 0;

    let parsed: { lessons?: Array<{ key: string; title: string; body: string; type: string; tags?: string[] }> };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return 0;
    }

    let stored = 0;
    for (const lesson of parsed.lessons ?? []) {
      await this.store({
        agentId: opts.agentId,
        type: (lesson.type as KnowledgeType) || 'lesson',
        key: lesson.key,
        title: lesson.title,
        body: lesson.body,
        tags: lesson.tags ?? [],
      });
      stored++;
    }

    return stored;
  }

  /**
   * Store explicit feedback for an agent from board or other agents.
   */
  async storeFeedback(opts: {
    agentId: string;
    fromUserId?: string;
    fromAgentId?: string;
    feedback: string;
    context?: string;
  }): Promise<void> {
    const key = `feedback-${Date.now()}`;
    await this.store({
      agentId: opts.agentId,
      type: 'feedback',
      key,
      title: opts.feedback.slice(0, 60),
      body: `${opts.feedback}${opts.context ? `\n\nContext: ${opts.context}` : ''}`,
      tags: ['feedback'],
    });
  }

  /**
   * Get a formatted knowledge summary for use in agent context.
   */
  formatForContext(facts: KnowledgeFact[]): string {
    if (facts.length === 0) return '';

    const sections: Record<string, KnowledgeFact[]> = {};
    for (const f of facts) {
      sections[f.type] = sections[f.type] ?? [];
      sections[f.type].push(f);
    }

    const lines: string[] = ['## Relevant Knowledge from Past Experience\n'];

    for (const [type, items] of Object.entries(sections)) {
      const label =
        type === 'lesson' ? '📚 Lessons Learned'
        : type === 'pattern' ? '🔁 Patterns'
        : type === 'feedback' ? '💬 Feedback Received'
        : '📎 References';
      lines.push(`### ${label}`);
      for (const item of items) {
        lines.push(`**${item.title}** _(from ${item.agentName})_`);
        lines.push(item.body);
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
