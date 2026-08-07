import React from 'react';
import { Activity, ArrowUpRight, Bot, CheckCircle2, Clock3, Cpu, Eye, FileText, Gauge, Image, Layers3, Radio, Sparkles, TimerReset } from 'lucide-react';
import type { HealthItem, Job, Provider, Publication, Workflow } from '../types';

export function StatusBadge({ status }: { status: string }) {
  const tone = ['success', 'online', 'healthy', 'active', 'published', 'ready'].includes(status) ? 'success' : ['failed', 'offline', 'cancelled'].includes(status) ? 'danger' : ['warning', 'degraded', 'review', 'retrying'].includes(status) ? 'warning' : 'info';
  return <span className={`ai-badge ai-badge--${tone}`}><span />{status}</span>;
}

export function MetricCard({ label, value, detail, icon: Icon = Activity, trend }: { label: string; value: string; detail: string; icon?: typeof Activity; trend?: string }) {
  return <article className="ai-card ai-metric-card">
    <div className="ai-icon-box"><Icon aria-hidden="true" /></div>
    <div><p className="ai-eyebrow">{label}</p><strong>{value}</strong><small>{detail}</small></div>
    {trend && <span className="ai-trend"><ArrowUpRight size={14} />{trend}</span>}
  </article>;
}

export function AIStatusCard() {
  return <article className="ai-card ai-status-hero"><div><span className="ai-live"><Radio size={15} /> Live</span><h2>La rédaction IA fonctionne normalement.</h2><p>7 traitements actifs sur 12 workers. Aucun incident critique détecté.</p></div><div className="ai-orbit"><Bot aria-hidden="true" /></div></article>;
}

export function JobCard({ job, compact = false, onMove }: { job: Job; compact?: boolean; onMove?: (status: Job['status']) => void }) {
  return <article className={`ai-card ai-job-card${compact ? ' ai-job-card--compact' : ''}`} draggable onDragStart={(event) => event.dataTransfer.setData('text/job-id', job.id)} tabIndex={0}>
    <div className="ai-card-head"><span className="ai-code">{job.id}</span><StatusBadge status={job.status} /></div>
    <h3>{job.title}</h3><p className="ai-muted">{job.editor} · {job.model}</p>
    <div className="ai-progress" role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${job.progress}%` }} /></div>
    <div className="ai-card-foot"><span><Clock3 size={14} /> {job.duration ? `${job.duration}s` : 'En attente'}</span><span>{job.progress}%</span></div>
    {onMove && <select className="ai-select ai-move-select" aria-label={`Déplacer ${job.title}`} value={job.status} onChange={(event) => onMove(event.target.value as Job['status'])}>
      {['pending', 'validating', 'publishing', 'success', 'failed'].map((status) => <option key={status}>{status}</option>)}
    </select>}
  </article>;
}

export function QueueCard({ count, wait, priority }: { count: number; wait: string; priority: string }) {
  return <article className="ai-card ai-queue-card"><Layers3 /><div><span className="ai-eyebrow">File {priority}</span><strong>{count}</strong><small>Attente estimée {wait}</small></div></article>;
}

export function WorkflowCard({ workflow }: { workflow: Workflow }) {
  return <article className="ai-card ai-workflow-card"><div className="ai-card-head"><div className="ai-icon-box"><Sparkles /></div><StatusBadge status={workflow.status} /></div><h3>{workflow.name}</h3><p>{workflow.steps.length} étapes · {workflow.executions} exécutions</p><div className="ai-step-dots">{workflow.steps.map((step, index) => <span key={step} title={step}>{index + 1}</span>)}</div><div className="ai-card-foot"><span>Taux de réussite</span><strong>{workflow.successRate}%</strong></div></article>;
}

export function ProviderCard({ provider }: { provider: Provider }) {
  return <article className="ai-card ai-provider-card"><div className="ai-card-head"><div><p className="ai-eyebrow">{provider.model}</p><h3>{provider.name}</h3></div><StatusBadge status={provider.status} /></div><dl><div><dt>Latence</dt><dd>{provider.latency} ms</dd></div><div><dt>Disponibilité</dt><dd>{provider.availability}%</dd></div><div><dt>Tokens</dt><dd>{Intl.NumberFormat('fr', { notation: 'compact' }).format(provider.tokens)}</dd></div></dl></article>;
}

export function ModelCard({ name, provider, context, cost }: { name: string; provider: string; context: string; cost: string }) {
  return <article className="ai-card ai-model-card"><Cpu /><h3>{name}</h3><p>{provider}</p><dl><div><dt>Contexte</dt><dd>{context}</dd></div><div><dt>Coût estimé</dt><dd>{cost}</dd></div></dl><button className="ai-btn ai-btn--ghost">Configurer</button></article>;
}

export function HealthCard({ item }: { item: HealthItem }) {
  return <article className="ai-card ai-health-card"><div className="ai-card-head"><Gauge /><StatusBadge status={item.status} /></div><h3>{item.name}</h3><div className="ai-health-stats"><span><TimerReset /> {item.latency} ms</span><span><CheckCircle2 /> {item.uptime}%</span></div></article>;
}

export function TimelineCard({ title, time, detail }: { title: string; time: string; detail: string }) {
  return <article className="ai-timeline-card"><span className="ai-timeline-dot" /><div><time>{time}</time><h3>{title}</h3><p>{detail}</p></div></article>;
}

export function PublicationCard({ publication }: { publication: Publication }) {
  return <article className="ai-card ai-publication-card"><div className="ai-publication-cover"><FileText /><span>{publication.editor}</span></div><div><div className="ai-card-head"><StatusBadge status={publication.status} /><span className="ai-score">SEO {publication.score}</span></div><h3>{publication.title}</h3><p>/{publication.slug}</p><div className="ai-card-foot"><span>Il y a {publication.publishedAt}</span><button className="ai-icon-button" aria-label={`Aperçu de ${publication.title}`}><Eye /></button></div></div></article>;
}

export function PromptCard({ title, category, tokens }: { title: string; category: string; tokens: number }) {
  return <article className="ai-card ai-prompt-card"><div className="ai-icon-box"><Sparkles /></div><div><p className="ai-eyebrow">{category}</p><h3>{title}</h3><small>{tokens} tokens · Version 3</small></div><button className="ai-btn ai-btn--ghost">Ouvrir</button></article>;
}

export function TemplateCard({ title, format, usage }: { title: string; format: string; usage: number }) {
  return <article className="ai-card ai-template-card"><div className="ai-template-preview"><Image /></div><h3>{title}</h3><p>{format} · utilisé {usage} fois</p><button className="ai-btn ai-btn--ghost">Prévisualiser</button></article>;
}
