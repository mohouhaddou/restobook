import React, { useEffect, useRef, useState } from 'react';
import {
  Clock, Loader, RefreshCw, Download, ShoppingCart,
  FileText, Headphones, Palette, Puzzle, GraduationCap, Users, Sparkles, Image as ImageIcon, Package,
} from 'lucide-react';
import { useI18n } from '../../../../i18n/config';
import { useCustomerAuth } from '../../../../shared/context/CustomerAuthContext';
import { API } from '../../../../api';
import { getProductButtonState } from './productState';
import { downloadDigitalProductFile } from './downloadFile';

// type -> icône : seul endroit où le type influence le rendu, un dictionnaire (jamais un
// if/else). Type inconnu = repli sur FileText, jamais une erreur.
const TYPE_ICONS = {
  pdf: FileText,
  audiobook: Headphones,
  coloring: Palette,
  activity_pack: Puzzle,
  teacher_guide: GraduationCap,
  parent_guide: Users,
  stickers: Sparkles,
  wallpapers: ImageIcon,
  bundle: Package,
};
const ACTION_ICONS = { Clock, Loader, RefreshCw, Download, ShoppingCart };

const POLL_MS = 2500;

/**
 * Carte générique pour un produit numérique — jamais de branche par type au-delà du choix
 * d'icône (TYPE_ICONS ci-dessus). Le libellé/l'action du bouton viennent uniquement de
 * productState.js, jamais recalculés ici.
 */
export function DigitalProductCard({ product, onBuy, refresh }) {
  const { t } = useI18n();
  const { token } = useCustomerAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const buttonState = getProductButtonState(product);
  const TypeIcon = TYPE_ICONS[product.type] || FileText;
  const ActionIcon = ACTION_ICONS[buttonState.icon];

  // Poll pendant la génération — s'arrête dès que l'état change (voir generationService.js côté
  // backend : la génération tourne en arrière-plan, ce polling est la seule façon pour le
  // frontend de savoir quand elle se termine).
  useEffect(() => {
    if (buttonState.action !== 'wait') return undefined;
    pollRef.current = setInterval(refresh, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [buttonState.action, refresh]);

  async function handleClick() {
    setError('');
    if (buttonState.action === 'buy') { onBuy(product); return; }
    if (buttonState.action === 'retry') {
      setBusy(true);
      try {
        await fetch(API(`/digital-products/${product.id}/purchase`), {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        });
        refresh();
      } catch { setError(t('kids.digitalProducts.errors.generic')); }
      finally { setBusy(false); }
      return;
    }
    if (buttonState.action === 'download') {
      setBusy(true);
      try { await downloadDigitalProductFile(product.id, token); }
      catch { setError(t('kids.digitalProducts.errors.download')); }
      finally { setBusy(false); }
    }
  }

  return (
    <article className="digital-product-card">
      <div className="digital-product-card-icon"><TypeIcon size={22} aria-hidden="true"/></div>
      <div className="digital-product-card-body">
        <strong>{product.title}</strong>
        {product.description && <p>{product.description}</p>}
        {!buttonState.disabled && buttonState.action === 'buy' && (
          <span className="digital-product-card-price">{Number(product.price).toFixed(2)} {product.currency}</span>
        )}
        {error && <span className="digital-product-card-error">{error}</span>}
      </div>
      <button
        type="button"
        className={`digital-product-card-cta digital-product-card-cta-${buttonState.action}`}
        disabled={buttonState.disabled || busy}
        onClick={handleClick}
      >
        {ActionIcon && <ActionIcon size={16} aria-hidden="true" className={buttonState.action === 'wait' ? 'digital-product-spin' : ''}/>}
        {t(buttonState.labelKey)}
      </button>
    </article>
  );
}
