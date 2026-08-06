import React, { useState } from 'react';
import { Check, Link2, Share2 } from 'lucide-react';
import { FacebookIcon, InstagramIcon, WhatsAppIcon, XIcon } from './brandIcons';
import './shareButtons.css';

// Boutons de partage génériques (Facebook/X/WhatsApp/Instagram/copier le
// lien + partage natif) — réutilisés par iFilino Play (jeu, résultat de
// partie, progression joueur) et le Gaming Hub (fiche jeu, article).
// Instagram n'a pas d'intent web officiel : le bouton n'apparaît que si le
// partage natif du navigateur est disponible (mobile), seul chemin réel vers
// Instagram Stories/DM ; sur desktop il est simplement absent plutôt que de
// simuler un partage qui ne fonctionnerait pas.
export default function ShareButtons({ title, text, url, compact = false }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareText = text || title || '';
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  async function handleNativeShare() {
    try { await navigator.share({ title, text: shareText, url: shareUrl }); } catch { /* annulé par l'utilisateur */ }
  }
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* presse-papiers indisponible */ }
  }

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  return (
    <div className={`share-buttons${compact ? ' compact' : ''}`}>
      {canNativeShare && (
        <button type="button" className="share-btn" onClick={handleNativeShare}>
          <Share2 size={15} /> {!compact && 'Partager'}
        </button>
      )}
      <a className="share-btn" href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`} target="_blank" rel="noopener noreferrer" aria-label="Partager sur Facebook">
        <FacebookIcon size={15} /> {!compact && 'Facebook'}
      </a>
      <a className="share-btn" href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Partager sur X">
        <XIcon size={15} /> {!compact && 'X'}
      </a>
      <a className="share-btn" href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Partager sur WhatsApp">
        <WhatsAppIcon size={15} /> {!compact && 'WhatsApp'}
      </a>
      {canNativeShare && (
        <button type="button" className="share-btn" onClick={handleNativeShare} aria-label="Partager sur Instagram">
          <InstagramIcon size={15} /> {!compact && 'Instagram'}
        </button>
      )}
      <button type="button" className={`share-btn${copied ? ' copied' : ''}`} onClick={handleCopy}>
        {copied ? <Check size={15} /> : <Link2 size={15} />} {copied ? 'Copié !' : (!compact ? 'Copier le lien' : '')}
      </button>
    </div>
  );
}
