import React from 'react';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import type { BookItem, BookRelatedProduct } from './types';
import { fadeUp, staggerContainer } from './bookMotion';
import { useKidsRouteLanguage } from '../../../../pages/kids/useKidsRouteLanguage';

export interface BookProductsProps {
  readonly item: BookItem;
}

const TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF', audiobook: 'Audiobook', coloring: 'Coloriage', educational_pack: 'Pack éducatif',
  printable: 'Version imprimable', poster: 'Poster', family_bundle: 'Bundle famille',
};

/** Produits associés — cartes réutilisables (voir BookRelatedProduct) : n'importe quel type de
 * produit futur passe par la même carte, seul le libellé change. */
export function BookProducts({ item }: BookProductsProps) {
  const { t } = useKidsRouteLanguage();
  const products = item.metadata?.relatedProducts || [];
  if (!products.length) return null;

  return (
    <section className="book-section book-products">
      <h2>{t('kids.book.relatedProducts')}</h2>
      <motion.div className="book-products-grid" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={staggerContainer}>
        {products.map((product: BookRelatedProduct, index: number) => (
          <motion.a
            key={`${product.type}-${index}`}
            className="book-product-card"
            variants={fadeUp}
            href={product.url || '#'}
            onClick={e => { if (!product.url) e.preventDefault(); }}
          >
            <span className="book-product-icon" aria-hidden="true"><Package size={22} /></span>
            <span className="book-product-type">{t('kids.digitalProducts.types.' + product.type) || TYPE_LABELS[product.type] || product.type}</span>
            <strong>{product.label}</strong>
            {typeof product.price === 'number' && <span className="book-product-price">{product.price.toFixed(2)} {product.currency ?? 'MAD'}</span>}
          </motion.a>
        ))}
      </motion.div>
    </section>
  );
}
