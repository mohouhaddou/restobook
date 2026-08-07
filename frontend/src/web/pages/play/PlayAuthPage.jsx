import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API } from '../../../api';
import { useCustomerAuth } from '../../../shared/context/CustomerAuthContext';
import GoogleAuthButton from '../../../shared/components/auth/GoogleAuthButton';
import '../../modules/play/play.css';

export default function PlayAuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginCustomer } = useCustomerAuth();
  const from = location.state?.from || '/play/profile';

  const [tab, setTab] = useState('login');
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
    if (!loginEmail.trim() || !loginPwd) { setError('Email et mot de passe requis.'); return; }
    setLoading(true);
    try {
      const res = await fetch(API('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricule: loginEmail.trim().toLowerCase(), password: loginPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Identifiants invalides.'); setLoading(false); return; }
      loginCustomer(data.token, data.user);
      navigate(from, { replace: true });
    } catch { setError('Erreur réseau, réessayez.'); }
    setLoading(false);
  }

  async function handleRegister(event) {
    event.preventDefault();
    setError('');
    if (!regNom.trim()) { setError('Un pseudo est requis.'); return; }
    if (!regEmail.trim()) { setError('Un email est requis.'); return; }
    if (regPwd.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (regPwd !== regPwd2) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    try {
      const res = await fetch(API('/auth/customer-register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: regNom.trim(), email: regEmail.trim().toLowerCase(), password: regPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Impossible de créer le compte."); setLoading(false); return; }
      loginCustomer(data.token, data.user);
      navigate(from, { replace: true });
    } catch { setError('Erreur réseau, réessayez.'); }
    setLoading(false);
  }

  function handleGoogleSuccess(data) {
    setError('');
    loginCustomer(data.token, data.user);
    navigate(from, { replace: true });
  }

  return (
    <div className="play-page">
      <div className="play-container play-auth-container">
        <div className="play-auth-hero">
          <img src="/brand/ifilino_play_mark.png" alt="iFilino Play" className="play-auth-logo"/>
          <p>Connectez-vous pour sauvegarder votre progression, débloquer des récompenses et grimper au classement.</p>
        </div>

        <div className="play-card play-auth-card">
          <div className="play-tabs">
            <button type="button" className={`play-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); }}>Connexion</button>
            <button type="button" className={`play-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError(''); }}>Créer un compte</button>
          </div>

          {error && <div className="play-auth-error" role="alert">{error}</div>}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="play-auth-form">
              <label>Email
                <input type="text" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="vous@example.com" autoComplete="email"/>
              </label>
              <label>Mot de passe
                <input type="password" value={loginPwd} onChange={e => setLoginPwd(e.target.value)} placeholder="••••••••" autoComplete="current-password"/>
              </label>
              <button type="submit" className="play-btn" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="play-auth-form">
              <label>Pseudo
                <input type="text" value={regNom} onChange={e => setRegNom(e.target.value)} placeholder="VotrePseudo" autoComplete="name"/>
              </label>
              <label>Email
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="vous@example.com" autoComplete="email"/>
              </label>
              <label>Mot de passe
                <input type="password" value={regPwd} onChange={e => setRegPwd(e.target.value)} placeholder="6 caractères minimum" autoComplete="new-password"/>
              </label>
              <label>Confirmer le mot de passe
                <input type="password" value={regPwd2} onChange={e => setRegPwd2(e.target.value)} placeholder="••••••••" autoComplete="new-password"/>
              </label>
              <button type="submit" className="play-btn" disabled={loading}>{loading ? 'Création…' : 'Créer mon compte'}</button>
            </form>
          )}

          <div className="play-auth-divider"><span>ou</span></div>
          <GoogleAuthButton roleIntent="consumer" onSuccess={handleGoogleSuccess} onError={setError}/>
        </div>

        <button type="button" className="play-auth-guest" onClick={() => navigate('/play')}>Continuer en invité</button>
      </div>
    </div>
  );
}
