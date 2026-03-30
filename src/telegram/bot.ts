import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config';

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
    opts.status === 'done'
      ? '✅'
      : opts.status === 'blocked'
        ? '🚫'
        : opts.status === 'in_progress'
          ? '⚙️'
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
 * Start a simple command listener for the board.
 * Commands:
 *   /status       — show all in-progress tasks
 *   /agents       — list agent statuses
 *   /pause <name> — pause an agent
 */
export function startCommandListener(): void {
  if (!config.telegram.botToken) return;
  const listeningBot = new TelegramBot(config.telegram.botToken, {
    polling: true,
  });

  listeningBot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id.toString();
    await notify('📊 Fetching task status...', chatId);
    // Actual status fetching is handled by the caller importing this module
    listeningBot.emit('command:status', chatId);
  });

  listeningBot.onText(/\/agents/, async (msg) => {
    const chatId = msg.chat.id.toString();
    listeningBot.emit('command:agents', chatId);
  });

  listeningBot.on('polling_error', (err) => {
    console.error('[Telegram polling error]', err.message);
  });

  console.log('[Telegram] Command listener started');
}
