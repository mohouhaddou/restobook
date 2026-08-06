import React, { useState } from 'react';
import { Portal } from './Portal';
import { useMkTheme } from '../../hooks/useMkTheme';
import { PremiumIcon } from './PremiumIcon';

/**
 * Bouton de partage réutilisable — liste de courses (contenu texte, sans URL,
 * données privées) et fiches commerce/produit marketplace (avec URL publique).
 * Essaie d'abord le partage natif (`navigator.share`, ouvre le sélecteur
 * WhatsApp/Facebook/Mail/... du système sur mobile) ; sur desktop ou si
 * indisponible, replie sur un petit menu avec les canaux explicites demandés.
 */
function buildFullText(text, url) {
  return [text, url].filter(Boolean).join('\n\n');
}

function ShareFallbackMenu({ title, text, url, onClose, anchorTheme }) {
  const [copied, setCopied] = useState(false);
  const fullText = buildFullText(text, url);

  function copyLink() {
    navigator.clipboard?.writeText(url || fullText);
    setCopied(true);
    setTimeout(() => { setCopied(false); onClose(); }, 1200);
  }

  return (
    <Portal>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div onClick={e => e.stopPropagation()} className={`mk-wrap mk-${anchorTheme}`} style={{
          background: 'var(--mk-surface)', width: '100%', maxWidth: 420, borderRadius: '20px 20px 0 0', padding: '18px 16px 26px',
        }}>
          <div style={{ width: 40, height: 4, background: 'var(--mk-border)', borderRadius: 4, margin: '0 auto 14px' }} />
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--mk-text)' }}>Partager {title ? `« ${title} »` : ''}</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <a href={`https://wa.me/?text=${encodeURIComponent(fullText)}`} target="_blank" rel="noopener noreferrer" onClick={onClose} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--mk-border)',
              background: 'var(--mk-card)', color: 'var(--mk-text)', textDecoration: 'none', fontSize: 13.5, fontWeight: 600,
            }}>
              <PremiumIcon name="whatsapp" size={18} /> WhatsApp
            </a>
            <a href={`mailto:?subject=${encodeURIComponent(title || 'iFilino')}&body=${encodeURIComponent(fullText)}`} onClick={onClose} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--mk-border)',
              background: 'var(--mk-card)', color: 'var(--mk-text)', textDecoration: 'none', fontSize: 13.5, fontWeight: 600,
            }}>
              <PremiumIcon name="mail" size={18} /> Email
            </a>
            {url && (
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" onClick={onClose} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--mk-border)',
                background: 'var(--mk-card)', color: 'var(--mk-text)', textDecoration: 'none', fontSize: 13.5, fontWeight: 600,
              }}>
                <PremiumIcon name="globe" size={18} /> Facebook
              </a>
            )}
            <button onClick={copyLink} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--mk-border)',
              background: 'var(--mk-card)', color: 'var(--mk-text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
            }}>
              <PremiumIcon name={copied ? 'check' : 'link'} size={18} /> {copied ? 'Copié !' : (url ? 'Copier le lien' : 'Copier le texte')}
            </button>
          </div>

          <button onClick={onClose} style={{
            width: '100%', marginTop: 14, padding: 12, borderRadius: 12, border: '1px solid var(--mk-border)',
            background: 'transparent', color: 'var(--mk-text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>Annuler</button>
        </div>
      </div>
    </Portal>
  );
}

/**
 * `compact` : petit bouton icône rond (cartes produit). Sinon : pilule
 * labellisée "Partager" (en-têtes de fiche commerce, liste de courses).
 */
export function ShareButton({ title, text, url, compact = false, style, className, children }) {
  const [theme] = useMkTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleClick(e) {
    e.stopPropagation();
    const shareData = { title, text: text || title, url };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch (err) { if (err?.name === 'AbortError') return; }
    }
    setMenuOpen(true);
  }

  if (compact) {
    return (
      <>
        <button onClick={handleClick} title="Partager" style={{
          width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.45)',
          color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style,
        }}>
          <PremiumIcon name="share" size={15} />
        </button>
        {menuOpen && <ShareFallbackMenu title={title} text={text} url={url} anchorTheme={theme} onClose={() => setMenuOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <button onClick={handleClick} className={className ?? 'mk-pill'} style={style}>{children ?? <><PremiumIcon name="share" size={14} /> Partager</>}</button>
      {menuOpen && <ShareFallbackMenu title={title} text={text} url={url} anchorTheme={theme} onClose={() => setMenuOpen(false)} />}
    </>
  );
}
