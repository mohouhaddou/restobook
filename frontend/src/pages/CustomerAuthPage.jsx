import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API } from '../api';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { BrandLogo } from '../components/brand/BrandLogo';

const inputStyle = {
  width: '100%', padding: '13px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10,
  fontSize: 15, outline: 'none', boxSizing: 'border-box', color: '#1E1E1E',
  transition: 'border-color 0.2s',
};
const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 };
const ORANGE = 'var(--rb-orange, #FF8A00)';

export default function CustomerAuthPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { loginCustomer } = useCustomerAuth();
  const from = location.state?.from || '/marketplace';

  const [tab, setTab]         = useState(location.state?.tab || 'login');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Login state
  const [loginEmail, setLoginEmail]   = useState('');
  const [loginPwd, setLoginPwd]       = useState('');

  // Register state
  const [regNom, setRegNom]     = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPwd, setRegPwd]     = useState('');
  const [regPwd2, setRegPwd2]   = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    if (!loginEmail.trim() || !loginPwd) { setError('Email et mot de passe requis'); return; }
    setLoading(true);
    try {
      const res  = await fetch(API('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricule: loginEmail.trim().toLowerCase(), password: loginPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Identifiants invalides'); setLoading(false); return; }
      loginCustomer(data.token, data.user);
      navigate(from, { replace: true });
    } catch { setError('Erreur réseau'); }
    setLoading(false);
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (!regNom.trim())  { setError('Votre nom est requis'); return; }
    if (!regEmail.trim()) { setError('Email requis'); return; }
    if (regPwd.length < 6) { setError('Mot de passe minimum 6 caractères'); return; }
    if (regPwd !== regPwd2) { setError('Les mots de passe ne correspondent pas'); return; }
    setLoading(true);
    try {
      const res  = await fetch(API('/auth/customer-register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: regNom.trim(), email: regEmail.trim().toLowerCase(), phone: regPhone.trim() || undefined, password: regPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur inscription'); setLoading(false); return; }
      loginCustomer(data.token, data.user);
      navigate(from, { replace: true });
    } catch { setError('Erreur réseau'); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #FFF3E0 0%, #F5F5F5 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <BrandLogo variant="full" theme="light" size="lg"
          style={{ height:120, margin: '0 auto 10px', filter: 'drop-shadow(0 4px 12px rgba(255,138,0,.25))' }} />
        <p style={{ margin: 0, fontSize: 14, color: '#6B7280' }}>Commandez facilement, partout</p>
      </div>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', width: '100%', maxWidth: 400, overflow: 'hidden' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #F3F4F6' }}>
          {[['login','Connexion'],['register','Créer un compte']].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setError(''); }} style={{
              flex: 1, padding: '16px 0', border: 'none', background: 'none',
              fontSize: 14, fontWeight: tab === key ? 700 : 500, cursor: 'pointer',
              color: tab === key ? 'var(--rb-orange,#FF8A00)' : '#9CA3AF',
              borderBottom: tab === key ? '2px solid var(--rb-orange,#FF8A00)' : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ padding: '24px 24px 28px' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: '#FEE2E2', borderRadius: 8, color: '#DC2626', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* ── Connexion ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Email ou identifiant</label>
                <input type="text" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="vous@example.com" style={inputStyle} autoComplete="email" />
              </div>
              <div>
                <label style={labelStyle}>Mot de passe</label>
                <input type="password" value={loginPwd} onChange={e => setLoginPwd(e.target.value)}
                  placeholder="••••••••" style={inputStyle} autoComplete="current-password" />
              </div>
              <button type="submit" disabled={loading} style={{
                padding: '14px', background: loading ? '#9CA3AF' : 'linear-gradient(135deg, var(--rb-orange,#FF8A00), var(--rb-deep-orange,#FF5D00))',
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                cursor: loading ? 'default' : 'pointer', marginTop: 4,
              }}>
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
              <div style={{ textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
                Pas encore de compte ?{' '}
                <button type="button" onClick={() => { setTab('register'); setError(''); }} style={{
                  background: 'none', border: 'none', color: 'var(--rb-orange,#FF8A00)', fontWeight: 600, cursor: 'pointer', padding: 0
                }}>Créer un compte</button>
              </div>
            </form>
          )}

          {/* ── Inscription ── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Prénom & Nom *</label>
                <input type="text" value={regNom} onChange={e => setRegNom(e.target.value)}
                  placeholder="Mohammed Alami" style={inputStyle} autoComplete="name" />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  placeholder="vous@example.com" style={inputStyle} autoComplete="email" />
              </div>
              <div>
                <label style={labelStyle}>Téléphone (optionnel)</label>
                <input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)}
                  placeholder="+212 6 00 00 00 00" style={inputStyle} autoComplete="tel" />
              </div>
              <div>
                <label style={labelStyle}>Mot de passe *</label>
                <input type="password" value={regPwd} onChange={e => setRegPwd(e.target.value)}
                  placeholder="Minimum 6 caractères" style={inputStyle} autoComplete="new-password" />
              </div>
              <div>
                <label style={labelStyle}>Confirmer le mot de passe *</label>
                <input type="password" value={regPwd2} onChange={e => setRegPwd2(e.target.value)}
                  placeholder="••••••••" style={inputStyle} autoComplete="new-password" />
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
                En créant un compte, vous acceptez nos conditions d'utilisation.
              </p>
              <button type="submit" disabled={loading} style={{
                padding: '14px', background: loading ? '#9CA3AF' : 'linear-gradient(135deg, var(--rb-orange,#FF8A00), var(--rb-deep-orange,#FF5D00))',
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                cursor: loading ? 'default' : 'pointer',
              }}>
                {loading ? 'Création…' : 'Créer mon compte'}
              </button>
              <div style={{ textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
                Déjà un compte ?{' '}
                <button type="button" onClick={() => { setTab('login'); setError(''); }} style={{
                  background: 'none', border: 'none', color: 'var(--rb-orange,#FF8A00)', fontWeight: 600, cursor: 'pointer', padding: 0
                }}>Se connecter</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Continuer sans compte */}
      <button onClick={() => navigate(from, { replace: true })} style={{
        marginTop: 20, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14, cursor: 'pointer', textDecoration: 'underline'
      }}>
        Continuer sans compte →
      </button>
    </div>
  );
}
