import { CronJob } from 'cron';
import { PrismaClient } from '@prisma/client';
import { TaskRouter } from '../tasks/router';
import { AutonomousLoop } from '../agents/autonomous-loop';
import { GovernanceEngine } from '../governance/engine';
import { FinancialReporter } from '../finance/reporter';
import { Ledger } from '../finance/ledger';
import { notify } from '../telegram/bot';

const prisma = new PrismaClient();
const router = new TaskRouter();
const autonomousLoop = new AutonomousLoop();
const governanceEngine = new GovernanceEngine();
const financialReporter = new FinancialReporter();
const ledger = new Ledger();

function fmtTWD(cents: number): string {
  return `NT$ ${(cents / 100).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`;
}

/**
 * Scheduler — the heartbeat of the zero-dao.
 *
 * Schedules:
 * - Every 5 min: route unassigned tasks to agents
 * - Every 10 min: autonomous loop (goal decomposition + self-healing)
 * - Every 30 min: detect stuck in-progress tasks
 * - Every hour: tally governance proposals
 * - Daily at 9am: digest (tasks + goals + finance summary)
 * - 1st of month at 8am: generate full financial reports
 */
export class Scheduler {
  private taskRouterJob: CronJob;
  private autonomousLoopJob: CronJob;
  private stuckCheckJob: CronJob;
  private governanceTallyJob: CronJob;
  private dailyDigestJob: CronJob;
  private monthlyReportJob: CronJob;

  constructor() {
    this.taskRouterJob = new CronJob('*/5 * * * *', () => {
      this.runTaskRouter().catch(console.error);
    });

    this.autonomousLoopJob = new CronJob('*/10 * * * *', () => {
      this.runAutonomousLoop().catch(console.error);
    });

    this.stuckCheckJob = new CronJob('*/30 * * * *', () => {
      this.checkStuckTasks().catch(console.error);
    });

    this.governanceTallyJob = new CronJob('0 * * * *', () => {
      governanceEngine.tallyAll().catch(console.error);
    });

    this.dailyDigestJob = new CronJob('0 9 * * *', () => {
      this.sendDailyDigest().catch(console.error);
    });

    // Monthly financial reports: 1st of every month at 8:00am
    this.monthlyReportJob = new CronJob('0 8 1 * *', () => {
      this.generateMonthlyFinancialReports().catch(console.error);
    });
  }

  start(): void {
    this.taskRouterJob.start();
    this.autonomousLoopJob.start();
    this.stuckCheckJob.start();
    this.governanceTallyJob.start();
    this.dailyDigestJob.start();
    this.monthlyReportJob.start();
    console.log(
      '[Scheduler] Started:\n' +
      '  Task router: every 5min\n' +
      '  Autonomous loop: every 10min\n' +
      '  Stuck check: every 30min\n' +
      '  Governance tally: hourly\n' +
      '  Daily digest: 9am\n' +
      '  Monthly finance report: 1st of month 8am',
    );
  }

  stop(): void {
    this.taskRouterJob.stop();
    this.autonomousLoopJob.stop();
    this.stuckCheckJob.stop();
    this.governanceTallyJob.stop();
    this.dailyDigestJob.stop();
    this.monthlyReportJob.stop();
  }

  private async runTaskRouter(): Promise<void> {
    try {
      await router.routeAll();
    } catch (err) {
      console.error('[Scheduler] Task routing error:', err);
    }
  }

  private async runAutonomousLoop(): Promise<void> {
    try {
      await autonomousLoop.tick();
    } catch (err) {
      console.error('[Scheduler] Autonomous loop error:', err);
    }
  }

  private async checkStuckTasks(): Promise<void> {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const stuck = await prisma.task.findMany({
      where: { status: 'in_progress', updatedAt: { lt: cutoff } },
      include: { assignee: true },
    });

    for (const task of stuck) {
      console.warn(`[Scheduler] Stuck task: ${task.identifier}`);
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'blocked',
          blockedReason: '進行中超過2小時無進度，自動移至阻塞狀態。',
          assigneeId: null,
        },
      });
      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          content: `⚠️ 自動移至阻塞 — 超過2小時無進度。原分配: ${task.assignee?.name ?? '未知'}`,
          isSystem: true,
        },
      });
      await notify(
        `⚠️ *任務卡住*\n\`${task.identifier}\` ${task.title}\n已自動移至阻塞，需要檢視。`,
      );
    }
  }

  private async sendDailyDigest(): Promise<void> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Task stats
    const [inProgress, blocked, done24h, todo, activeGoals] = await Promise.all([
      prisma.task.count({ where: { status: 'in_progress' } }),
      prisma.task.count({ where: { status: 'blocked' } }),
      prisma.task.count({ where: { status: 'done', completedAt: { gte: yesterday } } }),
      prisma.task.count({ where: { status: 'todo' } }),
      prisma.goal.count({ where: { status: { in: ['active', 'planning'] } } }),
    ]);

    // Financial snapshot
    let cashLine = '';
    let incomeLine = '';
    try {
      const [cashBalance, monthIncome] = await Promise.all([
        ledger.getBalance({ accountCode: '1001' }),
        prisma.incomeEvent.aggregate({
          _sum: { amountCents: true },
          where: { recordedAt: { gte: monthStart } },
        }),
      ]);
      cashLine = `💵 現金: ${fmtTWD(cashBalance)}`;
      incomeLine = `📈 本月收入: ${fmtTWD(monthIncome._sum.amountCents ?? 0)}`;
    } catch {
      cashLine = '💵 現金: (無資料)';
    }

    // Blocked tasks
    const blockedTasks = await prisma.task.findMany({
      where: { status: 'blocked' },
      select: { identifier: true, title: true },
      take: 3,
    });

    const lines = [
      `📊 *每日摘要 — ${now.toLocaleDateString('zh-TW')}*`,
      ``,
      `*任務*`,
      `✅ 完成（24h）: ${done24h}`,
      `⚙️ 進行中: ${inProgress}`,
      `📋 待辦: ${todo}  🚫 阻塞: ${blocked}`,
      `🎯 進行中目標: ${activeGoals}`,
      ``,
      `*財務*`,
      cashLine,
      incomeLine,
    ];

    if (blockedTasks.length > 0) {
      lines.push(`\n*需要注意:*`);
      for (const t of blockedTasks) {
        lines.push(`• \`${t.identifier}\` ${t.title.slice(0, 45)}`);
      }
    }

    await notify(lines.join('\n'));
  }

  private async generateMonthlyFinancialReports(): Promise<void> {
    // Generate reports for the PREVIOUS month
    const now = new Date();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);

    const monthLabel = prevMonthStart.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' });

    console.log(`[Scheduler] Generating monthly reports for ${monthLabel}`);
    await notify(`📑 *月報生成中*\n${monthLabel} 財務報表生成中...`);

    try {
      const [pl, bs, cf] = await Promise.all([
        financialReporter.generateIncomeStatement(prevMonthStart, prevMonthEnd),
        financialReporter.generateBalanceSheet(prevMonthEnd),
        financialReporter.generateCashFlow(prevMonthStart, prevMonthEnd),
      ]);

      const plData = pl as { revenue: { total: number }; netIncome: number; netMarginPct: string; summary?: string };
      const bsData = bs as { assets: { total: number }; isBalanced: boolean };
      const cfData = cf as { closingCash: number; netCashChange: number };

      const lines = [
        `📑 *${monthLabel} 月報完成*`,
        ``,
        `*損益表*`,
        `總收入: ${fmtTWD(plData.revenue.total)}`,
        `淨利: ${fmtTWD(plData.netIncome)} (${plData.netMarginPct}%)`,
        ``,
        `*資產負債表*`,
        `總資產: ${fmtTWD(bsData.assets.total)}`,
        `帳目平衡: ${bsData.isBalanced ? '✅' : '❌'}`,
        ``,
        `*現金流量*`,
        `期末現金: ${fmtTWD(cfData.closingCash)}`,
        `淨現金變動: ${fmtTWD(cfData.netCashChange)}`,
      ];

      if (plData.summary) {
        lines.push(``, `*CFO 分析:*`, plData.summary.slice(0, 500));
      }

      await notify(lines.join('\n'));
    } catch (err) {
      await notify(`❌ 月報生成失敗: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
