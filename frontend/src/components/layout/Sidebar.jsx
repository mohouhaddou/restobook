import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import { BrandLogo } from '../brand/BrandLogo';

const CANTEEN_TYPES = ['canteen'];
const RESTAURANT_TYPES = ['restaurant', 'snack', 'dark_kitchen', 'bakery', 'cafe'];

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
    ]
  },
  {
    label: 'Analytique Restaurant',
    domain: 'restaurant',
    items: [
      { to: '/stats',              icon: '📊', label: 'Statistiques',      permissions: [PERMISSIONS.RESTAURANT_STATS_VIEW] },
      { to: '/satisfaction',       icon: '⭐', label: 'Avis clients',      permissions: [PERMISSIONS.RESTAURANT_STATS_VIEW] },
      { to: '/business-dashboard', icon: '📈', label: 'Dashboard Business',permissions: [PERMISSIONS.RESTAURANT_STATS_VIEW] },
      { to: '/loyalty',            icon: '💎', label: 'Fidélisation',      permissions: [PERMISSIONS.RESTAURANT_STATS_VIEW] },
      { to: '/nutrition-ai',       icon: '🥗', label: 'IA Nutrition',      permissions: [PERMISSIONS.AI_NUTRITION_ANALYZE] },
    ]
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

function hasAccess(user, permissions, hasAnyPermission) {
  if (!permissions) return true;
  return !!user && hasAnyPermission(permissions);
}

function buildSections(user, hasAnyPermission) {
  const isSuperAdmin = user?.role === 'superadmin';
  const orgType = user?.org_type;
  const isCanteen    = orgType === 'canteen';
  const isRestaurant = RESTAURANT_TYPES.includes(orgType);

  let domainSections = [];

  if (isSuperAdmin) {
    // Superadmin voit tout
    domainSections = [...SECTIONS_CANTEEN, ...SECTIONS_RESTAURANT];
  } else if (isCanteen) {
    domainSections = SECTIONS_CANTEEN;
  } else if (isRestaurant) {
    domainSections = SECTIONS_RESTAURANT;
  } else {
    // Pas d'org ou type inconnu → afficher selon les permissions disponibles
    domainSections = [...SECTIONS_CANTEEN, ...SECTIONS_RESTAURANT];
  }

  const allSections = [...SECTIONS_COMMON, ...domainSections, ...SECTIONS_ADMIN];

  return allSections.map(s => ({
    ...s,
    items: s.items.filter(it => hasAccess(user, it.permissions, hasAnyPermission))
  })).filter(s => s.items.length > 0);
}

// ── Chip domaine ──────────────────────────────────────────────────────────────
function DomainChip({ orgType }) {
  const isCanteen    = orgType === 'canteen';
  const isRestaurant = RESTAURANT_TYPES.includes(orgType);

  if (!orgType || orgType === 'superadmin') return null;

  const label  = isCanteen ? '🏢 Cantine' : isRestaurant ? '🍽️ Restaurant' : orgType;
  const color  = isCanteen ? '#22C55E' : '#FF8A00';
  const bg     = isCanteen ? 'rgba(34,197,94,.12)' : 'rgba(255,138,0,.12)';
  const border = isCanteen ? 'rgba(34,197,94,.25)' : 'rgba(255,138,0,.25)';

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
  const navigate = useNavigate();
  const brandName = branding?.brand_name || 'RestoBook';

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
                  <span style={{ fontFamily:'Poppins,sans-serif', fontSize:16, fontWeight:700, color:'#F1F5F9', letterSpacing:'-.3px' }}>
                    {brandName}
                  </span>
                </>
              : <BrandLogo variant="full" theme="dark" size="sm" style={{ height:96 }} />
            }
          </NavLink>
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, padding: '8px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.1) transparent' }}>
          {visibleSections.map(section => (
            <div key={section.label} style={{ marginBottom: 4 }}>
              <span className="sb-nav-section">{section.label}</span>
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
                  <span>{item.label}</span>
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
          {user?.org_type && <DomainChip orgType={user.org_type} />}

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
              <div style={{ fontSize: 11, color: '#FCA5A5', marginTop: 1, opacity: .8 }}>Accès global toutes orgs</div>
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
              <span>Voir sur la marketplace</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
