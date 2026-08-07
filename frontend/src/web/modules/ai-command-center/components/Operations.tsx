import React, { useState } from 'react';
import { BarChart3, CheckCircle2, ChevronLeft, ChevronRight, GripVertical, Plus, X } from 'lucide-react';
import type { EditorId, Job, JobStatus, Priority } from '../types';
import { JobCard } from './Cards';

export function StatisticsChart({ data, labels, title }: { data: number[]; labels: string[]; title: string }) {
  const max = Math.max(...data);
  return <article className="ai-card ai-chart-card"><div className="ai-section-head"><div><p className="ai-eyebrow">Performance</p><h2>{title}</h2></div><BarChart3 /></div><div className="ai-chart" role="img" aria-label={`${title}. Maximum ${max} publications.`}>{data.map((value, index) => <div className="ai-chart-column" key={labels[index]}><span className="ai-chart-value">{value}</span><div style={{ height: `${Math.max(12, (value / max) * 100)}%` }} /><small>{labels[index]}</small></div>)}</div><details className="ai-chart-data"><summary>Voir les données</summary><table><tbody>{data.map((value, index) => <tr key={labels[index]}><th>{labels[index]}</th><td>{value}</td></tr>)}</tbody></table></details></article>;
}

const columns: { id: JobStatus; label: string }[] = [
  { id: 'pending', label: 'À faire' }, { id: 'validating', label: 'Validation' }, { id: 'publishing', label: 'Publication' }, { id: 'success', label: 'Terminé' }, { id: 'failed', label: 'Échec' }
];

export function KanbanBoard({ initialJobs }: { initialJobs: Job[] }) {
  const [items, setItems] = useState(initialJobs);
  const move = (jobId: string, status: JobStatus) => setItems((current) => current.map((job) => job.id === jobId ? { ...job, status } : job));
  return <div className="ai-kanban" aria-label="Tableau des jobs">
    {columns.map((column) => <section className="ai-kanban-column" key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => move(event.dataTransfer.getData('text/job-id'), column.id)}>
      <header><span className={`ai-kanban-dot ai-kanban-dot--${column.id}`} /><h2>{column.label}</h2><span>{items.filter((job) => job.status === column.id).length}</span></header>
      <div className="ai-kanban-stack">{items.filter((job) => job.status === column.id).map((job) => <div key={job.id} className="ai-draggable"><GripVertical aria-hidden="true" /><JobCard job={job} compact onMove={(status) => move(job.id, status)} /></div>)}</div>
    </section>)}
  </div>;
}

export function TimelineCalendar({ jobs }: { jobs: Job[] }) {
  const [view, setView] = useState<'month' | 'week' | 'day'>('week');
  const days = ['Lun 20', 'Mar 21', 'Mer 22', 'Jeu 23', 'Ven 24', 'Sam 25', 'Dim 26'];
  return <article className="ai-card ai-calendar"><div className="ai-section-head"><div><p className="ai-eyebrow">Juillet 2026</p><h2>Calendrier éditorial</h2></div><div className="ai-segmented">{(['month', 'week', 'day'] as const).map((item) => <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{item}</button>)}</div></div><div className="ai-calendar-tools"><button className="ai-icon-button" aria-label="Période précédente"><ChevronLeft /></button><button className="ai-btn ai-btn--ghost">Aujourd’hui</button><button className="ai-icon-button" aria-label="Période suivante"><ChevronRight /></button></div><div className={`ai-calendar-grid ai-calendar-grid--${view}`}>{days.slice(0, view === 'day' ? 1 : view === 'month' ? 7 : 5).map((day, dayIndex) => <section key={day}><h3>{day}</h3>{jobs.filter((_, index) => index % 5 === dayIndex).map((job) => <div className={`ai-calendar-event ai-calendar-event--${job.editor}`} key={job.id} draggable><time>{10 + dayIndex}:00</time><strong>{job.title}</strong><small>{job.editor}</small></div>)}</section>)}</div></article>;
}

interface WizardProps { open: boolean; onClose: () => void; onCreate: (job: { title: string; editor: EditorId; priority: Priority; model: string }) => Promise<void>; }
export function NewJobWizard({ open, onClose, onCreate }: WizardProps) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ title: string; editor: EditorId; priority: Priority; model: string }>({ title: '', editor: 'discover', priority: 'normal', model: 'GPT-5' });
  if (!open) return null;
  const submit = async () => { setBusy(true); await onCreate(form); setBusy(false); setStep(1); onClose(); };
  return <div className="ai-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="ai-modal" role="dialog" aria-modal="true" aria-labelledby="new-job-title">
    <header><div><p className="ai-eyebrow">Étape {step} sur 3</p><h2 id="new-job-title">Nouveau Job IA</h2></div><button className="ai-icon-button" onClick={onClose} aria-label="Fermer"><X /></button></header>
    <div className="ai-wizard-progress" aria-label={`Étape ${step} sur 3`}>{[1, 2, 3].map((item) => <span key={item} className={step >= item ? 'active' : ''} />)}</div>
    {step === 1 && <fieldset><legend>Quel contenu produire ?</legend><label>Titre du contenu<input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex. Les innovations qui changent nos villes" /></label><label>Éditeur<select value={form.editor} onChange={(event) => setForm({ ...form, editor: event.target.value as EditorId })}>{['discover', 'sports', 'kids', 'stories', 'gaming'].map((editor) => <option key={editor}>{editor}</option>)}</select></label></fieldset>}
    {step === 2 && <fieldset><legend>Configurer la génération</legend><label>Modèle<select value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })}><option>GPT-5</option><option>Claude Sonnet</option><option>Gemini Pro</option><option>Mistral Large</option></select></label><label>Priorité<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option><option value="critical">Critique</option></select></label></fieldset>}
    {step === 3 && <div className="ai-job-summary"><CheckCircle2 /><h3>Prêt à lancer</h3><dl><div><dt>Titre</dt><dd>{form.title || 'Sans titre'}</dd></div><div><dt>Éditeur</dt><dd>{form.editor}</dd></div><div><dt>Modèle</dt><dd>{form.model}</dd></div><div><dt>Priorité</dt><dd>{form.priority}</dd></div></dl></div>}
    <footer><button className="ai-btn ai-btn--ghost" onClick={() => step === 1 ? onClose() : setStep(step - 1)}>{step === 1 ? 'Annuler' : 'Retour'}</button>{step < 3 ? <button className="ai-btn ai-btn--primary" disabled={step === 1 && !form.title.trim()} onClick={() => setStep(step + 1)}>Continuer</button> : <button className="ai-btn ai-btn--primary" disabled={busy} onClick={submit}>{busy ? 'Création…' : 'Créer le job'}</button>}</footer>
  </section></div>;
}

export function FloatingActionButton({ onClick }: { onClick: () => void }) {
  return <button className="ai-fab" onClick={onClick} aria-label="Créer un nouveau Job IA"><Plus /><span>Nouveau Job IA</span></button>;
}
