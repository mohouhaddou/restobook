import type { Activity, Editor, HealthItem, Job, Provider, Publication, Workflow } from '../types';

export const jobs: Job[] = [
  { id: 'JOB-1048', title: 'Les océans bioluminescents', editor: 'discover', status: 'publishing', priority: 'high', progress: 82, createdAt: '2026-07-23T09:42:00Z', model: 'GPT-5', duration: 148 },
  { id: 'JOB-1047', title: 'Mercato : les jeunes talents à suivre', editor: 'sports', status: 'validating', priority: 'normal', progress: 38, createdAt: '2026-07-23T09:18:00Z', model: 'Claude Sonnet', duration: 91 },
  { id: 'JOB-1046', title: 'Pourquoi le ciel est bleu ?', editor: 'kids', status: 'pending', priority: 'normal', progress: 0, createdAt: '2026-07-23T08:55:00Z', model: 'GPT-5' },
  { id: 'JOB-1045', title: 'La cité sous les dunes', editor: 'stories', status: 'failed', priority: 'critical', progress: 64, createdAt: '2026-07-23T08:21:00Z', model: 'Gemini Pro', duration: 205 },
  { id: 'JOB-1044', title: 'Indés : les sorties de la semaine', editor: 'gaming', status: 'success', priority: 'low', progress: 100, createdAt: '2026-07-23T07:45:00Z', model: 'GPT-5', duration: 116 },
  { id: 'JOB-1043', title: 'Le télescope qui remonte le temps', editor: 'discover', status: 'archiving', priority: 'normal', progress: 94, createdAt: '2026-07-23T07:12:00Z', model: 'Mistral Large', duration: 174 }
];

export const activities: Activity[] = [
  { id: 'a1', label: 'Publication terminée', detail: 'GamingHub · Indés de la semaine', timestamp: 'Il y a 4 min', tone: 'success' },
  { id: 'a2', label: 'Validation SEO requise', detail: 'Sports · Mercato jeunes talents', timestamp: 'Il y a 11 min', tone: 'warning' },
  { id: 'a3', label: 'Nouvelle tentative planifiée', detail: 'Stories · La cité sous les dunes', timestamp: 'Il y a 18 min', tone: 'danger' },
  { id: 'a4', label: 'Modèle basculé', detail: 'Discover · GPT-5 activé', timestamp: 'Il y a 31 min', tone: 'info' }
];

export const editors: Editor[] = [
  { id: 'discover', name: 'Discover', description: 'Sciences, culture et société', articles: 428, successRate: 97.8, status: 'active', cadence: '12 / jour' },
  { id: 'sports', name: 'Sports', description: 'Actualités, analyses et résultats', articles: 316, successRate: 96.2, status: 'active', cadence: '18 / jour' },
  { id: 'kids', name: 'Kids', description: 'Contenus pédagogiques adaptés', articles: 204, successRate: 98.4, status: 'active', cadence: '6 / jour' },
  { id: 'stories', name: 'Stories', description: 'Récits originaux et feuilletons', articles: 151, successRate: 94.9, status: 'paused', cadence: '4 / jour' },
  { id: 'gaming', name: 'GamingHub', description: 'Jeux, guides et culture gaming', articles: 287, successRate: 97.1, status: 'active', cadence: '10 / jour' }
];

export const providers: Provider[] = [
  { id: 'openai', name: 'OpenAI', model: 'GPT-5', latency: 820, availability: 99.98, tokens: 1840000, status: 'online' },
  { id: 'anthropic', name: 'Anthropic', model: 'Claude Sonnet', latency: 930, availability: 99.91, tokens: 980000, status: 'online' },
  { id: 'google', name: 'Google AI', model: 'Gemini Pro', latency: 1160, availability: 98.72, tokens: 620000, status: 'degraded' },
  { id: 'mistral', name: 'Mistral AI', model: 'Mistral Large', latency: 710, availability: 99.87, tokens: 440000, status: 'online' }
];

export const workflows: Workflow[] = editors.map((editor, index) => ({
  id: `wf-${editor.id}`,
  name: `${editor.name} Editorial`,
  editor: editor.id,
  steps: ['Brief', 'Recherche', 'Rédaction', 'SEO', 'Validation', 'Package'],
  executions: 184 - index * 19,
  successRate: editor.successRate,
  status: editor.id === 'stories' ? 'draft' : 'active'
}));

export const publications: Publication[] = jobs.slice(0, 5).map((job, index) => ({
  id: `PUB-${2080 - index}`,
  title: job.title,
  editor: job.editor,
  slug: job.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  publishedAt: `${index + 1} h`,
  status: index < 2 ? 'published' : index === 2 ? 'ready' : 'review',
  score: 96 - index * 3
}));

export const health: HealthItem[] = [
  { id: 'workflow', name: 'Workflow Engine', latency: 42, uptime: 99.99, status: 'healthy' },
  { id: 'publisher', name: 'Publisher Engine', latency: 67, uptime: 99.97, status: 'healthy' },
  { id: 'content', name: 'Content Manager', latency: 31, uptime: 100, status: 'healthy' },
  { id: 'filesystem', name: 'FileSystem', latency: 18, uptime: 99.99, status: 'healthy' },
  { id: 'integration', name: 'Integration Layer', latency: 73, uptime: 99.88, status: 'degraded' },
  { id: 'backend', name: 'AI Publisher', latency: 58, uptime: 99.96, status: 'healthy' }
];

export const weeklySeries = [62, 74, 68, 89, 96, 84, 108];
export const monthlySeries = [61, 66, 72, 70, 78, 84, 82, 91, 94, 102, 108, 116];
