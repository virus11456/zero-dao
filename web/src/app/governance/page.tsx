'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { api, Proposal } from '@/lib/api';

const fetcher = (url: string) => api.get(url);

const statusConfig: Record<string, { color: string; label: string }> = {
  open:     { color: 'bg-sky-500/20 text-sky-400', label: '投票中' },
  passed:   { color: 'bg-emerald-500/20 text-emerald-400', label: '已通過' },
  rejected: { color: 'bg-red-500/20 text-red-400', label: '已否決' },
  executed: { color: 'bg-purple-500/20 text-purple-400', label: '已執行' },
  expired:  { color: 'bg-slate-500/20 text-slate-400', label: '已過期' },
};

const typeLabel: Record<string, string> = {
  constitution_amendment: '修憲',
  profit_distribution: '利潤分配',
  agent_hire: '雇用 Agent',
  agent_fire: '解除 Agent',
  budget_allocation: '預算分配',
  strategic_pivot: '策略轉向',
  custom: '其他',
};

export default function GovernancePage() {
  const { data: proposals, mutate } = useSWR<Proposal[]>('/api/proposals', fetcher, { refreshInterval: 30000 });
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ type: 'custom', title: '', description: '' });
  const [voting, setVoting] = useState<string | null>(null);
  const [voteChoice, setVoteChoice] = useState<'yes' | 'no' | 'abstain'>('yes');
  const [voterUserId, setVoterUserId] = useState('');

  async function createProposal() {
    await api.post('/api/proposals', form);
    setForm({ type: 'custom', title: '', description: '' });
    setShowNew(false);
    mutate();
  }

  async function castVote(proposalId: string) {
    await api.post(`/api/proposals/${proposalId}/vote`, {
      choice: voteChoice,
      voterUserId: voterUserId || undefined,
    });
    setVoting(null);
    mutate();
  }

  const open = proposals?.filter((p) => p.status === 'open') ?? [];
  const closed = proposals?.filter((p) => p.status !== 'open') ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">治理 & 提案</h2>
          <p className="text-slate-400 text-sm mt-0.5">董事會投票與重大決策</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-purple-500 hover:bg-purple-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + 新提案
        </button>
      </div>

      {/* New proposal */}
      {showNew && (
        <div className="bg-slate-800 border border-purple-500/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">新提案</h3>
          <div className="space-y-2 mb-3">
            <select
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {Object.entries(typeLabel).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
              placeholder="提案標題"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:border-purple-500"
              placeholder="提案說明"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={createProposal} className="bg-purple-500 hover:bg-purple-400 text-white text-sm font-medium px-4 py-2 rounded-lg">
              提交
            </button>
            <button onClick={() => setShowNew(false)} className="text-slate-400 text-sm px-4 py-2 rounded-lg">
              取消
            </button>
          </div>
        </div>
      )}

      {/* Open proposals */}
      {open.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">投票中 ({open.length})</h3>
          <div className="space-y-4">
            {open.map((p) => {
              const deadline = new Date(p.votingDeadline);
              const hoursLeft = Math.max(0, Math.round((deadline.getTime() - Date.now()) / 3600000));
              return (
                <div key={p.id} className="bg-slate-800 border border-purple-500/20 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded mr-2">{typeLabel[p.type] ?? p.type}</span>
                      <h4 className="font-medium mt-1">{p.title}</h4>
                      <p className="text-sm text-slate-400 mt-1">{p.description}</p>
                    </div>
                    <span className="shrink-0 text-xs text-amber-400">{hoursLeft}h 剩餘</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-slate-500">{p._count?.votes ?? 0} 票 · 需 {p.quorumPercent}% Quorum · {p.passThreshold}% 通過</span>
                    {voting === p.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs w-32"
                          placeholder="你的 User ID"
                          value={voterUserId}
                          onChange={(e) => setVoterUserId(e.target.value)}
                        />
                        <select
                          className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs"
                          value={voteChoice}
                          onChange={(e) => setVoteChoice(e.target.value as 'yes' | 'no' | 'abstain')}
                        >
                          <option value="yes">贊成</option>
                          <option value="no">反對</option>
                          <option value="abstain">棄權</option>
                        </select>
                        <button onClick={() => castVote(p.id)} className="bg-purple-500 text-white text-xs px-3 py-1 rounded">確認</button>
                        <button onClick={() => setVoting(null)} className="text-slate-400 text-xs px-2 py-1">取消</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setVoting(p.id)}
                        className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        投票 →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Closed proposals */}
      {closed.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">歷史提案</h3>
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                  <th className="text-left px-4 py-2">提案</th>
                  <th className="text-left px-4 py-2">類型</th>
                  <th className="text-left px-4 py-2">結果</th>
                  <th className="text-left px-4 py-2">日期</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((p) => {
                  const sc = statusConfig[p.status] ?? statusConfig.open;
                  return (
                    <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="px-4 py-3">{p.title}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{typeLabel[p.type]}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(p.createdAt).toLocaleDateString('zh-TW')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!proposals?.length && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">🗳️</p>
          <p>尚無提案</p>
        </div>
      )}
    </div>
  );
}
