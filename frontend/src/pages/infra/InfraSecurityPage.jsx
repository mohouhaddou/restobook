import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { InfraLayout } from './InfraLayout';

function Unavailable({ label }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--il-border)', fontSize: 13 }}>
      <span style={{ color: 'var(--il-muted)' }}>{label}</span>
      <span style={{ color: 'var(--il-muted)', fontStyle: 'italic' }}>Non disponible</span>
    </div>
  );
}

export default function InfraSecurityPage() {
  const { get } = useApi();
  const [sec, setSec] = useState(null);

  useEffect(() => { get('/superadmin/infra/security').then(setSec).catch(() => {}); }, []);

  return (
    <InfraLayout title="Sécurité" icon="🛡️">
      <div className="if-card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--il-muted)', fontWeight: 700, marginBottom: 6 }}>Tentatives de connexion échouées (24h)</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: sec?.failed_logins_24h > 10 ? 'var(--il-danger)' : 'var(--il-text)' }}>
          {sec?.failed_logins_24h ?? '—'}
        </div>
      </div>

      <div className="if-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 12, color: 'var(--il-text)' }}>Détection d'intrusion</div>
        <Unavailable label="Blocages Fail2Ban" />
        <Unavailable label="IP suspectes" />
        <Unavailable label="Pays suspects" />
        <Unavailable label="Ports ouverts" />
        <Unavailable label="Derniers accès SSH" />
        <Unavailable label="Derniers accès root" />
        <Unavailable label="Dernières modifications système" />

        {(sec?.limitations || []).length > 0 && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--il-primary-lighter)', borderRadius: 10, fontSize: 12, color: 'var(--il-text2)' }}>
            {sec.limitations.map((l, i) => <div key={i}>ℹ️ {l}</div>)}
          </div>
        )}
      </div>
    </InfraLayout>
  );
}
