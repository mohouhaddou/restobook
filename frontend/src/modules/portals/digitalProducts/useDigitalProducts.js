import { useCallback, useEffect, useState } from 'react';
import { useCustomerAuth } from '../../marketplace/CustomerAuthContext';
import { API } from '../../../api';

/**
 * Catalogue des produits numériques d'une Story, avec l'état effectif par visiteur (voir
 * backend/src/modules/digitalProducts/effectiveState.js). Même convention manuelle que
 * KidsProfilePage.jsx (token de useCustomerAuth() envoyé à la main) — un invité voit le
 * catalogue mais purchased vaut toujours false côté serveur.
 */
export function useDigitalProducts(contentId, contentType = "portal") {
  const { token } = useCustomerAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!contentId) { setProducts([]); setLoading(false); return; }
    setLoading(true);
    fetch(API(`/digital-products/content//`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [contentId, contentType, token]);

  useEffect(() => { refresh(); }, [refresh]);

  return { products, loading, refresh };
}
