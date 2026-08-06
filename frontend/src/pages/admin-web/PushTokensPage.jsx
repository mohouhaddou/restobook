import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { DashboardIcon } from '../../shared/components/ui/DashboardIcon';
import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';

const ROLE_TABS = [
  { value: '',         label: 'Tous', icon: 'inbox' },
  { value: 'customer', label: 'Clients', icon: 'shopping' },
  { value: 'driver',   label: 'Livreurs', icon: 'delivery' },
  { value: 'business', label: 'Commerces', icon: 'store' },
  { value: 'admin',    label: 'Admins', icon: 'shield' },
];

const rowStyle = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #F3F4F6' };

function timeAgo(iso) {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) return `${Math.floor(mins / 60)} h`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

export default function PushTokensPage() {
  const { get, patch } = useApi();
  const [role, setRole] = useState('');
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    try {
      const qs = role ? `?role=${role}` : '';
      const d = await get(`/superadmin/push-tokens${qs}`);
      setTokens(d.tokens || []);
    } catch (e) { setMsg(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [role]);

  async function deactivate(id) {
    try {
      await patch(`/superadmin/push-tokens/${id}/deactivate`, {});
      setMsg('Token désactivé');
      load();
    } catch (e) { setMsg(e.message); }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><PremiumIcon name="bell" size={22} /> Push tokens (debug)</div>
        <div className="page-subtitle">Tokens FCM actifs par compte — au plus un token actif par appareil (device_id).</div>
      </div>

      {msg && <div style={{ padding: '8px 12px', background: '#FFF7ED', borderRadius: 8, fontSize: 13, marginBottom: 12, color: '#B45309' }}>{msg}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {ROLE_TABS.map(t => (
          <button key={t.value} onClick={() => setRole(t.value)} style={{
            padding: '8px 16px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6,
            borderColor: role === t.value ? 'var(--rb-orange,#FF8A00)' : '#E5E7EB',
            background: role === t.value ? '#FFF7ED' : '#fff',
            color: role === t.value ? 'var(--rb-orange,#FF8A00)' : '#6B7280',
          }}><DashboardIcon icon={t.icon} size={14} /> {t.label}</button>
        ))}
      </div>

      <div className="card p-0" style={{ overflow: 'hidden' }}>
        <div style={{ ...rowStyle, background: '#F9FAFB', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>
          <div style={{ flex: '2 1 160px' }}>Compte</div>
          <div style={{ flex: '1 1 90px' }}>Rôle</div>
          <div style={{ flex: '1 1 100px' }}>Platform</div>
          <div style={{ flex: '2 1 140px' }}>Device</div>
          <div style={{ flex: '1 1 90px' }}>Vu</div>
          <div style={{ flex: '1 1 80px' }}>Session</div>
          <div style={{ flex: '1 1 80px' }}>Statut</div>
          <div style={{ flex: '0 0 100px' }}></div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>Chargement…</div>
        ) : tokens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>Aucun token dans cette catégorie.</div>
        ) : tokens.map(t => (
          <div key={t.id} style={rowStyle}>
            <div style={{ flex: '2 1 160px', fontWeight: 600, fontSize: 13 }}>{t.user_name || `#${t.user_id}`}</div>
            <div style={{ flex: '1 1 90px', fontSize: 12 }}>{t.role}{t.business_name ? ` (${t.business_name})` : ''}</div>
            <div style={{ flex: '1 1 100px', fontSize: 12 }}>{t.platform}</div>
            <div style={{ flex: '2 1 140px', fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', wordBreak: 'break-all' }}>{t.device_id}</div>
            <div style={{ flex: '1 1 90px', fontSize: 12 }}>{timeAgo(t.last_seen_at)}</div>
            <div style={{ flex: '1 1 80px', fontSize: 12 }}>{t.session_id ? 'Active' : '—'}</div>
            <div style={{ flex: '1 1 80px' }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                background: t.is_active ? '#F0FDF4' : '#F3F4F6',
                color: t.is_active ? '#16A34A' : '#9CA3AF',
              }}>{t.is_active ? 'Actif' : 'Inactif'}</span>
            </div>
            <div style={{ flex: '0 0 100px' }}>
              {t.is_active && (
                <button onClick={() => deactivate(t.id)} style={{ padding: '6px 12px', border: '1px solid #FCA5A5', color: '#DC2626', background: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>
                  Désactiver
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
