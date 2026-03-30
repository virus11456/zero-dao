/**
 * Default Chart of Accounts for a zero-dao company.
 * Follows standard double-entry bookkeeping structure.
 * All amounts tracked in smallest currency unit (cents for TWD, cents for USD).
 */

export const DEFAULT_CHART_OF_ACCOUNTS = [
  // ── ASSETS (1xxx) ────────────────────────────────────────────────────────
  { code: '1001', name: '現金', nameEn: 'Cash', type: 'asset' },
  { code: '1002', name: '銀行存款', nameEn: 'Bank Deposits', type: 'asset' },
  { code: '1100', name: '應收帳款', nameEn: 'Accounts Receivable', type: 'asset' },
  { code: '1200', name: '預付費用', nameEn: 'Prepaid Expenses', type: 'asset' },
  { code: '1500', name: '固定資產', nameEn: 'Fixed Assets', type: 'asset' },
  { code: '1600', name: '無形資產', nameEn: 'Intangible Assets', type: 'asset' },

  // ── LIABILITIES (2xxx) ───────────────────────────────────────────────────
  { code: '2001', name: '應付帳款', nameEn: 'Accounts Payable', type: 'liability' },
  { code: '2100', name: '預收款項', nameEn: 'Deferred Revenue', type: 'liability' },
  { code: '2200', name: '應付薪資', nameEn: 'Accrued Payroll', type: 'liability' },
  { code: '2300', name: '應付稅款', nameEn: 'Taxes Payable', type: 'liability' },
  { code: '2500', name: '長期借款', nameEn: 'Long-term Loans', type: 'liability' },

  // ── EQUITY (3xxx) ────────────────────────────────────────────────────────
  { code: '3001', name: '股本', nameEn: 'Share Capital', type: 'equity' },
  { code: '3100', name: '保留盈餘', nameEn: 'Retained Earnings', type: 'equity' },
  { code: '3200', name: '儲備金', nameEn: 'Reserve Fund', type: 'equity' },
  { code: '3300', name: '本期損益', nameEn: 'Current Period P&L', type: 'equity' },

  // ── REVENUE (4xxx) ───────────────────────────────────────────────────────
  { code: '4001', name: '聯盟行銷收入', nameEn: 'Affiliate Revenue', type: 'revenue' },
  { code: '4002', name: 'SaaS 訂閱收入', nameEn: 'SaaS Subscription Revenue', type: 'revenue' },
  { code: '4003', name: '廣告收入', nameEn: 'Advertising Revenue', type: 'revenue' },
  { code: '4004', name: '顧問服務收入', nameEn: 'Consulting Revenue', type: 'revenue' },
  { code: '4009', name: '其他收入', nameEn: 'Other Revenue', type: 'revenue' },

  // ── COGS (5xxx) ──────────────────────────────────────────────────────────
  { code: '5001', name: '直接服務成本', nameEn: 'Direct Service Costs', type: 'cogs' },

  // ── EXPENSES (6xxx) ──────────────────────────────────────────────────────
  { code: '6001', name: 'AI API 費用', nameEn: 'AI API Costs', type: 'expense' },
  { code: '6002', name: '雲端主機費用', nameEn: 'Cloud Infrastructure', type: 'expense' },
  { code: '6003', name: '軟體訂閱費', nameEn: 'Software Subscriptions', type: 'expense' },
  { code: '6010', name: '行銷費用', nameEn: 'Marketing Expenses', type: 'expense' },
  { code: '6020', name: '法律費用', nameEn: 'Legal Fees', type: 'expense' },
  { code: '6030', name: '銀行手續費', nameEn: 'Bank Charges', type: 'expense' },
  { code: '6090', name: '其他費用', nameEn: 'Other Expenses', type: 'expense' },
] as const;

export type AccountCode = (typeof DEFAULT_CHART_OF_ACCOUNTS)[number]['code'];
