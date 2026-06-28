import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../api';
import { BrandLogo } from '../components/brand/BrandLogo';

const FOOD_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    quote: "La bonne cuisine, c'est quand les choses ont le goût de ce qu'elles sont.",
    author: 'Curnonsky'
  },
  {
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    quote: "Un repas sans vin est comme un jour sans soleil.",
    author: 'Jean Anthelme Brillat-Savarin'
  },
  {
    url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80',
    quote: "Manger est un besoin, savoir manger est un art.",
    author: 'François de La Rochefoucauld'
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
  const brandName = branding?.brand_name || 'RestoBook';
  const navigate  = useNavigate();

  const [msg, setMsg]         = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

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
      if (!resp.ok) throw new Error(d.error || 'Erreur connexion');
      login(d.token, d.user);
      navigate(d.user?.role === 'customer' ? '/marketplace' : '/');
    } catch (err) { setMsg(err.message); }
    finally { setLoading(false); }
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
        {/* Brand — toujours le logo RestoBook, pas le branding org */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 28 }}>
            <BrandLogo variant="full" theme="light" size="md" style={{ height: 38 }} />
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#FFF7ED,#FFEDD5)', border: '1.5px solid #FED7AA', borderRadius: 20, padding: '5px 14px', marginBottom: 16 }}>
            <span style={{ fontSize: 13 }}>🏢</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>Espace professionnel</span>
          </div>
          <h1 style={{ fontFamily:'Poppins, sans-serif', fontSize:24, fontWeight:800, margin:'0 0 8px', color:'var(--rb-text)', lineHeight:1.2 }}>
            Accédez à votre espace
          </h1>
          <p style={{ color:'var(--rb-muted)', fontSize:13, margin:0, lineHeight:1.6 }}>
            Gérez votre restaurant, cantine ou organisation depuis votre tableau de bord.
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} style={{ display:'grid', gap:18 }}>
          <div>
            <label style={labelStyle}>Identifiant</label>
            <input name="matricule" className="form-control"
              placeholder="Matricule, email ou identifiant"
              style={{ height:44 }} autoFocus required />
          </div>
          <div>
            <label style={labelStyle}>Mot de passe</label>
            <div className="input-group">
              <input name="password" type={showPwd ? 'text' : 'password'}
                className="form-control" placeholder="••••••••"
                style={{ height:44 }} required />
              <button type="button" className="btn btn-outline-secondary"
                style={{ height:44, borderRadius:'0 var(--rb-radius-sm) var(--rb-radius-sm) 0' }}
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
              ? <><span className="spinner-border spinner-border-sm me-2" style={{ width:14, height:14 }} />Connexion…</>
              : 'Se connecter →'}
          </button>
          <p style={{ textAlign:'center', fontSize:12, color:'var(--rb-muted)', margin:0 }}>
            Mot de passe oublié ? Contactez votre administrateur.
          </p>
        </form>

        {/* Pro register + Marketplace link */}
        <div style={{ borderTop:'1px solid var(--rb-border)', marginTop:36, paddingTop:28 }}>
          <div style={{ background:'linear-gradient(135deg,#FFF7ED,#FFEDD5)', borderRadius:14, padding:'18px 20px', border:'1.5px solid #FED7AA', marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#92400E', marginBottom:4 }}>
              Vous n'avez pas encore de compte professionnel ?
            </div>
            <div style={{ fontSize:12, color:'#B45309', marginBottom:14, lineHeight:1.5 }}>
              Créez votre espace restaurant ou cantine en 5 minutes. 30 jours d'essai gratuit.
            </div>
            <button
              onClick={() => navigate('/pro-register')}
              style={{ width:'100%', padding:'11px', background:'linear-gradient(135deg,#FF8A00,#FF5D00)', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 4px 16px rgba(255,138,0,.3)', fontFamily:'inherit' }}
            >
              🚀 Créer un compte professionnel
            </button>
          </div>
          <div style={{ textAlign:'center' }}>
            <button
              onClick={() => navigate('/marketplace')}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--rb-muted)', fontSize:12, fontFamily:'inherit', textDecoration:'underline' }}
            >
              Je suis un client — Commander en ligne
            </button>
          </div>
        </div>
      </div>

      {/* ── Right panel: food image ── */}
      <div className="rb-login-image">
        <img src={IMG.url} alt="Restauration" loading="eager" />
        <div className="rb-login-image__overlay" />
        <div className="rb-login-image__quote">
          <div className="rb-login-image__quote-text">"{IMG.quote}"</div>
          <div className="rb-login-image__quote-author">— {IMG.author}</div>
        </div>
      </div>
    </div>
  );
}
