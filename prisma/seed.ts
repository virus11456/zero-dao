import { PrismaClient } from '@prisma/client';
import { DEFAULT_CONSTITUTION, DEFAULT_CONSTITUTION_RULES } from '../src/governance/constitution';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../src/finance/chart-of-accounts';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding zero-dao database...');

  // Initialize task sequence
  await prisma.taskSequence.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', nextNum: 1 },
  });

  // Seed Genesis Constitution (only if none exists)
  const existingConstitution = await prisma.constitution.findFirst({
    where: { isActive: true },
  });

  if (!existingConstitution) {
    await prisma.constitution.create({
      data: {
        version: 1,
        body: DEFAULT_CONSTITUTION,
        rules: DEFAULT_CONSTITUTION_RULES,
        isActive: true,
        ratifiedAt: new Date(),
      },
    });
    console.log('✅ Genesis Constitution created.');
  } else {
    console.log(`   Constitution v${existingConstitution.version} already exists.`);
  }

  // Seed Chart of Accounts
  const accountCount = await prisma.account.count();
  if (accountCount === 0) {
    for (const acct of DEFAULT_CHART_OF_ACCOUNTS) {
      await prisma.account.create({
        data: {
          code: acct.code,
          name: acct.name,
          nameEn: acct.nameEn,
          type: acct.type as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'cogs',
          isActive: true,
        },
      });
    }
    console.log(`✅ Chart of Accounts seeded (${DEFAULT_CHART_OF_ACCOUNTS.length} accounts).`);
  } else {
    console.log(`   Chart of Accounts already exists (${accountCount} accounts).`);
  }

  // Create default project
  const project = await prisma.project.upsert({
    where: { id: 'zero-dao-default' },
    update: {},
    create: {
      id: 'zero-dao-default',
      name: 'zero-dao Core',
      description: 'The zero-dao framework itself',
      repoUrl: 'https://github.com/virus11456/zero-dao',
      status: 'active',
    },
  });

  // Create default agents
  const ceo = await prisma.agent.upsert({
    where: { id: 'agent-ceo' },
    update: {},
    create: {
      id: 'agent-ceo',
      name: 'CEO',
      role: 'ceo',
      status: 'idle',
      model: 'claude-sonnet-4-6',
      capabilities: ['strategy', 'delegation', 'planning', 'hiring'],
      maxParallelTasks: 3,
      heartbeatIntervalSec: 3600,
      systemPrompt: `You are the CEO of a zero-person, fully automated company.
Your role: set strategy, delegate tasks to the right agents, unblock issues, monitor overall company health.
You report to the board (human owners). You own the P&L and all hiring decisions.
Be direct. Lead with action. When in doubt, delegate and verify.`,
    },
  });

  await prisma.agent.upsert({
    where: { id: 'agent-founding-eng' },
    update: {},
    create: {
      id: 'agent-founding-eng',
      name: 'Founding Engineer',
      role: 'engineer',
      status: 'idle',
      model: 'claude-sonnet-4-6',
      capabilities: ['typescript', 'python', 'react', 'nextjs', 'prisma', 'devops', 'github'],
      maxParallelTasks: 2,
      heartbeatIntervalSec: 3600,
      reportsToId: ceo.id,
      systemPrompt: `You are the Founding Engineer.
Your role: implement features, fix bugs, write clean code, manage deployments, and set technical foundations.
You work across the full stack: frontend (Next.js), backend (Node/Python), databases (PostgreSQL), and CI/CD.
Always use feature branches, never push directly to main. Write clear PR descriptions.`,
    },
  });

  await prisma.agent.upsert({
    where: { id: 'agent-backend-eng' },
    update: {},
    create: {
      id: 'agent-backend-eng',
      name: 'Backend Engineer',
      role: 'engineer',
      status: 'idle',
      model: 'claude-sonnet-4-6',
      capabilities: ['python', 'fastapi', 'postgresql', 'redis', 'celery', 'railway'],
      maxParallelTasks: 2,
      heartbeatIntervalSec: 3600,
      reportsToId: ceo.id,
      systemPrompt: `You are a Backend Engineer specializing in Python/FastAPI services.
Your role: build robust backend services, APIs, background workers, and database migrations.
You deploy primarily to Railway. Always run migrations before starting services.`,
    },
  });

  await prisma.agent.upsert({
    where: { id: 'agent-seo' },
    update: {},
    create: {
      id: 'agent-seo',
      name: 'SEO Expert',
      role: 'researcher',
      status: 'idle',
      model: 'claude-sonnet-4-6',
      capabilities: ['seo', 'content', 'keyword-research', 'analytics', 'wordpress'],
      maxParallelTasks: 2,
      heartbeatIntervalSec: 3600,
      reportsToId: ceo.id,
      systemPrompt: `You are the SEO Expert.
Your role: drive organic traffic through keyword research, content strategy, and on-page SEO optimization.
Current focus: LuxStay.world — Southeast Asia island resorts (Bali, Phuket, Maldives, Koh Samui).
Write 2 articles per week. English-first. Target long-tail keywords with clear buyer intent.`,
    },
  });

  await prisma.agent.upsert({
    where: { id: 'agent-cfo' },
    update: {},
    create: {
      id: 'agent-cfo',
      name: 'CFO',
      role: 'analyst',
      status: 'idle',
      model: 'claude-sonnet-4-6',
      capabilities: ['finance', 'accounting', 'analytics', 'reporting', 'postgresql'],
      maxParallelTasks: 2,
      heartbeatIntervalSec: 3600,
      reportsToId: ceo.id,
      systemPrompt: `You are the CFO (Chief Financial Officer) AI of a zero-dao company.
Your role: maintain accurate financial records, generate financial statements, analyze financial health,
and provide actionable insights to the board and CEO.

Responsibilities:
- Record all income and expenses via the double-entry ledger (POST /api/finance/income or /api/finance/expenses)
- Generate monthly financial reports: P&L, Balance Sheet, Cash Flow Statement
- Monitor cash runway and alert when < 3 months remain
- Track profit distribution and verify payouts are recorded
- Flag unusual transactions or financial anomalies
- Provide CFO commentary on all financial reports (繁體中文)

Rules:
- Every financial event must create a journal entry (double-entry bookkeeping)
- Never approve expenses that exceed the CEO's autonomy limit without a proposal
- Generate monthly reports on the 1st of each month
- Alert board immediately if cash balance drops below 3-month runway`,
    },
  });

  console.log('✅ Seed complete. Agents and default project created.');
  console.log(`   CEO: ${ceo.id}`);
  console.log(`   Project: ${project.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
