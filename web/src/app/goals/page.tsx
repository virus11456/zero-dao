'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { api, Goal } from '@/lib/api';

const fetcher = (url: string) => api.get(url);

const statusColor: Record<string, string> = {
  draft: 'bg-slate-600 text-slate-200',
  planning: 'bg-amber-500/20 text-amber-400',
  active: 'bg-sky-500/20 text-sky-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  paused: 'bg-slate-500/20 text-slate-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const statusLabel: Record<string, string> = {
  draft: '草稿',
  planning: '規劃中',
  active: '進行中',
  completed: '已完成',
  paused: '已暫停',
  cancelled: '已取消',
};

export default function GoalsPage() {
  const { data: goals, mutate } = useSWR<Goal[]>('/api/goals', fetcher, { refreshInterval: 15000 });
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function createGoal() {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/api/goals', { title: newTitle, description: newDesc, status: 'planning' });
      setNewTitle('');
      setNewDesc('');
      setShowNew(false);
      mutate();
    } finally {
      setSubmitting(false);
    }
  }

  async function decompose(goalId: string) {
    await api.post(`/api/goals/${goalId}/decompose`, {});
    mutate();
  }

  const active = goals?.filter((g) => ['active', 'planning'].includes(g.status)) ?? [];
  const completed = goals?.filter((g) => g.status === 'completed') ?? [];
  const other = goals?.filter((g) => !['active', 'planning', 'completed'].includes(g.status)) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">目標管理</h2>
          <p className="text-slate-400 text-sm mt-0.5">定義目標，系統自動分解任務</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + 新增目標
        </button>
      </div>

      {/* New goal form */}
      {showNew && (
        <div className="bg-slate-800 border border-sky-500/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">新目標</h3>
          <input
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 mb-2 focus:outline-none focus:border-sky-500"
            placeholder="目標標題（例：本月 SEO 流量增加 20%）"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 mb-3 h-20 resize-none focus:outline-none focus:border-sky-500"
            placeholder="描述（可選）— 越詳細，AI 分解的任務越精確"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={createGoal}
              disabled={submitting || !newTitle.trim()}
              className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {submitting ? '建立中...' : '建立'}
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2 rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Active goals */}
      {active.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">進行中 ({active.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map((g) => {
              const total = g._count?.tasks ?? 0;
              const done = g.tasksDone;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={g.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h4 className="font-medium truncate">{g.title}</h4>
                      {g.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{g.description}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusColor[g.status]}`}>
                      {statusLabel[g.status]}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>{done}/{total} 任務完成</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className="bg-sky-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>自愈次數: {g.selfHealCount}</span>
                    <button
                      onClick={() => decompose(g.id)}
                      className="text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      重新分解 →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Completed goals */}
      {completed.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">已完成 ({completed.length})</h3>
          <div className="space-y-2">
            {completed.map((g) => (
              <div key={g.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3 flex items-center gap-3">
                <span className="text-emerald-400">✓</span>
                <span className="text-sm text-slate-300">{g.title}</span>
                <span className="text-xs text-slate-500 ml-auto">{g.tasksDone} 任務</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!goals?.length && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-lg font-medium">尚無目標</p>
          <p className="text-sm mt-1">點擊「新增目標」開始，系統會自動分解任務並指派給 Agent</p>
        </div>
      )}
    </div>
  );
}
