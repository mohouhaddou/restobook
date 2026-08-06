import React, { useEffect, useState } from 'react';
import { API } from '../../../api';
import { requestNotificationPermission, isPushConfigured } from '../../../config/firebase';

// Catégories alignées sur les filtres déjà utilisés par NotificationBell/NotificationsPage.
const CATEGORIES = [
  { key: 'ORDER',       label: '🛎️ Commandes & livraisons' },
  { key: 'RESERVATION', label: '📅 Réservations' },
  { key: 'DELIVERY',    label: '🛵 Offres de livraison' },
  { key: 'PROMOTION',   label: '🎁 Promotions & offres' },
  { key: 'POINTS',      label: '⭐ Points fidélité' },
  { key: 'CASHBACK',    label: '💰 Cashback' },
  { key: 'ACCOUNT',     label: '👤 Compte' },
  { key: 'MESSAGE',     label: '💬 Messages' },
  { key: 'SYSTEM',      label: 'ℹ️ Système' },
];

const CHANNELS = [
  { key: 'push',   label: 'Push', ready: true },
  { key: 'in_app', label: 'In-App', ready: true },
  { key: 'email',  label: 'Email', ready: false },
  { key: 'sms',    label: 'SMS', ready: false },
];

/**
 * Grille de préférences par catégorie × canal — composant présentationnel,
 * réutilisable par les 4 rôles (accepte `token` en prop plutôt qu'un hook
 * d'auth fixe, même convention que NotificationBell.jsx).
 */
export function NotificationPreferences({ token }) {
  const [prefs, setPrefs] = useState({});
  const [defaultChannels, setDefaultChannels] = useState(['push', 'in_app']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushStatus, setPushStatus] = useState('idle'); // idle | requesting | granted | denied

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!token) return;
    fetch(API('/notifications/preferences'), { headers: authHeader })
      .then(r => r.json())
      .then(d => { setPrefs(d.prefs || {}); setDefaultChannels(d.default_channels || ['push', 'in_app']); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  function channelsFor(category) {
    return prefs[category] || defaultChannels;
  }

  async function toggle(category, channel) {
    const current = channelsFor(category);
    const next = current.includes(channel) ? current.filter(c => c !== channel) : [...current, channel];
    const nextPrefs = { ...prefs, [category]: next };
    setPrefs(nextPrefs);
    setSaving(true);
    try {
      await fetch(API('/notifications/preferences'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ prefs: nextPrefs }),
      });
    } catch {}
    setSaving(false);
  }

  async function enablePush() {
    setPushStatus('requesting');
    const fcmToken = await requestNotificationPermission(token);
    setPushStatus(fcmToken ? 'granted' : 'denied');
  }

  if (loading) return <div style={{ padding: 24, color: '#9CA3AF', fontSize: 13 }}>Chargement…</div>;

  return (
    <div>
      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 14, padding: 18, marginBottom: 22, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 28 }}>📱</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Notifications push</div>
          <div style={{ fontSize: 12.5, color: '#6B7280' }}>
            {!isPushConfigured() ? 'Bientôt disponible sur ce navigateur.'
              : pushStatus === 'granted' ? 'Activées sur cet appareil ✅'
              : pushStatus === 'denied' ? 'Permission refusée — activez-la dans les réglages du navigateur.'
              : 'Recevez vos notifications même quand l\'onglet est fermé.'}
          </div>
        </div>
        {isPushConfigured() && pushStatus !== 'granted' && (
          <button onClick={enablePush} disabled={pushStatus === 'requesting'} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#FF8A00,#FF5D00)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: pushStatus === 'requesting' ? 'default' : 'pointer',
          }}>
            {pushStatus === 'requesting' ? 'Activation…' : 'Activer les notifications push'}
          </button>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em' }}>Catégorie</th>
              {CHANNELS.map(c => (
                <th key={c.key} style={{ padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {c.label}{!c.ready && <div style={{ fontSize: 9, color: '#D1D5DB', fontWeight: 400, textTransform: 'none' }}>Bientôt</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map(cat => (
              <tr key={cat.key} style={{ borderTop: '1px solid #F3F4F6' }}>
                <td style={{ padding: '12px 10px', fontSize: 13.5, fontWeight: 600, color: '#111827' }}>{cat.label}</td>
                {CHANNELS.map(ch => {
                  const active = channelsFor(cat.key).includes(ch.key);
                  return (
                    <td key={ch.key} style={{ textAlign: 'center', padding: '12px 10px' }}>
                      <button
                        disabled={!ch.ready}
                        onClick={() => toggle(cat.key, ch.key)}
                        title={ch.ready ? '' : 'Bientôt disponible'}
                        style={{
                          width: 40, height: 22, borderRadius: 20, border: 'none', position: 'relative',
                          background: !ch.ready ? '#F3F4F6' : active ? 'var(--rb-orange,#FF8A00)' : '#E5E7EB',
                          cursor: ch.ready ? 'pointer' : 'not-allowed', transition: 'background .15s',
                        }}>
                        <span style={{
                          position: 'absolute', top: 2, left: active && ch.ready ? 20 : 2,
                          width: 18, height: 18, borderRadius: '50%', background: '#fff',
                          boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .15s',
                        }} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {saving && <div style={{ marginTop: 10, fontSize: 11, color: '#9CA3AF' }}>Enregistrement…</div>}
    </div>
  );
}
