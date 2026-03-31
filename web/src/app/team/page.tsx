'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { api, swrFetcher } from '@/lib/api';

interface AgentWithOrg {
  id: string;
  name: string;
  role: string;
  status: string;
  capabilities: string[];
  maxParallelTasks: number;
  systemPrompt: string;
  reportsTo?: { id: string; name: string } | null;
  directReports?: Array<{ id: string; name: string; role: string }>;
  _count?: { tasks: number };
}

const roleLabel: Record<string, string> = {
  ceo: 'CEO',
  engineer: '工程師',
  designer: '設計師',
  researcher: '研究員',
  marketing: '行銷',
  analyst: '分析師',
};

const roleColor: Record<string, string> = {
  ceo: 'bg-amber-500/20 text-amber-400',
  engineer: 'bg-sky-500/20 text-sky-400',
  designer: 'bg-purple-500/20 text-purple-400',
  researcher: 'bg-emerald-500/20 text-emerald-400',
  marketing: 'bg-pink-500/20 text-pink-400',
  analyst: 'bg-indigo-500/20 text-indigo-400',
};

const statusEmoji: Record<string, string> = {
  idle: '💤',
  running: '🟢',
  paused: '⏸️',
  error: '🔴',
};

export default function TeamPage() {
  const { data: agents, mutate } = useSWR<AgentWithOrg[]>('/api/agents/org', swrFetcher, { refreshInterval: 30000 });
  const [showHire, setShowHire] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [hireResult, setHireResult] = useState<{ name: string; role: string; systemPrompt: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    role: 'engineer',
    responsibilities: '',
    capabilities: '',
    maxParallelTasks: 2,
  });

  async function hireAgent() {
    if (!form.name || !form.responsibilities) return;
    setHiring(true);
    setHireResult(null);
    try {
      const result = await api.post<{ name: string; role: string; systemPrompt: string }>('/api/agents/hire', {
        name: form.name,
        role: form.role,
        responsibilities: form.responsibilities,
        capabilities: form.capabilities.split(',').map((c) => c.trim()).filter(Boolean),
        maxParallelTasks: form.maxParallelTasks,
      });
      setHireResult(result);
      setForm({ name: '', role: 'engineer', responsibilities: '', capabilities: '', maxParallelTasks: 2 });
      mutate();
    } finally {
      setHiring(false);
    }
  }

  // Group by reporting structure
  const ceo = agents?.find((a) => a.role === 'ceo');
  const reports = agents?.filter((a) => a.role !== 'ceo') ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">團隊管理</h2>
          <p className="text-slate-400 text-sm mt-0.5">CEO 雇用新 Agent 並管理組織架構</p>
        </div>
        <button
          onClick={() => setShowHire(true)}
          className="bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + CEO 雇用
        </button>
      </div>

      {/* Hire form */}
      {showHire && (
        <div className="bg-slate-800 border border-amber-500/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-1">新員工招募</h3>
          <p className="text-xs text-slate-400 mb-4">Claude AI 將根據職責描述自動生成系統提示</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              placeholder="姓名（如：Jane, 行銷專員）"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {Object.entries(roleLabel).filter(([k]) => k !== 'ceo').map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <textarea
              className="col-span-2 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:border-amber-500"
              placeholder="職責描述（越詳細，AI 生成的系統提示越精準）"
              value={form.responsibilities}
              onChange={(e) => setForm({ ...form, responsibilities: e.target.value })}
            />
            <input
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              placeholder="技能標籤，逗號分隔（如：react, python, seo）"
              value={form.capabilities}
              onChange={(e) => setForm({ ...form, capabilities: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 shrink-0">最大並行任務</label>
              <input
                type="number"
                min={1}
                max={10}
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                value={form.maxParallelTasks}
                onChange={(e) => setForm({ ...form, maxParallelTasks: parseInt(e.target.value) || 2 })}
              />
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            <button
              onClick={hireAgent}
              disabled={hiring || !form.name || !form.responsibilities}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {hiring ? 'AI 生成系統提示中...' : '確認雇用'}
            </button>
            <button onClick={() => { setShowHire(false); setHireResult(null); }} className="text-slate-400 text-sm px-4 py-2 rounded-lg">
              取消
            </button>
          </div>

          {hireResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-emerald-400 text-sm font-medium mb-2">✅ {hireResult.name} 已加入團隊！</p>
              <p className="text-xs text-slate-400 mb-1">AI 生成的系統提示：</p>
              <pre className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-900 rounded p-3 max-h-40 overflow-y-auto">{hireResult.systemPrompt}</pre>
            </div>
          )}
        </div>
      )}

      {/* Org chart */}
      <div className="space-y-4">
        {/* CEO at top */}
        {ceo && (
          <div className="flex justify-center">
            <AgentCard agent={ceo} isTop />
          </div>
        )}

        {/* Connecting line */}
        {ceo && reports.length > 0 && (
          <div className="flex justify-center">
            <div className="w-px h-6 bg-slate-600" />
          </div>
        )}

        {/* Reports */}
        {reports.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4">
            {reports.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        )}
      </div>

      {!agents?.length && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">👥</p>
          <p>尚無 Agent</p>
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, isTop = false }: { agent: AgentWithOrg; isTop?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const activeTasks = agent._count?.tasks ?? 0;
  const loadPct = Math.round((activeTasks / agent.maxParallelTasks) * 100);

  return (
    <div
      className={`bg-slate-800 border rounded-xl p-4 w-56 ${isTop ? 'border-amber-500/40' : 'border-slate-700'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-sm">{agent.name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${roleColor[agent.role] ?? 'bg-slate-600 text-slate-300'}`}>
            {roleLabel[agent.role] ?? agent.role}
          </span>
        </div>
        <span className="text-lg">{statusEmoji[agent.status] ?? '❓'}</span>
      </div>

      {/* Load bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>負載</span>
          <span>{activeTasks}/{agent.maxParallelTasks}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${loadPct >= 100 ? 'bg-red-500' : loadPct >= 60 ? 'bg-amber-500' : 'bg-sky-500'}`}
            style={{ width: `${Math.min(loadPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1 mb-2">
        {agent.capabilities.slice(0, 3).map((c) => (
          <span key={c} className="text-xs bg-slate-700 text-slate-400 rounded px-1.5">{c}</span>
        ))}
        {agent.capabilities.length > 3 && (
          <span className="text-xs text-slate-500">+{agent.capabilities.length - 3}</span>
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        {expanded ? '▲ 收起' : '▼ 系統提示'}
      </button>
      {expanded && (
        <pre className="text-xs text-slate-400 whitespace-pre-wrap mt-2 max-h-32 overflow-y-auto bg-slate-900 rounded p-2">
          {agent.systemPrompt.slice(0, 300)}...
        </pre>
      )}
    </div>
  );
}
