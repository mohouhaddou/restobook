import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../../api';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from './ProductCardSkeleton';
import { useI18n } from '../../../i18n/config';

/**
 * Grille progressive de ProductCard, avec action "Afficher plus" en bas.
 * Remplace le carrousel horizontal sans modifier les requêtes ni la navigation. Se cache entièrement si la requête ne renvoie aucun résultat
 * (ex: "Promotions" peut être vide si aucun commerce hanout n'a de
 * compare_price défini — pas de section vide avec juste un titre).
 */
export function ProductSection({ title, titleKey, icon, fetchQuery, seeAllHref, onOpenSellers, userPos, radiusKm = '10' }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const INITIAL_VISIBLE = 4;
  const STEP_VISIBLE = 4;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [products, setProducts] = useState(null); // null = chargement

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
    const params = new URLSearchParams({ limit: '10', ...fetchQuery });
    if (userPos) {
      params.set('lat', userPos.lat);
      params.set('lng', userPos.lng);
      params.set('radius_km', radiusKm || '10');
    }
    fetch(API(`/marketplace/search?${params.toString()}`))
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => { setProducts([]); });
  }, [JSON.stringify(fetchQuery), userPos?.lat, userPos?.lng, radiusKm]);

  if (products && products.length === 0) return null; // section vide -> masquée, pas de titre orphelin

  const visibleProducts = products?.slice(0, visibleCount) || [];
  const hasHidden = !!products && visibleCount < products.length;
  const canSeeAll = !!products && !hasHidden && !!seeAllHref;

  function showMore() {
    if (!products) return;
    setVisibleCount(count => Math.min(count + STEP_VISIBLE, products.length));
  }

  function openSeeAll() {
    const url = new URL(seeAllHref, window.location.origin);
    if (userPos) {
      url.searchParams.set('lat', userPos.lat);
      url.searchParams.set('lng', userPos.lng);
      url.searchParams.set('radius_km', radiusKm || '10');
    }
    navigate(url.pathname + url.search);
  }

  return (
    <section className="mk-product-section-grid-block" style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--mk-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <span style={{ fontSize: 20 }}>{icon}</span>}{titleKey ? t(titleKey) : title}
        </h2>
      </div>
      <div className="mk-product-section-grid">
        {products === null
          ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : visibleProducts.map(p => <ProductCard key={p.id} product={p} onOpenSellers={onOpenSellers} />)
        }
      </div>

      {(hasHidden || canSeeAll) && (
        <div className="mk-section-more-row">
          <button type="button" className="mk-section-more-btn" onClick={hasHidden ? showMore : openSeeAll}>
            {hasHidden ? t('marketplace.common.showMore') : t('marketplace.common.seeAll')}
          </button>
        </div>
      )}
    </section>
  );
}
