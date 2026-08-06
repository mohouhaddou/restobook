import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { API } from '../../api';
import { useMkTheme } from '../../shared/hooks/useMkTheme';
import { useInfiniteScroll } from '../../shared/hooks/useInfiniteScroll';
import { ProductCard } from '../../shared/components/marketplace/ProductCard';
import { ProductCardSkeleton } from '../../shared/components/marketplace/ProductCardSkeleton';
import { SellerCompareSheet } from '../../shared/components/marketplace/SellerCompareSheet';
import { PremiumIcon, PremiumIconBadge } from '../../shared/components/ui/PremiumIcon';
import { AdSlot } from '../../shared/components/ads/AdSlot';
import GlobalSearch from './GlobalSearch';
import { useI18n } from '../../i18n/config';

/**
 * Page de résultats dédiée — remplace l'ancien overlay de résultats intégré
 * à MarketplacePage.jsx. Bookmarkable/partageable (l'état vit dans l'URL),
 * avec scroll infini sur les produits (voir useInfiniteScroll.js).
 */
export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [theme] = useMkTheme();
  const { t, formatDistance } = useI18n();

  const q = searchParams.get('q') || '';
  const needCategory = searchParams.get('need_category') || '';
  const sort = searchParams.get('sort') || '';
  const lat = searchParams.get('lat') || '';
  const lng = searchParams.get('lng') || '';
  const radiusKm = searchParams.get('radius_km') || '';

  const [businesses, setBusinesses] = useState([]);
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [compareProduct, setCompareProduct] = useState(null);

  const queryKey = `${q}|${needCategory}|${sort}|${lat}|${lng}|${radiusKm}`;

  const load = useCallback((pageToLoad) => {
    if (!q && !needCategory && !sort) { setProducts([]); setBusinesses([]); setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams({ limit: '20', page: String(pageToLoad) });
    if (q) params.set('q', q);
    if (needCategory) params.set('need_category', needCategory);
    if (sort) params.set('sort', sort);
    if (lat && lng) {
      params.set('lat', lat);
      params.set('lng', lng);
      if (radiusKm) params.set('radius_km', radiusKm);
    }
    fetch(API(`/marketplace/search?${params.toString()}`))
      .then(r => r.json())
      .then(d => {
        setProducts(prev => pageToLoad === 1 ? (d.products || []) : [...prev, ...(d.products || [])]);
        if (pageToLoad === 1) setBusinesses(d.businesses || []);
        setHasMore(!!d.has_more);
        setPage(pageToLoad);
      })
      .catch(() => { if (pageToLoad === 1) { setProducts([]); setBusinesses([]); } })
      .finally(() => setLoading(false));
  }, [q, needCategory, sort, lat, lng, radiusKm]);

  useEffect(() => { load(1); }, [queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const sentinelRef = useInfiniteScroll({
    hasMore, loading,
    onLoadMore: () => load(page + 1),
  });

  const title = q ? t('marketplace.search.resultsFor', { query: q }) : needCategory ? t('marketplace.search.category') : t('marketplace.search.discover');

  return (
    <div className={`mk-wrap mk-${theme}`} style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      <div className="mk-search-results-shell" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 20px 60px' }}>
        <div className="mk-search-results-search" style={{ marginBottom: 24 }}>
          <GlobalSearch userPos={lat && lng ? { lat, lng } : null} radiusKm={radiusKm || '10'} />
        </div>

        <div className="mk-search-results-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--mk-text)' }}>{title}</h1>
            {lat && lng && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--mk-muted)' }}>{t('marketplace.search.radius', { distance: formatDistance(radiusKm || 10) })}</p>}
          </div>
          <button className="mk-search-results-back" onClick={() => navigate('/marketplace')} style={{ background: 'none', border: '1.5px solid var(--mk-border)', borderRadius: 10, padding: '6px 14px', color: 'var(--mk-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            ← {t('common.home')}
          </button>
        </div>

        {businesses.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mk-muted)', textTransform: 'uppercase', marginBottom: 10 }}>{t('marketplace.search.businesses')}</div>
            <div className="mk-scroll mk-search-business-strip" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
              {businesses.slice(0, 10).map(b => (
                <button key={b.id} onClick={() => navigate(`/${b.module === 'hanout' ? 'h' : b.module === 'pharmacie' ? 'ph' : 'r'}/${b.slug}`)}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 20, border: '1px solid var(--mk-border)', background: 'var(--mk-surface)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--mk-text)' }}>
                  <PremiumIcon name="store" size={14} /> {b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mk-muted)', textTransform: 'uppercase', marginBottom: 10 }}>{t('marketplace.search.products')}</div>
        {!loading && products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mk-muted)' }}>
            <PremiumIconBadge name="search" size={28} style={{ margin:'0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t('marketplace.search.noProducts')}</div>
            <div style={{ fontSize: 13 }}>{t('marketplace.search.tryAnother')}</div>
          </div>
        ) : (
          <div className="mk-search-products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 16 }}>
            {products.map((p, i) => (
              <React.Fragment key={p.id}>
                <ProductCard product={p} onOpenSellers={setCompareProduct} />
                {(i + 1) % 8 === 0 && <AdSlot placement="listing_inline" platform="marketplace" />}
              </React.Fragment>
            ))}
            {loading && Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={`sk-${i}`} />)}
          </div>
        )}

        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>

      {compareProduct && <SellerCompareSheet product={compareProduct} onClose={() => setCompareProduct(null)} />}
    </div>
  );
}
