import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { InfraLayout } from './InfraLayout';

const STATE_COLOR = { ok: 'var(--il-success)', warning: 'var(--il-warning)', critical: 'var(--il-danger)' };
const STATE_LABEL = { ok: 'Valide', warning: 'Expire bientôt', critical: 'Expiration imminente' };

export default function InfraSslPage() {
  const { get } = useApi();
  const [ssl, setSsl] = useState(null);

  useEffect(() => { get('/superadmin/infra/ssl').then(setSsl).catch(() => {}); }, []);

  if (!ssl) return <InfraLayout title="Certificats SSL" icon="🔒"><div style={{ color: 'var(--il-muted)' }}>Chargement…</div></InfraLayout>;

  if (ssl.error) {
    return (
      <InfraLayout title="Certificats SSL" icon="🔒">
        <div className="if-card" style={{ padding: 18, color: 'var(--il-danger)' }}>❌ {ssl.error}</div>
      </InfraLayout>
    );
  }

  const color = STATE_COLOR[ssl.state] || 'var(--il-muted)';

  return (
    <InfraLayout title="Certificats SSL" icon="🔒">
      <div className="if-card" style={{ padding: 24, textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--il-text)', marginBottom: 4 }}>{ssl.domain}</div>
        <div style={{ fontSize: 12, color: 'var(--il-muted)', marginBottom: 18 }}>Émis par {ssl.issuer || '—'}</div>
        <div style={{ fontSize: 48, fontWeight: 900, color }}>{ssl.days_remaining}</div>
        <div style={{ fontSize: 12, color: 'var(--il-muted)', marginBottom: 14 }}>jours restants</div>
        <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: color + '22', color, fontWeight: 700, fontSize: 12, marginBottom: 18 }}>
          {STATE_LABEL[ssl.state] || ssl.state}
        </div>
        <div style={{ textAlign: 'left', fontSize: 12, color: 'var(--il-text2)', borderTop: '1px solid var(--il-border)', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: 'var(--il-muted)' }}>Valide depuis</span><span>{ssl.valid_from}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: 'var(--il-muted)' }}>Expire le</span><span>{ssl.valid_to}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--il-muted)' }}>Renouvellement</span>
            <span>{ssl.auto_renew_detected ? '✅ Automatique (certbot)' : '—'}</span>
          </div>
        </div>
      </div>
    </InfraLayout>
  );
}
