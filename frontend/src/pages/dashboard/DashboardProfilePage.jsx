import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../api';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';

const cardStyle = {
  background: 'var(--mk-card)', border: '1px solid var(--mk-border)', borderRadius: 16,
  padding: 18, marginBottom: 16,
};
const inputStyle = {
  width: '100%', padding: '11px 12px', border: '1.5px solid var(--mk-border)', borderRadius: 10,
  fontSize: 14, boxSizing: 'border-box', background: 'var(--mk-input-bg)', color: 'var(--mk-text)',
};
const labelStyle = { fontSize: 12.5, fontWeight: 600, color: 'var(--mk-text2)', display: 'block', marginBottom: 6 };

export default function DashboardProfilePage() {
  const navigate = useNavigate();
  const { user, authHeader, logoutCustomer } = useCustomerAuth();

  const [editNom, setEditNom] = useState(user?.nom || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [addresses, setAddresses] = useState([]);

  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');

  useEffect(() => {
    fetch(API('/marketplace/me/addresses'), { headers: authHeader })
      .then(r => r.json()).then(d => setAddresses(d.addresses || [])).catch(() => {});
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(API('/marketplace/me'), {
        method: 'PATCH', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: editNom.trim(), phone: editPhone.trim() || undefined }),
      });
      const data = await res.json();
      setSaveMsg(data.ok ? 'Profil mis à jour ✓' : (data.error || 'Erreur'));
    } catch { setSaveMsg('Erreur réseau'); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  }

  async function deleteAddress(id) {
    setAddresses(prev => prev.filter(a => a.id !== id));
    try { await fetch(API(`/marketplace/me/addresses/${id}`), { method: 'DELETE', headers: authHeader }); } catch {}
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwdNew.length < 6) { setPwdMsg('Le nouveau mot de passe doit faire au moins 6 caractères'); return; }
    setPwdSaving(true);
    try {
      const res = await fetch(API('/auth/change-password'), {
        method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pwdCurrent, new_password: pwdNew }),
      });
      const data = await res.json();
      if (res.ok) { setPwdMsg('Mot de passe mis à jour ✓'); setPwdCurrent(''); setPwdNew(''); }
      else setPwdMsg(data.error || 'Erreur');
    } catch { setPwdMsg('Erreur réseau'); }
    setPwdSaving(false);
    setTimeout(() => setPwdMsg(''), 4000);
  }

  function handleLogout() {
    logoutCustomer();
    navigate('/account', { replace: true });
  }

  return (
    <div className="mk-fade-up" style={{ maxWidth: 560 }}>
      <form onSubmit={saveProfile}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--mk-text)' }}>Informations personnelles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Nom complet</label>
              <input value={editNom} onChange={e => setEditNom(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input value={editPhone} onChange={e => setEditPhone(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input value={user?.email || ''} disabled style={{ ...inputStyle, opacity: .6, cursor: 'not-allowed' }} />
            </div>
          </div>
          {saveMsg && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--mk-green-light)', borderRadius: 8, fontSize: 13, color: 'var(--mk-green)', fontWeight: 600 }}>
              {saveMsg}
            </div>
          )}
          <button type="submit" disabled={saving} style={{
            marginTop: 14, width: '100%', padding: '12px', background: saving ? 'var(--mk-muted)' : 'var(--mk-orange)',
            color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>{saving ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>
        </div>
      </form>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--mk-text)' }}><span className="premium-inline-icon"><PremiumIcon name="mapPin" size={17} /> Mes adresses</span></div>
        {addresses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--mk-muted)', fontSize: 13 }}>
            Aucune adresse sauvegardée — elles seront ajoutées lors de votre prochaine commande.
          </div>
        ) : addresses.map(addr => (
          <div key={addr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--mk-border2)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--mk-text)' }}>
                {addr.label}
                {addr.is_default && <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--mk-green-light)', color: 'var(--mk-green)', padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>Défaut</span>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--mk-muted)', marginTop: 2 }}>{addr.street}{addr.city ? `, ${addr.city}` : ''}</div>
            </div>
            <button onClick={() => deleteAddress(addr.id)} style={{ background: 'none', border: '1px solid var(--mk-red)', borderRadius: 6, padding: '4px 8px', color: 'var(--mk-red)', cursor: 'pointer', fontSize: 11 }}>
              Supprimer
            </button>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: 'var(--mk-text)' }}><span className="premium-inline-icon"><PremiumIcon name="bell" size={17} /> Notifications</span></div>
        <div style={{ fontSize: 12.5, color: 'var(--mk-muted)', marginBottom: 12 }}>Consultez et gérez toutes vos notifications.</div>
        <button onClick={() => navigate('/dashboard/notifications')} className="mk-pill">Ouvrir le centre de notifications →</button>
      </div>

      <form onSubmit={changePassword}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--mk-text)' }}><span className="premium-inline-icon"><PremiumIcon name="shield" size={17} /> Sécurité</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Mot de passe actuel</label>
              <input type="password" autoComplete="current-password" value={pwdCurrent} onChange={e => setPwdCurrent(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Nouveau mot de passe</label>
              <input type="password" autoComplete="new-password" value={pwdNew} onChange={e => setPwdNew(e.target.value)} style={inputStyle} />
            </div>
          </div>
          {pwdMsg && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: pwdMsg.includes('✓') ? 'var(--mk-green-light)' : 'rgba(220,38,38,.12)', borderRadius: 8, fontSize: 13, color: pwdMsg.includes('✓') ? 'var(--mk-green)' : 'var(--mk-red)', fontWeight: 600 }}>
              {pwdMsg}
            </div>
          )}
          <button type="submit" disabled={pwdSaving || !pwdCurrent || !pwdNew} style={{
            marginTop: 14, width: '100%', padding: '12px', background: 'var(--mk-surface)', border: '1.5px solid var(--mk-border)',
            color: 'var(--mk-text)', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>{pwdSaving ? '…' : 'Changer le mot de passe'}</button>
        </div>
      </form>

      <button onClick={handleLogout} style={{
        width: '100%', padding: '13px', background: 'var(--mk-surface)',
        border: '1.5px solid var(--mk-red)', borderRadius: 10, color: 'var(--mk-red)',
        fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 20,
      }}>Se déconnecter</button>
    </div>
  );
}
