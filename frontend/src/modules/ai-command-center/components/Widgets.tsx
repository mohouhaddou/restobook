import React from 'react';
import { Bell, Check, CircleAlert, Command, Search, X } from 'lucide-react';
import type { Activity } from '../types';

export function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="ai-search"><Search aria-hidden="true" /><span className="visually-hidden">Recherche globale</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Rechercher partout…" /><kbd>⌘ K</kbd></label>;
}

export function SystemStatus() {
  return <div className="ai-system-status"><span /><div><strong>Opérationnel</strong><small>99,97% uptime</small></div></div>;
}

export function RecentActivityCard({ activities }: { activities: Activity[] }) {
  return <article className="ai-card"><div className="ai-section-head"><div><p className="ai-eyebrow">Temps réel</p><h2>Activité récente</h2></div><button className="ai-btn ai-btn--ghost">Tout voir</button></div><div className="ai-activity-list">{activities.map((activity) => <div className="ai-activity" key={activity.id}><span className={`ai-activity-icon ai-activity-icon--${activity.tone}`}>{activity.tone === 'success' ? <Check /> : activity.tone === 'danger' ? <CircleAlert /> : <Command />}</span><div><strong>{activity.label}</strong><p>{activity.detail}</p></div><time>{activity.timestamp}</time></div>)}</div></article>;
}

export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <aside className="ai-notifications" role="dialog" aria-modal="true" aria-label="Centre de notifications"><div className="ai-section-head"><h2>Notifications</h2><button className="ai-icon-button" onClick={onClose} aria-label="Fermer"><X /></button></div><div className="ai-notice"><Bell /><div><strong>3 jobs nécessitent votre attention</strong><p>Une validation et deux nouvelles tentatives.</p></div></div><div className="ai-notice"><Check /><div><strong>Publication terminée</strong><p>Le dernier contenu GamingHub est prêt.</p></div></div></aside>;
}

export function QuickActions({ onNewJob }: { onNewJob: () => void }) {
  return <div className="ai-quick-actions"><button onClick={onNewJob} className="ai-btn ai-btn--primary">Créer un job</button><button className="ai-btn ai-btn--ghost">Importer un package</button><button className="ai-btn ai-btn--ghost">Planifier</button></div>;
}

export function GlobalProgressBar({ active = 7, total = 12 }: { active?: number; total?: number }) {
  return <div className="ai-global-progress"><span style={{ width: `${(active / total) * 100}%` }} /></div>;
}

export function LogViewer() {
  const logs = [
    ['10:42:18.021', 'INFO', 'workflow', 'ValidateMetadata terminé en 128 ms'],
    ['10:42:18.304', 'INFO', 'publisher', 'Package JOB-1048 préparé'],
    ['10:42:20.119', 'WARN', 'seo', 'Description proche de la limite (158 caractères)'],
    ['10:42:22.870', 'INFO', 'integration', 'Asset map résolu pour Discover'],
    ['10:43:01.214', 'ERROR', 'stories', 'Timeout récupérable, retry #1 planifié']
  ];
  return <div className="ai-log-viewer" role="log" aria-label="Logs système">{logs.map(([time, level, module, message]) => <div key={`${time}-${module}`}><time>{time}</time><strong data-level={level}>{level}</strong><span>{module}</span><code>{message}</code></div>)}</div>;
}

export function AuditViewer() {
  return <div className="ai-table-wrap"><table className="ai-table"><thead><tr><th>Action</th><th>Acteur</th><th>Cible</th><th>Date</th><th>Résultat</th></tr></thead><tbody>{[
    ['Modification workflow', 'Nadia B.', 'Discover Editorial', '10:38', 'Validé'],
    ['Pause éditeur', 'Samir K.', 'Stories', '09:54', 'Validé'],
    ['Changement modèle', 'Système', 'GamingHub', '09:22', 'Automatique'],
    ['Relance job', 'Lina A.', 'JOB-1045', '08:45', 'En cours']
  ].map((row) => <tr key={row.join()}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
