import React from 'react';
import Breadcrumbs from '../../../shared/seo/components/Breadcrumbs';
import StarRating from '../../../shared/seo/components/StarRating';
import OpeningHours from './components/OpeningHours';
import BusinessReviewsSection from './components/BusinessReviewsSection';
import { MagazineArticleGrid } from '../../../web/pages/discover/magazine/MagazineArticleCard';

const VERTICAL_LABELS = {
  hanout:    { plural: 'Épiceries', urlPrefix: 'epiceries' },
  pharmacie: { plural: 'Pharmacies', urlPrefix: 'pharmacies' },
};

export default function BusinessSeoView({ vertical, business: b }) {
  const v = VERTICAL_LABELS[vertical];
  const products = b.products || [];
  return (
    <div className="mk-wrap mk-light" style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      {b.cover_url && (
        <div style={{ width: '100%', maxHeight: 320, overflow: 'hidden' }}>
          <img src={b.cover_url} alt={b.name} width={1200} height={320} style={{ width: '100%', height: 320, objectFit: 'cover' }} />
        </div>
      )}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <Breadcrumbs items={[{ name: 'Accueil', path: '/' }, { name: v.plural, path: `/${v.urlPrefix}` }, { name: b.name }]} />

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {b.logo_url && <img src={b.logo_url} alt="" width={64} height={64} style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />}
          <div>
            <h1 style={{ margin: '0 0 4px' }}>{b.name}</h1>
            <p style={{ margin: 0, color: 'var(--mk-muted, #64748B)' }}>
              {b.city || ''}{b.district ? `, ${b.district}` : ''}
            </p>
            <div style={{ marginTop: 6 }}><StarRating value={b.avg_rating} count={b.total_reviews} /></div>
          </div>
        </div>

        {b.description && <p style={{ marginTop: 16 }}>{b.description}</p>}

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 16, fontSize: 14 }}>
          {b.address && <p>📍 {b.address}</p>}
          {b.phone && <p>📞 <a href={`tel:${b.phone}`}>{b.phone}</a></p>}
        </div>

        {(b.review_business_id || b.business_id || b.id) && <BusinessReviewsSection businessId={b.review_business_id || b.business_id || b.id} />}

        {products.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2>Produits</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 14 }}>
              {products.map(p => (
                <a key={p.id} href={p.slug ? `/produits/${p.slug}` : `/${v.urlPrefix}/${b.slug}`} className="mk-card" style={{ display: 'block', padding: 14, textDecoration: 'none', color: 'inherit' }}>
                  {p.image_url && <img src={p.image_url} alt={p.name} width={200} height={140} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />}
                  <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>{p.name}</h3>
                  {p.price != null && <p style={{ margin: 0, fontWeight: 700 }}>{Number(p.price).toFixed(2)} MAD</p>}
                  {p.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--mk-muted, #64748B)' }}>{p.description}</p>}
                </a>
              ))}
            </div>
          </section>
        )}

        {b.opening_hours && (
          <section style={{ marginTop: 32, maxWidth: 320 }}>
            <h2>Horaires</h2>
            <OpeningHours hours={b.opening_hours} />
          </section>
        )}

        {b.editorial_story && (
          <section style={{ marginTop: 32 }}>
            <h2>Notre histoire</h2>
            <p>{b.editorial_story}</p>
          </section>
        )}
        {b.editorial_specialties && (
          <section style={{ marginTop: 24 }}>
            <h2>Nos spécialités</h2>
            <p>{b.editorial_specialties}</p>
          </section>
        )}
        {b.related_articles?.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2>À lire sur Discover</h2>
            <MagazineArticleGrid articles={b.related_articles} />
          </section>
        )}
      </main>
    </div>
  );
}
