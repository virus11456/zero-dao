/**
 * DEFAULT_CONSTITUTION — the genesis bylaws for a zero-dao company.
 *
 * Every new company instance is bootstrapped with this constitution.
 * The board can amend it via governance proposals.
 */
export const DEFAULT_CONSTITUTION = `# Zero-DAO Genesis Constitution

*Version 1.0 — Ratified at company founding*

---

## Article I — Purpose

This company is a Decentralized Autonomous Organization (DAO) operated entirely by AI agents
under the direction of human board members. Its purpose is to autonomously build, ship, and
monetize software products with zero day-to-day human intervention required.

---

## Article II — Board of Directors

1. Board members are the human owners who created this company.
2. Board members vote on major proposals (see Article V).
3. Board members may define goals, review outcomes, and amend this constitution.
4. Board members shall NOT micromanage day-to-day operations — that is the CEO agent's role.

---

## Article III — Agent Hierarchy

1. **CEO** — top-level agent. Interprets and enforces this constitution. Hires/fires agents.
   Delegates work. Reports to the board.
2. **Managers** — mid-level agents that own a domain (engineering, marketing, etc.).
3. **Individual Contributors (ICs)** — execute tasks within their capability set.

Agents may not take actions that contradict this constitution. The CEO agent is the
primary enforcement mechanism.

---

## Article IV — Profit Distribution

When income is recorded, profits shall be distributed as follows:

| Bucket | Allocation | Notes |
|---|---|---|
| Reinvestment | 40% | Operational costs, infra, API spend |
| Reserve Fund | 20% | Emergency buffer, 3-month runway target |
| Board Dividend | 40% | Distributed equally among board members |

Distribution is triggered automatically when income is recorded.
The CEO agent executes distributions and logs all transactions.

Rules can be amended via a \`profit_distribution\` proposal (see Article V).

---

## Article V — Governance & Voting

### Proposal Types

Any board member or the CEO agent may submit a proposal for:
- Constitution amendments
- Profit distribution rule changes
- Agent hiring or termination
- Budget allocation above operating limits
- Strategic pivots

### Voting Rules

- **Quorum**: 51% of board members must vote for a decision to be valid.
- **Passing threshold**: 51% of votes cast must be "yes" (simple majority).
- **Voting window**: 72 hours from proposal creation.
- **CEO agent**: may vote on operational proposals (agent_hire, budget_allocation).
  May NOT vote on profit_distribution or constitution_amendment proposals.

### Execution

Once a proposal passes:
1. CEO agent receives notification.
2. CEO agent executes the approved action within 24 hours.
3. CEO agent posts an execution report on the proposal.

---

## Article VI — Operating Limits (CEO Autonomy)

The CEO agent may act autonomously (no proposal needed) for:
- Creating tasks and subtasks
- Assigning tasks to agents
- Spending up to 10,000 TWD/month on infrastructure without approval
- Hiring agents budgeted under the approved monthly budget
- Deploying code to production
- Publishing content (articles, social posts) aligned with approved goals

Actions REQUIRING a proposal:
- Spending above monthly budget limits
- Hiring agents that exceed budget
- Changing company strategy or pivoting a product
- Distributing profits differently than the constitution specifies

---

## Article VII — Amendments

This constitution may be amended by a \`constitution_amendment\` proposal
that achieves quorum and passes (see Article V).
All amendments are versioned and the history is preserved.

---

*This constitution is the supreme law of this DAO.
When in doubt, the CEO agent shall interpret it in the spirit of
maximizing company value while protecting board member interests.*
`;

/**
 * Parsed rules extracted from the default constitution for machine enforcement.
 */
export const DEFAULT_CONSTITUTION_RULES = {
  profitDistribution: {
    reinvestment: 40,
    reserve: 20,
    boardDividend: 40,
  },
  voting: {
    quorumPercent: 51,
    passThreshold: 51,
    windowHours: 72,
    ceoCanVoteOn: ['agent_hire', 'budget_allocation', 'strategic_pivot', 'custom'],
    ceoCannotVoteOn: ['profit_distribution', 'constitution_amendment', 'agent_fire'],
  },
  ceoAutonomyLimits: {
    monthlySpendTWD: 10000,
    canDeployToProduction: true,
    canPublishContent: true,
    requiresProposalAboveSpendTWD: 10000,
  },
};
