import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { BrandLogo } from '../components/brand/BrandLogo';
import { BRAND } from '../config/branding';
import GoogleAuthButton from '../shared/components/auth/GoogleAuthButton';

const inputStyle = {
  width: '100%', padding: '13px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10,
  fontSize: 15, outline: 'none', boxSizing: 'border-box', color: '#1E1E1E',
  transition: 'border-color 0.2s',
};
const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 };
const ORANGE = 'var(--rb-orange, #FF8A00)';

export default function DeliveryRegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [city, setCity]           = useState('');
  const [pwd, setPwd]             = useState('');
  const [pwd2, setPwd2]           = useState('');

  // Compte Google confirmé mais inexistant : { token: pending_signup_token, profile }.
  // Il ne reste plus qu'à saisir téléphone + ville pour créer le compte livreur.
  const [googlePending, setGooglePending] = useState(null);

  function handleGoogleSuccess(d) {
    setError('');
    if (d.account_found === false) {
      setGooglePending({ token: d.pending_signup_token, profile: d.profile });
      const [firstGuess = '', ...restGuess] = (d.profile?.name || '').split(' ');
      setFirstName(firstGuess);
      setLastName(restGuess.join(' '));
      setEmail(d.profile?.email || '');
      return;
    }
    login(d.token, d.user);
    navigate('/delivery', { replace: true });
  }

  function handleGoogleError(message) {
    setGooglePending(null);
    setError(message);
  }

  async function handleCompleteCourierSignup(e) {
    e.preventDefault();
    setError('');
    if (!phone.trim()) { setError('Téléphone requis'); return; }
    if (!city.trim())  { setError('Ville requise'); return; }
    setLoading(true);
    try {
      const res = await fetch(API('/auth/google/complete-courier-signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_signup_token: googlePending.token, phone: phone.trim(), city: city.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur inscription'); setLoading(false); return; }
      login(data.token, data.user);
      navigate('/delivery', { replace: true });
    } catch { setError('Erreur réseau'); }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!firstName.trim())  { setError('Le prénom est requis'); return; }
    if (!lastName.trim())   { setError('Le nom est requis'); return; }
    if (!email.trim())      { setError('Email requis'); return; }
    if (!phone.trim())      { setError('Téléphone requis'); return; }
    if (!city.trim())       { setError('Ville requise'); return; }
    if (pwd.length < 6)     { setError('Mot de passe minimum 6 caractères'); return; }
    if (pwd !== pwd2)       { setError('Les mots de passe ne correspondent pas'); return; }

    setLoading(true);
    try {
      const res = await fetch(API('/auth/courier-register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name:  lastName.trim(),
          email:      email.trim().toLowerCase(),
          phone:      phone.trim(),
          city:       city.trim(),
          password:   pwd,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur inscription'); setLoading(false); return; }
      login(data.token, data.user);
      navigate('/delivery', { replace: true });
    } catch { setError('Erreur réseau'); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #FFF3E0 0%, #F5F5F5 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <BrandLogo variant="full" theme="light" size="lg"
          style={{ height: 120, margin: '0 auto 10px', filter: 'drop-shadow(0 4px 12px rgba(255,138,0,.25))' }} />
        <p style={{ margin: 0, fontSize: 14, color: '#6B7280' }}>🛵 Devenez livreur partenaire {BRAND.APP_NAME}</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', width: '100%', maxWidth: 440, overflow: 'hidden' }}>
        <div style={{ padding: '28px 24px' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#111827' }}>Inscription livreur</h1>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
            Créez votre compte, puis complétez votre profil et vos documents (permis, véhicule) depuis votre espace livreur.
          </p>

          {error && (
            <div style={{ padding: '10px 14px', background: '#FEE2E2', borderRadius: 8, color: '#DC2626', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {googlePending ? (
            <form onSubmit={handleCompleteCourierSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 10, padding: '10px 12px' }}>
                {googlePending.profile?.picture && (
                  <img src={googlePending.profile.picture} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                )}
                <div style={{ fontSize: 12, color: '#92400E' }}>
                  Connexion Google confirmée pour <strong>{googlePending.profile?.email}</strong>. Plus que 2 infos :
                </div>
              </div>
              <div>
                <label style={labelStyle}>Téléphone *</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+212 6 00 00 00 00" style={inputStyle} autoComplete="tel" autoFocus />
              </div>
              <div>
                <label style={labelStyle}>Ville *</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)}
                  placeholder="Casablanca" style={inputStyle} autoComplete="address-level2" />
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
                Vos premières livraisons débuteront après vérification de vos documents (permis, véhicule) par notre équipe.
              </p>
              <button type="submit" disabled={loading} style={{
                padding: '14px', background: loading ? '#9CA3AF' : 'linear-gradient(135deg, var(--rb-orange,#FF8A00), var(--rb-deep-orange,#FF5D00))',
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                cursor: loading ? 'default' : 'pointer', marginTop: 4,
              }}>
                {loading ? 'Création…' : 'Créer mon compte livreur'}
              </button>
              <button type="button" onClick={() => setGooglePending(null)} style={{
                background: 'none', border: 'none', color: '#9CA3AF', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit',
              }}>← Utiliser un autre compte / mot de passe classique</button>
            </form>
          ) : (
            <>
              <GoogleAuthButton roleIntent="delivery" onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
                <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>OU</span>
                <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
              </div>
            </>
          )}

          {!googlePending && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Prénom *</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="Mohammed" style={inputStyle} autoComplete="given-name" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Nom *</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="Alami" style={inputStyle} autoComplete="family-name" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="vous@example.com" style={inputStyle} autoComplete="email" />
            </div>
            <div>
              <label style={labelStyle}>Téléphone *</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+212 6 00 00 00 00" style={inputStyle} autoComplete="tel" />
            </div>
            <div>
              <label style={labelStyle}>Ville *</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)}
                placeholder="Casablanca" style={inputStyle} autoComplete="address-level2" />
            </div>
            <div>
              <label style={labelStyle}>Mot de passe *</label>
              <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
                placeholder="Minimum 6 caractères" style={inputStyle} autoComplete="new-password" />
            </div>
            <div>
              <label style={labelStyle}>Confirmer le mot de passe *</label>
              <input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)}
                placeholder="••••••••" style={inputStyle} autoComplete="new-password" />
            </div>
            <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
              Vos premières livraisons débuteront après vérification de vos documents (permis, véhicule) par notre équipe.
            </p>
            <button type="submit" disabled={loading} style={{
              padding: '14px', background: loading ? '#9CA3AF' : 'linear-gradient(135deg, var(--rb-orange,#FF8A00), var(--rb-deep-orange,#FF5D00))',
              color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer', marginTop: 4,
            }}>
              {loading ? 'Création…' : 'Créer mon compte livreur'}
            </button>
            <div style={{ textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
              Déjà livreur partenaire ?{' '}
              <button type="button" onClick={() => navigate('/login')} style={{
                background: 'none', border: 'none', color: ORANGE, fontWeight: 600, cursor: 'pointer', padding: 0
              }}>Se connecter</button>
            </div>
          </form>
          )}
        </div>
      </div>

      <button onClick={() => navigate('/landing')} style={{
        marginTop: 20, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14, cursor: 'pointer', textDecoration: 'underline'
      }}>
        ← Retour à l'accueil
      </button>
    </div>
  );
}
