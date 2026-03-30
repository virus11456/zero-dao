import { config } from './config';
import { createApp } from './api/app';
import { Scheduler } from './scheduler';
import { startCommandListener, notify } from './telegram/bot';

async function main() {
  console.log('[zero-dao] Starting...');

  // HTTP API server
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[zero-dao] API server running on port ${config.port}`);
  });

  // Scheduler (task routing, stuck-task detection, daily digest)
  const scheduler = new Scheduler();
  scheduler.start();

  // Telegram bot (optional — only if token is configured)
  if (config.telegram.botToken) {
    startCommandListener();
    await notify('🤖 *zero-dao started*\nAll systems operational.');
  }

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[zero-dao] SIGTERM received. Shutting down...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    scheduler.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[zero-dao] Fatal startup error:', err);
  process.exit(1);
});
