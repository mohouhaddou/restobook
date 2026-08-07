import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, ASSET } from '../../../api';
import { getTypeConfig } from '../../config/businessConfig';
import { useI18n } from '../../../i18n/config';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

/* ── helpers ───────────────────────────────────────────────────────────── */
function bizPath(r) {
  const mod = r.module || r._module
    || getTypeConfig(r.type || r.business_type)?.category?.module;
  if (mod === 'hanout')    return `/h/${r.slug}`;
  if (mod === 'pharmacie') return `/ph/${r.slug}`;
  return `/r/${r.slug}`;
}

const PLACEHOLDER_KEYS = [
  'marketplace.search.placeholder_food',
  'marketplace.search.placeholder_pharma',
  'marketplace.search.placeholder_grocery',
  'marketplace.search.placeholder_guard',
  'marketplace.search.placeholder_restaurant',
];

/* ── Suggestion item ───────────────────────────────────────────────────── */
function SuggItem({ s, onPick }) {
  const { t } = useI18n();
  const tc = s.btype ? getTypeConfig(s.btype) : null;
  const icon = s.type === 'business' ? 'store'
             : s.type === 'medicine' ? 'medicine'
             : s.type === 'product'  ? 'cart'
             : 'utensils';
  const sub  = s.type === 'business' ? s.city || '' : s.bizName || '';
  const typeLabel = s.type === 'business' ? t('marketplace.search.type.business') : s.type === 'product' ? t('marketplace.search.type.product') : s.type === 'medicine' ? t('marketplace.search.type.medicine') : t('marketplace.search.type.dish');
  return (
    <button onClick={() => onPick(s)} style={{
      display:'flex', alignItems:'center', gap:10, padding:'10px 16px',
      background:'none', border:'none', cursor:'pointer', width:'100%', textAlign:'start',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--mk-pill)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {s.type === 'business' && s.logo
        ? <img src={ASSET(s.logo)} alt="" style={{ width:34, height:34, borderRadius:10, objectFit:'cover', flexShrink:0 }} />
        : <div style={{ width:34, height:34, borderRadius:10, background: tc ? `${tc.color}18` : 'var(--mk-pill)', display:'grid', placeItems:'center', flexShrink:0 }}><PremiumIcon name={icon} size={18} /></div>
      }
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--mk-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
        {sub && <div style={{ fontSize:11, color:'var(--mk-muted)' }}>{sub}</div>}
      </div>
      <span style={{ fontSize:10, color:'var(--mk-muted)', flexShrink:0, background:'var(--mk-pill)', padding:'2px 7px', borderRadius:20 }}>
        {typeLabel}
      </span>
    </button>
  );
}

/**
 * Barre de recherche universelle — suggestions instantanées uniquement.
 * L'affichage des résultats a été extrait vers SearchResultsPage.jsx
 * (route dédiée /marketplace/search), pour rendre la recherche
 * partageable/navigable au bouton retour — impossible avec un état local.
 */
export default function GlobalSearch({ userPos, radiusKm }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const inputRef  = useRef(null);
  const wrapRef   = useRef(null);
  const debSugRef = useRef(null);

  const [phIdx,  setPhIdx]  = useState(0);
  const [q,      setQ]      = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [sugLoading,  setSugLoading]  = useState(false);

  useEffect(() => {
    const id = setInterval(() => setPhIdx(i => (i + 1) % PLACEHOLDER_KEYS.length), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setFocused(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSuggestions = useCallback((val) => {
    clearTimeout(debSugRef.current);
    if (val.trim().length < 2) { setSuggestions([]); return; }
    debSugRef.current = setTimeout(async () => {
      setSugLoading(true);
      try {
        const ps = new URLSearchParams({ q: val.trim() });
        if (userPos) { ps.set('lat', userPos.lat); ps.set('lng', userPos.lng); if (radiusKm) ps.set('radius_km', radiusKm); }
        const r = await fetch(API(`/marketplace/suggest?${ps}`));
        const d = await r.json();
        setSuggestions(d.suggestions || []);
      } catch { setSuggestions([]); }
      setSugLoading(false);
    }, 220);
  }, [userPos, radiusKm]);

  function goToResults(term) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setFocused(false); setSuggestions([]);
    navigate(`/marketplace/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleInput(e) {
    const val = e.target.value;
    setQ(val);
    fetchSuggestions(val);
  }

  function handleKey(e) {
    if (e.key === 'Enter') goToResults(q);
    if (e.key === 'Escape') { setFocused(false); setSuggestions([]); }
  }

  function pickSuggestion(s) {
    setSuggestions([]); setFocused(false);
    if (s.type === 'business' && s.slug) {
      navigate(bizPath({ slug: s.slug, type: s.btype, module: null }));
    } else {
      setQ(s.name);
      goToResults(s.name);
    }
  }

  function clear() { setQ(''); setSuggestions([]); inputRef.current?.focus(); }

  const showSug = focused && suggestions.length > 0;

  return (
    <div style={{ width:'100%' }}>
      <div ref={wrapRef} className="mk-global-search" style={{ position:'relative', width:'100%', maxWidth:760, margin:'0 auto' }}>
        <div className="mk-global-search-box" style={{
          display:'flex', alignItems:'center', gap:0,
          background:'rgba(255,255,255,.94)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
          border:'1px solid rgba(255,255,255,.6)',
          borderRadius: showSug ? '22px 22px 0 0' : 22,
          boxShadow: focused ? '0 0 0 3px rgba(255,138,0,.3), 0 20px 56px rgba(0,0,0,.22)' : '0 16px 48px rgba(0,0,0,.16)',
          transform: focused ? 'scale(1.012)' : 'scale(1)',
          transition:'box-shadow .25s cubic-bezier(.4,0,.2,1), border-radius .15s, transform .25s cubic-bezier(.4,0,.2,1)',
          overflow:'hidden',
        }}>
          <span style={{ padding:'0 12px 0 16px', color:'#94A3B8', flexShrink:0, display:'grid', placeItems:'center' }}><PremiumIcon name="search" size={20} /></span>
          <input
            ref={inputRef}
            value={q}
            onChange={handleInput}
            onKeyDown={handleKey}
            onFocus={() => setFocused(true)}
            placeholder={t(PLACEHOLDER_KEYS[phIdx])}
            style={{
              flex:1, border:'none', outline:'none', fontSize:15, background:'transparent',
              color:'#0F172A', padding:'14px 0', minWidth:0, fontFamily:'inherit',
            }}
          />
          {q && (
            <button onClick={clear} aria-label={t('marketplace.sidebar.clear_search')} style={{ padding:'0 10px', background:'none', border:'none', color:'#94A3B8', cursor:'pointer', fontSize:18, flexShrink:0 }}><PremiumIcon name="close" size={18} /></button>
          )}
          <button onClick={() => goToResults(q)}
            style={{
              minHeight:44, padding:'10px 22px', margin:5, borderRadius:12, border:'none',
              background: 'linear-gradient(135deg,#FF8A00,#FF5D00)',
              color: '#fff', cursor:'pointer',
              fontWeight:800, fontSize:14, flexShrink:0, transition:'all .15s', whiteSpace:'nowrap',
            }}>
            {t('marketplace.search.button')}
          </button>
        </div>

        {showSug && (
          <div style={{
            position:'absolute', top:'100%', insetInlineStart:0, insetInlineEnd:0, zIndex:500,
            background:'var(--mk-surface)', borderRadius:'0 0 22px 22px',
            boxShadow:'0 20px 48px rgba(0,0,0,.18)', border:'1px solid var(--mk-border)', borderTop:'none',
            overflow:'hidden',
          }}>
            {sugLoading && <div style={{ padding:'10px 16px', fontSize:12, color:'var(--mk-muted)' }}>{t('marketplace.search.loading')}</div>}
            {suggestions.map((s, i) => <SuggItem key={i} s={s} onPick={pickSuggestion} />)}
          </div>
        )}
      </div>
    </div>
  );
}
