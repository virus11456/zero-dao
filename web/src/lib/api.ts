const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};

// --- Types ---

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'cancelled';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type AgentStatus = 'idle' | 'running' | 'paused' | 'error';
export type GoalStatus = 'draft' | 'planning' | 'active' | 'completed' | 'paused' | 'cancelled';

export interface Task {
  id: string;
  identifier: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assignee?: { id: string; name: string; role: string } | null;
  labels: string[];
  updatedAt: string;
  completedAt?: string | null;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  capabilities: string[];
  maxParallelTasks: number;
  _count?: { tasks: number };
}

export interface Goal {
  id: string;
  title: string;
  description?: string | null;
  status: GoalStatus;
  tasksCreated: number;
  tasksDone: number;
  selfHealCount: number;
  _count?: { tasks: number };
  createdAt: string;
}

export interface DashboardData {
  tasks: { inProgress: number; blocked: number; done: number; todo: number };
  agents: Record<string, number>;
  goals: { active: number; completed: number };
}

export interface Proposal {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  votingDeadline: string;
  quorumPercent: number;
  passThreshold: number;
  _count?: { votes: number };
  createdAt: string;
}

export interface IncomeEvent {
  id: string;
  source: string;
  description?: string | null;
  amountCents: number;
  currency: string;
  recordedAt: string;
  distribution?: {
    totalCents: number;
    lineItems: Array<{ id: string; label: string; percent: number; amountCents: number; paid: boolean }>;
  } | null;
}

export interface FinancialReport {
  id: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  summary?: string | null;
}

export interface KnowledgeFact {
  id: string;
  type: string;
  key: string;
  title: string;
  body: string;
  tags: string[];
  accessCount: number;
  agent: { name: string; role: string };
  updatedAt: string;
}
