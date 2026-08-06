import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API } from '../../api';
import { useCustomerAuth } from '../../modules/marketplace/CustomerAuthContext';
import GoogleAuthButton from '../../shared/components/auth/GoogleAuthButton';
import { PortalBrand } from '../../modules/portals/components/PortalBrand';
import { useKidsRouteLanguage } from '../kids/useKidsRouteLanguage';
import '../../modules/portals/portals.css';

/**
 * Connexion/inscription iFilino Kids — même back-end d'auth consommateur que
 * Marketplace et iFilino Play (voir PlayAuthPage.jsx, dont ce composant reprend
 * la structure : /auth/login, /auth/customer-register, Google roleIntent
 * "consumer"), habillé aux couleurs de la marque Kids. Additif seulement : la
 * navigation anonyme sur /kids reste inchangée, ceci n'est qu'un point d'entrée
 * optionnel vers un espace personnalisé (voir KidsProfilePage.jsx).
 */
export default function KidsAuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginCustomer } = useCustomerAuth();
  const { language, t } = useKidsRouteLanguage();
  const from = location.state?.from || `/kids/${language}/profile`;

  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');

  const [regNom, setRegNom] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPwd, setRegPwd] = useState('');
  const [regPwd2, setRegPwd2] = useState('');

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    if (!loginEmail.trim() || !loginPwd) { setError(t('kids.auth.errors.missingLogin')); return; }
    setLoading(true);
    try {
      const res = await fetch(API('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricule: loginEmail.trim().toLowerCase(), password: loginPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('kids.auth.errors.invalidCredentials')); setLoading(false); return; }
      loginCustomer(data.token, data.user);
      navigate(from, { replace: true });
    } catch { setError(t('kids.auth.errors.network')); }
    setLoading(false);
  }

  async function handleRegister(event) {
    event.preventDefault();
    setError('');
    if (!regNom.trim()) { setError(t('kids.auth.errors.missingName')); return; }
    if (!regEmail.trim()) { setError(t('kids.auth.errors.missingEmail')); return; }
    if (regPwd.length < 6) { setError(t('kids.auth.errors.shortPassword')); return; }
    if (regPwd !== regPwd2) { setError(t('kids.auth.errors.passwordMismatch')); return; }
    setLoading(true);
    try {
      const res = await fetch(API('/auth/customer-register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: regNom.trim(), email: regEmail.trim().toLowerCase(), password: regPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('kids.auth.errors.registerFailed')); setLoading(false); return; }
      loginCustomer(data.token, data.user);
      navigate(from, { replace: true });
    } catch { setError(t('kids.auth.errors.network')); }
    setLoading(false);
  }

  function handleGoogleSuccess(data) {
    setError('');
    loginCustomer(data.token, data.user);
    navigate(from, { replace: true });
  }

  return (
    <div className="portal portal-kids kids-auth-page">
      <div className="kids-auth-container">
        <div className="kids-auth-hero">
          <PortalBrand portal="kids"/>
          <p className="kids-auth-slogan">{t('kids.auth.slogan')}</p>
        </div>

        <div className="kids-auth-card">
          <div className="kids-auth-tabs">
            <button type="button" className={`kids-auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => { setTab('login'); setError(''); }}>
              {t('kids.auth.tabs.login')}
            </button>
            <button type="button" className={`kids-auth-tab${tab === 'register' ? ' active' : ''}`} onClick={() => { setTab('register'); setError(''); }}>
              {t('kids.auth.tabs.register')}
            </button>
          </div>

          {error && <div className="kids-auth-error" role="alert">{error}</div>}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="kids-auth-form">
              <label>{t('kids.auth.fields.email')}
                <input type="text" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="vous@example.com" autoComplete="email"/>
              </label>
              <label>{t('kids.auth.fields.password')}
                <input type="password" value={loginPwd} onChange={e => setLoginPwd(e.target.value)} placeholder="••••••••" autoComplete="current-password"/>
              </label>
              <button type="submit" className="kids-auth-btn" disabled={loading}>
                {loading ? t('kids.auth.actions.signingIn') : t('kids.auth.actions.signIn')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="kids-auth-form">
              <label>{t('kids.auth.fields.name')}
                <input type="text" value={regNom} onChange={e => setRegNom(e.target.value)} placeholder={t('kids.auth.fields.namePlaceholder')} autoComplete="name"/>
              </label>
              <label>{t('kids.auth.fields.email')}
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="vous@example.com" autoComplete="email"/>
              </label>
              <label>{t('kids.auth.fields.password')}
                <input type="password" value={regPwd} onChange={e => setRegPwd(e.target.value)} placeholder={t('kids.auth.fields.passwordHint')} autoComplete="new-password"/>
              </label>
              <label>{t('kids.auth.fields.confirmPassword')}
                <input type="password" value={regPwd2} onChange={e => setRegPwd2(e.target.value)} placeholder="••••••••" autoComplete="new-password"/>
              </label>
              <button type="submit" className="kids-auth-btn" disabled={loading}>
                {loading ? t('kids.auth.actions.registering') : t('kids.auth.actions.register')}
              </button>
            </form>
          )}

          <div className="kids-auth-divider"><span>{t('common.or')}</span></div>
          <GoogleAuthButton roleIntent="consumer" onSuccess={handleGoogleSuccess} onError={setError}/>
        </div>

        <button type="button" className="kids-auth-guest" onClick={() => navigate(`/kids/${language}`)}>
          {t('kids.auth.actions.guest')}
        </button>
      </div>
    </div>
  );
}
