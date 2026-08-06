import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { InfraLayout } from './InfraLayout';

function fmtBytes(n) {
  if (n == null) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--il-border)', fontSize: 13 }}>
      <span style={{ color: 'var(--il-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--il-text)' }}>{value}</span>
    </div>
  );
}

export default function InfraDatabasePage() {
  const { get } = useApi();
  const [db, setDb] = useState(null);

  function load() { get('/superadmin/infra/database').then(setDb).catch(() => {}); }
  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id); }, []);

  const maxTableSize = Math.max(1, ...((db?.tables || []).map(t => t.size_bytes)));

  return (
    <InfraLayout title="Base de données" icon="🗄️">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: db?.status === 'up' ? 'var(--il-success)' : 'var(--il-danger)' }} />
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--il-text)' }}>
          {db?.status === 'up' ? 'Base de données opérationnelle' : 'Base de données indisponible'}
        </span>
        {db?.version && <span style={{ fontSize: 12, color: 'var(--il-muted)' }}>MySQL {db.version}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 14, marginBottom: 20 }}>
        <div className="if-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--il-muted)', marginBottom: 8, fontWeight: 700 }}>Connexions</div>
          <Row label="Actives" value={db?.connections ?? '—'} />
          <Row label="Maximum" value={db?.max_connections ?? '—'} />
        </div>
        <div className="if-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--il-muted)', marginBottom: 8, fontWeight: 700 }}>Performance</div>
          <Row label="Requêtes/sec" value={db?.queries_per_sec ?? '—'} />
          <Row label="Requêtes lentes" value={db?.slow_queries ?? '—'} />
          <Row label="Locks en cours" value={db?.locks_current ?? '—'} />
        </div>
        <div className="if-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--il-muted)', marginBottom: 8, fontWeight: 700 }}>Stockage</div>
          <Row label="Taille totale" value={fmtBytes(db?.size_bytes)} />
          <Row label="Nombre de tables" value={db?.table_count ?? '—'} />
        </div>
      </div>

      <div className="if-card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ fontWeight: 800, marginBottom: 14, color: 'var(--il-text)' }}>Taille par table (top 10)</div>
        {(db?.tables || []).map(t => (
          <div key={t.name} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: 'var(--il-text2)' }}>{t.name} <span style={{ color: 'var(--il-muted)' }}>({t.rows} lignes)</span></span>
              <span style={{ fontWeight: 700, color: 'var(--il-text)' }}>{fmtBytes(t.size_bytes)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--il-border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(t.size_bytes / maxTableSize) * 100}%`, height: '100%', background: 'var(--il-primary)' }} />
            </div>
          </div>
        ))}
      </div>

      {(db?.limitations || []).length > 0 && (
        <div style={{ padding: '12px 16px', background: 'var(--il-primary-lighter)', borderRadius: 10, fontSize: 12, color: 'var(--il-text2)' }}>
          {db.limitations.map((l, i) => <div key={i}>ℹ️ {l}</div>)}
        </div>
      )}
    </InfraLayout>
  );
}
