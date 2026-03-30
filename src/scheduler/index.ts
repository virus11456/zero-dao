import { CronJob } from 'cron';
import { PrismaClient } from '@prisma/client';
import { TaskRouter } from '../tasks/router';
import { AutonomousLoop } from '../agents/autonomous-loop';
import { GovernanceEngine } from '../governance/engine';
import { notify } from '../telegram/bot';

const prisma = new PrismaClient();
const router = new TaskRouter();
const autonomousLoop = new AutonomousLoop();
const governanceEngine = new GovernanceEngine();

/**
 * Scheduler — the heartbeat of the zero-dao.
 *
 * Runs at configured intervals to:
 * 1. Route unassigned tasks to available agents.
 * 2. Check for stale in-progress tasks (stuck agents).
 * 3. Send daily digest to Telegram.
 * 4. Prune completed runs older than 30 days.
 */
export class Scheduler {
  private autonomousLoopJob: CronJob;
  private taskRouterJob: CronJob;
  private governanceTallyJob: CronJob;
  private stuckCheckJob: CronJob;
  private dailyDigestJob: CronJob;

  constructor() {
    // Autonomous loop: goal decomposition + self-healing (every 10 minutes)
    this.autonomousLoopJob = new CronJob('*/10 * * * *', () => {
      this.runAutonomousLoop().catch(console.error);
    });

    // Route tasks every 5 minutes
    this.taskRouterJob = new CronJob('*/5 * * * *', () => {
      this.runTaskRouter().catch(console.error);
    });

    // Governance tally: check proposals every hour
    this.governanceTallyJob = new CronJob('0 * * * *', () => {
      governanceEngine.tallyAll().catch(console.error);
    });

    // Check for stuck tasks every 30 minutes
    this.stuckCheckJob = new CronJob('*/30 * * * *', () => {
      this.checkStuckTasks().catch(console.error);
    });

    // Daily digest at 9am
    this.dailyDigestJob = new CronJob('0 9 * * *', () => {
      this.sendDailyDigest().catch(console.error);
    });
  }

  start(): void {
    this.autonomousLoopJob.start();
    this.taskRouterJob.start();
    this.governanceTallyJob.start();
    this.stuckCheckJob.start();
    this.dailyDigestJob.start();
    console.log('[Scheduler] Started. Autonomous loop: 10min, Task router: 5min, Governance tally: hourly, Digest: 9am daily.');
  }

  stop(): void {
    this.autonomousLoopJob.stop();
    this.taskRouterJob.stop();
    this.governanceTallyJob.stop();
    this.stuckCheckJob.stop();
    this.dailyDigestJob.stop();
  }

  private async runAutonomousLoop(): Promise<void> {
    try {
      await autonomousLoop.tick();
    } catch (err) {
      console.error('[Scheduler] Autonomous loop error:', err);
    }
  }

  private async runTaskRouter(): Promise<void> {
    try {
      await router.routeAll();
    } catch (err) {
      console.error('[Scheduler] Task routing error:', err);
    }
  }

  private async checkStuckTasks(): Promise<void> {
    // Tasks in-progress for > 2 hours without a recent run
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const stuck = await prisma.task.findMany({
      where: {
        status: 'in_progress',
        updatedAt: { lt: cutoff },
      },
      include: { assignee: true },
    });

    for (const task of stuck) {
      console.warn(`[Scheduler] Stuck task detected: ${task.identifier} - ${task.title}`);
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'blocked',
          blockedReason: 'Task was in-progress for >2 hours without progress. Needs review.',
          assigneeId: null,
        },
      });
      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          content: `⚠️ Task automatically moved to blocked — no progress for 2+ hours. Previously assigned to ${task.assignee?.name || 'unknown'}.`,
          isSystem: true,
        },
      });
      await notify(
        `⚠️ *Stuck task detected*\n[${task.identifier}] ${task.title}\nMoved to blocked — needs board review.`,
      );
    }
  }

  private async sendDailyDigest(): Promise<void> {
    const [inProgress, blocked, done, todo] = await Promise.all([
      prisma.task.count({ where: { status: 'in_progress' } }),
      prisma.task.count({ where: { status: 'blocked' } }),
      prisma.task.count({
        where: { status: 'done', completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.task.count({ where: { status: 'todo' } }),
    ]);

    const blockedTasks = await prisma.task.findMany({
      where: { status: 'blocked' },
      select: { identifier: true, title: true, blockedReason: true },
      take: 5,
    });

    const lines = [
      `📊 *Daily Digest — ${new Date().toLocaleDateString('zh-TW')}*`,
      ``,
      `✅ Done (24h): ${done}`,
      `⚙️ In Progress: ${inProgress}`,
      `📋 Todo: ${todo}`,
      `🚫 Blocked: ${blocked}`,
    ];

    if (blockedTasks.length > 0) {
      lines.push(`\n*Blocked tasks:*`);
      for (const t of blockedTasks) {
        lines.push(`• [${t.identifier}] ${t.title}`);
        if (t.blockedReason) {
          lines.push(`  _${t.blockedReason.slice(0, 100)}_`);
        }
      }
    }

    await notify(lines.join('\n'));
  }
}
