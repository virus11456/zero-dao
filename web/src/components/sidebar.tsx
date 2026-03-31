'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const nav = [
  { href: '/',           label: '看板',   icon: '📊' },
  { href: '/goals',      label: '目標',   icon: '🎯' },
  { href: '/tasks',      label: '任務',   icon: '✅' },
  { href: '/team',       label: '團隊',   icon: '👥' },
  { href: '/agents',     label: 'Agents', icon: '🤖' },
  { href: '/finance',    label: '財務',   icon: '💰' },
  { href: '/governance', label: '治理',   icon: '🗳️' },
  { href: '/archive',    label: '檔案庫', icon: '📁' },
  { href: '/knowledge',  label: '知識庫', icon: '📚' },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <aside className="fixed top-0 left-0 w-56 h-screen bg-slate-800 border-r border-slate-700 flex flex-col py-6 px-3 z-10">
      <div className="mb-8 px-3">
        <h1 className="text-lg font-bold text-sky-400">zero-dao</h1>
        <p className="text-xs text-slate-400 mt-0.5">零人全自動公司</p>
      </div>

      <nav className="flex-1 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              path === item.href
                ? 'bg-sky-500/20 text-sky-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50',
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="px-3 pt-4 border-t border-slate-700">
        <p className="text-xs text-slate-500">v0.6 · DAO Framework</p>
      </div>
    </aside>
  );
}
