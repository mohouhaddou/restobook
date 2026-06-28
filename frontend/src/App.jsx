import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { CustomerAuthProvider } from './contexts/CustomerAuthContext';
import { PageLayout } from './components/layout/PageLayout';
import { API } from './api';
import { PERMISSIONS } from './auth/permissions';

// Pages back-office
import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PlanningPage  from './pages/PlanningPage';
import PrepPage      from './pages/PrepPage';
import QrScanPage    from './pages/QrScanPage';
import ItemsPage     from './pages/ItemsPage';
import UsersPage     from './pages/UsersPage';
import SettingsPage  from './pages/SettingsPage';
import StatsPage     from './pages/StatsPage';
import OrgsPage      from './pages/OrgsPage';
import ProfilePage   from './pages/ProfilePage';
import OrdersPage    from './pages/OrdersPage';
import TablesPage    from './pages/TablesPage';
import RestaurantConfigPage from './pages/RestaurantConfigPage';
import CanteenPage   from './pages/CanteenPage';
import RestaurantSaasPage from './pages/RestaurantSaasPage';
import NutritionAIPage from './pages/NutritionAIPage';
import SatisfactionPage from './pages/SatisfactionPage';
import BusinessDashboardPage from './pages/BusinessDashboardPage';
import LoyaltyPage from './pages/LoyaltyPage';
import SubscriptionPage from './pages/SubscriptionPage';

// Landing page
import LandingPage from './pages/LandingPage';
import ProRegisterPage from './pages/ProRegisterPage';

// Pages marketplace (public)
import MarketplacePage     from './pages/MarketplacePage';
import RestaurantPage      from './pages/RestaurantPage';
import CheckoutPage        from './pages/CheckoutPage';
import OrderTrackingPage   from './pages/OrderTrackingPage';
import DeliveryPage        from './pages/DeliveryPage';
import CustomerAuthPage    from './pages/CustomerAuthPage';
import CustomerProfilePage from './pages/CustomerProfilePage';
import QrTablePage             from './pages/QrTablePage';
import TableReservationPage    from './pages/TableReservationPage';

// Image héro par défaut (Unsplash — restaurant gastronomique)
const DEFAULT_HERO = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80';
const DEFAULT_BRANDING = {
  brand_name: 'RestoBook',
  brand_logo_url: null,
  hero_image_url: DEFAULT_HERO,
  theme_primary: '#FF8A00',
  theme_accent: '#FFD500',
};

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function mix(hex, target, amount) {
  const rgb = hexToRgb(hex);
  const dst = hexToRgb(target);
  if (!rgb || !dst) return hex;
  const c = k => Math.round(rgb[k] + (dst[k] - rgb[k]) * amount);
  return `#${[c('r'), c('g'), c('b')].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
function applyBrandingTheme(branding) {
  const primary = branding?.theme_primary || DEFAULT_BRANDING.theme_primary;
  const accent = branding?.theme_accent || DEFAULT_BRANDING.theme_accent;
  const root = document.documentElement;
  root.style.setProperty('--rb-orange', primary);
  root.style.setProperty('--rb-orange-hover', mix(primary, '#000000', 0.18));
  root.style.setProperty('--rb-orange-light', mix(primary, '#ffffff', 0.9));
  root.style.setProperty('--rb-orange-muted', mix(primary, '#ffffff', 0.7));
  root.style.setProperty('--rb-green', accent);
  root.style.setProperty('--rb-green-s', mix(accent, '#ffffff', 0.9));
}

function ProtectedRoute({ children, roles, permissions }) {
  const { user, ready, hasAnyPermission } = useAuth();
  if (!ready) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'var(--rb-muted)'}}>
      <div className="spinner-border" style={{width:32,height:32,borderColor:'var(--rb-orange)',borderRightColor:'transparent'}} />
      <span style={{fontSize:13}}>Chargement…</span>
    </div>
  );
  if (!user) return <Navigate to="/landing" replace />;
  // Un customer qui atterrit sur une route back-office est renvoyé au marketplace
  if (user.role === 'customer') return <Navigate to="/marketplace" replace />;
  if (permissions && !hasAnyPermission(permissions)) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user, ready } = useAuth();
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const heroUrl = branding.hero_image_url || DEFAULT_HERO;

  useEffect(() => {
    if (!ready) return;
    const orgId = user?.organization_id || 1;
    fetch(API(`/settings?org_id=${orgId}`))
      .then(r => r.json())
      .then(d => {
        const next = { ...DEFAULT_BRANDING, ...(d.settings || {}) };
        setBranding(next);
        applyBrandingTheme(next);
      })
      .catch(() => {
        setBranding(DEFAULT_BRANDING);
        applyBrandingTheme(DEFAULT_BRANDING);
      });
  }, [ready, user?.organization_id]);

  if (!ready) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12}}>
      <div className="spinner-border" style={{width:36,height:36,borderColor:'var(--rb-orange)',borderRightColor:'transparent'}} />
    </div>
  );

  return (
    <Routes>
      {/* ── Page de connexion ── */}
      <Route path="/login" element={
        user
          ? <Navigate to={user.role === 'customer' ? '/marketplace' : '/'} replace />
          : <LoginPage branding={branding} />
      } />

      {/* ── Routes authentifiées ── */}
      <Route path="/" element={
        <ProtectedRoute>
          <PageLayout heroUrl={heroUrl} branding={branding}><DashboardPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/canteen" element={
        <ProtectedRoute permissions={PERMISSIONS.USERS_MANAGE}>
          <PageLayout branding={branding}><CanteenPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/satisfaction" element={
        <ProtectedRoute permissions={PERMISSIONS.RESTAURANT_STATS_VIEW}>
          <PageLayout branding={branding}><SatisfactionPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/nutrition-ai" element={
        <ProtectedRoute permissions={PERMISSIONS.AI_NUTRITION_ANALYZE}>
          <PageLayout branding={branding}><NutritionAIPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/restaurant-saas" element={
        <ProtectedRoute permissions={[PERMISSIONS.RESTAURANT_STATS_VIEW, PERMISSIONS.RESTAURANT_MENU_MANAGE, PERMISSIONS.RESTAURANT_PROFILE_MANAGE]}>
          <PageLayout branding={branding}><RestaurantSaasPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/planning" element={
        <ProtectedRoute permissions={PERMISSIONS.CANTEEN_MENU_MANAGE}>
          <PageLayout heroUrl={heroUrl} branding={branding}><PlanningPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/prep" element={
        <ProtectedRoute permissions={PERMISSIONS.CANTEEN_PREP_MANAGE}>
          <PageLayout branding={branding}><PrepPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/orders" element={
        <ProtectedRoute permissions={PERMISSIONS.RESTAURANT_ORDER_MANAGE}>
          <PageLayout branding={branding}><OrdersPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/scan" element={
        <ProtectedRoute permissions={PERMISSIONS.CANTEEN_PREP_MANAGE}>
          <PageLayout branding={branding}><QrScanPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/stats" element={
        <ProtectedRoute permissions={[PERMISSIONS.CANTEEN_STATS_VIEW, PERMISSIONS.RESTAURANT_STATS_VIEW]}>
          <PageLayout branding={branding}><StatsPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/business-dashboard" element={
        <ProtectedRoute permissions={[PERMISSIONS.CANTEEN_STATS_VIEW, PERMISSIONS.RESTAURANT_STATS_VIEW]}>
          <PageLayout branding={branding}><BusinessDashboardPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/loyalty" element={
        <ProtectedRoute permissions={[PERMISSIONS.CANTEEN_STATS_VIEW, PERMISSIONS.RESTAURANT_STATS_VIEW]}>
          <PageLayout branding={branding}><LoyaltyPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/subscription" element={
        <ProtectedRoute>
          <PageLayout branding={branding}><SubscriptionPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/items" element={
        <ProtectedRoute permissions={[PERMISSIONS.CANTEEN_MENU_MANAGE, PERMISSIONS.RESTAURANT_MENU_MANAGE]}>
          <PageLayout branding={branding}><ItemsPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute permissions={PERMISSIONS.USERS_MANAGE}>
          <PageLayout branding={branding}><UsersPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute permissions={PERMISSIONS.SETTINGS_MANAGE}>
          <PageLayout branding={branding}><SettingsPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/orgs" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><OrgsPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <PageLayout branding={branding}><ProfilePage /></PageLayout>
        </ProtectedRoute>
      } />

      {/* ── Routes marketplace (publiques) ── */}
      <Route path="/landing"        element={<LandingPage />} />
      <Route path="/pro-register"   element={<ProRegisterPage />} />
      <Route path="/marketplace"   element={<MarketplacePage />} />
      <Route path="/r/:slug"       element={<RestaurantPage />} />
      <Route path="/checkout"      element={<CheckoutPage />} />
      <Route path="/track/:code"   element={<OrderTrackingPage />} />

      {/* ── Table Reservation (luxury booking wizard) ── */}
      <Route path="/r/:slug/reserve" element={<TableReservationPage />} />

      {/* ── QR Smart Ordering ── */}
      <Route path="/qr/:slug/:token" element={<QrTablePage />} />

      {/* ── Auth & profil client ── */}
      <Route path="/account"         element={<CustomerAuthPage />} />
      <Route path="/account/orders"  element={<CustomerProfilePage />} />

      {/* ── Espace livreur (rôle delivery) ── */}
      <Route path="/delivery" element={
        <ProtectedRoute permissions={PERMISSIONS.DELIVERY_MANAGE}>
          <PageLayout branding={branding}><DeliveryPage /></PageLayout>
        </ProtectedRoute>
      } />

      {/* ── Tables QR (back-office restaurant) ── */}
      <Route path="/tables" element={
        <ProtectedRoute permissions={PERMISSIONS.RESTAURANT_TABLES_MANAGE}>
          <PageLayout branding={branding}><TablesPage /></PageLayout>
        </ProtectedRoute>
      } />

      <Route path="/restaurant-config" element={
        <ProtectedRoute permissions={PERMISSIONS.RESTAURANT_PROFILE_MANAGE}>
          <PageLayout branding={branding}><RestaurantConfigPage /></PageLayout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/landing" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <CustomerAuthProvider>
          <CartProvider>
            <AppRoutes />
          </CartProvider>
        </CustomerAuthProvider>
      </AuthProvider>
    </HashRouter>
  );
}
