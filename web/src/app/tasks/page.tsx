'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { api, swrFetcher, Task, TaskStatus } from '@/lib/api';


const STATUS_COLS: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'blocked'];

const colLabel: Record<string, string> = {
  todo: '待辦',
  in_progress: '進行中',
  in_review: '審核中',
  done: '完成',
  blocked: '阻塞',
};

const colBorder: Record<string, string> = {
  todo: 'border-slate-600',
  in_progress: 'border-sky-500/40',
  in_review: 'border-purple-500/40',
  done: 'border-emerald-500/40',
  blocked: 'border-red-500/40',
};

const priorityBadge: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-slate-600 text-slate-400',
};

export default function TasksPage() {
  const { data: tasks, mutate } = useSWR<Task[]>('/api/tasks', swrFetcher, { refreshInterval: 10000 });
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');

  const grouped = STATUS_COLS.reduce<Record<string, Task[]>>((acc, s) => {
    acc[s] = (tasks ?? []).filter((t) => t.status === s);
    return acc;
  }, {});

  const filtered = filter === 'all' ? tasks ?? [] : (tasks ?? []).filter((t) => t.status === filter);

  async function updateStatus(taskId: string, status: TaskStatus) {
    await api.patch(`/api/tasks/${taskId}`, { status });
    mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">任務看板</h2>
          <p className="text-slate-400 text-sm mt-0.5">所有任務的即時狀態</p>
        </div>
        <div className="flex gap-2 text-xs">
          {['all', ...STATUS_COLS].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s as 'all' | TaskStatus)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filter === s ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {s === 'all' ? '全部' : colLabel[s]}
            </button>
          ))}
        </div>
      </div>

      {filter === 'all' ? (
        /* Kanban board view */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLS.map((status) => (
            <div key={status} className="shrink-0 w-72">
              <div className={`rounded-t-lg px-3 py-2 border-b-2 ${colBorder[status]} bg-slate-800 flex items-center justify-between`}>
                <span className="text-xs font-semibold text-slate-300">{colLabel[status]}</span>
                <span className="text-xs bg-slate-700 text-slate-400 rounded-full px-2 py-0.5">{grouped[status].length}</span>
              </div>
              <div className="bg-slate-800/50 rounded-b-lg min-h-24 p-2 space-y-2 border border-t-0 border-slate-700">
                {grouped[status].map((t) => (
                  <div key={t.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-slate-500 cursor-pointer group">
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <span className="text-xs text-slate-500 font-mono">{t.identifier}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${priorityBadge[t.priority]}`}>{t.priority}</span>
                    </div>
                    <p className="text-sm text-slate-200 leading-snug">{t.title}</p>
                    {t.assignee && (
                      <p className="text-xs text-sky-400 mt-2">→ {t.assignee.name}</p>
                    )}
                    {t.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.labels.slice(0, 3).map((l) => (
                          <span key={l} className="text-xs bg-slate-700 text-slate-400 rounded px-1.5">{l}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List view for filtered status */
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-xs text-slate-400 uppercase">
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">任務</th>
                <th className="text-left px-4 py-3">優先級</th>
                <th className="text-left px-4 py-3">負責人</th>
                <th className="text-left px-4 py-3">標籤</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="px-4 py-3 font-mono text-slate-400 text-xs">{t.identifier}</td>
                  <td className="px-4 py-3">{t.title}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${priorityBadge[t.priority]}`}>{t.priority}</span>
                  </td>
                  <td className="px-4 py-3 text-sky-400">{t.assignee?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {t.labels.slice(0, 2).map((l) => (
                        <span key={l} className="text-xs bg-slate-700 text-slate-400 rounded px-1.5">{l}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm">此狀態無任務</div>
          )}
        </div>
      )}
    </div>
  );
}
