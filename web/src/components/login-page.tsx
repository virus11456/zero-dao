'use client';

import { useState, useEffect, useRef } from 'react';
import { validateApiKey, setStoredApiKey } from '@/lib/auth';

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('請輸入 API Key');
      return;
    }

    setLoading(true);
    setError(null);

    const valid = await validateApiKey(apiKey.trim());
    if (valid) {
      setStoredApiKey(apiKey.trim());
      onSuccess();
    } else {
      setError('API Key 無效或無法連線到伺服器');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex bg-slate-900">
      {/* Left half — login form */}
      <div className="w-full md:w-1/2 flex flex-col overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto px-8 py-12">
          {/* Logo */}
          <div className="mb-10">
            <h1 className="text-2xl font-bold text-sky-400">zero-dao</h1>
            <p className="text-sm text-slate-400 mt-1">零人全自動公司</p>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-slate-100">
            登入管理看板
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            輸入你的 API Key 來存取零人公司的管理儀表板。
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="api-key"
                className="text-xs text-slate-400 mb-1.5 block font-medium"
              >
                API Key
              </label>
              <input
                ref={inputRef}
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="your-secret-api-key"
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '驗證中...' : '登入'}
            </button>
          </form>

          {/* Help text */}
          <div className="mt-8 text-xs text-slate-500 space-y-1">
            <p>API Key 設定在伺服器的 <code className="text-slate-400">API_KEY</code> 環境變數中。</p>
            <p>如果伺服器未設定 API_KEY，則任何值皆可登入（開發模式）。</p>
          </div>
        </div>
      </div>

      {/* Right half — decorative panel */}
      <div className="hidden md:flex w-1/2 bg-slate-800 items-center justify-center overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-900/20 to-indigo-900/20" />

        <div className="relative text-center px-12 max-w-lg">
          {/* ASCII art / decorative element */}
          <pre className="text-sky-400/60 text-xs font-mono leading-relaxed mb-8 select-none">{`
    ╔══════════════════════════╗
    ║   ░░░ ZERO-DAO ░░░      ║
    ║                          ║
    ║   Autonomous Company     ║
    ║   ┌─────┐  ┌─────┐      ║
    ║   │ CEO │──│ ENG │      ║
    ║   └──┬──┘  └──┬──┘      ║
    ║      │        │          ║
    ║   ┌──┴──┐  ┌──┴──┐      ║
    ║   │ MKT │  │ CFO │      ║
    ║   └─────┘  └─────┘      ║
    ║                          ║
    ║   Goals → Tasks → Done   ║
    ╚══════════════════════════╝
`}</pre>

          <h3 className="text-lg font-semibold text-slate-200 mb-3">
            完全自主的 AI 公司
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            定義目標，AI 自動分解任務、分配 Agent 執行、
            自我修復、累積知識、治理投票、財務記帳。
            人類只需設定方向。
          </p>

          {/* Feature badges */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['自主規劃', '智能分配', '自我修復', '知識累積', '治理投票', '財務記帳'].map((f) => (
              <span
                key={f}
                className="inline-block rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
