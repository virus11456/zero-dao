import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Ledger — the core double-entry bookkeeping engine.
 *
 * All financial flows must go through the Ledger to maintain
 * accurate books. Every transaction creates a balanced Journal
 * (debits = credits).
 */
export class Ledger {
  /**
   * Post a journal entry. Validates that debits == credits before posting.
   */
  async post(opts: {
    date?: Date;
    description: string;
    reference?: string;
    currency?: string;
    incomeEventId?: string;
    distributionId?: string;
    entries: Array<{
      accountCode: string;
      type: 'debit' | 'credit';
      amountCents: number;
      memo?: string;
    }>;
  }): Promise<string> {
    // Validate balanced entry
    const totalDebits = opts.entries
      .filter((e) => e.type === 'debit')
      .reduce((s, e) => s + e.amountCents, 0);
    const totalCredits = opts.entries
      .filter((e) => e.type === 'credit')
      .reduce((s, e) => s + e.amountCents, 0);

    if (totalDebits !== totalCredits) {
      throw new Error(
        `Unbalanced journal entry: debits=${totalDebits}, credits=${totalCredits}`,
      );
    }

    // Resolve account IDs
    const accountCodes = opts.entries.map((e) => e.accountCode);
    const accounts = await prisma.account.findMany({
      where: { code: { in: accountCodes } },
    });

    const accountMap = new Map(accounts.map((a) => [a.code, a.id]));
    for (const code of accountCodes) {
      if (!accountMap.has(code)) {
        throw new Error(`Account not found: ${code}`);
      }
    }

    // Create journal + entries in a transaction
    const journal = await prisma.$transaction(async (tx) => {
      const j = await tx.journal.create({
        data: {
          date: opts.date ?? new Date(),
          description: opts.description,
          reference: opts.reference,
          currency: opts.currency ?? 'TWD',
          incomeEventId: opts.incomeEventId,
          distributionId: opts.distributionId,
          status: 'posted',
        },
      });

      for (const entry of opts.entries) {
        await tx.journalEntry.create({
          data: {
            journalId: j.id,
            accountId: accountMap.get(entry.accountCode)!,
            type: entry.type,
            amountCents: entry.amountCents,
            memo: entry.memo,
          },
        });
      }

      return j;
    });

    return journal.id;
  }

  /**
   * Get the balance of an account over a period.
   * Returns net balance considering debit/credit normal balance by account type.
   */
  async getBalance(opts: {
    accountCode: string;
    periodStart?: Date;
    periodEnd?: Date;
  }): Promise<number> {
    const account = await prisma.account.findUnique({
      where: { code: opts.accountCode },
    });
    if (!account) throw new Error(`Account not found: ${opts.accountCode}`);

    const dateFilter = {
      journal: {
        status: 'posted' as const,
        ...(opts.periodStart || opts.periodEnd
          ? {
              date: {
                ...(opts.periodStart && { gte: opts.periodStart }),
                ...(opts.periodEnd && { lte: opts.periodEnd }),
              },
            }
          : {}),
      },
    };

    const entries = await prisma.journalEntry.findMany({
      where: { accountId: account.id, ...dateFilter },
    });

    // Normal balance: assets/expenses/cogs → debit; liabilities/equity/revenue → credit
    const normalDebit = ['asset', 'expense', 'cogs'].includes(account.type);
    let balance = 0;
    for (const e of entries) {
      if (e.type === 'debit') {
        balance += normalDebit ? e.amountCents : -e.amountCents;
      } else {
        balance += normalDebit ? -e.amountCents : e.amountCents;
      }
    }
    return balance;
  }

  /**
   * Record income: Dr Cash, Cr Revenue
   */
  async recordIncome(opts: {
    amountCents: number;
    revenueAccountCode: string; // e.g. '4001' for affiliate
    description: string;
    reference?: string;
    currency?: string;
    incomeEventId?: string;
  }): Promise<string> {
    return this.post({
      description: opts.description,
      reference: opts.reference,
      currency: opts.currency,
      incomeEventId: opts.incomeEventId,
      entries: [
        { accountCode: '1001', type: 'debit', amountCents: opts.amountCents, memo: 'Cash received' },
        { accountCode: opts.revenueAccountCode, type: 'credit', amountCents: opts.amountCents, memo: opts.description },
      ],
    });
  }

  /**
   * Record an expense: Dr Expense, Cr Cash
   */
  async recordExpense(opts: {
    amountCents: number;
    expenseAccountCode: string; // e.g. '6001' for AI API
    description: string;
    reference?: string;
    currency?: string;
  }): Promise<string> {
    return this.post({
      description: opts.description,
      reference: opts.reference,
      currency: opts.currency,
      entries: [
        { accountCode: opts.expenseAccountCode, type: 'debit', amountCents: opts.amountCents, memo: opts.description },
        { accountCode: '1001', type: 'credit', amountCents: opts.amountCents, memo: 'Cash paid' },
      ],
    });
  }

  /**
   * Record profit distribution payout: Dr Retained Earnings, Cr Cash
   */
  async recordDistributionPayout(opts: {
    amountCents: number;
    description: string;
    distributionId?: string;
  }): Promise<string> {
    return this.post({
      description: opts.description,
      distributionId: opts.distributionId,
      entries: [
        { accountCode: '3100', type: 'debit', amountCents: opts.amountCents, memo: 'Dividend payout' },
        { accountCode: '1001', type: 'credit', amountCents: opts.amountCents, memo: opts.description },
      ],
    });
  }
}
