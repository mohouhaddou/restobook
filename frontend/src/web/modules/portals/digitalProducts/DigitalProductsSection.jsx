import React, { useState } from 'react';
import { useI18n } from '../../../../i18n/config';
import { useDigitalProducts } from './useDigitalProducts';
import { DigitalProductCard } from './DigitalProductCard';
import { PurchaseModal } from './PurchaseModal';

/**
 * Remplace BookDownloads/BookAudio/BookColoring/BookActivities.tsx : une seule section générique
 * listant tous les DigitalProduct d'une Story, quel que soit leur type — jamais un composant par
 * type (voir le cahier des charges, section "architecture générique"). Rien n'est affiché tant
 * qu'aucun produit n'existe pour cette Story (les histoires déjà publiées sans DigitalProduct ne
 * doivent pas montrer une section vide).
 */
export function DigitalProductsSection({ portalContentId, studyLessonId }) {
  const { t } = useI18n();
  const { products, loading, refresh } = useDigitalProducts(studyLessonId || portalContentId, studyLessonId ? 'lesson' : 'portal');
  const [purchaseTarget, setPurchaseTarget] = useState(null);

  if (loading || products.length === 0) return null;

  return (
    <section className="book-section digital-products-section">
      <h2>{t('kids.digitalProducts.sectionTitle')}</h2>
      <div className="digital-products-grid">
        {products.map(product => (
          <DigitalProductCard key={product.id} product={product} onBuy={setPurchaseTarget} refresh={refresh}/>
        ))}
      </div>
      <PurchaseModal product={purchaseTarget} onClose={() => setPurchaseTarget(null)} onPurchased={refresh}/>
    </section>
  );
}
