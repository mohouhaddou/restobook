import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { PERMISSIONS } from '../../../auth/permissions';
import { BrandLogo } from '../brand/BrandLogo';
import { BRAND } from '../../../config/branding';
import { useI18n } from '../../../i18n/config';

const CANTEEN_TYPES    = ['canteen'];
const RESTAURANT_TYPES = ['restaurant', 'snack', 'dark_kitchen', 'bakery', 'cafe'];
const HANOUT_BIZ_TYPE   = 'hanout';
const PHARMACY_BIZ_TYPE = 'pharmacie';

const SIDEBAR_I18N = {
  'Mon espace': 'sidebar.sections.mySpace',
  'Gestion Cantine': 'sidebar.sections.canteenManagement',
  'Analytique Cantine': 'sidebar.sections.canteenAnalytics',
  'Gestion Restaurant': 'sidebar.sections.restaurantManagement',
  'Analytique Restaurant': 'sidebar.sections.restaurantAnalytics',
  'Espace Livreur': 'sidebar.sections.deliverySpace',
  'Fidélité': 'sidebar.sections.loyalty',
  'Commerce de proximité': 'sidebar.sections.localCommerce',
  'POS / Caisse': 'sidebar.sections.pos',
  'Gestion Pharmacie': 'sidebar.sections.pharmacyManagement',
  'Administration': 'sidebar.sections.administration',
  'Infrastructure': 'sidebar.sections.infrastructure',
  'Marketplace': 'sidebar.sections.marketplace',
  'Administration Web': 'sidebar.sections.adminWeb',
  'Administration Marketplace': 'sidebar.sections.adminMarket',
  'Tableau de bord': 'sidebar.items.dashboard',
  'Mon profil': 'sidebar.items.profile',
  'Dashboard Cantine': 'sidebar.items.canteenDashboard',
  'Planification menus': 'sidebar.items.menuPlanning',
  'Préparation': 'sidebar.items.preparation',
  'Validation QR': 'sidebar.items.qrValidation',
  'Réservations internes': 'sidebar.items.internalReservations',
  'Statistiques': 'sidebar.items.statistics',
  'Dashboard Business': 'sidebar.items.businessDashboard',
  'IA Nutrition': 'sidebar.items.nutritionAi',
  'Commandes live': 'sidebar.items.liveOrders',
  'Mon Restaurant': 'sidebar.items.myRestaurant',
  'Config & Menu du jour': 'sidebar.items.restaurantConfig',
  'Tables & QR': 'sidebar.items.tablesQr',
  'Livraisons': 'sidebar.items.deliveries',
  'Zones & tarification': 'sidebar.items.deliveryZones',
  'Avis clients': 'sidebar.items.customerReviews',
  'Fidélisation': 'sidebar.items.loyalty',
  'Fidélité & Récompenses': 'sidebar.items.loyaltyRewards',
  'Commandes live (Kanban)': 'sidebar.items.liveOrdersKanban',
  'Produits': 'sidebar.items.products',
  'Catégories': 'sidebar.items.categories',
  'Clients': 'sidebar.items.customers',
  'Vente rapide': 'sidebar.items.quickSale',
  'Session caisse': 'sidebar.items.cashSession',
  'Historique POS': 'sidebar.items.posHistory',
  'Vente (POS)': 'sidebar.items.posSale',
  'Médicaments': 'sidebar.items.medicines',
  'Lots & péremption': 'sidebar.items.lotsExpiry',
  'Ordonnances': 'sidebar.items.prescriptions',
  'Clients / Patients': 'sidebar.items.patients',
  'Crédit Clients': 'sidebar.items.customerCredit',
  'Fournisseurs': 'sidebar.items.suppliers',
  'Commandes fournisseurs': 'sidebar.items.purchaseOrders',
  'Rapports': 'sidebar.items.reports',
  'Profil pharmacie': 'sidebar.items.pharmacyProfile',
  'Catalogue plats': 'sidebar.items.menuCatalog',
  'Utilisateurs': 'sidebar.items.users',
  'Abonnement': 'sidebar.items.subscription',
  'Paramètres': 'sidebar.items.settings',
  'Organisations': 'sidebar.items.organizations',
  'Programme Fidélité': 'sidebar.items.loyaltyProgram',
  'Dashboard': 'sidebar.items.infraDashboard',
  'Services': 'sidebar.items.services',
  'Serveur': 'sidebar.items.server',
  'Réseau': 'sidebar.items.network',
  'Base de données': 'sidebar.items.database',
  'Disque': 'sidebar.items.disk',
  'Logs': 'sidebar.items.logs',
  'Sauvegardes': 'sidebar.items.backups',
  'Sécurité': 'sidebar.items.security',
  'Certificats SSL': 'sidebar.items.ssl',
  'Alertes': 'sidebar.items.alerts',
  'Hero Manager': 'sidebar.items.heroManager',
  'Knowledge Acquisition': 'sidebar.items.knowledgeAcquisition',
  'Documents livreurs': 'sidebar.items.courierDocuments',
  'Push tokens': 'sidebar.items.pushTokens',
  'Voir sur la marketplace': 'sidebar.actions.viewMarketplace',
  'Accès global toutes orgs': 'sidebar.badges.globalAccess',
};

function trLabel(t, label) {
  const key = SIDEBAR_I18N[label];
  return key ? (t(key) || label) : label;
}

// ── Sections communes (tous les types) ────────────────────────────────────────
const SECTIONS_COMMON = [
  {
    label: 'Mon espace',
    items: [
      { to: '/',        icon: '🏠', label: 'Tableau de bord', permissions: null },
      { to: '/profile', icon: '👤', label: 'Mon profil',      permissions: null },
    ]
  },
];

// ── Sections domaine Cantine ──────────────────────────────────────────────────
const SECTIONS_CANTEEN = [
  {
    label: 'Gestion Cantine',
    domain: 'canteen',
    items: [
      { to: '/canteen',   icon: '🏫', label: 'Dashboard Cantine',  permissions: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.CANTEEN_STATS_VIEW] },
      { to: '/planning',  icon: '📅', label: 'Planification menus',permissions: [PERMISSIONS.CANTEEN_MENU_MANAGE] },
      { to: '/prep',      icon: '📋', label: 'Préparation',        permissions: [PERMISSIONS.CANTEEN_PREP_MANAGE] },
      { to: '/scan',      icon: '📷', label: 'Validation QR',      permissions: [PERMISSIONS.CANTEEN_PREP_MANAGE] },
      { to: '/reservations-canteen', icon: '🍽️', label: 'Réservations internes', permissions: [PERMISSIONS.CANTEEN_RESERVATION_MANAGE] },
    ]
  },
  {
    label: 'Analytique Cantine',
    domain: 'canteen',
    items: [
      { to: '/stats',             icon: '📊', label: 'Statistiques',     permissions: [PERMISSIONS.CANTEEN_STATS_VIEW] },
      { to: '/business-dashboard',icon: '📈', label: 'Dashboard Business',permissions: [PERMISSIONS.CANTEEN_STATS_VIEW] },
      { to: '/nutrition-ai',      icon: '🥗', label: 'IA Nutrition',     permissions: [PERMISSIONS.AI_NUTRITION_ANALYZE] },
    ]
  },
];

// ── Sections domaine Restaurant / Marketplace ─────────────────────────────────
const SECTIONS_RESTAURANT = [
  {
    label: 'Gestion Restaurant',
    domain: 'restaurant',
    items: [
      { to: '/orders',            icon: '🛒', label: 'Commandes live',        permissions: [PERMISSIONS.RESTAURANT_ORDER_MANAGE] },
      { to: '/restaurant-saas',  icon: '🏪', label: 'Mon Restaurant',        permissions: [PERMISSIONS.RESTAURANT_STATS_VIEW, PERMISSIONS.RESTAURANT_MENU_MANAGE, PERMISSIONS.RESTAURANT_PROFILE_MANAGE] },
      { to: '/restaurant-config', icon: '⚙️', label: 'Config & Menu du jour', permissions: [PERMISSIONS.RESTAURANT_PROFILE_MANAGE] },
      { to: '/tables',            icon: '🪑', label: 'Tables & QR',          permissions: [PERMISSIONS.RESTAURANT_TABLES_MANAGE] },
      { to: '/delivery',        icon: '🛵', label: 'Livraisons',          permissions: [PERMISSIONS.DELIVERY_MANAGE] },
      { to: '/delivery-zones',  icon: '🗺️', label: 'Zones & tarification', permissions: [PERMISSIONS.RESTAURANT_PROFILE_MANAGE] },
    ]
  },
  {
    label: 'Analytique Restaurant',
    domain: 'restaurant',
    items: [
      { to: '/satisfaction',       icon: '⭐', label: 'Avis clients',      permissions: [PERMISSIONS.RESTAURANT_STATS_VIEW] },
      { to: '/business-dashboard', icon: '📈', label: 'Dashboard Business',permissions: [PERMISSIONS.RESTAURANT_STATS_VIEW] },
      { to: '/nutrition-ai',       icon: '🥗', label: 'IA Nutrition',      permissions: [PERMISSIONS.AI_NUTRITION_ANALYZE] },
    ]
  },
];

// ── Section domaine Livreur (rôle `delivery`, indépendant de tout org_type —
// un livreur n'appartient généralement à aucun commerce) ──────────────────────
const SECTIONS_DELIVERY = [
  {
    label: 'Espace Livreur',
    domain: 'delivery',
    items: [
      { to: '/delivery', icon: '🛵', label: 'Livraisons', permissions: [PERMISSIONS.DELIVERY_MANAGE] },
    ]
  },
];

// ── Section Fidélité — commune à tous les domaines où le gain de points/cashback
// est effectivement câblé (resto, hanout, cantine — pas encore la pharmacie,
// qui a son propre flux de vente non relié au moteur de fidélité pour l'instant).
const SECTIONS_LOYALTY_COMMON = [
  {
    label: 'Fidélité',
    items: [
      { to: '/loyalty',          icon: '💎', label: 'Fidélisation',           permissions: [PERMISSIONS.RESTAURANT_STATS_VIEW, PERMISSIONS.CANTEEN_STATS_VIEW, PERMISSIONS.HANOUT_STATS_VIEW] },
      { to: '/loyalty/settings', icon: '⚙️', label: 'Fidélité & Récompenses', permissions: [PERMISSIONS.RESTAURANT_STATS_VIEW, PERMISSIONS.CANTEEN_STATS_VIEW, PERMISSIONS.HANOUT_STATS_VIEW, PERMISSIONS.LOYALTY_MANAGE] },
    ]
  },
];

// ── Sections domaine Commerces de proximité ───────────────────────────────────
const SECTIONS_HANOUT = [
  {
    label: 'Commerce de proximité',
    domain: 'hanout',
    items: [
      { to: '/hanout-dashboard', icon: '🏪', label: 'Tableau de bord',   permissions: [PERMISSIONS.HANOUT_ORDER_MANAGE, PERMISSIONS.HANOUT_STATS_VIEW] },
      { to: '/orders',   icon: '🛒', label: 'Commandes live (Kanban)', permissions: [PERMISSIONS.HANOUT_ORDER_MANAGE, PERMISSIONS.RESTAURANT_ORDER_MANAGE] },
      { to: '/hanout-dashboard?tab=products', icon: '📦', label: 'Produits',       permissions: [PERMISSIONS.HANOUT_PRODUCT_MANAGE] },
      { to: '/hanout-dashboard?tab=cats',     icon: '🗂️', label: 'Catégories',     permissions: [PERMISSIONS.HANOUT_PRODUCT_MANAGE] },
      { to: '/hanout-dashboard?tab=customers',icon: '👥', label: 'Clients',        permissions: [PERMISSIONS.HANOUT_ORDER_MANAGE] },
      { to: '/hanout-dashboard?tab=stats',    icon: '📊', label: 'Statistiques',   permissions: [PERMISSIONS.HANOUT_STATS_VIEW] },
    ],
  },
];

// ── Sections domaine POS / Caisse (resto + hanout) ────────────────────────────
const SECTIONS_POS = [
  {
    label: 'POS / Caisse',
    domain: 'pos',
    items: [
      { to: '/pos',         icon: '🧾', label: 'Vente rapide',   permissions: [PERMISSIONS.POS_SELL] },
      { to: '/pos/session', icon: '🗄️', label: 'Session caisse', permissions: [PERMISSIONS.POS_SESSION_OPEN, PERMISSIONS.POS_SESSION_CLOSE] },
      { to: '/pos/history', icon: '📜', label: 'Historique POS', permissions: [PERMISSIONS.POS_HISTORY_VIEW] },
    ],
  },
];

// ── Sections domaine Pharmacie ─────────────────────────────────────────────────
const SECTIONS_PHARMACY = [
  {
    label: 'Gestion Pharmacie',
    domain: 'pharmacy',
    items: [
      { to: '/pharmacy-dashboard',                icon: '💊', label: 'Tableau de bord', permissions: [PERMISSIONS.PHARMACY_SALE_CREATE, PERMISSIONS.PHARMACY_STATS_VIEW] },
      { to: '/pharmacy-dashboard?tab=pos',         icon: '🧾', label: 'Vente (POS)',      permissions: [PERMISSIONS.PHARMACY_SALE_CREATE] },
      { to: '/pharmacy-dashboard?tab=products',    icon: '💉', label: 'Médicaments',      permissions: [PERMISSIONS.PHARMACY_PRODUCT_MANAGE] },
      { to: '/pharmacy-dashboard?tab=lots',        icon: '📦', label: 'Lots & péremption',permissions: [PERMISSIONS.PHARMACY_LOT_MANAGE] },
      { to: '/pharmacy-dashboard?tab=prescriptions',icon: '📋', label: 'Ordonnances',     permissions: [PERMISSIONS.PHARMACY_PRESCRIPTION_VIEW] },
      { to: '/pharmacy-dashboard?tab=customers',   icon: '👥', label: 'Clients / Patients',permissions: [PERMISSIONS.PHARMACY_CUSTOMER_MANAGE] },
      { to: '/pharmacy-dashboard?tab=credit',      icon: '💳', label: 'Crédit Clients',   permissions: [PERMISSIONS.PHARMACY_CREDIT_VIEW] },
      { to: '/pharmacy-dashboard?tab=suppliers',   icon: '🚚', label: 'Fournisseurs',     permissions: [PERMISSIONS.PHARMACY_SUPPLIER_MANAGE] },
      { to: '/pharmacy-dashboard?tab=purchases',   icon: '📥', label: 'Commandes fournisseurs', permissions: [PERMISSIONS.PHARMACY_PURCHASE_MANAGE] },
      { to: '/pharmacy-dashboard?tab=reports',     icon: '📊', label: 'Rapports',         permissions: [PERMISSIONS.PHARMACY_STATS_VIEW] },
      { to: '/pharmacy-dashboard?tab=profile',     icon: '⚙️', label: 'Profil pharmacie', permissions: [PERMISSIONS.PHARMACY_PROFILE_MANAGE] },
    ],
  },
];

// ── Sections administration (communes) ────────────────────────────────────────
const SECTIONS_ADMIN = [
  {
    label: 'Administration',
    items: [
      { to: '/items',        icon: '🥘', label: 'Catalogue plats',  permissions: [PERMISSIONS.CANTEEN_MENU_MANAGE, PERMISSIONS.RESTAURANT_MENU_MANAGE] },
      { to: '/users',        icon: '👥', label: 'Utilisateurs',     permissions: [PERMISSIONS.USERS_MANAGE] },
      { to: '/subscription', icon: '💳', label: 'Abonnement',       permissions: [PERMISSIONS.SETTINGS_MANAGE] },
      { to: '/settings',     icon: '⚙️', label: 'Paramètres',       permissions: [PERMISSIONS.SETTINGS_MANAGE] },
      { to: '/orgs',         icon: '🌐', label: 'Organisations',    permissions: [PERMISSIONS.PLATFORM_MANAGE] },
    ]
  },
];

// ── Infrastructure Monitoring Center (SuperAdmin uniquement) ──────────────────
// Section plate (pas de menu déroulant) — cohérente avec le reste de cette
// sidebar qui n'a aucun pattern d'accordéon, chaque item gardé individuellement
// par permission comme SECTIONS_ADMIN ci-dessus.
const SECTIONS_INFRA = [
  {
    label: 'Infrastructure',
    items: [
      { to: '/infrastructure/dashboard', icon: '🖥️', label: 'Dashboard',        permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/infrastructure/services',  icon: '🧩', label: 'Services',         permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/infrastructure/server',    icon: '⚙️', label: 'Serveur',          permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/infrastructure/network',   icon: '🌐', label: 'Réseau',           permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/infrastructure/database',  icon: '🗄️', label: 'Base de données',  permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/infrastructure/disk',      icon: '💽', label: 'Disque',           permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/infrastructure/logs',      icon: '📜', label: 'Logs',             permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/infrastructure/backups',   icon: '🗂️', label: 'Sauvegardes',      permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/infrastructure/security',  icon: '🛡️', label: 'Sécurité',         permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/infrastructure/ssl',       icon: '🔒', label: 'Certificats SSL',  permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/infrastructure/alerts',    icon: '🚨', label: 'Alertes',          permissions: [PERMISSIONS.PLATFORM_MANAGE] },
    ]
  },
];

// ── Administration Web (ifilino-web) — portails de contenu grand public :
// Discover, Comics/GamingHub, Play, Sports & Kids, Study, Ads, Media, Push.
// Voir docs/PLATFORM_SPLIT_WEB_MARKET.md — même build/domaine pour l'instant,
// seul le regroupement de navigation change (aucune route déplacée).
const SECTIONS_ADMIN_WEB = [
  {
    label: 'Administration Web',
    items: [
      { to: '/discover-admin/articles', icon: '📰', label: 'Discover',     permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/admin/play',              icon: '🎮', label: 'iFilino Play', permissions: [PERMISSIONS.PLAY_MANAGE] },
      { to: '/admin/gaminghub',         icon: '🕹️', label: 'Gaming Hub', permissions: [PERMISSIONS.GAMING_MANAGE] },
      { to: '/admin/portals',           icon: '🏆', label: 'Sports & Kids', permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/admin/study',             icon: '🎓', label: 'Study',        permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/superadmin/ads',          icon: '📢', label: 'Publicités',   permissions: [PERMISSIONS.ADS_MANAGE] },
      { to: '/admin/media',             icon: '🎬', label: 'Media Center', permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/push-tokens',             icon: '🔔', label: 'Push tokens',        permissions: [PERMISSIONS.PLATFORM_MANAGE] },
    ]
  },
];

// ── Administration Marketplace (ifilino-market) — commerce, commerçants,
// fidélité, paiements, livraison. Voir docs/PLATFORM_SPLIT_WEB_MARKET.md.
const SECTIONS_ADMIN_MARKET = [
  {
    label: 'Administration Marketplace',
    items: [
      { to: '/marketplace-hero/slides', icon: '🎠', label: 'Hero Manager', permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/acquisition',             icon: '📍', label: 'Knowledge Acquisition', permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/admin/loyalty',           icon: '🏛️', label: 'Programme Fidélité', permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/admin/payments',          icon: '💳', label: 'Paiements',    permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/delivery-documents',      icon: '📄', label: 'Documents livreurs', permissions: [PERMISSIONS.PLATFORM_MANAGE] },
    ]
  },
];

function hasAccess(user, permissions, hasAnyPermission) {
  if (!permissions) return true;
  return !!user && hasAnyPermission(permissions);
}

function buildSections(user, hasAnyPermission) {
  const isSuperAdmin   = user?.role === 'superadmin';
  const isDelivery     = user?.role === 'delivery';
  const orgType        = user?.org_type;
  const bizType        = user?.org_business_type;
  const orgModule      = user?.org_module;
  const isCanteen      = orgType === 'canteen';
  const isHanout       = orgModule === 'hanout' || bizType === HANOUT_BIZ_TYPE;
  const isPharmacy     = orgModule === 'pharmacie' || bizType === PHARMACY_BIZ_TYPE || orgType === PHARMACY_BIZ_TYPE;
  const isRestaurant   = !isHanout && !isPharmacy && RESTAURANT_TYPES.includes(orgType);

  let domainSections = [];

  if (isSuperAdmin) {
    domainSections = [...SECTIONS_CANTEEN, ...SECTIONS_RESTAURANT, ...SECTIONS_POS, ...SECTIONS_HANOUT, ...SECTIONS_PHARMACY, ...SECTIONS_LOYALTY_COMMON];
  } else if (isDelivery) {
    // Priorité sur les branches org_type ci-dessous : un livreur n'est
    // généralement rattaché à aucun commerce (organization_id null), donc
    // sans cette branche dédiée il retomberait dans le "else" catch-all et
    // verrait les sections Cantine/Restaurant/Fidélité en plus du bruit inutile.
    domainSections = SECTIONS_DELIVERY;
  } else if (isHanout) {
    domainSections = [...SECTIONS_HANOUT, ...SECTIONS_POS, ...SECTIONS_LOYALTY_COMMON];
  } else if (isPharmacy) {
    domainSections = SECTIONS_PHARMACY;
  } else if (isCanteen) {
    domainSections = [...SECTIONS_CANTEEN, ...SECTIONS_LOYALTY_COMMON];
  } else if (isRestaurant) {
    domainSections = [...SECTIONS_RESTAURANT, ...SECTIONS_POS, ...SECTIONS_LOYALTY_COMMON];
  } else {
    domainSections = [...SECTIONS_CANTEEN, ...SECTIONS_RESTAURANT, ...SECTIONS_LOYALTY_COMMON];
  }

  const allSections = [...SECTIONS_COMMON, ...domainSections, ...SECTIONS_ADMIN, ...SECTIONS_INFRA, ...SECTIONS_ADMIN_WEB, ...SECTIONS_ADMIN_MARKET];

  return allSections.map(s => ({
    ...s,
    items: s.items
      .filter(it => hasAccess(user, it.permissions, hasAnyPermission))
      // Catalogue plats (resto/cantine) n'a pas de sens pour un hanout ou une pharmacie : ils ont leur propre catalogue
      .filter(it => !((isHanout || isPharmacy) && it.to === '/items'))
  })).filter(s => s.items.length > 0);
}

// ── Chip domaine ──────────────────────────────────────────────────────────────
function DomainChip({ orgType, bizType, orgModule }) {
  const { t } = useI18n();
  const isCanteen    = orgType === 'canteen';
  const isHanout     = orgModule === 'hanout' || bizType === HANOUT_BIZ_TYPE;
  const isPharmacy   = orgModule === 'pharmacie' || bizType === PHARMACY_BIZ_TYPE || orgType === PHARMACY_BIZ_TYPE;
  const isRestaurant = !isHanout && !isPharmacy && RESTAURANT_TYPES.includes(orgType);

  if (!orgType || orgType === 'superadmin') return null;

  const label  = isCanteen ? '🏢 ' + t('sidebar.domain.canteen') : isHanout ? '🏪 ' + t('sidebar.domain.localCommerce') : isPharmacy ? '💊 ' + t('sidebar.domain.pharmacy') : isRestaurant ? '🍽️ ' + t('sidebar.domain.restaurant') : orgType;
  const color  = isCanteen ? '#22C55E' : isHanout ? '#10B981' : isPharmacy ? '#0EA5E9' : '#FF8A00';
  const bg     = isCanteen ? 'rgba(34,197,94,.12)' : isHanout ? 'rgba(16,185,129,.12)' : isPharmacy ? 'rgba(14,165,233,.12)' : 'rgba(255,138,0,.12)';
  const border = isCanteen ? 'rgba(34,197,94,.25)' : isHanout ? 'rgba(16,185,129,.25)' : isPharmacy ? 'rgba(14,165,233,.25)' : 'rgba(255,138,0,.25)';

  return (
    <div style={{
      margin: '0 4px 8px',
      padding: '6px 10px',
      borderRadius: 8,
      background: bg,
      border: `1px solid ${border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {label}
      </div>
    </div>
  );
}

export function Sidebar({ open, onClose, branding }) {
  const { user, hasAnyPermission } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const brandName = branding?.brand_name || BRAND.APP_NAME;

  const visibleSections = buildSections(user, hasAnyPermission);
  const handleNavClick  = () => onClose?.();

  return (
    <>
      {open && <div className="app-sidebar-backdrop open" onClick={onClose} />}

      <aside className={`app-sidebar${open ? ' open' : ''}`}>
        {/* Logo */}
        <div style={{
          padding: '18px 16px',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          flexShrink: 0,
        }}>
          <NavLink to="/" className="d-flex align-items-center gap-2 text-decoration-none" onClick={handleNavClick}>
            {branding?.brand_logo_url
              ? <>
                  <img src={branding.brand_logo_url} alt={brandName} height={32}
                    style={{ borderRadius: 6, maxWidth: 130, objectFit: 'contain' }} />
                  <div style={{ lineHeight:1.15 }}>
                    <span style={{ fontFamily:'Poppins,sans-serif', fontSize:16, fontWeight:700, color:'#F1F5F9', letterSpacing:'-.3px', display:'block' }}>
                      {brandName}
                    </span>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,.45)', fontWeight:600, letterSpacing:'.04em', display:'block' }}>
                      {BRAND.APP_TAGLINE}
                    </span>
                  </div>
                </>
              : <>
                  <BrandLogo variant="full" theme="dark" size="sm" style={{ height:64 }} />
                </>
            }
          </NavLink>
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, padding: '8px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.1) transparent' }}>
          {visibleSections.map(section => (
            <div key={section.label} style={{ marginBottom: 4 }}>
              <span className="sb-nav-section">{trLabel(t, section.label)}</span>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `sb-nav-item${isActive ? ' active' : ''}`}
                  onClick={handleNavClick}
                >
                  <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </span>
                  <span>{trLabel(t, item.label)}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px',
          borderTop: '1px solid rgba(255,255,255,.06)',
          flexShrink: 0,
        }}>
          {/* Chip domaine */}
          {user?.org_type && <DomainChip orgType={user.org_type} bizType={user.org_business_type} orgModule={user.org_module} />}

          {/* SuperAdmin badge */}
          {user?.role === 'superadmin' && (
            <div style={{
              margin: '0 4px 8px',
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(239,68,68,.15)',
              border: '1px solid rgba(239,68,68,.25)',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#FCA5A5', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                SuperAdmin
              </div>
              <div style={{ fontSize: 11, color: '#FCA5A5', marginTop: 1, opacity: .8 }}>{t('sidebar.badges.globalAccess')}</div>
            </div>
          )}

          {user?.organization_id && user?.role !== 'superadmin' && (
            <div style={{
              margin: '0 4px 8px',
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(255,138,0,.12)',
              border: '1px solid rgba(255,138,0,.2)',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#FF8A00', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Organisation #{user.organization_id}
              </div>
            </div>
          )}

          {/* Accès rapide marketplace (uniquement pour restaurants) */}
          {(user?.org_is_marketplace || user?.role === 'superadmin') && (
            <button
              onClick={() => { navigate('/marketplace'); handleNavClick(); }}
              className="sb-nav-item"
              style={{ border: 'none' }}
            >
              <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>🌍</span>
              <span>{t('sidebar.actions.viewMarketplace')}</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
