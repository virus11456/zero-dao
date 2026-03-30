'use client';

import useSWR from 'swr';
import { api, Agent } from '@/lib/api';

const fetcher = (url: string) => api.get(url);

const statusConfig: Record<string, { color: string; label: string; emoji: string }> = {
  idle:    { color: 'bg-slate-500/20 text-slate-400', label: '閒置', emoji: '💤' },
  running: { color: 'bg-emerald-500/20 text-emerald-400', label: '運行中', emoji: '🟢' },
  paused:  { color: 'bg-amber-500/20 text-amber-400', label: '已暫停', emoji: '⏸️' },
  error:   { color: 'bg-red-500/20 text-red-400', label: '錯誤', emoji: '🔴' },
};

const roleLabel: Record<string, string> = {
  ceo: 'CEO',
  engineer: '工程師',
  designer: '設計師',
  researcher: '研究員',
  marketing: '行銷',
  analyst: '分析師',
};

export default function AgentsPage() {
  const { data: agents } = useSWR<Agent[]>('/api/agents', fetcher, { refreshInterval: 15000 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Agent 管理</h2>
        <p className="text-slate-400 text-sm mt-0.5">所有 AI Agent 的狀態與能力</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents?.map((a) => {
          const sc = statusConfig[a.status] ?? statusConfig.idle;
          const activeTasks = a._count?.tasks ?? 0;
          const loadPct = Math.round((activeTasks / a.maxParallelTasks) * 100);

          return (
            <div key={a.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{a.name}</h3>
                  <p className="text-xs text-slate-400">{roleLabel[a.role] ?? a.role}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${sc.color}`}>
                  {sc.emoji} {sc.label}
                </span>
              </div>

              {/* Task load bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>任務負載</span>
                  <span>{activeTasks}/{a.maxParallelTasks}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${loadPct >= 100 ? 'bg-red-500' : loadPct >= 60 ? 'bg-amber-500' : 'bg-sky-500'}`}
                    style={{ width: `${Math.min(loadPct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <p className="text-xs text-slate-400 mb-1.5">技能</p>
                <div className="flex flex-wrap gap-1">
                  {a.capabilities.map((c) => (
                    <span key={c} className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-0.5">{c}</span>
                  ))}
                  {a.capabilities.length === 0 && <span className="text-xs text-slate-500">—</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!agents?.length && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">🤖</p>
          <p>尚無 Agent</p>
        </div>
      )}
    </div>
  );
}
