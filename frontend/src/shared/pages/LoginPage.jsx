import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { API } from '../../api';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { BRAND } from '../../config/branding';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';
import { useI18n } from '../../i18n/config';

const FOOD_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    quoteKey: 'auth.proLogin.quotes.curnonsky',
    authorKey: 'auth.proLogin.authors.curnonsky'
  },
  {
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    quoteKey: 'auth.proLogin.quotes.brillat',
    authorKey: 'auth.proLogin.authors.brillat'
  },
  {
    url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80',
    quoteKey: 'auth.proLogin.quotes.rochefoucauld',
    authorKey: 'auth.proLogin.authors.rochefoucauld'
  },
];

const IMG = FOOD_IMAGES[Math.floor(Math.random() * FOOD_IMAGES.length)];

function EyeIcon({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {open
        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
      }
    </svg>
  );
}

export default function LoginPage({ branding }) {
  const { login } = useAuth();
  const { t } = useI18n();
  const brandName = branding?.brand_name || BRAND.APP_NAME;
  const navigate  = useNavigate();

  const [msg, setMsg]         = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [googlePending, setGooglePending] = useState(null); // { token, profile } — compte Google inexistant, à créer

  async function handleLogin(e) {
    e.preventDefault();
    setMsg(''); setLoading(true);
    const f = new FormData(e.target);
    try {
      const resp = await fetch(API('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricule: f.get('matricule'), password: f.get('password') })
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error || t('auth.errors.loginFailed'));
      login(d.token, d.user);
      navigate(d.user?.role === 'customer' ? '/marketplace' : '/');
    } catch (err) { setMsg(err.message); }
    finally { setLoading(false); }
  }

  function handleGoogleSuccess(d) {
    setMsg('');
    if (d.account_found === false) {
      // Aucun compte pour ce compte Google : on propose de le créer plutôt
      // que d'en créer un silencieusement avec un rôle deviné.
      setGooglePending({ token: d.pending_signup_token, profile: d.profile });
      return;
    }
    setGooglePending(null);
    login(d.token, d.user);
    if (d.needs_onboarding) navigate('/pro-register', { state: { googleOnboarding: true } });
    else navigate(d.user?.role === 'customer' ? '/marketplace' : '/');
  }

  function handleGoogleError(message) {
    setGooglePending(null);
    setMsg(message);
  }

  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: 'var(--rb-muted)',
    textTransform: 'uppercase', letterSpacing: '.07em',
    display: 'block', marginBottom: 6,
  };

  return (
    <div className="rb-login-wrap">
      {/* ── Left panel: form ── */}
      <div className="rb-login-panel">
        {/* Brand — toujours le logo Ifilino, pas le branding org */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 20 }}>
            <BrandLogo variant="full" theme="light" size="md" style={{ height: 110 }} />
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#FFF7ED,#FFEDD5)', border: '1.5px solid #FED7AA', borderRadius: 20, padding: '5px 14px', marginBottom: 16 }}>
            <span style={{ fontSize: 13 }}>🏢</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>{t('auth.proLogin.badge')}</span>
          </div>
          <h1 style={{ fontFamily:'Poppins, sans-serif', fontSize:24, fontWeight:800, margin:'0 0 8px', color:'var(--rb-text)', lineHeight:1.2 }}>
            {t('auth.proLogin.title')}
          </h1>
          <p style={{ color:'var(--rb-muted)', fontSize:13, margin:'0 0 10px', lineHeight:1.6 }}>
            {t('auth.proLogin.subtitle')}
          </p>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {[['🍽️', t('auth.proLogin.modules.resto'), '#FF8A00'], ['🏪', t('auth.proLogin.modules.hanout'), '#10B981'], ['🏢', t('auth.proLogin.modules.canteen'), '#3B82F6']].map(([icon,label,color]) => (
              <span key={label} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:14, background:`${color}12`, border:`1px solid ${color}30`, fontSize:11, fontWeight:700, color }}>
                {icon} {label}
              </span>
            ))}
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} style={{ display:'grid', gap:18 }}>
          <div>
            <label style={labelStyle}>{t('auth.fields.identifier')}</label>
            <input name="matricule" className="form-control"
              placeholder={t('auth.placeholders.identifier')}
              style={{ height:44 }} autoFocus required />
          </div>
          <div>
            <label style={labelStyle}>{t('auth.fields.password')}</label>
            <div className="input-group">
              <input name="password" type={showPwd ? 'text' : 'password'}
                className="form-control" placeholder="••••••••"
                style={{ height:44 }} required />
              <button type="button" className="btn btn-outline-secondary"
                style={{ height:44, borderRadius:'0 var(--rb-radius-sm) var(--rb-radius-sm) 0' }}
                aria-label={showPwd ? t('auth.actions.hidePassword') : t('auth.actions.showPassword')}
                onClick={() => setShowPwd(v => !v)}>
                <EyeIcon open={showPwd} />
              </button>
            </div>
          </div>
          {msg && (
            <div className="alert alert-danger py-2 mb-0" style={{ fontSize:13 }}>❌ {msg}</div>
          )}
          <button className="btn btn-primary w-100" style={{ height:46, fontSize:14 }} disabled={loading}>
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2" style={{ width:14, height:14 }} />{t('auth.actions.signingIn')}</>
              : t('auth.actions.signInArrow')}
          </button>
          <p style={{ textAlign:'center', fontSize:12, color:'var(--rb-muted)', margin:0 }}>
            {t('auth.proLogin.forgotPasswordHelp')}
          </p>
        </form>

        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'22px 0' }}>
          <div style={{ flex:1, height:1, background:'var(--rb-border)' }} />
          <span style={{ fontSize:11, color:'var(--rb-muted)', fontWeight:600 }}>{t('common.or')}</span>
          <div style={{ flex:1, height:1, background:'var(--rb-border)' }} />
        </div>

        {googlePending ? (
          <div style={{ background:'linear-gradient(135deg,#FFF7ED,#FFEDD5)', border:'1.5px solid #FED7AA', borderRadius:14, padding:'16px 18px', display:'flex', flexDirection:'column', gap:10, alignItems:'center', textAlign:'center' }}>
            {googlePending.profile?.picture && (
              <img src={googlePending.profile.picture} alt="" style={{ width:44, height:44, borderRadius:'50%' }} />
            )}
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:'#92400E' }}>{t('auth.google.noAccountTitle')}</div>
              <div style={{ fontSize:12, color:'#B45309', marginTop:2 }}>
                {t('auth.google.noAccountMessage', { email: googlePending.profile?.email })}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, width:'100%' }}>
              <button
                onClick={() => setGooglePending(null)}
                style={{ flex:1, padding:'10px', background:'transparent', border:'1.5px solid #FED7AA', borderRadius:10, color:'#92400E', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}
              >{t('common.cancel')}</button>
              <button
                onClick={() => navigate('/pro-register', { state: { googlePendingSignup: googlePending } })}
                style={{ flex:2, padding:'10px', background:'linear-gradient(135deg,#FF8A00,#FF5D00)', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}
              >{t('auth.actions.createBusinessAccount')}</button>
            </div>
          </div>
        ) : (
          <GoogleAuthButton roleIntent="business_owner" onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
        )}

        {/* Pro register + Marketplace link */}
        <div style={{ borderTop:'1px solid var(--rb-border)', marginTop:36, paddingTop:28 }}>
          <div style={{ background:'linear-gradient(135deg,#FFF7ED,#FFEDD5)', borderRadius:14, padding:'18px 20px', border:'1.5px solid #FED7AA', marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#92400E', marginBottom:4 }}>
              {t('auth.proLogin.noBusinessAccount')}
            </div>
            <div style={{ fontSize:12, color:'#B45309', marginBottom:14, lineHeight:1.5 }}>
              {t('auth.proLogin.trialCopy')}
            </div>
            <button
              onClick={() => navigate('/pro-register')}
              style={{ width:'100%', padding:'11px', background:'linear-gradient(135deg,#FF8A00,#FF5D00)', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 4px 16px rgba(255,138,0,.3)', fontFamily:'inherit' }}
            >
              {t('auth.actions.createBusinessAccount')}
            </button>
          </div>
          <div style={{ textAlign:'center' }}>
            <button
              onClick={() => navigate('/marketplace')}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--rb-muted)', fontSize:12, fontFamily:'inherit', textDecoration:'underline' }}
            >
              {t('auth.actions.continueAsCustomer')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right panel: food image ── */}
      <div className="rb-login-image">
        <img src={IMG.url} alt={t('auth.proLogin.heroAlt')} loading="eager" />
        <div className="rb-login-image__overlay" />
        <div className="rb-login-image__quote">
          <div className="rb-login-image__quote-text">"{t(IMG.quoteKey)}"</div>
          <div className="rb-login-image__quote-author">— {t(IMG.authorKey)}</div>
        </div>
      </div>
    </div>
  );
}
