import { PrismaClient } from '@prisma/client';
import { GoalDecomposer } from '../tasks/goal-decomposer';
import { notify } from '../telegram/bot';
import { ArchiveService } from '../archive/service';

const prisma = new PrismaClient();
const decomposer = new GoalDecomposer();
const archive = new ArchiveService();

/**
 * AutonomousLoop — the continuous self-operation engine of the DAO.
 *
 * This is what makes it a TRUE DAO (Decentralized Autonomous Organization):
 *
 * 1. Read active goals from DB
 * 2. If a goal has no tasks → decompose it into tasks automatically
 * 3. If all tasks for a goal are done → mark goal complete, notify board
 * 4. If a goal is stuck (blocked tasks, no progress) → self-heal by re-decomposing
 * 5. Continuously adapt: learn from completed work, refine future task generation
 *
 * Humans only need to:
 * - Define goals (what to achieve)
 * - Review outcomes (optional)
 * Everything else is autonomous.
 */
export class AutonomousLoop {
  /**
   * Run one full autonomous loop iteration.
   * Call this on every scheduler tick.
   */
  async tick(): Promise<void> {
    const goals = await prisma.goal.findMany({
      where: { status: { in: ['active', 'planning'] } },
      include: {
        tasks: {
          select: {
            id: true,
            status: true,
            title: true,
            labels: true,
          },
        },
      },
    });

    for (const goal of goals) {
      await this.processGoal(goal);
    }
  }

  private async processGoal(
    goal: {
      id: string;
      title: string;
      description: string | null;
      status: string;
      projectId: string | null;
      tasks: Array<{ id: string; status: string; title: string; labels: string[] }>;
    },
  ): Promise<void> {
    const tasks = goal.tasks;
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done' || t.status === 'cancelled').length;
    const active = tasks.filter((t) => t.status === 'in_progress').length;
    const blocked = tasks.filter((t) => t.status === 'blocked').length;
    const todo = tasks.filter((t) => t.status === 'todo').length;

    // Case 1: No tasks yet — decompose the goal
    if (total === 0) {
      console.log(`[AutonomousLoop] Decomposing goal: ${goal.title}`);
      const count = await decomposer.decompose({
        goalId: goal.id,
        goalTitle: goal.title,
        goalDescription: goal.description || undefined,
        projectId: goal.projectId || undefined,
      });

      await prisma.goal.update({
        where: { id: goal.id },
        data: { status: 'active' },
      });

      await notify(`🎯 *Goal activated*: ${goal.title}\n${count} tasks auto-generated and queued.`);
      return;
    }

    // Case 2: All tasks done — mark goal complete
    if (done === total && total > 0) {
      await prisma.goal.update({
        where: { id: goal.id },
        data: { status: 'completed', completedAt: new Date() },
      });

      // Archive the goal completion
      await archive.recordGoalCompletion(goal.id).catch(console.error);

      await notify(
        `✅ *Goal completed*: ${goal.title}\n${total} tasks done. The DAO advances.`,
      );
      return;
    }

    // Case 3: All remaining tasks are blocked with nothing in progress — self-heal
    const nonDone = total - done;
    if (nonDone > 0 && active === 0 && blocked === nonDone && todo === 0) {
      console.log(`[AutonomousLoop] Self-healing blocked goal: ${goal.title}`);

      // Generate fresh tasks to unblock progress
      const existingTitles = tasks.map((t) => t.title);
      const count = await decomposer.decompose({
        goalId: goal.id,
        goalTitle: goal.title,
        goalDescription: `Goal is stuck. All ${blocked} tasks are blocked. Generate alternative approaches to make progress.\n${goal.description || ''}`,
        projectId: goal.projectId || undefined,
        existingTaskTitles: existingTitles,
      });

      await notify(
        `🔄 *Self-healing*: "${goal.title}"\nAll tasks blocked. Generated ${count} alternative tasks.`,
      );
    }

    // Case 4: Progress report (log only, no action needed)
    const pct = Math.round((done / total) * 100);
    console.log(
      `[AutonomousLoop] Goal "${goal.title}": ${pct}% complete (${done}/${total} tasks, ${active} active, ${blocked} blocked)`,
    );
  }
}
