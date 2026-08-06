import React from 'react';
import Breadcrumbs from './components/Breadcrumbs';
import StarRating from './components/StarRating';
import OpeningHours from './components/OpeningHours';
import BusinessReviewsSection from './components/BusinessReviewsSection';
import { MagazineArticleGrid } from '../discover/magazine/MagazineArticleCard';

export default function RestaurantSeoView({ restaurant: r }) {
  const menu = r.menu_items || [];
  return (
    <div className="mk-wrap mk-light" style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      {r.cover_url && (
        <div style={{ width: '100%', maxHeight: 320, overflow: 'hidden' }}>
          <img src={r.cover_url} alt={r.name} width={1200} height={320} style={{ width: '100%', height: 320, objectFit: 'cover' }} />
        </div>
      )}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <Breadcrumbs items={[{ name: 'Accueil', path: '/' }, { name: 'Restaurants', path: '/restaurants' }, { name: r.name }]} />

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {r.logo_url && <img src={r.logo_url} alt="" width={64} height={64} style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />}
          <div>
            <h1 style={{ margin: '0 0 4px' }}>{r.name}</h1>
            <p style={{ margin: 0, color: 'var(--mk-muted, #64748B)' }}>
              {r.cuisine_type || r.type}{r.city ? ` — ${r.city}` : ''}{r.district ? `, ${r.district}` : ''}
            </p>
            <div style={{ marginTop: 6 }}><StarRating value={r.avg_rating} count={r.total_reviews} /></div>
          </div>
        </div>

        {r.description && <p style={{ marginTop: 16 }}>{r.description}</p>}

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 16, fontSize: 14 }}>
          {r.address && <p>📍 {r.address}</p>}
          {r.phone && <p>📞 <a href={`tel:${r.phone}`}>{r.phone}</a></p>}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {r.accepts_delivery && <span className="mk-pill active">Livraison{r.delivery_fee != null ? ` — ${Number(r.delivery_fee).toFixed(2)} MAD` : ''}</span>}
          {r.accepts_takeaway && <span className="mk-pill active">À emporter</span>}
          {r.accepts_dine_in && <span className="mk-pill active">Sur place</span>}
        </div>

        {(r.review_business_id || r.business_id || r.id) && <BusinessReviewsSection businessId={r.review_business_id || r.business_id || r.id} />}

        {menu.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2>Menu</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 14 }}>
              {menu.map(mi => (
                <a key={mi.id} href={mi.slug ? `/produits/${mi.slug}` : `/restaurants/${r.slug}`} className="mk-card" style={{ display: 'block', padding: 14, textDecoration: 'none', color: 'inherit' }}>
                  {mi.image_url && <img src={mi.image_url} alt={mi.name} width={200} height={140} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />}
                  <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>{mi.name}</h3>
                  {mi.price != null && <p style={{ margin: 0, fontWeight: 700 }}>{Number(mi.price).toFixed(2)} MAD</p>}
                  {mi.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--mk-muted, #64748B)' }}>{mi.description}</p>}
                </a>
              ))}
            </div>
          </section>
        )}

        {r.opening_hours && (
          <section style={{ marginTop: 32, maxWidth: 320 }}>
            <h2>Horaires</h2>
            <OpeningHours hours={r.opening_hours} />
          </section>
        )}

        {/* Page éditoriale — iFilino Discover (voir plan Discover décision 5) :
            n'affiche rien si vide, jamais de contenu fabriqué. */}
        {r.editorial_story && (
          <section style={{ marginTop: 32 }}>
            <h2>Notre histoire</h2>
            <p>{r.editorial_story}</p>
          </section>
        )}
        {r.editorial_specialties && (
          <section style={{ marginTop: 24 }}>
            <h2>Nos spécialités</h2>
            <p>{r.editorial_specialties}</p>
          </section>
        )}
        {r.related_articles?.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2>À lire sur Discover</h2>
            <MagazineArticleGrid articles={r.related_articles} />
          </section>
        )}
      </main>
    </div>
  );
}
