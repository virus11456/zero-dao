import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3200'),

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  ai: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
  },

  github: {
    token: process.env.GITHUB_TOKEN!,
    org: process.env.GITHUB_ORG || 'virus11456',
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '832659652',
  },

  heartbeat: {
    intervalSec: parseInt(process.env.HEARTBEAT_INTERVAL_SEC || '3600'),
    maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '5'),
  },

  activeRepos: (process.env.ACTIVE_REPOS || '').split(',').filter(Boolean),
};

// Validate required fields
const required = ['DATABASE_URL', 'ANTHROPIC_API_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
