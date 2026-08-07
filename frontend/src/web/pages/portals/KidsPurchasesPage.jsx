import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader } from 'lucide-react';
import { useCustomerAuth } from '../../../shared/context/CustomerAuthContext';
import { API } from '../../../api';
import { PortalBrand } from '../../modules/portals/components/PortalBrand';
import { downloadDigitalProductFile } from '../../modules/portals/digitalProducts/downloadFile';
import { useKidsRouteLanguage } from '../kids/useKidsRouteLanguage';
import { localeForLanguage } from '../kids/i18n';
import '../../modules/portals/portals.css';

const TYPE_FILTERS = ['all', 'pdf', 'audiobook', 'coloring', 'activity_pack'];

/**
 * "Mes achats" — bibliothèque de tous les produits numériques achetés par le lecteur, toutes
 * Stories confondues (voir GET /digital-products/purchases). Filtres par type jamais codés en
 * dur au-delà de la liste TYPE_FILTERS ci-dessus (mêmes valeurs que digitalProducts/config.js
 * côté backend) — un nouveau type de produit n'a qu'à être ajouté à ce tableau pour apparaître ici.
 */
export default function KidsPurchasesPage() {
  const { token } = useCustomerAuth();
  const { language, t } = useKidsRouteLanguage();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(!!token);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    fetch(API('/digital-products/purchases'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setPurchases(d.purchases || []))
      .catch(() => setPurchases([]))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = useMemo(
    () => (filter === 'all' ? purchases : purchases.filter(p => p.type === filter)),
    [purchases, filter]
  );

  async function handleDownload(purchase) {
    setBusyId(purchase.productId); setError('');
    try { await downloadDigitalProductFile(purchase.productId, token); }
    catch { setError(t('kids.digitalProducts.errors.download')); }
    finally { setBusyId(null); }
  }

  if (!token) {
    return (
      <div className="portal portal-kids kids-profile-page">
        <div className="kids-profile-guest">
          <PortalBrand portal="kids"/>
          <h1>{t('kids.profile.guestTitle')}</h1>
          <p>{t('kids.profile.guestSubtitle')}</p>
          <Link to={`/kids/${language}/login`} className="kids-auth-btn">{t('kids.profile.guestCta')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="portal portal-kids kids-profile-page">
      <header className="portal-header">
        <div className="portal-shell portal-header-row">
          <PortalBrand portal="kids"/>
          <Link to={`/kids/${language}/profile`} className="kids-profile-back">{t('portals.back')}</Link>
        </div>
      </header>

      <main className="portal-shell kids-profile-content">
        <h1 className="kids-profile-greeting">{t('kids.purchases.title')}</h1>

        <div className="kids-purchases-filters" role="tablist">
          {TYPE_FILTERS.map(key => (
            <button
              key={key} type="button" role="tab" aria-selected={filter === key}
              className={`kids-purchases-filter${filter === key ? ' active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {t(`kids.purchases.filters.${key}`)}
            </button>
          ))}
        </div>

        {error && <p className="digital-product-card-error">{error}</p>}

        {loading ? (
          <div className="portal-detail-skeleton" aria-busy="true"><span/><span/><span/><span/></div>
        ) : filtered.length === 0 ? (
          <p className="kids-profile-empty">{t('kids.purchases.empty')}</p>
        ) : (
          <div className="kids-purchases-list">
            {filtered.map(purchase => (
              <div key={purchase.purchaseId} className="kids-purchase-row">
                <div className="kids-purchase-row-body">
                  <strong>{purchase.title}</strong>
                  {purchase.storyTitle && purchase.storySlug && (
                    <Link to={`/kids/${language}/book/${purchase.storySlug}`}>{purchase.storyTitle}</Link>
                  )}
                  <span className="kids-purchase-row-meta">
                    {new Date(purchase.purchasedAt).toLocaleDateString(localeForLanguage(language))} · v{purchase.version || 1}
                  </span>
                </div>
                <button
                  type="button"
                  className="kids-auth-btn"
                  disabled={!purchase.downloadReady || busyId === purchase.productId}
                  onClick={() => handleDownload(purchase)}
                >
                  {purchase.downloadReady
                    ? <><Download size={15} aria-hidden="true"/> {t('kids.digitalProducts.actions.download')}</>
                    : <><Loader size={15} aria-hidden="true" className="digital-product-spin"/> {t('kids.digitalProducts.actions.generating')}</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
