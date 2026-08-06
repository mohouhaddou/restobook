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

function pctColor(pct) {
  if (pct >= 90) return 'var(--il-danger)';
  if (pct >= 75) return 'var(--il-warning)';
  return 'var(--il-success)';
}

export default function InfraDiskPage() {
  const { get } = useApi();
  const [disk, setDisk] = useState(null);

  useEffect(() => { get('/superadmin/infra/disk').then(setDisk).catch(() => {}); }, []);

  const maxFolder = Math.max(1, ...((disk?.top_folders || []).map(f => f.size_bytes)));

  return (
    <InfraLayout title="Disque" icon="💽">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 14, marginBottom: 24 }}>
        {(disk?.partitions || []).map(p => (
          <div key={p.mount} className="if-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 800, color: 'var(--il-text)' }}>{p.mount}</span>
              <span style={{ fontWeight: 900, color: pctColor(p.pct) }}>{p.pct}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--il-border)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ width: `${p.pct}%`, height: '100%', background: pctColor(p.pct) }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--il-muted)' }}>{p.used} utilisés / {p.size} total ({p.avail} disponible) · {p.filesystem}</div>
          </div>
        ))}
      </div>

      <div className="if-card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ fontWeight: 800, marginBottom: 14, color: 'var(--il-text)' }}>Top dossiers</div>
        {(disk?.top_folders || []).map(f => (
          <div key={f.path} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: 'var(--il-text2)', fontFamily: 'monospace' }}>{f.path}</span>
              <span style={{ fontWeight: 700, color: 'var(--il-text)' }}>{fmtBytes(f.size_bytes)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--il-border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(f.size_bytes / maxFolder) * 100}%`, height: '100%', background: 'var(--il-info)' }} />
            </div>
          </div>
        ))}
      </div>

      <div className="if-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 4, color: 'var(--il-text)' }}>Logs volumineux (&gt;10 Mo)</div>
        <div style={{ fontSize: 12, color: 'var(--il-muted)', marginBottom: 14 }}>Nettoyage automatique prévu dans une phase ultérieure — liste informative pour l'instant.</div>
        {(disk?.large_logs || []).length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--il-muted)' }}>Aucun log ne dépasse le seuil actuellement.</div>
        ) : (
          <table className="if-table" style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              {disk.large_logs.map(l => (
                <tr key={l.name} style={{ borderBottom: '1px solid var(--il-border)' }}>
                  <td style={{ padding: '6px 0', fontFamily: 'monospace', color: 'var(--il-text2)' }}>{l.name}</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700, color: 'var(--il-text)' }}>{fmtBytes(l.size_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </InfraLayout>
  );
}
