import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { InfraLayout } from './InfraLayout';

const LEVEL_COLOR = { INFO: '#2563EB', WARNING: '#D97706', ERROR: '#DC2626', CRITICAL: '#991B1B' };

export default function InfraLogsPage() {
  const { get } = useApi();
  const [apps, setApps] = useState([]);
  const [app, setApp] = useState('');
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (app) params.set('app', app);
    if (level) params.set('level', level);
    if (search) params.set('search', search);
    params.set('limit', '300');
    get(`/superadmin/infra/logs?${params.toString()}`)
      .then(d => { setLines(d.lines || []); setApps(d.apps || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function downloadLogs() {
    const text = lines.map(l => `[${l.ts || '—'}] [${l.level}] [${l.app}/${l.source}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `infra_logs_${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <InfraLayout title="Logs" icon="📜" actions={
      <button className="if-btn if-btn-outline if-btn-sm" onClick={downloadLogs} disabled={lines.length === 0}>⬇ Télécharger</button>
    }>
      <div className="if-card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="if-input" style={{ width: 'auto' }} value={app} onChange={e => setApp(e.target.value)}>
          <option value="">Toutes les applications</option>
          {apps.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="if-input" style={{ width: 'auto' }} value={level} onChange={e => setLevel(e.target.value)}>
          <option value="">Tous les niveaux</option>
          {Object.keys(LEVEL_COLOR).map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input className="if-input" style={{ flex: 1, minWidth: 200 }} placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        <button className="if-btn if-btn-primary if-btn-sm" onClick={load}>Filtrer</button>
      </div>

      <div className="if-card" style={{ padding: 14, maxHeight: 560, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
        {loading ? (
          <div style={{ color: 'var(--il-muted)' }}>Chargement…</div>
        ) : lines.length === 0 ? (
          <div style={{ color: 'var(--il-muted)' }}>Aucun log ne correspond à ces filtres.</div>
        ) : lines.slice().reverse().map((l, i) => (
          <div key={i} style={{ marginBottom: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <span style={{ color: 'var(--il-muted)' }}>{l.ts ? `[${l.ts}] ` : ''}</span>
            <span style={{ color: LEVEL_COLOR[l.level] || 'var(--il-text2)', fontWeight: 700 }}>[{l.level}]</span>{' '}
            <span style={{ color: 'var(--il-muted)' }}>[{l.app}]</span>{' '}
            <span style={{ color: 'var(--il-text2)' }}>{l.text}</span>
          </div>
        ))}
      </div>
    </InfraLayout>
  );
}
