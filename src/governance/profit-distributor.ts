import { PrismaClient } from '@prisma/client';
import { notify } from '../telegram/bot';

const prisma = new PrismaClient();

/**
 * ProfitDistributor — executes profit distribution per the active constitution.
 *
 * How it works:
 * 1. Board records income: POST /api/income
 * 2. ProfitDistributor reads the active constitution's distribution rules
 * 3. Computes each recipient's share
 * 4. Creates a Distribution record with line items
 * 5. Notifies board via Telegram
 *
 * The board then manually executes payments (bank transfer, etc.).
 * zero-dao tracks what was distributed and marks items as paid.
 */
export class ProfitDistributor {
  /**
   * Distribute profits from a recorded income event.
   */
  async distribute(opts: {
    incomeEventId: string;
    boardMemberIds?: string[]; // user IDs to split boardDividend among
  }): Promise<void> {
    const income = await prisma.incomeEvent.findUnique({
      where: { id: opts.incomeEventId },
    });

    if (!income) throw new Error('Income event not found');
    if (income.distributionId) throw new Error('Income event already distributed');

    // Get active constitution rules
    const constitution = await prisma.constitution.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!constitution) throw new Error('No active constitution found');

    const rules = constitution.rules as {
      profitDistribution?: {
        reinvestment: number;
        reserve: number;
        boardDividend: number;
      };
    };

    const dist = rules.profitDistribution ?? {
      reinvestment: 40,
      reserve: 20,
      boardDividend: 40,
    };

    const total = income.amountCents;
    const boardMemberIds = opts.boardMemberIds ?? [];

    // Compute line items
    const reinvestmentCents = Math.floor((total * dist.reinvestment) / 100);
    const reserveCents = Math.floor((total * dist.reserve) / 100);
    const dividendTotal = total - reinvestmentCents - reserveCents;

    const lineItems: Array<{
      recipient: string;
      label: string;
      percent: number;
      amountCents: number;
    }> = [
      {
        recipient: 'reinvestment',
        label: '再投資 (Reinvestment)',
        percent: dist.reinvestment,
        amountCents: reinvestmentCents,
      },
      {
        recipient: 'reserve',
        label: '儲備金 (Reserve Fund)',
        percent: dist.reserve,
        amountCents: reserveCents,
      },
    ];

    // Split board dividend equally
    if (boardMemberIds.length > 0) {
      const perMember = Math.floor(dividendTotal / boardMemberIds.length);
      for (const userId of boardMemberIds) {
        lineItems.push({
          recipient: `board:${userId}`,
          label: `董事分紅 Board Dividend (${userId.slice(0, 8)}...)`,
          percent: Math.floor(dist.boardDividend / boardMemberIds.length),
          amountCents: perMember,
        });
      }
    } else {
      // No board members specified — hold as undistributed dividend
      lineItems.push({
        recipient: 'board:undistributed',
        label: '董事分紅 (待分配)',
        percent: dist.boardDividend,
        amountCents: dividendTotal,
      });
    }

    // Create distribution record
    const distribution = await prisma.distribution.create({
      data: {
        totalCents: total,
        currency: income.currency,
        rulesSnapshot: rules,
        lineItems: {
          create: lineItems.map((li) => ({
            recipient: li.recipient,
            label: li.label,
            percent: li.percent,
            amountCents: li.amountCents,
          })),
        },
      },
    });

    // Link back to income event
    await prisma.incomeEvent.update({
      where: { id: income.id },
      data: { distributionId: distribution.id },
    });

    // Format currency display
    const fmt = (cents: number) =>
      `${income.currency} ${(cents / 100).toLocaleString('zh-TW', { minimumFractionDigits: 0 })}`;

    const lines = [
      `💰 *利潤分配完成*`,
      `收入: ${fmt(total)} (${income.source})`,
      ``,
      ...lineItems.map((li) => `• ${li.label}: ${fmt(li.amountCents)} (${li.percent}%)`),
      ``,
      `Distribution ID: \`${distribution.id}\``,
      `標記已付款: PATCH /api/distributions/${distribution.id}/line-items/:id/pay`,
    ];

    await notify(lines.join('\n'));
  }
}
