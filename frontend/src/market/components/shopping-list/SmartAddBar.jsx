import React, { useEffect, useRef, useState } from 'react';
import { API } from '../../../api';
import { useVoiceInput } from '../../../shared/hooks/useVoiceInput';
import { parseVoiceList } from '../../../shared/utils/voiceListParser';
import { BarcodeCameraScanner } from '../../../shared/components/ui/BarcodeCameraScanner';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

const MODULE_ICON = { hanout: 'store', pharmacie: 'medicine', resto: 'utensils' };

// Langues de reconnaissance vocale proposées — le parseur d'articles
// (voiceListParser.js) ne sait extraire quantités/unités qu'en français ;
// les autres langues restent utilisables (Web Speech API les transcrit très
// bien) mais retombent sur "1 article = la phrase entière" faute d'un
// parseur dédié — dégradation gracieuse, jamais un blocage.
const VOICE_LANGS = [
  { code: 'fr-FR', short: 'FR', label: 'Français' },
  { code: 'ar-MA', short: 'AR', label: 'العربية' },
  { code: 'en-US', short: 'EN', label: 'English' },
];
const VOICE_LANG_KEY = 'rb_voice_lang';

function detectVoiceLang() {
  try {
    const stored = localStorage.getItem(VOICE_LANG_KEY);
    if (stored && VOICE_LANGS.some(l => l.code === stored)) return stored;
  } catch {}
  const nav = (typeof navigator !== 'undefined' && navigator.language || '').toLowerCase();
  const match = VOICE_LANGS.find(l => nav.startsWith(l.code.split('-')[0].toLowerCase()));
  return match ? match.code : 'fr-FR';
}

// Icône micro (contour) — utilisée à l'état repos.
function MicIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

// Petit égaliseur animé — remplace l'icône micro pendant l'écoute.
function VoiceWaveform() {
  const bars = [7, 13, 17, 12, 8];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, height: 17 }}>
      {bars.map((h, i) => (
        <span key={i} className="sl-wave-bar" style={{ height: h, animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

/**
 * Barre d'ajout intelligente — remplace le simple champ texte. Recherche la
 * marketplace en temps réel (même endpoint public que la page Marketplace),
 * + ajout vocal (Web Speech API native) + scan code-barres (catalogue interne
 * uniquement, jamais de base externe — décision verrouillée).
 */
export function SmartAddBar({ onAddProduct, onAddPlain, onAddBulk, onBarcodeAmbiguous }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [voiceLang, setVoiceLang] = useState(detectVoiceLang);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const debRef = useRef(null);
  const voice = useVoiceInput({ lang: voiceLang });

  function pickVoiceLang(code) {
    setVoiceLang(code);
    setLangMenuOpen(false);
    try { localStorage.setItem(VOICE_LANG_KEY, code); } catch {}
  }

  useEffect(() => {
    clearTimeout(debRef.current);
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    debRef.current = setTimeout(() => {
      setLoading(true);
      fetch(API(`/marketplace/search?q=${encodeURIComponent(q.trim())}&limit=8`))
        .then(r => r.json())
        .then(d => { setResults(d.products || []); setOpen(true); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(debRef.current);
  }, [q]);

  function pickProduct(p) {
    const seller = p.sellers?.[0]; // carte groupée : moins cher/plus proche déjà en premier
    const fields = seller ? {
      name: p.name, estimated_price: seller.price, image_url: p.images?.[0] || null,
      source_module: p.module, source_product_id: seller.product_id,
      preferred_organization_id: seller.business?.id || null,
    } : {
      name: p.name, estimated_price: p.price, image_url: p.images?.[0] || null,
      source_module: p.module, source_product_id: p.id,
      preferred_organization_id: p.business?.id || null,
    };
    onAddProduct(fields);
    setQ(''); setResults([]); setOpen(false);
  }

  function addPlain() {
    if (!q.trim()) return;
    onAddPlain(q.trim());
    setQ(''); setResults([]); setOpen(false);
  }

  function handleVoiceClick() {
    if (!voice.supported) return;
    if (voice.listening) { voice.stop(); return; }
    voice.start(transcript => {
      const parsed = parseVoiceList(transcript);
      if (parsed.length) onAddBulk(parsed);
    });
  }

  async function handleBarcodeDetected(code) {
    setScannerOpen(false);
    try {
      const d = await fetch(API(`/marketplace/products/by-barcode/${encodeURIComponent(code)}`)).then(r => r.json());
      if (!d.found) { onAddPlain(''); return; } // laisse l'appelant proposer un mini-formulaire manuel
      if (d.products.length === 1) pickProduct(d.products[0]);
      else onBarcodeAmbiguous(d.products);
    } catch {}
  }

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes sl-wave-bar { 0%, 100% { transform: scaleY(.45); } 50% { transform: scaleY(1); } }
        .sl-wave-bar {
          display: inline-block; width: 3px; border-radius: 3px; background: #fff;
          animation: sl-wave-bar .85s ease-in-out infinite; transform-origin: center;
        }
        @keyframes sl-pulse-ring {
          0%   { transform: scale(1);   opacity: .45; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        .sl-pulse-ring {
          position: absolute; inset: 0; border-radius: 50%;
          background: var(--mk-orange); animation: sl-pulse-ring 1.3s ease-out infinite;
        }
        .sl-searchbar {
          transition: box-shadow .2s ease, border-color .2s ease, background .2s ease;
        }
        .sl-searchbar:focus-within {
          border-color: var(--mk-orange) !important;
          box-shadow: 0 6px 22px rgba(255,138,0,.14) !important;
        }
        .sl-mic-btn {
          transition: transform .18s cubic-bezier(.34,1.56,.64,1), background .25s ease, box-shadow .25s ease;
        }
        .sl-mic-btn:active { transform: scale(.92); }
        .sl-icon-btn {
          transition: background .15s ease, color .15s ease, transform .15s ease;
        }
        .sl-icon-btn:hover { background: var(--mk-bg); color: var(--mk-text); }
      `}</style>

      <div className="sl-searchbar" style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--mk-surface)', border: '1.5px solid var(--mk-border)', borderRadius: 999,
        padding: '6px 6px 6px 6px', boxShadow: '0 2px 14px rgba(15,23,42,.05)',
      }}>
        <button onClick={() => setScannerOpen(true)} title="Scanner un code-barres" className="sl-icon-btn" style={{
          width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'transparent',
          color: 'var(--mk-muted)', cursor: 'pointer', fontSize: 17, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <PremiumIcon name="scan" size={18} />
        </button>

        <input
          value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !results.length) addPlain(); }}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Chercher un produit ou dicter un article…"
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            color: 'var(--mk-text)', fontSize: 14, padding: '8px 2px',
          }}
        />

        {voice.supported && (
          <button onClick={() => setLangMenuOpen(o => !o)} title="Langue de reconnaissance vocale" className="sl-icon-btn" style={{
            width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--mk-border)', background: 'var(--mk-card)',
            fontSize: 13, lineHeight: 1, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {VOICE_LANGS.find(l => l.code === voiceLang)?.short}
          </button>
        )}

        <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
          {voice.listening && <span className="sl-pulse-ring" />}
          <button
            onClick={handleVoiceClick}
            disabled={!voice.supported}
            title={!voice.supported ? 'Non supporté par ce navigateur' : voice.listening ? "Arrêter l'écoute" : `Ajout vocal (${VOICE_LANGS.find(l => l.code === voiceLang)?.label})`}
            className="sl-mic-btn"
            style={{
              position: 'relative', width: 44, height: 44, borderRadius: '50%', border: 'none',
              background: voice.listening
                ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                : 'linear-gradient(135deg, var(--mk-orange), #FF5D00)',
              color: '#fff', cursor: voice.supported ? 'pointer' : 'not-allowed',
              opacity: voice.supported ? 1 : .4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: voice.listening ? '0 4px 16px rgba(239,68,68,.4)' : '0 4px 14px rgba(255,138,0,.35)',
              transform: voice.listening ? 'scale(1.06)' : 'scale(1)',
            }}
          >
            {voice.listening ? <VoiceWaveform /> : <MicIcon />}
          </button>
        </div>
      </div>

      {langMenuOpen && (
        <div style={{
          position: 'absolute', top: '110%', right: 0, zIndex: 60, background: 'var(--mk-surface)',
          border: '1px solid var(--mk-border)', borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,.15)', padding: 4, minWidth: 130,
        }}>
          {VOICE_LANGS.map(l => (
            <button key={l.code} onClick={() => pickVoiceLang(l.code)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 8px', borderRadius: 8,
              background: l.code === voiceLang ? 'var(--mk-bg)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12.5, color: 'var(--mk-text)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--mk-orange)' }}>{l.short}</span><span>{l.label}</span>
            </button>
          ))}
        </div>
      )}

      {voice.listening && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--mk-orange)', fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', animation: 'sl-wave-bar 1s ease-in-out infinite' }} />
          Je vous écoute…
        </div>
      )}
      {voice.error && <div style={{ fontSize: 11.5, color: 'var(--mk-red)', marginTop: 6 }}>{voice.error}</div>}

      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 50,
          background: 'var(--mk-surface)', border: '1px solid var(--mk-border)', borderRadius: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,.15)', maxHeight: 320, overflowY: 'auto', padding: 6,
        }}>
          {loading && <div style={{ padding: 12, fontSize: 12, color: 'var(--mk-muted)' }}>Recherche…</div>}
          {!loading && results.length === 0 && (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--mk-muted)' }}>Aucun résultat dans la marketplace.</div>
          )}
          {!loading && results.map(p => (
            <button key={p.id} onClick={() => pickProduct(p)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 10,
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ color: 'var(--mk-orange)', display: 'grid', placeItems: 'center' }}><PremiumIcon name={MODULE_ICON[p.module] || 'cart'} size={17} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mk-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--mk-muted)' }}>
                  {p.seller_count > 1 ? `Dès ${Number(p.price).toFixed(2)} MAD · ${p.seller_count} commerces` : `${Number(p.price).toFixed(2)} MAD · ${p.business?.name || ''}`}
                </div>
              </div>
            </button>
          ))}
          <button onClick={addPlain} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 10,
            background: 'none', border: 'none', borderTop: '1px dashed var(--mk-border)', marginTop: 4, cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ color: 'var(--mk-orange)', display: 'grid', placeItems: 'center' }}><PremiumIcon name="plus" size={17} /></span>
            <span style={{ fontSize: 12.5, color: 'var(--mk-muted)' }}>Ajouter « {q} » comme article libre</span>
          </button>
        </div>
      )}

      {scannerOpen && (
        <BarcodeCameraScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setScannerOpen(false)}
          onUnavailable={() => setScannerOpen(false)}
          continuous={false}
          includeQr={false}
          title="Scanner un article"
          hintText="Scannez le code-barres du produit à ajouter à votre liste."
        />
      )}
    </div>
  );
}
