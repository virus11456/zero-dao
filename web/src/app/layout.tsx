import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/sidebar';
import { AuthGuard } from '@/components/auth-guard';

export const metadata: Metadata = {
  title: 'zero-dao',
  description: '零人全自動公司看板',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="flex min-h-screen bg-slate-900 text-slate-100">
        <AuthGuard>
          <Sidebar />
          <main className="flex-1 ml-56 p-6 overflow-auto">{children}</main>
        </AuthGuard>
      </body>
    </html>
  );
}
