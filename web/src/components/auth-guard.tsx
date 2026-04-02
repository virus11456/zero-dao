'use client';

import { useEffect, useState, useCallback } from 'react';
import { AuthContext, getStoredApiKey, clearStoredApiKey } from '@/lib/auth';
import { LoginPage } from '@/components/login-page';

/**
 * AuthGuard wraps the entire app.
 * If no valid API key is stored, shows the login page.
 * Once authenticated, renders children and provides auth context.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const key = getStoredApiKey();
    setIsAuthenticated(!!key);
  }, []);

  const handleLogin = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearStoredApiKey();
    setIsAuthenticated(false);
  }, []);

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  // Not authenticated — show login
  if (!isAuthenticated) {
    return <LoginPage onSuccess={handleLogin} />;
  }

  // Authenticated — render app
  return (
    <AuthContext.Provider value={{ isAuthenticated: true, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
