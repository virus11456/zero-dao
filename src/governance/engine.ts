import { notify } from '../telegram/bot';
import { ArchiveService } from '../archive/service';
import { prisma } from '../lib/prisma';
const archive = new ArchiveService();

/**
 * GovernanceEngine — handles proposals, voting, and execution.
 *
 * Flow:
 * 1. Someone (board member or CEO agent) creates a Proposal.
 * 2. Board members cast Votes within the voting window.
 * 3. GovernanceEngine.tallyAndExecute() runs every hour to:
 *    - Check if quorum + threshold is met → mark passed → execute
 *    - Check if window expired without quorum → mark expired
 */
export class GovernanceEngine {
  /**
   * Create a new proposal. Returns the proposal record.
   */
  async createProposal(opts: {
    constitutionId: string;
    type: string;
    title: string;
    description: string;
    payload?: object;
    proposedByAgentId?: string;
    proposedByUserId?: string;
    votingWindowHours?: number;
    quorumPercent?: number;
    passThreshold?: number;
  }) {
    const deadline = new Date(
      Date.now() + (opts.votingWindowHours ?? 72) * 60 * 60 * 1000,
    );

    const proposal = await prisma.proposal.create({
      data: {
        constitutionId: opts.constitutionId,
        type: opts.type as 'constitution_amendment' | 'profit_distribution' | 'agent_hire' | 'agent_fire' | 'budget_allocation' | 'strategic_pivot' | 'custom',
        title: opts.title,
        description: opts.description,
        payload: (opts.payload as object) ?? {},
        proposedByAgentId: opts.proposedByAgentId,
        proposedByUserId: opts.proposedByUserId,
        votingDeadline: deadline,
        quorumPercent: opts.quorumPercent ?? 51,
        passThreshold: opts.passThreshold ?? 51,
        status: 'open',
      },
    });

    await notify(
      `🗳️ *New Proposal*: ${opts.title}\nType: \`${opts.type}\`\nVoting deadline: ${deadline.toLocaleDateString('zh-TW')}\n\nCast your vote at: POST /api/proposals/${proposal.id}/vote`,
    );

    return proposal;
  }

  /**
   * Cast a vote on a proposal.
   */
  async castVote(opts: {
    proposalId: string;
    voterAgentId?: string;
    voterUserId?: string;
    choice: 'yes' | 'no' | 'abstain';
    rationale?: string;
    weight?: number;
  }) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: opts.proposalId },
    });

    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'open') throw new Error(`Proposal is ${proposal.status}, not open`);
    if (new Date() > proposal.votingDeadline) throw new Error('Voting window has closed');

    const vote = await prisma.vote.create({
      data: {
        proposalId: opts.proposalId,
        voterAgentId: opts.voterAgentId,
        voterUserId: opts.voterUserId,
        choice: opts.choice,
        rationale: opts.rationale,
        weight: opts.weight ?? 1,
      },
    });

    // Check if we can finalize early (all voters have voted)
    await this.tallyProposal(opts.proposalId);

    return vote;
  }

  /**
   * Tally all open proposals. Call this hourly.
   * Marks passed/rejected/expired as appropriate.
   */
  async tallyAll(): Promise<void> {
    const open = await prisma.proposal.findMany({
      where: { status: 'open' },
      select: { id: true },
    });

    for (const p of open) {
      await this.tallyProposal(p.id);
    }
  }

  private async tallyProposal(proposalId: string): Promise<void> {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { votes: true },
    });

    if (!proposal || proposal.status !== 'open') return;

    const now = new Date();
    const expired = now > proposal.votingDeadline;

    // Get total eligible board members for quorum calculation
    const totalBoardMembers = await prisma.boardMember.count({ where: { isActive: true } });
    const totalEligibleWeight = totalBoardMembers > 0 ? totalBoardMembers : 1;

    const totalVoteWeight = proposal.votes.reduce((s, v) => s + v.weight, 0);
    const yesWeight = proposal.votes
      .filter((v) => v.choice === 'yes')
      .reduce((s, v) => s + v.weight, 0);

    // Quorum: % of eligible board members who voted
    const quorumReached = totalBoardMembers === 0
      ? totalVoteWeight >= 1  // no board members registered → 1 vote sufficient
      : (totalVoteWeight / totalEligibleWeight) * 100 >= proposal.quorumPercent;

    const yesPct = totalVoteWeight > 0 ? (yesWeight / totalVoteWeight) * 100 : 0;
    const passed = quorumReached && yesPct >= proposal.passThreshold;

    if (expired && !passed) {
      await prisma.proposal.update({
        where: { id: proposalId },
        data: { status: totalVoteWeight === 0 ? 'expired' : 'rejected' },
      });
      await notify(
        `❌ *提案${totalVoteWeight === 0 ? '過期' : '未通過'}*: ${proposal.title}\n投票: ${totalVoteWeight}票，${yesPct.toFixed(0)}% 贊成`,
      );
      // Archive the decision (rejected/expired also get recorded)
      await archive.recordBoardDecision(proposalId).catch(console.error);
      return;
    }

    if (passed) {
      await prisma.proposal.update({
        where: { id: proposalId },
        data: { status: 'passed' },
      });
      await notify(
        `✅ *提案通過*: ${proposal.title}\n${yesWeight}/${totalVoteWeight}票贊成 (${yesPct.toFixed(0)}%)，CEO 將在24小時內執行。`,
      );
      // Archive the decision
      await archive.recordBoardDecision(proposalId).catch(console.error);
      await this.executeProposal(proposalId);
    }
  }

  /**
   * Execute a passed proposal. CEO agent applies the decision.
   */
  async executeProposal(proposalId: string): Promise<void> {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { constitution: true },
    });

    if (!proposal || proposal.status !== 'passed') return;

    let executionNote = '';

    try {
      switch (proposal.type) {
        case 'profit_distribution': {
          const rules = proposal.payload as {
            reinvestment?: number;
            reserve?: number;
            boardDividend?: number;
          };
          // Update constitution rules
          const currentRules = proposal.constitution.rules as Record<string, unknown>;
          const updated = {
            ...currentRules,
            profitDistribution: {
              reinvestment: rules.reinvestment ?? 40,
              reserve: rules.reserve ?? 20,
              boardDividend: rules.boardDividend ?? 40,
            },
          };
          await prisma.constitution.update({
            where: { id: proposal.constitutionId },
            data: { rules: updated },
          });
          executionNote = `Profit distribution rules updated: ${JSON.stringify(rules)}`;
          break;
        }

        case 'constitution_amendment': {
          const { newBody } = proposal.payload as { newBody?: string };
          if (newBody) {
            const current = await prisma.constitution.findUnique({
              where: { id: proposal.constitutionId },
            });
            // Create new version, deactivate old
            await prisma.constitution.update({
              where: { id: proposal.constitutionId },
              data: { isActive: false },
            });
            await prisma.constitution.create({
              data: {
                version: (current?.version ?? 1) + 1,
                body: newBody,
                rules: current?.rules ?? {},
                isActive: true,
                ratifiedAt: new Date(),
              },
            });
            executionNote = `Constitution amended to version ${(current?.version ?? 1) + 1}`;
          }
          break;
        }

        default:
          executionNote = `Proposal type ${proposal.type} noted. CEO to implement manually.`;
      }

      await prisma.proposal.update({
        where: { id: proposalId },
        data: { status: 'executed', executedAt: new Date(), executionNote },
      });

      await notify(`⚙️ *Proposal executed*: ${proposal.title}\n${executionNote}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await prisma.proposal.update({
        where: { id: proposalId },
        data: { executionNote: `Execution failed: ${errMsg}` },
      });
    }
  }
}
