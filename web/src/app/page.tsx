'use client';

import useSWR from 'swr';
import { api, DashboardData, Task, Agent, Goal } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fetcher = (url: string) => api.get(url);

const statusColor: Record<string, string> = {
  todo: 'bg-slate-600',
  in_progress: 'bg-sky-500',
  done: 'bg-emerald-500',
  blocked: 'bg-red-500',
  cancelled: 'bg-slate-700',
};

const priorityColor: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-slate-400',
};

const agentStatusEmoji: Record<string, string> = {
  idle: '💤',
  running: '🟢',
  paused: '⏸️',
  error: '🔴',
};

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color ?? 'text-slate-100'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium text-white ${statusColor[status] ?? 'bg-slate-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function DashboardPage() {
  const { data: dash, isLoading: dashLoading } = useSWR<DashboardData>('/api/dashboard', fetcher, { refreshInterval: 15000 });
  const { data: tasks } = useSWR<Task[]>('/api/tasks', fetcher, { refreshInterval: 15000 });
  const { data: agents } = useSWR<Agent[]>('/api/agents', fetcher, { refreshInterval: 30000 });
  const { data: goals } = useSWR<Goal[]>('/api/goals', fetcher, { refreshInterval: 30000 });

  const inProgressTasks = tasks?.filter((t) => t.status === 'in_progress').slice(0, 5) ?? [];
  const blockedTasks = tasks?.filter((t) => t.status === 'blocked').slice(0, 3) ?? [];
  const activeGoals = goals?.filter((g) => ['active', 'planning'].includes(g.status)).slice(0, 4) ?? [];

  const taskChartData = dash ? [
    { name: '進行中', value: dash.tasks.inProgress, fill: '#0ea5e9' },
    { name: '待辦', value: dash.tasks.todo, fill: '#64748b' },
    { name: '阻塞', value: dash.tasks.blocked, fill: '#ef4444' },
    { name: '完成', value: dash.tasks.done, fill: '#10b981' },
  ] : [];

  if (dashLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">載入中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">公司看板</h2>
        <p className="text-slate-400 text-sm">即時監控所有營運指標</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="進行中任務" value={dash?.tasks.inProgress ?? 0} color="text-sky-400" />
        <StatCard label="待辦任務" value={dash?.tasks.todo ?? 0} />
        <StatCard label="阻塞任務" value={dash?.tasks.blocked ?? 0} color={dash?.tasks.blocked ? 'text-red-400' : undefined} />
        <StatCard label="進行中目標" value={dash?.goals.active ?? 0} color="text-emerald-400" sub={`${dash?.goals.completed ?? 0} 已完成`} />
      </div>

      {/* Charts + Agents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Task distribution chart */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">任務分布</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={taskChartData} layout="vertical">
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={50} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#f1f5f9' }}
                itemStyle={{ color: '#94a3b8' }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {taskChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Agent status */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Agent 狀態</h3>
          <div className="space-y-3">
            {agents?.map((a) => (
              <div key={a.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{agentStatusEmoji[a.status] ?? '❓'}</span>
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-slate-400">{a.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex gap-1">
                    {Array.from({ length: a.maxParallelTasks }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-sm ${i < (a._count?.tasks ?? 0) ? 'bg-sky-500' : 'bg-slate-600'}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{a._count?.tasks ?? 0}/{a.maxParallelTasks}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">進行中目標</h3>
          <div className="space-y-4">
            {activeGoals.map((g) => {
              const total = g._count?.tasks ?? 0;
              const done = g.tasksDone;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate max-w-xs">{g.title}</p>
                    <span className="text-xs text-slate-400 ml-2 shrink-0">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div className="bg-sky-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{done}/{total} 任務</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* In-progress tasks + Blocked */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">進行中任務</h3>
          {inProgressTasks.length === 0 ? (
            <p className="text-slate-500 text-sm">無進行中任務</p>
          ) : (
            <div className="space-y-2">
              {inProgressTasks.map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-mono">{t.identifier}</p>
                    <p className="text-sm truncate">{t.title}</p>
                    {t.assignee && <p className="text-xs text-sky-400 mt-0.5">{t.assignee.name}</p>}
                  </div>
                  <span className={`text-xs shrink-0 ${priorityColor[t.priority]}`}>{t.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">
            阻塞任務 {blockedTasks.length > 0 && <span className="text-red-400">({blockedTasks.length})</span>}
          </h3>
          {blockedTasks.length === 0 ? (
            <p className="text-slate-500 text-sm">🎉 目前無阻塞任務</p>
          ) : (
            <div className="space-y-2">
              {blockedTasks.map((t) => (
                <div key={t.id} className="border border-red-500/20 rounded-lg p-3 bg-red-500/5">
                  <p className="text-xs text-slate-400 font-mono">{t.identifier}</p>
                  <p className="text-sm">{t.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
