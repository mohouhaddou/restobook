import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { InfraLayout } from './InfraLayout';

function fmtBps(bps) {
  if (bps == null) return '—';
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  let i = 0, v = bps;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}
function fmtBytes(n) {
  if (n == null) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

export default function InfraNetworkPage() {
  const { get } = useApi();
  const [net, setNet] = useState(null);

  function load() { get('/superadmin/infra/network').then(setNet).catch(() => {}); }
  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, []);

  return (
    <InfraLayout title="Réseau" icon="🌐">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14, marginBottom: 20 }}>
        {(net?.interfaces || []).map(iface => (
          <div key={iface.name} className="if-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 10, color: 'var(--il-text)' }}>{iface.name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--il-muted)' }}>⬇ Entrant</span>
              <span style={{ fontWeight: 700, color: 'var(--il-success)' }}>{fmtBps(iface.rx_rate_bps)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
              <span style={{ color: 'var(--il-muted)' }}>⬆ Sortant</span>
              <span style={{ fontWeight: 700, color: 'var(--il-info)' }}>{fmtBps(iface.tx_rate_bps)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--il-muted)', borderTop: '1px solid var(--il-border)', paddingTop: 8 }}>
              Total depuis démarrage : {fmtBytes(iface.rx_bytes_total)} reçus · {fmtBytes(iface.tx_bytes_total)} envoyés
            </div>
          </div>
        ))}
      </div>

      <div className="if-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 10, color: 'var(--il-text)' }}>Top IP / Pays / Endpoints</div>
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--il-muted)', fontSize: 13, background: 'var(--il-bg2, #F9FAFB)', borderRadius: 10 }}>
          {(net?.limitations || []).map((l, i) => <div key={i}>⚠️ {l}</div>)}
        </div>
      </div>
    </InfraLayout>
  );
}
