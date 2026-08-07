export type Locale = 'fr' | 'en' | 'ar';
export type Theme = 'light' | 'dark';
export type JobStatus = 'pending' | 'validating' | 'importing' | 'publishing' | 'archiving' | 'success' | 'failed' | 'retrying' | 'cancelled';
export type Priority = 'low' | 'normal' | 'high' | 'critical';
export type EditorId = 'discover' | 'sports' | 'kids' | 'stories' | 'gaming';

export interface Job {
  readonly id: string;
  title: string;
  editor: EditorId;
  status: JobStatus;
  priority: Priority;
  progress: number;
  createdAt: string;
  scheduledAt?: string;
  model: string;
  duration?: number;
}

export interface Activity {
  readonly id: string;
  label: string;
  detail: string;
  timestamp: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
}

export interface Provider {
  readonly id: string;
  name: string;
  model: string;
  latency: number;
  availability: number;
  tokens: number;
  status: 'online' | 'degraded' | 'offline';
}

export interface Editor {
  readonly id: EditorId;
  name: string;
  description: string;
  articles: number;
  successRate: number;
  status: 'active' | 'paused';
  cadence: string;
}

export interface Workflow {
  readonly id: string;
  name: string;
  editor: EditorId | 'global';
  steps: readonly string[];
  executions: number;
  successRate: number;
  status: 'active' | 'draft';
}

export interface Publication {
  readonly id: string;
  title: string;
  editor: EditorId;
  slug: string;
  publishedAt: string;
  status: 'published' | 'ready' | 'review';
  score: number;
}

export interface HealthItem {
  readonly id: string;
  name: string;
  latency: number;
  uptime: number;
  status: 'healthy' | 'degraded' | 'offline';
}
