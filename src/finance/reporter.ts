import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { Ledger } from './ledger';

const prisma = new PrismaClient();
const ledger = new Ledger();

/**
 * FinancialReporter — generates the three core financial statements.
 *
 * 1. 損益表 (Income Statement / P&L)
 *    Revenue - COGS - Expenses = Net Income
 *
 * 2. 資產負債表 (Balance Sheet)
 *    Assets = Liabilities + Equity
 *
 * 3. 現金流量表 (Cash Flow Statement)
 *    Operating + Investing + Financing = Net Cash Change
 *
 * Each report is stored in FinancialReport with an AI-generated narrative.
 */
export class FinancialReporter {
  private ai: Anthropic;

  constructor() {
    this.ai = new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl,
    });
  }

  private fmt(cents: number, currency = 'TWD'): string {
    const val = (cents / 100).toLocaleString('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return `${currency} ${val}`;
  }

  /**
   * Generate Income Statement (P&L) for a period.
   */
  async generateIncomeStatement(periodStart: Date, periodEnd: Date): Promise<object> {
    const accounts = await prisma.account.findMany({
      where: { type: { in: ['revenue', 'cogs', 'expense'] }, isActive: true },
      orderBy: { code: 'asc' },
    });

    const rows: Array<{ code: string; name: string; nameEn: string; type: string; balanceCents: number }> = [];
    for (const acc of accounts) {
      const balance = await ledger.getBalance({
        accountCode: acc.code,
        periodStart,
        periodEnd,
      });
      rows.push({ code: acc.code, name: acc.name, nameEn: acc.nameEn ?? '', type: acc.type, balanceCents: balance });
    }

    const revenue = rows.filter((r) => r.type === 'revenue').reduce((s, r) => s + r.balanceCents, 0);
    const cogs = rows.filter((r) => r.type === 'cogs').reduce((s, r) => s + r.balanceCents, 0);
    const expenses = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.balanceCents, 0);
    const grossProfit = revenue - cogs;
    const netIncome = grossProfit - expenses;
    const grossMarginPct = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : '0.0';
    const netMarginPct = revenue > 0 ? ((netIncome / revenue) * 100).toFixed(1) : '0.0';

    const data = {
      period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
      revenue: { total: revenue, items: rows.filter((r) => r.type === 'revenue') },
      cogs: { total: cogs, items: rows.filter((r) => r.type === 'cogs') },
      grossProfit,
      grossMarginPct,
      expenses: { total: expenses, items: rows.filter((r) => r.type === 'expense') },
      netIncome,
      netMarginPct,
    };

    const summary = await this.generateNarrative('income_statement', data);
    await this.saveReport('income_statement', periodStart, periodEnd, data, summary);
    return { ...data, summary };
  }

  /**
   * Generate Balance Sheet (as of a date).
   */
  async generateBalanceSheet(asOf: Date): Promise<object> {
    const accounts = await prisma.account.findMany({
      where: { type: { in: ['asset', 'liability', 'equity'] }, isActive: true },
      orderBy: { code: 'asc' },
    });

    const rows: Array<{ code: string; name: string; nameEn: string; type: string; balanceCents: number }> = [];
    for (const acc of accounts) {
      const balance = await ledger.getBalance({ accountCode: acc.code, periodEnd: asOf });
      rows.push({ code: acc.code, name: acc.name, nameEn: acc.nameEn ?? '', type: acc.type, balanceCents: balance });
    }

    const totalAssets = rows.filter((r) => r.type === 'asset').reduce((s, r) => s + r.balanceCents, 0);
    const totalLiabilities = rows.filter((r) => r.type === 'liability').reduce((s, r) => s + r.balanceCents, 0);
    const totalEquity = rows.filter((r) => r.type === 'equity').reduce((s, r) => s + r.balanceCents, 0);
    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 100; // 1 TWD tolerance

    const data = {
      asOf: asOf.toISOString(),
      assets: { total: totalAssets, items: rows.filter((r) => r.type === 'asset') },
      liabilities: { total: totalLiabilities, items: rows.filter((r) => r.type === 'liability') },
      equity: { total: totalEquity, items: rows.filter((r) => r.type === 'equity') },
      isBalanced,
      currentRatio: totalLiabilities > 0 ? (totalAssets / totalLiabilities).toFixed(2) : 'N/A',
      debtToEquity: totalEquity > 0 ? (totalLiabilities / totalEquity).toFixed(2) : 'N/A',
    };

    const summary = await this.generateNarrative('balance_sheet', data);
    await this.saveReport('balance_sheet', asOf, asOf, data, summary);
    return { ...data, summary };
  }

  /**
   * Generate Cash Flow Statement for a period.
   * Simplified: uses cash account movements categorized by journal description.
   */
  async generateCashFlow(periodStart: Date, periodEnd: Date): Promise<object> {
    // Get all posted journal entries touching cash account in the period
    const cashAccount = await prisma.account.findUnique({ where: { code: '1001' } });
    if (!cashAccount) throw new Error('Cash account (1001) not found');

    const cashEntries = await prisma.journalEntry.findMany({
      where: {
        accountId: cashAccount.id,
        journal: { status: 'posted', date: { gte: periodStart, lte: periodEnd } },
      },
      include: { journal: true },
    });

    // Categorize by journal description keywords
    let operatingCents = 0;
    let investingCents = 0;
    let financingCents = 0;

    for (const entry of cashEntries) {
      const amount = entry.type === 'debit' ? entry.amountCents : -entry.amountCents;
      const desc = entry.journal.description.toLowerCase();
      if (desc.includes('invest') || desc.includes('asset') || desc.includes('equipment')) {
        investingCents += amount;
      } else if (desc.includes('loan') || desc.includes('dividend') || desc.includes('distribution') || desc.includes('分紅')) {
        financingCents += amount;
      } else {
        operatingCents += amount;
      }
    }

    const openingCash = await ledger.getBalance({ accountCode: '1001', periodEnd: periodStart });
    const netCashChange = operatingCents + investingCents + financingCents;
    const closingCash = openingCash + netCashChange;

    const data = {
      period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
      openingCash,
      operating: { net: operatingCents },
      investing: { net: investingCents },
      financing: { net: financingCents },
      netCashChange,
      closingCash,
    };

    const summary = await this.generateNarrative('cash_flow', data);
    await this.saveReport('cash_flow', periodStart, periodEnd, data, summary);
    return { ...data, summary };
  }

  /**
   * Generate Trial Balance — list all accounts with their balances.
   */
  async generateTrialBalance(asOf: Date): Promise<object> {
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    const rows = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const acc of accounts) {
      const balance = await ledger.getBalance({ accountCode: acc.code, periodEnd: asOf });
      if (balance === 0) continue;

      const isDebitNormal = ['asset', 'expense', 'cogs'].includes(acc.type);
      const debit = isDebitNormal && balance > 0 ? balance : (!isDebitNormal && balance < 0 ? Math.abs(balance) : 0);
      const credit = !isDebitNormal && balance > 0 ? balance : (isDebitNormal && balance < 0 ? Math.abs(balance) : 0);

      totalDebits += debit;
      totalCredits += credit;

      rows.push({ code: acc.code, name: acc.name, type: acc.type, debit, credit });
    }

    const data = {
      asOf: asOf.toISOString(),
      rows,
      totalDebits,
      totalCredits,
      isBalanced: totalDebits === totalCredits,
    };

    await this.saveReport('trial_balance', asOf, asOf, data, null);
    return data;
  }

  private async generateNarrative(type: string, data: object): Promise<string> {
    const typeLabels: Record<string, string> = {
      income_statement: '損益表 (P&L)',
      balance_sheet: '資產負債表',
      cash_flow: '現金流量表',
    };

    try {
      const response = await this.ai.messages.create({
        model: config.ai.model,
        max_tokens: 512,
        system: `你是公司的 CFO AI。用繁體中文分析財務報表數據，給出簡潔的管理層摘要（3-5個重點）。
聚焦在：關鍵指標、趨勢、風險、和建議行動。不超過200字。`,
        messages: [
          {
            role: 'user',
            content: `請分析以下${typeLabels[type] ?? type}數據：\n\n${JSON.stringify(data, null, 2)}`,
          },
        ],
      });

      return response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');
    } catch {
      return '';
    }
  }

  private async saveReport(
    type: 'income_statement' | 'balance_sheet' | 'cash_flow' | 'trial_balance',
    periodStart: Date,
    periodEnd: Date,
    data: object,
    summary: string | null,
  ): Promise<void> {
    await prisma.financialReport.create({
      data: {
        type,
        periodStart,
        periodEnd,
        currency: 'TWD',
        data,
        summary,
        generatedAt: new Date(),
      },
    });
  }
}
