import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API } from '../api';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { BrandLogo } from '../components/brand/BrandLogo';
import GoogleAuthButton from '../shared/components/auth/GoogleAuthButton';
import { useI18n } from '../i18n/config';

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
  const { t } = useI18n();
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
    if (!loginEmail.trim() || !loginPwd) { setError(t('auth.errors.emailPasswordRequired')); return; }
    setLoading(true);
    try {
      const res  = await fetch(API('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricule: loginEmail.trim().toLowerCase(), password: loginPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('auth.errors.invalidCredentials')); setLoading(false); return; }
      loginCustomer(data.token, data.user);
      navigate(from, { replace: true });
    } catch { setError(t('auth.errors.network')); }
    setLoading(false);
  }

  function handleGoogleSuccess(data) {
    setError('');
    loginCustomer(data.token, data.user);
    navigate(from, { replace: true });
  }

  function handleGoogleError(message) {
    setError(message);
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (!regNom.trim())  { setError(t('auth.errors.nameRequired')); return; }
    if (!regEmail.trim()) { setError(t('auth.errors.emailRequired')); return; }
    if (regPwd.length < 6) { setError(t('auth.errors.passwordMin')); return; }
    if (regPwd !== regPwd2) { setError(t('auth.password_mismatch')); return; }
    setLoading(true);
    try {
      const res  = await fetch(API('/auth/customer-register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: regNom.trim(), email: regEmail.trim().toLowerCase(), phone: regPhone.trim() || undefined, password: regPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('auth.errors.registerFailed')); setLoading(false); return; }
      loginCustomer(data.token, data.user);
      navigate(from, { replace: true });
    } catch { setError(t('auth.errors.network')); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #FFF3E0 0%, #F5F5F5 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <BrandLogo variant="full" theme="light" size="lg"
          style={{ height:120, margin: '0 auto 10px', filter: 'drop-shadow(0 4px 12px rgba(255,138,0,.25))' }} />
        <p style={{ margin: 0, fontSize: 14, color: '#6B7280' }}>{t('auth.customer.tagline')}</p>
      </div>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', width: '100%', maxWidth: 400, overflow: 'hidden' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #F3F4F6' }}>
          {[['login', t('auth.tabs.login')], ['register', t('auth.tabs.register')]].map(([key, label]) => (
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
                <label style={labelStyle}>{t('auth.fields.emailOrIdentifier')}</label>
                <input type="text" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="vous@example.com" style={inputStyle} autoComplete="email" />
              </div>
              <div>
                <label style={labelStyle}>{t('auth.fields.password')}</label>
                <input type="password" value={loginPwd} onChange={e => setLoginPwd(e.target.value)}
                  placeholder="••••••••" style={inputStyle} autoComplete="current-password" />
              </div>
              <button type="submit" disabled={loading} style={{
                padding: '14px', background: loading ? '#9CA3AF' : 'linear-gradient(135deg, var(--rb-orange,#FF8A00), var(--rb-deep-orange,#FF5D00))',
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                cursor: loading ? 'default' : 'pointer', marginTop: 4,
              }}>
                {loading ? t('auth.actions.signingIn') : t('auth.actions.signIn')}
              </button>
              <div style={{ textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
                {t('auth.customer.noAccount')} 
                <button type="button" onClick={() => { setTab('register'); setError(''); }} style={{
                  background: 'none', border: 'none', color: 'var(--rb-orange,#FF8A00)', fontWeight: 600, cursor: 'pointer', padding: 0
                }}>{t('auth.actions.createAccount')}</button>
              </div>
            </form>
          )}

          {/* ── Inscription ── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>{t('auth.fields.fullNameRequired')}</label>
                <input type="text" value={regNom} onChange={e => setRegNom(e.target.value)}
                  placeholder="Mohammed Alami" style={inputStyle} autoComplete="name" />
              </div>
              <div>
                <label style={labelStyle}>{t('auth.fields.emailRequired')}</label>
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  placeholder="vous@example.com" style={inputStyle} autoComplete="email" />
              </div>
              <div>
                <label style={labelStyle}>{t('auth.fields.phoneOptional')}</label>
                <input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)}
                  placeholder="+212 6 00 00 00 00" style={inputStyle} autoComplete="tel" />
              </div>
              <div>
                <label style={labelStyle}>{t('auth.fields.passwordRequired')}</label>
                <input type="password" value={regPwd} onChange={e => setRegPwd(e.target.value)}
                  placeholder={t('auth.placeholders.passwordMin')} style={inputStyle} autoComplete="new-password" />
              </div>
              <div>
                <label style={labelStyle}>{t('auth.fields.confirmPasswordRequired')}</label>
                <input type="password" value={regPwd2} onChange={e => setRegPwd2(e.target.value)}
                  placeholder="••••••••" style={inputStyle} autoComplete="new-password" />
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
                {t('auth.customer.terms')}
              </p>
              <button type="submit" disabled={loading} style={{
                padding: '14px', background: loading ? '#9CA3AF' : 'linear-gradient(135deg, var(--rb-orange,#FF8A00), var(--rb-deep-orange,#FF5D00))',
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                cursor: loading ? 'default' : 'pointer',
              }}>
                {loading ? t('auth.actions.creating') : t('auth.actions.createMyAccount')}
              </button>
              <div style={{ textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
                {t('auth.customer.hasAccount')} 
                <button type="button" onClick={() => { setTab('login'); setError(''); }} style={{
                  background: 'none', border: 'none', color: 'var(--rb-orange,#FF8A00)', fontWeight: 600, cursor: 'pointer', padding: 0
                }}>{t('auth.actions.signIn')}</button>
              </div>
            </form>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
            <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{t('common.or')}</span>
            <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
          </div>
          <GoogleAuthButton roleIntent="consumer" onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
        </div>
      </div>

      {/* Continuer sans compte */}
      <button onClick={() => navigate(from, { replace: true })} style={{
        marginTop: 20, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14, cursor: 'pointer', textDecoration: 'underline'
      }}>
        {t('auth.actions.continueWithoutAccount')}
      </button>
    </div>
  );
}
