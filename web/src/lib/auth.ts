'use client';

import { createContext, useContext } from 'react';

const AUTH_STORAGE_KEY = 'zero-dao-api-key';

export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem(AUTH_STORAGE_KEY, key);
}

export function clearStoredApiKey(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/** Validate an API key by calling the backend health-check with auth */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200';
  try {
    const res = await fetch(`${API_URL}/api/dashboard`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Auth context for components
export interface AuthContextValue {
  isAuthenticated: boolean;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
