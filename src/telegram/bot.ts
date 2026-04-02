import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config';
import { FinancialReporter } from '../finance/reporter';
import { Ledger } from '../finance/ledger';
import { prisma } from '../lib/prisma';
const reporter = new FinancialReporter();
const ledger = new Ledger();

let bot: TelegramBot | null = null;

function getBot(): TelegramBot {
  if (!bot) {
    if (!config.telegram.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
    bot = new TelegramBot(config.telegram.botToken, { polling: false });
  }
  return bot;
}

export async function notify(message: string, chatId?: string): Promise<void> {
  const target = chatId || config.telegram.adminChatId;
  if (!target || !config.telegram.botToken) return;
  try {
    await getBot().sendMessage(target, message, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[Telegram] Failed to send notification:', err);
  }
}

export async function notifyTaskUpdate(opts: {
  taskId: string;
  taskTitle: string;
  status: string;
  agentName: string;
  comment?: string;
}): Promise<void> {
  const emoji =
    opts.status === 'done' ? '✅'
    : opts.status === 'blocked' ? '🚫'
    : opts.status === 'in_progress' ? '⚙️'
    : '📋';

  const lines = [
    `${emoji} *[${opts.taskId}] ${opts.taskTitle}*`,
    `Status: \`${opts.status}\``,
    `Agent: ${opts.agentName}`,
  ];
  if (opts.comment) {
    lines.push(`\n${opts.comment.slice(0, 300)}`);
  }

  await notify(lines.join('\n'));
}

/**
 * Format TWD cents as readable string
 */
function fmtTWD(cents: number): string {
  return `NT$ ${(cents / 100).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`;
}

/**
 * Handle /status command — show task overview
 */
async function handleStatus(chatId: string): Promise<void> {
  const [inProgress, blocked, todo, done24h] = await Promise.all([
    prisma.task.findMany({
      where: { status: 'in_progress' },
      include: { assignee: { select: { name: true } } },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.task.count({ where: { status: 'blocked' } }),
    prisma.task.count({ where: { status: 'todo' } }),
    prisma.task.count({
      where: {
        status: 'done',
        completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const lines = [
    `📊 *任務狀態*`,
    `✅ 完成（24h）: ${done24h}`,
    `⚙️ 進行中: ${inProgress.length}`,
    `📋 待辦: ${todo}`,
    `🚫 阻塞: ${blocked}`,
  ];

  if (inProgress.length > 0) {
    lines.push(`\n*進行中任務:*`);
    for (const t of inProgress) {
      lines.push(`• \`${t.identifier}\` ${t.title.slice(0, 40)} — _${t.assignee?.name ?? '未分配'}_`);
    }
  }

  await notify(lines.join('\n'), chatId);
}

/**
 * Handle /agents command — show agent overview
 */
async function handleAgents(chatId: string): Promise<void> {
  const agents = await prisma.agent.findMany({
    include: {
      _count: { select: { tasks: { where: { status: 'in_progress' } } } },
    },
    orderBy: { name: 'asc' },
  });

  const statusEmoji: Record<string, string> = {
    idle: '💤',
    running: '🟢',
    paused: '⏸️',
    error: '🔴',
  };

  const lines = [`🤖 *Agent 狀態*`];
  for (const a of agents) {
    const emoji = statusEmoji[a.status] ?? '❓';
    const activeTasks = a._count.tasks;
    lines.push(`${emoji} *${a.name}* (${a.role}) — ${activeTasks}/${a.maxParallelTasks} 任務`);
  }

  await notify(lines.join('\n'), chatId);
}

/**
 * Handle /finance command — show quick financial summary
 */
async function handleFinance(chatId: string): Promise<void> {
  try {
    const cashBalance = await ledger.getBalance({ accountCode: '1001' });

    // This month's income
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthlyIncome = await prisma.incomeEvent.aggregate({
      _sum: { amountCents: true },
      where: { recordedAt: { gte: monthStart } },
    });

    // Pending distributions
    const pendingPayouts = await prisma.distributionLineItem.aggregate({
      _sum: { amountCents: true },
      where: { paid: false },
    });

    // Open proposals
    const openProposals = await prisma.proposal.count({ where: { status: 'open' } });

    const lines = [
      `💰 *財務摘要*`,
      `現金餘額: ${fmtTWD(cashBalance)}`,
      `本月收入: ${fmtTWD(monthlyIncome._sum.amountCents ?? 0)}`,
      `待付分紅: ${fmtTWD(pendingPayouts._sum.amountCents ?? 0)}`,
      `待決議提案: ${openProposals} 件`,
      ``,
      `輸入 /report 生成月報`,
    ];

    await notify(lines.join('\n'), chatId);
  } catch (err) {
    await notify(`❌ 財務資料讀取失敗: ${err instanceof Error ? err.message : String(err)}`, chatId);
  }
}

/**
 * Handle /report command — generate and send this month's P&L
 */
async function handleReport(chatId: string): Promise<void> {
  await notify('📊 生成月報中，請稍候...', chatId);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const now = new Date();

  try {
    const pl = await reporter.generateIncomeStatement(monthStart, now) as {
      revenue: { total: number };
      expenses: { total: number };
      netIncome: number;
      netMarginPct: string;
      summary?: string;
    };

    const lines = [
      `📈 *本月損益表 (${monthStart.toLocaleDateString('zh-TW')} ~ ${now.toLocaleDateString('zh-TW')})*`,
      `收入: ${fmtTWD(pl.revenue.total)}`,
      `費用: ${fmtTWD(pl.expenses.total)}`,
      `淨利: ${fmtTWD(pl.netIncome)} (${pl.netMarginPct}%)`,
    ];

    if (pl.summary) {
      lines.push(``, `*CFO 分析:*`, pl.summary.slice(0, 400));
    }

    await notify(lines.join('\n'), chatId);
  } catch (err) {
    await notify(`❌ 月報生成失敗: ${err instanceof Error ? err.message : String(err)}`, chatId);
  }
}

/**
 * Handle /goals command — show active goals and progress
 */
async function handleGoals(chatId: string): Promise<void> {
  const goals = await prisma.goal.findMany({
    where: { status: { in: ['active', 'planning'] } },
    include: {
      _count: { select: { tasks: true } },
      tasks: { select: { status: true } },
    },
    take: 8,
    orderBy: { createdAt: 'desc' },
  });

  if (goals.length === 0) {
    await notify('📋 目前沒有進行中的目標。\n用 POST /api/goals 建立新目標。', chatId);
    return;
  }

  const lines = [`🎯 *進行中目標*`];
  for (const g of goals) {
    const done = g.tasks.filter((t) => t.status === 'done').length;
    const total = g.tasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    lines.push(`• *${g.title.slice(0, 45)}*`);
    lines.push(`  ${bar} ${pct}% (${done}/${total} 任務)`);
  }

  await notify(lines.join('\n'), chatId);
}

/**
 * Start Telegram command listener with fully implemented handlers.
 */
export function startCommandListener(): void {
  if (!config.telegram.botToken) {
    console.log('[Telegram] No bot token configured — skipping command listener');
    return;
  }

  const listeningBot = new TelegramBot(config.telegram.botToken, { polling: true });

  listeningBot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id.toString();
    await notify(
      `🤖 *zero-dao 已啟動*\n\n可用指令：\n/status — 任務狀態\n/agents — Agent 狀態\n/goals — 目標進度\n/finance — 財務摘要\n/report — 生成月報`,
      chatId,
    );
  });

  listeningBot.onText(/\/status/, async (msg) => {
    await handleStatus(msg.chat.id.toString());
  });

  listeningBot.onText(/\/agents/, async (msg) => {
    await handleAgents(msg.chat.id.toString());
  });

  listeningBot.onText(/\/finance/, async (msg) => {
    await handleFinance(msg.chat.id.toString());
  });

  listeningBot.onText(/\/report/, async (msg) => {
    await handleReport(msg.chat.id.toString());
  });

  listeningBot.onText(/\/goals/, async (msg) => {
    await handleGoals(msg.chat.id.toString());
  });

  listeningBot.on('polling_error', (err) => {
    console.error('[Telegram polling error]', err.message);
  });

  console.log('[Telegram] Command listener started. Commands: /start /status /agents /goals /finance /report');
}
