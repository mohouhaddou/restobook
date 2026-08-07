import React, { useEffect, useId, useMemo, useState } from 'react';
import { CATEGORIES, getTypeConfig } from '../../config/businessConfig';
import { useI18n } from '../../../i18n/config';
import { translateBusinessType } from '../../../i18n/status';
import './MarketplaceSidebar.css';

const OPEN_STORAGE_KEY = 'mk-explorer-open-sections';
const SEARCH_STORAGE_KEY = 'mk-explorer-search-history';

const DEFAULT_OPEN = ['search', 'discover', 'filters'];
const COMMERCE_DISCOVERY_LIMIT = 8;

const COLLECTIONS = [
  { key: 'barbecue', label: 'Barbecue', query: 'barbecue' },
  { key: 'breakfast', label: 'Petit déjeuner', query: 'petit déjeuner' },
  { key: 'ramadan', label: 'Ramadan', query: 'ramadan' },
  { key: 'aid', label: 'Aid', query: 'aid' },
  { key: 'summer', label: 'Ete', query: 'ete' },
  { key: 'winter', label: 'Hiver', query: 'hiver' },
  { key: 'healthy', label: 'Healthy', query: 'healthy' },
  { key: 'promo', label: 'Promotion', filter: { sort: 'promo' } },
  { key: 'new', label: 'Nouveautes', filter: { sort: 'new' } },
  { key: 'best', label: 'Les plus vendus', filter: { sort: 'popular' } },
  { key: 'trends', label: 'Tendances', filter: { sort: 'featured' } },
];

const PROMOTIONS = [
  { key: 'flash', label: 'Flash Deals', filter: { sort: 'promo' } },
  { key: 'free_delivery', label: 'Livraison gratuite', filter: { delivery: 'true' } },
  { key: 'new_products', label: 'Nouveaux produits', filter: { sort: 'new' } },
  { key: 'popular', label: 'Produits populaires', filter: { sort: 'popular' } },
  { key: 'today', label: 'Promotions du jour', filter: { sort: 'promo' } },
];

const DIETS = [
  ['halal', 'Halal'],
  ['bio', 'Bio'],
  ['vegan', 'Vegan'],
  ['gluten_free', 'Sans gluten'],
  ['lactose_free', 'Sans lactose'],
  ['sugar_free', 'Sans sucre'],
];

const DELIVERY_FILTERS = [
  ['delivery', 'Livraison gratuite'],
  ['fast_delivery', 'Livraison rapide (<20 min)'],
  ['express_delivery', 'Livraison express'],
  ['takeaway', 'Retrait sur place'],
  ['available_today', "Disponible aujourd'hui"],
];

const AVAILABILITY_FILTERS = [
  ['in_stock', 'En stock'],
  ['preorder', 'Precommande'],
  ['limited_stock', 'Stock limite'],
  ['available_now', 'Disponible maintenant'],
];

const HOURS_FILTERS = [
  ['open_now', 'Ouvert maintenant'],
  ['open_24h', 'Ouvert 24h/24'],
  ['opening_soon', 'Ouverture prochaine'],
];

const SORTS = [
  ['featured', 'Les plus pertinents'],
  ['distance', 'Les plus proches'],
  ['rating', 'Les mieux notes'],
  ['price_asc', 'Prix croissant'],
  ['price_desc', 'Prix decroissant'],
  ['new', 'Nouveautes'],
  ['popular', 'Les plus vendus'],
  ['delivery_time', 'Temps de livraison'],
];

const DISTANCES = [
  ['1', 'moins de 1 km'],
  ['3', 'moins de 3 km'],
  ['5', 'moins de 5 km'],
  ['10', 'moins de 10 km'],
  ['custom', 'Personnalise'],
];

const POPULAR_SEARCHES = ['couscous', 'pharmacy_guard', 'butcher', 'breakfast', 'fast_delivery'];

const DISCOVERY_CATEGORIES = [
  { key: "restaurant", label: "Restaurants", type: "restaurant", color: "#F97316" },
  { key: "epicerie", label: "Epiceries", type: "epicerie", color: "#10B981" },
  { key: "supermarche", label: "Supermarches", type: "supermarche", color: "#2563EB" },
  { key: "boucherie", label: "Boucheries", type: "boucherie", color: "#DC2626" },
  { key: "boulangerie", label: "Boulangeries", type: "boulangerie", color: "#D97706" },
  { key: "patisserie", label: "Patisseries", type: "patisserie", color: "#EC4899" },
  { key: "cafe", label: "Cafes", type: "cafe", color: "#0369A1" },
  { key: "pharmacie", label: "Pharmacies", type: "pharmacie", color: "#16A34A" },
  { key: "parapharmacie", label: "Parapharmacies", type: "parapharmacie", color: "#22C55E" },
  { key: "poissonnerie", label: "Poissonneries", query: "poissonnerie", color: "#0891B2" },
  { key: "primeur", label: "Fruits & legumes", type: "primeur", color: "#65A30D" },
  { key: "beauty", label: "Beaute", query: "beaute", color: "#DB2777" },
  { key: "home", label: "Maison", query: "maison", color: "#64748B" },
  { key: "electronics", label: "Electronique", query: "electronique", color: "#4F46E5" },
  { key: "services", label: "Services", query: "services", color: "#0F766E" },
];

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
  if (name === 'x') return <svg {...common}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>;
  if (name === 'chevron') return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
  if (name === 'filter') return <svg {...common}><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></svg>;
  if (name === 'map') return <svg {...common}><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z" /><path d="M9 3v15" /><path d="M15 6v15" /></svg>;
  if (name === 'star') return <svg {...common}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>;
  if (name === 'truck') return <svg {...common}><path d="M3 7h11v10H3z" /><path d="M14 10h4l3 3v4h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>;
  return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="5" /><path d="M8 12h8" /><path d="M12 8v8" /></svg>;
}

function CategoryIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10h16" />
      <path d="M6 10l1.2 9h9.6L18 10" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
    </svg>
  );
}

function readStoredOpen() {
  try {
    const value = JSON.parse(localStorage.getItem(OPEN_STORAGE_KEY) || 'null');
    return Array.isArray(value) && value.length ? value : DEFAULT_OPEN;
  } catch {
    return DEFAULT_OPEN;
  }
}

function readSearchHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(SEARCH_STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveSearch(term) {
  const clean = term.trim();
  if (!clean) return [];
  const next = [clean, ...readSearchHistory().filter(item => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
  localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function Accordion({ id, title, icon, open, onToggle, children }) {
  const panelId = `${id}-panel`;
  return (
    <section className="mk-explorer-section">
      <button className="mk-explorer-accordion" type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        {icon}
        <strong>{title}</strong>
        <span><Icon name="chevron" size={16} /></span>
      </button>
      {open && <div id={panelId} className="mk-explorer-section-body">{children}</div>}
    </section>
  );
}

function CheckChip({ active, children, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`mk-explorer-chip${active ? ' is-active' : ''}`}>
      {children}
    </button>
  );
}

function CheckRow({ active, children, onChange }) {
  return (
    <label className={`mk-explorer-check${active ? ' is-active' : ''}`}>
      <input type="checkbox" checked={active} onChange={e => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function MapCard({ business, t }) {
  return (
    <div className="mk-explorer-map-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span className="mk-explorer-cat-icon" style={{ '--cat-color': 'var(--mk-orange)' }}><Icon name="map" /></span>
        <div>
          <b style={{ display: 'block', fontSize: 13 }}>{t('marketplace.sidebar.map')}</b>
          <span style={{ display: 'block', color: 'var(--mk-muted)', fontSize: 11 }}>
            {business?.distance || t('marketplace.sidebar.distance_zone')}
          </span>
        </div>
      </div>
      <div style={{ color: 'var(--mk-muted)', fontSize: 12, lineHeight: 1.45 }}>
        {t('marketplace.sidebar.map_description')}
      </div>
    </div>
  );
}

export function MarketplaceSidebar({
  mode = 'marketplace',
  variant = 'sidebar',
  open = false,
  onClose,
  filters = {},
  onChange,
  query = '',
  onQueryChange,
  district = '',
  onDistrict,
  activeCategory = '',
  onCategoryChange,
  typeCounts = {},
  catCounts = {},
  total = 0,
  business = null,
  product = null,
}) {
  const instanceId = useId();
  const { t } = useI18n();
  const [openSections, setOpenSections] = useState(readStoredOpen);
  const [searchText, setSearchText] = useState(query || '');
  const [searchHistory, setSearchHistory] = useState(readSearchHistory);
  const [brandSearch, setBrandSearch] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => setSearchText(query || ''), [query]);

  useEffect(() => {
    localStorage.setItem(OPEN_STORAGE_KEY, JSON.stringify(openSections));
  }, [openSections]);

  useEffect(() => {
    if (!open || variant === 'sidebar') return undefined;
    const onKey = event => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, variant, onClose]);

  const labelCollection = item => t(`marketplace.sidebar.collection.${item.key}`);
  const labelPromotion = item => t(`marketplace.sidebar.promotion.${item.key}`);
  const labelPopular = key => t(`marketplace.sidebar.popular.${key}`);
  const labelDiscovery = item => item.type ? translateBusinessType(t, item.type, item.label) : t(`marketplace.sidebar.discovery.${item.key}`);

  const suggestions = useMemo(() => {
    const typed = searchText.trim().toLowerCase();
    const base = [
      ...CATEGORIES.flatMap(cat => cat.types.map(type => ({ label: translateBusinessType(t, type.id, type.label), type: 'categorie', typeLabel: t('marketplace.sidebar.suggestion_category'), filter: { type: type.id } }))),
      ...COLLECTIONS.map(item => ({ label: labelCollection(item), type: 'collection', typeLabel: t('marketplace.sidebar.suggestion_collection'), query: item.query, filter: item.filter })),
      ...POPULAR_SEARCHES.map(key => ({ label: labelPopular(key), type: 'populaire', typeLabel: t('marketplace.sidebar.suggestion_popular'), query: labelPopular(key) })),
    ];
    if (!typed) return [];
    return base.filter(item => item.label.toLowerCase().includes(typed)).slice(0, 6);
  }, [searchText, t]);

  const allTypes = useMemo(() => CATEGORIES.flatMap(cat => cat.types.map(t => ({ ...t, category: cat }))), []);
  const activeCount = [
    filters.type,
    filters.min_rating,
    filters.delivery,
    filters.open_now,
    filters.open_24h,
    filters.takeaway,
    filters.guard,
    filters.priceMin,
    filters.priceMax,
    district,
    activeCategory,
  ].filter(Boolean).length;

  function toggleSection(key) {
    setOpenSections(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]);
  }

  function isOpen(key) {
    return openSections.includes(key);
  }

  function setFilter(key, value) {
    onChange?.(key, value);
  }

  function toggleBoolean(key, checked) {
    setFilter(key, checked ? 'true' : '');
  }

  function submitSearch(term = searchText) {
    const clean = term.trim();
    onQueryChange?.(clean);
    setSearchText(clean);
    if (clean) setSearchHistory(saveSearch(clean));
  }

  function applySuggestion(item) {
    if (item.filter) {
      Object.entries(item.filter).forEach(([key, value]) => setFilter(key, value));
    }
    if (item.query || !item.filter) submitSearch(item.query || item.label);
    else if (item.filter?.type) submitSearch('');
  }

  function applyFilterGroup(group) {
    Object.entries(group).forEach(([key, value]) => setFilter(key, value));
  }

  function resetAll() {
    onChange?.('__reset');
    onQueryChange?.('');
    setSearchText('');
    setBrandSearch('');
  }

  const filteredBrands = ['Coca-Cola', 'Jaouda', 'Danone', 'Aiguebelle', 'Lesieur', 'Sidi Ali', 'Bimo', 'Marjane']
    .filter(brand => brand.toLowerCase().includes(brandSearch.trim().toLowerCase()))
    .slice(0, 6);
  const primaryDiscovery = DISCOVERY_CATEGORIES.slice(0, COMMERCE_DISCOVERY_LIMIT);
  const secondaryDiscovery = DISCOVERY_CATEGORIES.slice(COMMERCE_DISCOVERY_LIMIT);

  const panel = (
    <div className="mk-explorer-panel">
      <header className="mk-explorer-header">
        <div>
          <p className="mk-explorer-kicker">{t('marketplace.sidebar.kicker')}</p>
          <h2 className="mk-explorer-title">{mode === 'marketplace' ? t('marketplace.sidebar.explorer') : mode === 'business' ? t('marketplace.sidebar.business') : t('marketplace.sidebar.choice_help')}</h2>
          <p className="mk-explorer-subtitle">
            {mode === 'marketplace'
              ? t('marketplace.sidebar.available_results', { count: total || 0 })
              : mode === 'business'
                ? t('marketplace.sidebar.business_subtitle')
                : t('marketplace.sidebar.product_subtitle')}
          </p>
        </div>
        {variant !== 'sidebar' && (
          <button className="mk-explorer-icon-btn" type="button" onClick={onClose} aria-label={t('marketplace.sidebar.close_filters')}>
            <Icon name="x" />
          </button>
        )}
      </header>

      {mode === 'marketplace' && (
        <>
          <div className="mk-explorer-search">
            <label htmlFor={`${instanceId}-search`}>{t('marketplace.sidebar.instant_search')}</label>
            <div className="mk-explorer-searchbox">
              <Icon name="search" />
              <input
                id={`${instanceId}-search`}
                value={searchText}
                onChange={event => setSearchText(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') submitSearch();
                  if (event.key === 'Escape') setSearchText('');
                }}
                placeholder={t('marketplace.sidebar.search_placeholder')}
              />
              {searchText && (
                <button type="button" onClick={() => { setSearchText(''); onQueryChange?.(''); }} aria-label={t('marketplace.sidebar.clear_search')}>
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
            {suggestions.length > 0 && (
              <div className="mk-explorer-suggestions">
                {suggestions.map(item => (
                  <button key={`${item.type}-${item.label}`} type="button" className="mk-explorer-suggestion" onClick={() => applySuggestion(item)}>
                    <Icon name={item.type === 'categorie' ? 'filter' : 'search'} size={16} />
                    <span>{item.label}</span>
                    <small>{item.typeLabel || item.type}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mk-explorer-quick" aria-label={t('marketplace.sidebar.quick_searches')}>
            {(searchHistory.length ? searchHistory : POPULAR_SEARCHES.map(labelPopular)).slice(0, 5).map(term => (
              <CheckChip key={term} active={query === term} onClick={() => submitSearch(term)}>{term}</CheckChip>
            ))}
          </div>
        </>
      )}

      {mode === 'business' && (
        <>
          <div className="mk-explorer-business-card">
            <div className="mk-explorer-business-top">
              {business?.logo && <img className="mk-explorer-business-logo" src={business.logo} alt="" />}
              <div>
                <b style={{ display: 'block', fontSize: 14 }}>{business?.name || t('marketplace.sidebar.business_fallback')}</b>
                <span style={{ display: 'block', color: 'var(--mk-muted)', fontSize: 12 }}>{business?.rating || '4.8'} / 5 · {business?.hours || t('marketplace.sidebar.default_hours')}</span>
              </div>
            </div>
            <div className="mk-explorer-grid" style={{ marginTop: 10 }}>
              <span className="mk-explorer-pill is-active">{business?.deliveryTime || '25 min'}</span>
              <span className="mk-explorer-pill">{business?.deliveryFee || t('marketplace.sidebar.default_delivery_fee')}</span>
              <span className="mk-explorer-pill">{business?.distance || '2.4 km'}</span>
            </div>
          </div>
          <MapCard business={business} t={t} />
        </>
      )}

      {mode === 'product' && (
        <div className="mk-explorer-business-card">
          <b style={{ display: 'block', fontSize: 14 }}>{product?.name || t('marketplace.sidebar.product_fallback')}</b>
          <div className="mk-explorer-grid" style={{ marginTop: 10 }}>
            <span className="mk-explorer-pill is-active">{product?.price || t('marketplace.sidebar.price_available')}</span>
            <span className="mk-explorer-pill">{product?.stock || t('marketplace.product.in_stock')}</span>
            <span className="mk-explorer-pill">{product?.eta || t('marketplace.sidebar.estimated_delivery')}</span>
          </div>
        </div>
      )}

      {mode === 'marketplace' && (
        <Accordion id={`${instanceId}-discover`} title={t('marketplace.sidebar.discover')} icon={<Icon name="filter" />} open={isOpen('discover')} onToggle={() => toggleSection('discover')}>
          {primaryDiscovery.map(item => {
            const typeConfig = item.type ? getTypeConfig(item.type) : null;
            const count = item.type ? (typeCounts[item.type] || 0) : 0;
            const products = Math.max(count * 8, item.query ? 24 : 0);
            const active = item.type ? filters.type === item.type : query === item.query;
            return (
              <button
                key={item.key}
                type="button"
                className={`mk-explorer-category${active ? " is-active" : ""}`}
                style={{ "--cat-color": item.color || typeConfig?.color || "var(--mk-orange)" }}
                onClick={() => {
                  if (item.type) setFilter("type", filters.type === item.type ? "" : item.type);
                  if (item.query) submitSearch(item.query);
                }}
              >
                <span className="mk-explorer-cat-icon"><CategoryIcon /></span>
                <span>
                  <b>{labelDiscovery(item)}</b>
                  <em>{t('marketplace.sidebar.commerce_product_count', { count, products })}</em>
                </span>
                <span className="mk-explorer-count">{count}</span>
              </button>
            );
          })}
        </Accordion>
      )}

      {mode === 'marketplace' && (
        <button
          type="button"
          className="mk-explorer-advanced-toggle"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced(value => !value)}
        >
          <span>
            <b>{showAdvanced ? t("marketplace.sidebar.less_filters") : t("marketplace.sidebar.more_filters")}</b>
            <small>{t("marketplace.sidebar.more_filters_hint")}</small>
          </span>
          <Icon name="chevron" size={16} />
        </button>
      )}

      {mode === 'marketplace' && showAdvanced && secondaryDiscovery.length > 0 && (
        <Accordion id={`${instanceId}-more-discover`} title={t("marketplace.sidebar.more_categories")} icon={<Icon name="filter" />} open={isOpen("more-discover")} onToggle={() => toggleSection("more-discover")}>
          {secondaryDiscovery.map(item => {
            const typeConfig = item.type ? getTypeConfig(item.type) : null;
            const count = item.type ? (typeCounts[item.type] || 0) : 0;
            const products = Math.max(count * 8, item.query ? 24 : 0);
            const active = item.type ? filters.type === item.type : query === item.query;
            return (
              <button
                key={item.key}
                type="button"
                className={`mk-explorer-category${active ? " is-active" : ""}`}
                style={{ "--cat-color": item.color || typeConfig?.color || "var(--mk-orange)" }}
                onClick={() => {
                  if (item.type) setFilter("type", filters.type === item.type ? "" : item.type);
                  if (item.query) submitSearch(item.query);
                }}
              >
                <span className="mk-explorer-cat-icon"><CategoryIcon /></span>
                <span>
                  <b>{labelDiscovery(item)}</b>
                  <em>{t("marketplace.sidebar.commerce_product_count", { count, products })}</em>
                </span>
                <span className="mk-explorer-count">{count}</span>
              </button>
            );
          })}
        </Accordion>
      )}
      {mode === 'marketplace' && showAdvanced && (
        <Accordion id={`${instanceId}-collections`} title={t('marketplace.sidebar.collections')} icon={<Icon name="star" />} open={isOpen('collections')} onToggle={() => toggleSection('collections')}>
          <div className="mk-explorer-grid">
            {COLLECTIONS.map(item => (
              <CheckChip key={item.key} active={filters.sort === item.filter?.sort || query === item.query} onClick={() => applySuggestion({ ...item, type: 'collection', label: labelCollection(item) })}>
                {labelCollection(item)}
              </CheckChip>
            ))}
          </div>
        </Accordion>
      )}

      {mode === 'marketplace' && showAdvanced && (
        <Accordion id={`${instanceId}-promotions`} title={t('marketplace.sidebar.promotions')} icon={<Icon name="truck" />} open={isOpen('promotions')} onToggle={() => toggleSection('promotions')}>
          <div className="mk-explorer-grid">
            {PROMOTIONS.map(item => (
              <CheckChip key={item.key} active={Object.entries(item.filter).some(([key, value]) => filters[key] === value)} onClick={() => applyFilterGroup(item.filter)}>
                {labelPromotion(item)}
              </CheckChip>
            ))}
          </div>
        </Accordion>
      )}

      {mode !== 'product' && (
        <Accordion id={`${instanceId}-filters`} title={t('marketplace.common.filters')} icon={<Icon name="filter" />} open={isOpen('filters')} onToggle={() => toggleSection('filters')}>
          {showAdvanced && (
          <div>
            <span className="mk-explorer-field-label">{t('marketplace.sidebar.price')}</span>
            <div className="mk-explorer-range">
              <div className="mk-explorer-range-row">
                <input inputMode="numeric" aria-label={t('marketplace.sidebar.price_min')} value={filters.priceMin || ''} onChange={event => setFilter('priceMin', event.target.value)} placeholder="0 MAD" />
                <input inputMode="numeric" aria-label={t('marketplace.sidebar.price_max')} value={filters.priceMax || ''} onChange={event => setFilter('priceMax', event.target.value)} placeholder="500 MAD" />
              </div>
              <div style={{ color: 'var(--mk-muted)', fontSize: 11 }}>
                {(filters.priceMin || 0)} MAD - {(filters.priceMax || 500)} MAD
              </div>
            </div>
          </div>
          )}

          <div>
            <span className="mk-explorer-field-label">{t('marketplace.sidebar.distance')}</span>
            <div className="mk-explorer-grid">
              {DISTANCES.map(([value]) => (
                <CheckChip key={value} active={(filters.radius_km || '10') === value} onClick={() => setFilter('radius_km', value === 'custom' ? (filters.radius_km || '10') : value)}>
                  {t(`marketplace.sidebar.distance_filter.${value}`)}
                </CheckChip>
              ))}
            </div>
          </div>

          <div>
            <label className="mk-explorer-field-label" htmlFor={`${instanceId}-district`}>{t('marketplace.filters.district')}</label>
            <input id={`${instanceId}-district`} className="mk-explorer-input" value={district} onChange={event => onDistrict?.(event.target.value)} placeholder={t('marketplace.filters.district_placeholder')} />
          </div>

          <div>
            <span className="mk-explorer-field-label">{t('marketplace.sidebar.delivery')}</span>
            {(showAdvanced ? DELIVERY_FILTERS : DELIVERY_FILTERS.slice(0, 3)).map(([key]) => (
              <CheckRow key={key} active={filters[key] === 'true'} onChange={checked => toggleBoolean(key, checked)}>{t(`marketplace.sidebar.delivery_filter.${key}`)}</CheckRow>
            ))}
          </div>

          {showAdvanced && (
          <div>
            <span className="mk-explorer-field-label">{t('marketplace.sidebar.availability')}</span>
            {AVAILABILITY_FILTERS.map(([key]) => (
              <CheckRow key={key} active={filters[key] === 'true'} onChange={checked => toggleBoolean(key, checked)}>{t(`marketplace.sidebar.availability_filter.${key}`)}</CheckRow>
            ))}
          </div>

          )}

          <div>
            <span className="mk-explorer-field-label">{t('marketplace.sidebar.hours')}</span>
            {(showAdvanced ? HOURS_FILTERS : HOURS_FILTERS.slice(0, 1)).map(([key]) => (
              <CheckRow key={key} active={filters[key] === 'true'} onChange={checked => toggleBoolean(key, checked)}>{t(`marketplace.sidebar.hours_filter.${key}`)}</CheckRow>
            ))}
          </div>

          <div>
            <span className="mk-explorer-field-label">{t('marketplace.sidebar.ratings')}</span>
            <div className="mk-explorer-grid">
              {['4', '4.5', '5'].map(value => (
                <CheckChip key={value} active={filters.min_rating === value} onClick={() => setFilter('min_rating', filters.min_rating === value ? '' : value)}>
                  {value}+
                </CheckChip>
              ))}
            </div>
          </div>

          {showAdvanced && (
          <>
          <div>
            <label className="mk-explorer-field-label" htmlFor={`${instanceId}-brand`}>{t('marketplace.sidebar.brands')}</label>
            <input id={`${instanceId}-brand`} className="mk-explorer-input" value={brandSearch} onChange={event => setBrandSearch(event.target.value)} placeholder={t('marketplace.sidebar.brand_placeholder')} />
            <div className="mk-explorer-grid" style={{ marginTop: 8 }}>
              {filteredBrands.map(brand => (
                <CheckChip key={brand} active={filters.brand === brand} onClick={() => setFilter('brand', filters.brand === brand ? '' : brand)}>
                  {brand} · {Math.floor(8 + brand.length * 3)}
                </CheckChip>
              ))}
            </div>
          </div>

          <div>
            <span className="mk-explorer-field-label">{t('marketplace.sidebar.diets')}</span>
            <div className="mk-explorer-grid">
              {DIETS.map(([key]) => (
                <CheckChip key={key} active={filters[key] === 'true'} onClick={() => toggleBoolean(key, filters[key] !== 'true')}>{t(`marketplace.sidebar.diet.${key}`)}</CheckChip>
              ))}
            </div>
          </div>

          <div>
            <span className="mk-explorer-field-label">{t('marketplace.sidebar.business_type')}</span>
            <div className="mk-explorer-grid">
              <CheckChip active={!filters.type} onClick={() => setFilter('type', '')}>{t('marketplace.common.all')}</CheckChip>
              {allTypes.map(type => {
                const count = typeCounts[type.id] || 0;
                return (
                  <CheckChip key={`${type.category.id}-${type.id}`} active={filters.type === type.id} onClick={() => setFilter('type', filters.type === type.id ? '' : type.id)}>
                    {translateBusinessType(t, type.id, type.label)} · {count}
                  </CheckChip>
                );
              })}
            </div>
          </div>
          </>
          )}

          <div>
            <label className="mk-explorer-field-label" htmlFor={`-sort`}>{t('marketplace.filters.sort')}</label>
            <select id={`${instanceId}-sort`} className="mk-explorer-select" value={filters.sort || 'featured'} onChange={event => setFilter('sort', event.target.value)}>
              {SORTS.map(([value]) => <option key={value} value={value}>{t(`marketplace.sidebar.sort.${value}`)}</option>)}
            </select>
          </div>
        </Accordion>
      )}

      {mode === 'marketplace' && showAdvanced && (
        <Accordion id={`${instanceId}-personal`} title={t('marketplace.sidebar.personal')} icon={<Icon name="star" />} open={isOpen('personal')} onToggle={() => toggleSection('personal')}>
          <div className="mk-explorer-grid">
            {['recent_products', 'favorite_products', 'favorite_businesses', 'last_searches', 'popular_nearby', 'new_nearby'].map(key => {
              const label = t(`marketplace.sidebar.personal.${key}`);
              return <CheckChip key={key} active={false} onClick={() => submitSearch(label)}>{label}</CheckChip>;
            })}
          </div>
        </Accordion>
      )}

      {mode === 'business' && (
        <>
          <Accordion id={`${instanceId}-business-cats`} title={t('marketplace.sidebar.internal_categories')} icon={<Icon name="filter" />} open={isOpen('business-cats')} onToggle={() => toggleSection('business-cats')}>
            <div className="mk-explorer-grid">
              {['meat', 'chicken', 'drinks', 'desserts', 'starters', 'promotions'].map((key, index) => {
                const label = t(`marketplace.sidebar.internal.${key}`);
                return <CheckChip key={key} active={false} onClick={() => submitSearch(label)}>{label} · {12 - index}</CheckChip>;
              })}
            </div>
          </Accordion>
          <Accordion id={`${instanceId}-services`} title={t('marketplace.sidebar.services_offered')} icon={<Icon name="truck" />} open={isOpen('services')} onToggle={() => toggleSection('services')}>
            {['delivery', 'pickup', 'cash', 'card', 'ifilino_pay', 'loyalty'].map(key => (
              <CheckRow key={key} active onChange={() => {}}>{t(`marketplace.sidebar.service.${key}`)}</CheckRow>
            ))}
          </Accordion>
        </>
      )}

      {mode === 'product' && (
        <>
          <Accordion id={`${instanceId}-product-info`} title={t('marketplace.sidebar.information')} icon={<Icon name="filter" />} open={isOpen('product-info')} onToggle={() => toggleSection('product-info')}>
            {['availability', 'delivery', 'eta', 'stock', 'category', 'brand', 'origin', 'nutrition', 'allergens'].map(key => (
              <div key={key} className="mk-explorer-check"><span>{t(`marketplace.sidebar.product_info.${key}`)}</span></div>
            ))}
          </Accordion>
          <Accordion id={`${instanceId}-product-more`} title={t('marketplace.sidebar.more')} icon={<Icon name="star" />} open={isOpen('product-more')} onToggle={() => toggleSection('product-more')}>
            <div className="mk-explorer-grid">
              {['complements', 'frequently_bought', 'same_business', 'similar'].map(key => {
                const label = t(`marketplace.sidebar.product_more.${key}`);
                return <CheckChip key={key} active={false} onClick={() => submitSearch(label)}>{label}</CheckChip>;
              })}
            </div>
          </Accordion>
        </>
      )}

      <div className="mk-explorer-actions">
        <button type="button" className="mk-explorer-action" onClick={resetAll}>
          {t('marketplace.sidebar.reset')}
        </button>
        <button type="button" className="mk-explorer-action primary" onClick={onClose}>
          {activeCount ? t('marketplace.sidebar.view_results_count', { count: activeCount }) : t('marketplace.sidebar.view_results')}
        </button>
      </div>
    </div>
  );

  if (variant !== 'sidebar') {
    if (!open) return null;
    return (
      <>
        <div className="mk-explorer-backdrop" onClick={onClose} />
        <aside className="mk-explorer-drawer mk-explorer-surface" aria-label={t('marketplace.sidebar.filters_aria')}>
          {panel}
        </aside>
      </>
    );
  }

  return (
    <aside className="mk-explorer-sidebar mk-explorer-surface" aria-label={t('marketplace.sidebar.explorer_aria')}>
      {panel}
    </aside>
  );
}

export default MarketplaceSidebar;
