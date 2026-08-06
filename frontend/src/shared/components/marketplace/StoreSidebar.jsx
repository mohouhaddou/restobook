import React from 'react';
import './StoreSidebar.css';

function Icon({ name }) {
  const common = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'phone') return <svg {...common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.59 2.6a2 2 0 0 1-.45 2.11L9 10.66a16 16 0 0 0 4.34 4.34l1.23-1.23a2 2 0 0 1 2.11-.45c.83.27 1.7.47 2.6.59A2 2 0 0 1 22 16.92Z" /></svg>;
  if (name === 'map') return <svg {...common}><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z" /><path d="M9 3v15" /><path d="M15 6v15" /></svg>;
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
  if (name === 'cart') return <svg {...common}><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h8.78a2 2 0 0 0 1.95-1.57L21 7H5.12" /></svg>;
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === 'star') return <svg {...common}><path d="m12 3 2.7 5.5 6 .9-4.4 4.3 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.3 6-.9L12 3Z" /></svg>;
  return <svg {...common}><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></svg>;
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function ActionButton({ href, onClick, icon, children, primary = false }) {
  const className = 'store-sidebar-action' + (primary ? ' primary' : '');
  if (href) return <a className={className} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}><Icon name={icon} />{children}</a>;
  return <button type="button" className={className} onClick={onClick}><Icon name={icon} />{children}</button>;
}

export function StoreSidebar({
  store,
  type = 'store',
  theme,
  activeTab,
  onTabChange,
  tabs = [],
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  categories = [],
  activeCategory = '',
  onCategoryChange,
  cartCount = 0,
  cartTotal = 0,
  onCartOpen,
  onPrimaryRequest,
  primaryRequestLabel,
}) {
  if (!store) return null;

  const accent = theme?.primary || 'var(--mk-orange, #ff8a00)';
  const accentDark = theme?.dark || accent;
  const accentLight = theme?.light || 'rgba(255, 138, 0, .1)';
  const address = [store.address, store.district, store.city].filter(Boolean).join(', ');
  const mapHref = store.latitude && store.longitude
    ? 'https://www.google.com/maps/dir/?api=1&destination=' + store.latitude + ',' + store.longitude
    : (address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address) : '');
  const rating = Number(store.avg_rating || store.rating || 0);
  const reviewCount = store.total_reviews || store.reviews_count || 0;
  const productCount = store.product_count || store.products_count || 0;
  const isOpen = store.is_open;
  const delivery = store.accepts_delivery || store.delivery_available;
  const takeaway = store.accepts_takeaway || store.accepts_pickup;
  const dineIn = store.accepts_dine_in;
  const prep = store.avg_prep_time || store.prep_time;
  const categoryLabel = store.cuisine_type || store.business_type || store.type || type;

  return (
    <aside className="store-sidebar" style={{ '--store-accent': accent, '--store-accent-dark': accentDark, '--store-accent-light': accentLight }} aria-label="Informations et filtres du commerce">
      <section className="store-sidebar-card store-sidebar-summary">
        <div className="store-sidebar-head">
          {store.logo_url && <img src={store.logo_url} alt="" />}
          <div>
            <strong>{store.name}</strong>
            <span>{categoryLabel}</span>
          </div>
        </div>
        <div className="store-sidebar-status-row">
          {isOpen !== undefined && <span className={isOpen ? 'is-open' : 'is-closed'}>{isOpen ? 'Ouvert' : 'Fermé'}</span>}
          {rating > 0 && <span><Icon name="star" /> {rating.toFixed(1)}{reviewCount ? ' (' + reviewCount + ')' : ''}</span>}
        </div>
        {address && <p>{address}</p>}
      </section>

      {(store.phone || store.whatsapp || mapHref || primaryRequestLabel) && (
        <section className="store-sidebar-card store-sidebar-actions">
          {primaryRequestLabel && <ActionButton onClick={onPrimaryRequest} icon="search" primary>{primaryRequestLabel}</ActionButton>}
          {store.phone && <ActionButton href={'tel:' + store.phone} icon="phone">Appeler</ActionButton>}
          {store.whatsapp && <ActionButton href={'https://wa.me/' + String(store.whatsapp).replace(/\D/g, '')} icon="phone">WhatsApp</ActionButton>}
          {mapHref && <ActionButton href={mapHref} icon="map">Itinéraire</ActionButton>}
        </section>
      )}

      {tabs.length > 0 && (
        <section className="store-sidebar-card store-sidebar-tabs" aria-label="Navigation du store">
          {tabs.map(tab => (
            <button key={tab} type="button" className={activeTab === tab ? 'is-active' : ''} onClick={() => onTabChange?.(tab)}>{tab}</button>
          ))}
        </section>
      )}

      {onSearchChange && (
        <section className="store-sidebar-card store-sidebar-search">
          <label>Recherche</label>
          <div>
            <Icon name="search" />
            <input value={searchValue} onChange={event => onSearchChange(event.target.value)} placeholder={searchPlaceholder} />
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className="store-sidebar-card store-sidebar-cats">
          <div className="store-sidebar-card-title">Catégories</div>
          <button type="button" className={!activeCategory ? 'is-active' : ''} onClick={() => onCategoryChange?.('')}>Tout</button>
          {categories.slice(0, 10).map(category => {
            const id = String(category.id ?? category.name);
            const count = category.count ?? category.product_count ?? category.items?.length;
            return (
              <button key={id} type="button" className={String(activeCategory) === id ? 'is-active' : ''} onClick={() => onCategoryChange?.(String(activeCategory) === id ? '' : id)}>
                <span>{category.icon || ''} {category.name}</span>
                {hasValue(count) && <em>{count}</em>}
              </button>
            );
          })}
        </section>
      )}

      <section className="store-sidebar-card store-sidebar-meta">
        <div className="store-sidebar-card-title">Services</div>
        <div className="store-sidebar-meta-grid">
          {delivery && <span>Livraison</span>}
          {takeaway && <span>Retrait</span>}
          {dineIn && <span>Sur place</span>}
          {store.is_garde && <span>De garde</span>}
          {prep && <span><Icon name="clock" /> {prep} min</span>}
          {productCount > 0 && <span>{productCount} produits</span>}
        </div>
      </section>

      {onCartOpen && cartCount > 0 && (
        <button type="button" className="store-sidebar-cart" onClick={onCartOpen}>
          <span><Icon name="cart" /> Panier</span>
          <b>{cartCount} · {Number(cartTotal || 0).toFixed(0)} MAD</b>
        </button>
      )}
    </aside>
  );
}

export default StoreSidebar;
