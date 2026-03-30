'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { api, swrFetcher, KnowledgeFact } from '@/lib/api';


const typeConfig: Record<string, { color: string; label: string; icon: string }> = {
  lesson:    { color: 'bg-sky-500/20 text-sky-400', label: '教訓', icon: '📚' },
  pattern:   { color: 'bg-purple-500/20 text-purple-400', label: '模式', icon: '🔁' },
  reference: { color: 'bg-amber-500/20 text-amber-400', label: '參考', icon: '📎' },
  feedback:  { color: 'bg-emerald-500/20 text-emerald-400', label: '回饋', icon: '💬' },
};

export default function KnowledgePage() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const queryStr = `/api/knowledge?${new URLSearchParams({ ...(q && { q }), ...(type && { type }) })}`;
  const { data: facts } = useSWR<KnowledgeFact[]>(queryStr, swrFetcher, { refreshInterval: 60000 });

  const grouped = (facts ?? []).reduce<Record<string, KnowledgeFact[]>>((acc, f) => {
    (acc[f.type] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">知識庫</h2>
        <p className="text-slate-400 text-sm mt-0.5">Agent 從每次任務累積的經驗與教訓</p>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <input
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
          placeholder="搜尋知識..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">全部類型</option>
          {Object.entries(typeConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(typeConfig).map(([k, cfg]) => (
          <div key={k} className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-2xl mb-1">{cfg.icon}</p>
            <p className="text-lg font-bold">{(facts ?? []).filter((f) => f.type === k).length}</p>
            <p className="text-xs text-slate-400">{cfg.label}</p>
          </div>
        ))}
      </div>

      {/* Knowledge cards */}
      {type ? (
        /* Single type view */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(facts ?? []).map((f) => <KnowledgeCard key={f.id} fact={f} />)}
        </div>
      ) : (
        /* Grouped by type */
        Object.entries(grouped).map(([t, items]) => {
          const cfg = typeConfig[t] ?? { color: 'bg-slate-600', label: t, icon: '📝' };
          return (
            <section key={t}>
              <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                <span>{cfg.icon}</span>
                <span>{cfg.label} ({items.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.slice(0, 6).map((f) => <KnowledgeCard key={f.id} fact={f} />)}
              </div>
            </section>
          );
        })
      )}

      {!facts?.length && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-lg font-medium">知識庫尚為空</p>
          <p className="text-sm mt-1">Agent 完成任務後會自動累積知識</p>
        </div>
      )}
    </div>
  );
}

function KnowledgeCard({ fact }: { fact: KnowledgeFact }) {
  const cfg = typeConfig[fact.type] ?? { color: 'bg-slate-600 text-slate-300', label: fact.type, icon: '📝' };
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium leading-snug">{fact.title}</h4>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>{cfg.label}</span>
      </div>
      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-3">{fact.body}</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {fact.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-xs bg-slate-700 text-slate-400 rounded px-1.5">{t}</span>
          ))}
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">{fact.agent.name}</p>
          <p className="text-xs text-slate-600">使用 {fact.accessCount} 次</p>
        </div>
      </div>
    </div>
  );
}
