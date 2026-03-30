'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { api, swrFetcher, IncomeEvent, FinancialReport } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';


function fmtTWD(cents: number) {
  return `NT$ ${(cents / 100).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`;
}

export default function FinancePage() {
  const { data: income, mutate: mutateIncome } = useSWR<IncomeEvent[]>('/api/income', swrFetcher, { refreshInterval: 30000 });
  const { data: reports } = useSWR<FinancialReport[]>('/api/finance/reports', swrFetcher);
  const [showIncome, setShowIncome] = useState(false);
  const [form, setForm] = useState({ source: '', description: '', amountCents: '', currency: 'TWD' });
  const [generating, setGenerating] = useState<string | null>(null);
  const [reportResult, setReportResult] = useState<Record<string, unknown> | null>(null);

  async function submitIncome() {
    await api.post('/api/income', {
      source: form.source,
      description: form.description,
      amountCents: parseInt(form.amountCents),
      currency: form.currency,
    });
    setForm({ source: '', description: '', amountCents: '', currency: 'TWD' });
    setShowIncome(false);
    mutateIncome();
  }

  async function generateReport(type: string) {
    setGenerating(type);
    try {
      const endpoint = {
        'income_statement': '/api/finance/reports/income-statement',
        'balance_sheet': '/api/finance/reports/balance-sheet',
        'cash_flow': '/api/finance/reports/cash-flow',
      }[type];
      if (!endpoint) return;
      const result = await api.post<Record<string, unknown>>(endpoint, {});
      setReportResult(result);
    } finally {
      setGenerating(null);
    }
  }

  // Monthly income chart
  const monthlyData = (() => {
    if (!income) return [];
    const map: Record<string, number> = {};
    income.forEach((e) => {
      const month = new Date(e.recordedAt).toLocaleDateString('zh-TW', { year: 'numeric', month: 'short' });
      map[month] = (map[month] ?? 0) + e.amountCents;
    });
    return Object.entries(map).slice(-6).map(([name, value]) => ({ name, value }));
  })();

  const totalIncome = income?.reduce((s, e) => s + e.amountCents, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">財務管理</h2>
          <p className="text-slate-400 text-sm mt-0.5">收入記錄、利潤分配與財務報表</p>
        </div>
        <button
          onClick={() => setShowIncome(true)}
          className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + 記錄收入
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">累計收入</p>
          <p className="text-2xl font-bold text-emerald-400">{fmtTWD(totalIncome)}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">收入筆數</p>
          <p className="text-2xl font-bold">{income?.length ?? 0}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">已生成報表</p>
          <p className="text-2xl font-bold">{reports?.length ?? 0}</p>
        </div>
      </div>

      {/* Income form */}
      {showIncome && (
        <div className="bg-slate-800 border border-emerald-500/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">記錄收入</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="來源（如：affiliate, saas）"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            />
            <input
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="金額（分，如 100000 = NT$1,000）"
              value={form.amountCents}
              onChange={(e) => setForm({ ...form, amountCents: e.target.value })}
            />
            <input
              className="col-span-2 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="說明（可選）"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={submitIncome} className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium px-4 py-2 rounded-lg">
              記錄
            </button>
            <button onClick={() => setShowIncome(false)} className="text-slate-400 text-sm px-4 py-2 rounded-lg">
              取消
            </button>
          </div>
        </div>
      )}

      {/* Monthly chart */}
      {monthlyData.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">月收入趨勢</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${(v/100).toLocaleString('zh-TW')}`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [fmtTWD(v), '收入']}
              />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Report generation */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">生成財務報表</h3>
        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'income_statement', label: '損益表 (P&L)' },
            { key: 'balance_sheet', label: '資產負債表' },
            { key: 'cash_flow', label: '現金流量表' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => generateReport(key)}
              disabled={generating === key}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {generating === key ? '生成中...' : label}
            </button>
          ))}
        </div>
        {reportResult && (
          <div className="mt-4 bg-slate-900 rounded-lg p-4 text-xs font-mono text-slate-300 overflow-auto max-h-60">
            <pre>{JSON.stringify(reportResult, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Income list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-semibold">收入記錄</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
              <th className="text-left px-4 py-2">日期</th>
              <th className="text-left px-4 py-2">來源</th>
              <th className="text-left px-4 py-2">說明</th>
              <th className="text-right px-4 py-2">金額</th>
              <th className="text-left px-4 py-2">分配</th>
            </tr>
          </thead>
          <tbody>
            {income?.slice(0, 20).map((e) => (
              <tr key={e.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(e.recordedAt).toLocaleDateString('zh-TW')}
                </td>
                <td className="px-4 py-3">
                  <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded">{e.source}</span>
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs">{e.description ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-400">{fmtTWD(e.amountCents)}</td>
                <td className="px-4 py-3">
                  {e.distribution ? (
                    <span className="text-emerald-400 text-xs">✓ 已分配</span>
                  ) : (
                    <span className="text-slate-500 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!income?.length && (
          <div className="text-center py-10 text-slate-500 text-sm">尚無收入記錄</div>
        )}
      </div>
    </div>
  );
}
