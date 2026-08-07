import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './shared/modules/auth/AuthContext';
import { CartProvider } from './market/modules/marketplace/CartContext';
import { CustomerAuthProvider } from './shared/context/CustomerAuthContext';
import { SubscriptionProvider } from './web/modules/subscriptions';
import { KidsProfileProvider } from './web/modules/kids-profile';
import { GamificationProvider } from './web/modules/gamification';
import { PlayProvider } from './web/modules/play/PlayContext';
import { PageLayout } from './shared/components/layout/PageLayout';
import { PublicChrome } from './shared/components/layout/PublicChrome';
import { ScrollToTop } from './shared/components/layout/ScrollToTop';
import { API } from './shared/services/api';
import { PERMISSIONS } from './shared/modules/core/permissions';
import { BRAND } from './config/branding';
import { I18nProvider, useI18n } from './i18n/config';
import { ConsentProvider } from './shared/context/ConsentContext';
import { CookieConsentBanner } from './shared/components/ads/CookieConsentBanner';

// Pages back-office
import LoginPage     from './shared/pages/LoginPage';
import DashboardPage from './market/pages/DashboardPage';
import PlanningPage  from './market/pages/PlanningPage';
import PrepPage      from './market/pages/PrepPage';
import QrScanPage    from './market/pages/QrScanPage';
import ItemsPage     from './market/pages/ItemsPage';
import UsersPage     from './shared/pages/UsersPage';
import SettingsPage  from './shared/pages/SettingsPage';
import StatsPage     from './market/pages/StatsPage';
import OrgsPage      from './shared/pages/OrgsPage';
import LoyaltyProgramPage from './market/pages/LoyaltyProgramPage';
// Infrastructure Monitoring Center (SuperAdmin)
import InfraDashboardPage from './pages/infra/InfraDashboardPage';
import InfraServicesPage  from './pages/infra/InfraServicesPage';
import InfraServerPage    from './pages/infra/InfraServerPage';
import InfraNetworkPage   from './pages/infra/InfraNetworkPage';
import InfraDatabasePage  from './pages/infra/InfraDatabasePage';
import InfraDiskPage      from './pages/infra/InfraDiskPage';
import InfraLogsPage      from './pages/infra/InfraLogsPage';
import InfraBackupsPage   from './pages/infra/InfraBackupsPage';
import InfraSecurityPage  from './pages/infra/InfraSecurityPage';
import InfraSslPage       from './pages/infra/InfraSslPage';
import InfraAlertsPage    from './pages/infra/InfraAlertsPage';
import AdCampaignsListPage from './web/pages/ads/AdCampaignsListPage';
import AdCampaignEditorPage from './web/pages/ads/AdCampaignEditorPage';
import AdPlacementsPage from './web/pages/ads/AdPlacementsPage';
import AdAnalyticsPage from './web/pages/ads/AdAnalyticsPage';
import HeroSlidesListPage  from './market/pages/marketplaceHero/HeroSlidesListPage';
import HeroSlideEditorPage from './market/pages/marketplaceHero/HeroSlideEditorPage';
import HeroSlideStatsPage  from './market/pages/marketplaceHero/HeroSlideStatsPage';
import ProfilePage   from './shared/pages/ProfilePage';
import NotificationsPage from './shared/pages/NotificationsPage';
import NotificationPreferencesPage from './shared/pages/NotificationPreferencesPage';
import CustomerNotificationPreferencesPage from './market/pages/dashboard/NotificationPreferencesPage';
import OrdersPage    from './market/pages/OrdersPage';
import TablesPage    from './market/pages/TablesPage';
import RestaurantConfigPage from './market/pages/RestaurantConfigPage';
import CanteenPage   from './market/pages/CanteenPage';
import RestaurantSaasPage from './market/pages/RestaurantSaasPage';
import NutritionAIPage from './market/pages/NutritionAIPage';
import SatisfactionPage from './market/pages/SatisfactionPage';
import BusinessDashboardPage from './market/pages/BusinessDashboardPage';
import LoyaltyPage from './market/pages/LoyaltyPage';
import LoyaltySettingsPage from './market/pages/LoyaltySettingsPage';
import SubscriptionPage from './shared/pages/SubscriptionPage';
import PosPage from './market/pages/pos/PosPage';
import PosSessionPage from './market/pages/pos/PosSessionPage';
import PosHistoryPage from './market/pages/pos/PosHistoryPage';

// Landing page
import LandingPage from './shared/pages/LandingPage';
import ProRegisterPage from './market/pages/ProRegisterPage';
import DiscoverHomePage from './web/pages/discover/DiscoverHomePage';
import ArticlePage from './web/pages/discover/ArticlePage';
const GamingHubHomePage = lazy(() => import('./web/pages/gaminghub/GamingHubHomePage'));
const GameProfilePage = lazy(() => import('./web/pages/gaminghub/GameProfilePage'));
const GamingArticlesListPage = lazy(() => import('./web/pages/gaminghub/ArticlesListPage'));
const GamingArticleDetailPage = lazy(() => import('./web/pages/gaminghub/ArticleDetailPage'));
const GamingDiscoverFinderPage = lazy(() => import('./web/pages/gaminghub/DiscoverFinderPage'));
const GamingCategoriesListPage = lazy(() => import('./web/pages/gaminghub/CategoriesListPage'));
const GamingGamesListPage = lazy(() => import('./web/pages/gaminghub/GamesListPage'));
const GamingSearchPage = lazy(() => import('./web/pages/gaminghub/GamingSearchPage'));
const PortalPage = lazy(() => import('./web/pages/portals/PortalPage'));
const PortalDetailPage = lazy(() => import('./web/pages/portals/PortalDetailPage'));
const BookLandingPage = lazy(() => import('./web/pages/portals/BookLandingPage'));
const StoryReaderPage = lazy(() => import('./web/pages/portals/StoryReaderPage'));
const KidsAuthPage = lazy(() => import('./web/pages/portals/KidsAuthPage'));
const KidsProfilePage = lazy(() => import('./web/pages/portals/KidsProfilePage'));
const KidsPurchasesPage = lazy(() => import('./web/pages/portals/KidsPurchasesPage'));
const KidsPremiumPage = lazy(() => import('./web/pages/kids/KidsPremiumPage'));
const StudyHomePage = lazy(() => import('./web/pages/study/StudyHomePage'));
const StudyLessonPage = lazy(() => import('./web/pages/study/StudyLessonPage'));
const ComicsChrome = lazy(() => import('./web/modules/comics/ComicsChrome'));
const ComicsHomePage = lazy(() => import('./web/modules/comics/ComicsPages').then(module => ({ default: module.ComicsHomePage })));
const ComicsSearchPage = lazy(() => import('./web/modules/comics/ComicsPages').then(module => ({ default: module.ComicsSearchPage })));
const ComicDetailPage = lazy(() => import('./web/modules/comics/ComicsPages').then(module => ({ default: module.ComicDetailPage })));
const ComicsLibraryPage = lazy(() => import('./web/modules/comics/ComicsPages').then(module => ({ default: module.ComicsLibraryPage })));
const ComicReaderPage = lazy(() => import('./web/modules/comics/ComicsPages').then(module => ({ default: module.ComicReaderPage })));
const ComicsAdminDashboard = lazy(() => import('./web/modules/comics-dashboard/ComicsDashboard').then(module => ({ default: module.ComicsAdminDashboard })));
const ComicsAdminSeries = lazy(() => import('./web/modules/comics-dashboard/ComicsDashboard').then(module => ({ default: module.ComicsAdminSeries })));
const ComicsPublisherDashboard = lazy(() => import('./web/modules/comics-dashboard/ComicsDashboard').then(module => ({ default: module.ComicsPublisherDashboard })));
const ComicsImportWizard = lazy(() => import('./web/modules/comics-dashboard/ComicsDashboard').then(module => ({ default: module.ComicsImportWizard })));
const ComicsLoginPage = lazy(() => import('./web/modules/comics/ComicsAccount').then(module => ({ default: module.ComicsLoginPage })));
const ComicsUserDashboard = lazy(() => import('./web/modules/comics/ComicsAccount').then(module => ({ default: module.ComicsUserDashboard })));
const ComicsDashboardSection = lazy(() => import('./web/modules/comics-dashboard/ComicsDashboard').then(module => ({ default: module.ComicsDashboardSection })));
const ComicsSeriesEditor = lazy(() => import('./web/modules/comics-dashboard/ComicsEditorial').then(module => ({ default: module.ComicsSeriesEditor })));
const ComicsImportsPage = lazy(() => import('./web/modules/comics-dashboard/ComicsEditorial').then(module => ({ default: module.ComicsImportsPage })));
const AICommandCenter = lazy(() => import('./web/modules/ai-command-center/AICommandCenter'));
import ArticlesListPage from './web/pages/discover/admin/ArticlesListPage';
import ArticleEditorPage from './web/pages/discover/admin/ArticleEditorPage';
import DiscoverStatsPage from './web/pages/discover/admin/DiscoverStatsPage';
import DeliveryRegisterPage from './market/pages/DeliveryRegisterPage';

// Pages marketplace (public)
import MarketplacePage     from './market/pages/MarketplacePage';
import SearchResultsPage   from './market/pages/marketplace/SearchResultsPage';
import HanoutPage          from './market/pages/hanout/HanoutPage';
import HanoutDashboard     from './market/pages/hanout/HanoutDashboard';
import PharmacyPage        from './market/pages/pharmacy/PharmacyPage';
import PharmacyDashboard   from './market/pages/pharmacy/PharmacyDashboard';
import RestaurantPage      from './market/pages/RestaurantPage';
import CheckoutPage        from './market/pages/CheckoutPage';
import ProductDetailPage   from './market/pages/ProductDetailPage';
import OrderTrackingPage   from './market/pages/OrderTrackingPage';
import DeliveryPage        from './market/pages/DeliveryPage';
import DeliveryZonesPricingPage from './market/pages/DeliveryZonesPricingPage';
import DeliveryDocumentsReviewPage from './pages/admin-market/DeliveryDocumentsReviewPage';
import PushTokensPage      from './pages/admin-web/PushTokensPage';
import AcquisitionDashboardPage from './pages/admin-market/AcquisitionDashboardPage';
import PlayAdminPage from './pages/admin-web/PlayAdminPage';
import GamingHubAdminPage from './pages/admin-web/GamingHubAdminPage';
import PortalsAdminPage from './pages/admin-web/PortalsAdminPage';
import PaymentsAdminPage from './pages/admin-market/PaymentsAdminPage';
import PortalArticleEditorPage from './pages/admin-web/PortalArticleEditorPage';
import MediaCenterPage from './pages/admin-web/MediaCenterPage';
import StudyAdminPage from './pages/admin-web/StudyAdminPage';
import StudyLessonEditorPage from './pages/admin-web/StudyLessonEditorPage';
import PlayRouteFallback from './web/modules/play/components/PlayRouteFallback';
import { KidsLegacyRedirect, KidsBooksRedirect, KidsHomeOrSectionRoute } from './web/pages/kids/KidsLangRoutes';
import { SUPPORTED_LANGUAGES as KIDS_SUPPORTED_LANGUAGES } from './web/pages/kids/i18n';
import PlayChrome from './web/modules/play/components/PlayChrome';
const PlayHomePage = lazy(() => import('./web/pages/play/PlayHomePage'));
const PlayGamePage = lazy(() => import('./web/pages/play/PlayGamePage'));
const GameDetailsPage = lazy(() => import('./web/pages/play/GameDetailsPage'));
const PlayBadgesPage = lazy(() => import('./web/pages/play/PlayBadgesPage'));
const PlayRewardsPage = lazy(() => import('./web/pages/play/PlayRewardsPage'));
const PlayLeaderboardPage = lazy(() => import('./web/pages/play/PlayLeaderboardPage'));
const PlayProfilePage = lazy(() => import('./web/pages/play/PlayProfilePage'));
const PlayAuthPage = lazy(() => import('./web/pages/play/PlayAuthPage'));
import CustomerAuthPage    from './shared/pages/CustomerAuthPage';
import QrTablePage             from './market/pages/QrTablePage';
import TableReservationPage    from './market/pages/TableReservationPage';

// Dashboard Consommateur
import { CustomerProtectedRoute } from './shared/components/layout/CustomerProtectedRoute';
import { CustomerDashboardLayout } from './market/components/dashboard/CustomerDashboardLayout';
import DashboardHomePage       from './market/pages/dashboard/DashboardHomePage';
import ActivityPage            from './market/pages/dashboard/ActivityPage';
import ShoppingListsPage       from './market/pages/dashboard/ShoppingListsPage';
import WalletPage              from './market/pages/dashboard/WalletPage';
import InsightsPage            from './market/pages/dashboard/InsightsPage';
import DashboardProfilePage    from './market/pages/dashboard/DashboardProfilePage';
import IfilinoCardPage         from './market/pages/dashboard/IfilinoCardPage';
import NotificationCenterPage  from './market/pages/dashboard/NotificationCenterPage';
import FamilyPage              from './market/pages/dashboard/FamilyPage';
import GiftCardsPage           from './market/pages/dashboard/GiftCardsPage';
import AssistantPage           from './market/pages/dashboard/AssistantPage';

// Image héro par défaut (Unsplash — restaurant gastronomique)
const DEFAULT_HERO = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80';
const DEFAULT_BRANDING = {
  brand_name:     BRAND.APP_NAME,
  brand_logo_url: null,
  hero_image_url: DEFAULT_HERO,
};

// Pages ville/catégorie SEO (/:city, /:city/:category — voir backend SSR
// modules/seo/ssrRouter.js) : côté client, on redirige vers le marketplace
// existant plutôt que de reconstruire une page de listing dédiée — les
// crawlers voient déjà le vrai contenu via le SSR, seuls les visiteurs JS
// qui cliquent depuis Google/le sitemap passent par cette redirection.
function CitySeoRedirect() {
  const { city } = useParams();
  return <Navigate to={`/marketplace?city=${encodeURIComponent(city)}`} replace />;
}

// Study a déménagé de /study/:lang/... vers /kids/:lang/learn/... (section "Learn" déjà
// présente dans la nav Kids) — redirection pour ne pas casser un lien déjà partagé pendant la
// courte fenêtre où /study/... était l'URL en place.
function StudyLegacyRedirect({ toSuffix }) {
  const params = useParams();
  const lang = KIDS_SUPPORTED_LANGUAGES.includes(params.lang) ? params.lang : 'en';
  return <Navigate to={`/kids/${lang}/${toSuffix(params)}`} replace />;
}

function ProtectedRoute({ children, roles, permissions, anonRedirect = '/landing' }) {
  const { user, ready, hasAnyPermission } = useAuth();
  const { t } = useI18n();
  if (!ready) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'var(--rb-muted)'}}>
      <div className="spinner-border" style={{width:32,height:32,borderColor:'var(--il-primary)',borderRightColor:'transparent'}} />
      <span style={{fontSize:13}}>{t('common.loading')}</span>
    </div>
  );
  if (!user) return <Navigate to={anonRedirect} replace />;
  // Un customer qui atterrit sur une route back-office est renvoyé au marketplace
  if (user.role === 'customer') return <Navigate to="/marketplace" replace />;
  if (permissions && !hasAnyPermission(permissions)) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

const PlayRoute = ({ children }) => <Suspense fallback={<PlayRouteFallback/>}>{children}</Suspense>;

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
      })
      .catch(() => {
        setBranding(DEFAULT_BRANDING);
      });
  }, [ready, user?.organization_id]);

  // Ne bloque plus TOUTES les routes derrière le spinner d'auth : ce gate
  // masquait aussi les pages publiques (marketplace, /restaurants/:slug,
  // /:city...) qui n'ont besoin d'aucune session. ProtectedRoute (ligne
  // ci-dessus) gère déjà son propre spinner `!ready` pour les routes qui en
  // ont réellement besoin — aucune régression sur le back-office.
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
        <ProtectedRoute anonRedirect="/marketplace">
          {(user?.org_module === 'hanout' || user?.org_business_type === 'hanout')
            ? <Navigate to="/hanout-dashboard" replace />
            : (user?.org_module === 'pharmacie' || user?.org_business_type === 'pharmacie')
              ? <Navigate to="/pharmacy-dashboard" replace />
              : <PageLayout heroUrl={heroUrl} branding={branding}><DashboardPage /></PageLayout>
          }
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
        <ProtectedRoute permissions={PERMISSIONS.CANTEEN_STATS_VIEW}>
          <PageLayout branding={branding}><StatsPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/business-dashboard" element={
        <ProtectedRoute permissions={[PERMISSIONS.CANTEEN_STATS_VIEW, PERMISSIONS.RESTAURANT_STATS_VIEW]}>
          <PageLayout branding={branding}><BusinessDashboardPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/loyalty" element={
        <ProtectedRoute permissions={[PERMISSIONS.CANTEEN_STATS_VIEW, PERMISSIONS.RESTAURANT_STATS_VIEW, PERMISSIONS.HANOUT_STATS_VIEW]}>
          <PageLayout branding={branding}><LoyaltyPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/loyalty/settings" element={
        <ProtectedRoute permissions={[PERMISSIONS.CANTEEN_STATS_VIEW, PERMISSIONS.RESTAURANT_STATS_VIEW, PERMISSIONS.HANOUT_STATS_VIEW, PERMISSIONS.LOYALTY_MANAGE]}>
          <PageLayout branding={branding}><LoyaltySettingsPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/subscription" element={
        <ProtectedRoute>
          <PageLayout branding={branding}><SubscriptionPage /></PageLayout>
        </ProtectedRoute>
      } />

      {/* ── POS / Caisse ── */}
      <Route path="/pos" element={
        <ProtectedRoute permissions={PERMISSIONS.POS_SELL}>
          <PageLayout branding={branding}><PosPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/pos/session" element={
        <ProtectedRoute permissions={[PERMISSIONS.POS_SESSION_OPEN, PERMISSIONS.POS_SESSION_CLOSE]}>
          <PageLayout branding={branding}><PosSessionPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/pos/history" element={
        <ProtectedRoute permissions={PERMISSIONS.POS_HISTORY_VIEW}>
          <PageLayout branding={branding}><PosHistoryPage /></PageLayout>
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
      <Route path="/admin/loyalty" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><LoyaltyProgramPage /></PageLayout>
        </ProtectedRoute>
      } />
      {/* Infrastructure Monitoring Center (SuperAdmin) */}
      <Route path="/infrastructure/dashboard" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><InfraDashboardPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/infrastructure/services" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><InfraServicesPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/infrastructure/server" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><InfraServerPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/infrastructure/network" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><InfraNetworkPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/infrastructure/database" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><InfraDatabasePage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/infrastructure/disk" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><InfraDiskPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/infrastructure/logs" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><InfraLogsPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/infrastructure/backups" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><InfraBackupsPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/infrastructure/security" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><InfraSecurityPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/infrastructure/ssl" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><InfraSslPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/infrastructure/alerts" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><InfraAlertsPage /></PageLayout>
        </ProtectedRoute>
      } />
      {/* Hero Manager marketplace (SuperAdmin) */}
      <Route path="/marketplace-hero/slides" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><HeroSlidesListPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/marketplace-hero/slides/new" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><HeroSlideEditorPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/marketplace-hero/slides/:id/edit" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><HeroSlideEditorPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/marketplace-hero/slides/:id/stats" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><HeroSlideStatsPage /></PageLayout>
        </ProtectedRoute>
      } />
      {/* Ads Management (SuperAdmin) */}
      <Route path="/superadmin/ads" element={
        <ProtectedRoute permissions={PERMISSIONS.ADS_MANAGE}>
          <PageLayout branding={branding}><AdCampaignsListPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/superadmin/ads/new" element={
        <ProtectedRoute permissions={PERMISSIONS.ADS_MANAGE}>
          <PageLayout branding={branding}><AdCampaignEditorPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/superadmin/ads/placements" element={
        <ProtectedRoute permissions={PERMISSIONS.ADS_MANAGE}>
          <PageLayout branding={branding}><AdPlacementsPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/superadmin/ads/analytics" element={
        <ProtectedRoute permissions={PERMISSIONS.ADS_MANAGE}>
          <PageLayout branding={branding}><AdAnalyticsPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/superadmin/ads/:id/edit" element={
        <ProtectedRoute permissions={PERMISSIONS.ADS_MANAGE}>
          <PageLayout branding={branding}><AdCampaignEditorPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/superadmin/ads/:id/stats" element={
        <ProtectedRoute permissions={PERMISSIONS.ADS_MANAGE}>
          <PageLayout branding={branding}><AdAnalyticsPage /></PageLayout>
        </ProtectedRoute>
      } />
      {/* iFilino Discover — CMS (SuperAdmin) */}
      <Route path="/discover-admin/articles" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><ArticlesListPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/discover-admin/articles/new" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><ArticleEditorPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/discover-admin/articles/:id/edit" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><ArticleEditorPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/discover-admin/stats" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><DiscoverStatsPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <PageLayout branding={branding}><ProfilePage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute>
          <PageLayout branding={branding}><NotificationsPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/notifications/preferences" element={
        <ProtectedRoute>
          <PageLayout branding={branding}><NotificationPreferencesPage /></PageLayout>
        </ProtectedRoute>
      } />

      {/* ── Routes marketplace (publiques) ── */}
      <Route path="/landing"        element={<LandingPage />} />
      <Route path="/pro-register"   element={<PublicChrome><ProRegisterPage /></PublicChrome>} />
      <Route path="/devenir-livreur" element={<PublicChrome><DeliveryRegisterPage /></PublicChrome>} />
      <Route path="/marketplace"   element={<MarketplacePage />} />
      <Route path="/marketplace/search" element={<PublicChrome><SearchResultsPage /></PublicChrome>} />
      <Route path="/product/:module/:id" element={<PublicChrome><ProductDetailPage /></PublicChrome>} />
      <Route path="/r/:slug"       element={<PublicChrome><RestaurantPage /></PublicChrome>} />

      {/* ── URLs SEO canoniques (voir backend SSR modules/seo/) — /r/:slug et
           /product/:module/:id ci-dessus restent actifs, non retirés ── */}
      <Route path="/restaurants"       element={<Navigate to="/marketplace?type=restaurant" replace />} />
      <Route path="/restaurants/:slug" element={<PublicChrome><RestaurantPage /></PublicChrome>} />
      <Route path="/produits/:slug"    element={<PublicChrome><ProductDetailPage /></PublicChrome>} />
      {/* ── iFilino Discover (Discover) ── */}
      <Route path="/discover/:lang/article/:slug" element={<ArticlePage />} />
      <Route path="/discover/:lang/:rubrique"     element={<DiscoverHomePage />} />
      <Route path="/discover/:lang"               element={<DiscoverHomePage />} />
      <Route path="/discover/article/:slug" element={<ArticlePage />} />
      <Route path="/discover/:rubrique"     element={<DiscoverHomePage />} />
      <Route path="/discover"               element={<DiscoverHomePage />} />
      {/* iFilino Comics */}
      <Route path="/comics" element={<PlayRoute><ComicsChrome><ComicsHomePage /></ComicsChrome></PlayRoute>} />
      <Route path="/comics/search" element={<PlayRoute><ComicsChrome><ComicsSearchPage /></ComicsChrome></PlayRoute>} />
      <Route path="/comics/library" element={<PlayRoute><ComicsChrome><ComicsLibraryPage /></ComicsChrome></PlayRoute>} />
      <Route path="/comics/login" element={<Suspense fallback={<PlayRouteFallback/>}><ComicsLoginPage /></Suspense>} />
      <Route path="/comics/account" element={<Suspense fallback={<PlayRouteFallback/>}><ComicsUserDashboard /></Suspense>} />
      <Route path="/comics/series/:slug" element={<PlayRoute><ComicsChrome><ComicDetailPage /></ComicsChrome></PlayRoute>} />
      <Route path="/comics/read/:slug/:chapter" element={<PlayRoute><ComicsChrome reader><ComicReaderPage /></ComicsChrome></PlayRoute>} />
      {/* ── iFilino Sports ── */}
      <Route path="/sports/content/:slug" element={<Suspense fallback={<PlayRouteFallback/>}><PortalDetailPage portal="sports"/></Suspense>} />
      <Route path="/sports/:section?" element={<Suspense fallback={<PlayRouteFallback/>}><PortalPage portal="sports"/></Suspense>} />
      {/* ── iFilino Kids — /kids/:lang/... (en/fr/ar), miroir du pattern /discover/:lang ── */}
      <Route path="/kids/:lang/content/:slug" element={<Suspense fallback={<PlayRouteFallback/>}><PortalDetailPage portal="kids"/></Suspense>} />
      <Route path="/kids/:lang/read/:slug" element={<Suspense fallback={<PlayRouteFallback/>}><PortalDetailPage portal="kids" reader/></Suspense>} />
      <Route path="/kids/:lang/premium" element={<Suspense fallback={<PlayRouteFallback/>}><KidsPremiumPage/></Suspense>} />
      <Route path="/kids/:lang/login" element={<Suspense fallback={<PlayRouteFallback/>}><KidsAuthPage/></Suspense>} />
      <Route path="/kids/:lang/profile" element={<Suspense fallback={<PlayRouteFallback/>}><KidsProfilePage/></Suspense>} />
      <Route path="/kids/:lang/purchases" element={<Suspense fallback={<PlayRouteFallback/>}><KidsPurchasesPage/></Suspense>} />
      <Route path="/kids/:lang/books" element={<KidsBooksRedirect/>} />
      <Route path="/kids/:lang/book/:slug" element={<Suspense fallback={<PlayRouteFallback/>}><BookLandingPage/></Suspense>} />
      <Route path="/kids/:lang/story/:slug" element={<Suspense fallback={<PlayRouteFallback/>}><StoryReaderPage/></Suspense>} />
      {/* ── Study (leçons) — vit dans la section "Learn" déjà présente dans la nav Kids ── */}
      <Route path="/kids/:lang/learn/:slug" element={<Suspense fallback={<PlayRouteFallback/>}><StudyLessonPage/></Suspense>} />
      <Route path="/kids/:lang/learn" element={<Suspense fallback={<PlayRouteFallback/>}><StudyHomePage/></Suspense>} />
      <Route path="/kids/:lang/study/:taxonomy" element={<Suspense fallback={<PlayRouteFallback/>}><StudyHomePage/></Suspense>} />
      <Route path="/kids/:lang/study" element={<Suspense fallback={<PlayRouteFallback/>}><StudyHomePage/></Suspense>} />
      <Route path="/kids/:lang/:section/:taxonomy" element={<KidsHomeOrSectionRoute/>} />
      <Route path="/kids/:lang/:section?" element={<KidsHomeOrSectionRoute/>} />
      {/* ── Anciennes URLs /kids/... sans langue — redirigées vers /kids/:lang/... ── */}
      <Route path="/kids" element={<KidsLegacyRedirect toSuffix={() => ''}/>} />
      <Route path="/kids/content/:slug" element={<KidsLegacyRedirect toSuffix={p => `/content/${p.slug}`}/>} />
      <Route path="/kids/premium" element={<KidsLegacyRedirect toSuffix={() => '/premium'}/>} />
      <Route path="/kids/login" element={<KidsLegacyRedirect toSuffix={() => '/login'}/>} />
      <Route path="/kids/profile" element={<KidsLegacyRedirect toSuffix={() => '/profile'}/>} />
      <Route path="/kids/purchases" element={<KidsLegacyRedirect toSuffix={() => '/purchases'}/>} />
      <Route path="/kids/books" element={<KidsLegacyRedirect toSuffix={() => '/stories'}/>} />
      <Route path="/kids/book/:slug" element={<KidsLegacyRedirect toSuffix={p => `/book/${p.slug}`}/>} />
      <Route path="/kids/story/:slug" element={<KidsLegacyRedirect toSuffix={p => `/story/${p.slug}`}/>} />
      {/* ── /study/... — ancien emplacement (déplacé dans /kids/:lang/learn), redirection ── */}
      <Route path="/study/:lang/lesson/:slug" element={<StudyLegacyRedirect toSuffix={p => `learn/${p.slug}`}/>} />
      <Route path="/study/:lang/*" element={<StudyLegacyRedirect toSuffix={() => 'learn'}/>} />
      <Route path="/study" element={<Navigate to="/kids/en/learn" replace/>} />
      {/* ── Gaming Hub — intégré à iFilino Play (même PlayChrome/thème cyan-
          magenta, voir plan Gaming Hub Frontend). Routes littérales AVANT
          /gaming/:slug (catch-all dynamique), même convention que Discover. */}
      <Route path="/gaming" element={<PlayRoute><PlayChrome><GamingHubHomePage /></PlayChrome></PlayRoute>} />
      <Route path="/gaming/jeux" element={<PlayRoute><PlayChrome><GamingGamesListPage /></PlayChrome></PlayRoute>} />
      <Route path="/gaming/categories" element={<PlayRoute><PlayChrome><GamingCategoriesListPage /></PlayChrome></PlayRoute>} />
      <Route path="/gaming/recherche" element={<PlayRoute><PlayChrome><GamingSearchPage /></PlayChrome></PlayRoute>} />
      <Route path="/gaming/actualites" element={<PlayRoute><PlayChrome><GamingArticlesListPage forcedType="actualite" titleKey="gaminghub.listing.newsTitle" /></PlayChrome></PlayRoute>} />
      <Route path="/gaming/guides" element={<PlayRoute><PlayChrome><GamingArticlesListPage forcedType="guide" titleKey="gaminghub.listing.guidesTitle" /></PlayChrome></PlayRoute>} />
      <Route path="/gaming/tests" element={<PlayRoute><PlayChrome><GamingArticlesListPage forcedType="test" titleKey="gaminghub.listing.testsTitle" /></PlayChrome></PlayRoute>} />
      <Route path="/gaming/articles" element={<PlayRoute><PlayChrome><GamingArticlesListPage /></PlayChrome></PlayRoute>} />
      <Route path="/gaming/articles/:slug" element={<PlayRoute><PlayChrome><GamingArticleDetailPage /></PlayChrome></PlayRoute>} />
      <Route path="/gaming/decouvrir" element={<PlayRoute><PlayChrome><GamingDiscoverFinderPage /></PlayChrome></PlayRoute>} />
      <Route path="/gaming/:slug" element={<PlayRoute><PlayChrome><GameProfilePage /></PlayChrome></PlayRoute>} />

      {/* ── iFilino Play (public, jouable en invité — voir plan iFilino Play) ──
          Chrome dédié (PlayChrome, thème cyan/magenta) au lieu de PublicChrome :
          Play est un sous-produit avec sa propre identité visuelle. */}
      <Route path="/play"              element={<PlayRoute><PlayChrome><PlayHomePage /></PlayChrome></PlayRoute>} />
      <Route path="/play/badges"       element={<PlayRoute><PlayChrome><PlayBadgesPage /></PlayChrome></PlayRoute>} />
      <Route path="/play/rewards"      element={<PlayRoute><PlayChrome><PlayRewardsPage /></PlayChrome></PlayRoute>} />
      <Route path="/play/leaderboard"  element={<PlayRoute><PlayChrome><PlayLeaderboardPage /></PlayChrome></PlayRoute>} />
      <Route path="/play/profile"      element={<PlayRoute><PlayChrome><PlayProfilePage /></PlayChrome></PlayRoute>} />
      <Route path="/play/login"        element={<PlayRoute><PlayChrome footer={false}><PlayAuthPage /></PlayChrome></PlayRoute>} />
      <Route path="/play/:slug/play"   element={<PlayRoute><PlayChrome footer={false} nav={false}><PlayGamePage /></PlayChrome></PlayRoute>} />
      <Route path="/play/:slug"        element={<PlayRoute><PlayChrome><GameDetailsPage /></PlayChrome></PlayRoute>} />

      <Route path="/:city/:category"   element={<CitySeoRedirect />} />
      <Route path="/:city"             element={<CitySeoRedirect />} />

      {/* ── Hanout (public) ── */}
      <Route path="/h/:slug"       element={<PublicChrome><HanoutPage /></PublicChrome>} />
      {/* URL SEO canonique (voir backend SSR modules/seo/) — /h/:slug reste actif */}
      <Route path="/epiceries"       element={<Navigate to="/marketplace?type=hanout" replace />} />
      <Route path="/epiceries/:slug" element={<PublicChrome><HanoutPage /></PublicChrome>} />

      {/* ── Hanout dashboard (pro) ── */}
      <Route path="/hanout-dashboard" element={
        <ProtectedRoute permissions={[PERMISSIONS.HANOUT_ORDER_MANAGE, PERMISSIONS.HANOUT_PRODUCT_MANAGE, PERMISSIONS.HANOUT_STATS_VIEW]}>
          <PageLayout branding={branding}><HanoutDashboard /></PageLayout>
        </ProtectedRoute>
      } />

      {/* ── Pharmacie (public) ── */}
      <Route path="/ph/:slug"      element={<PublicChrome><PharmacyPage /></PublicChrome>} />
      {/* URL SEO canonique (voir backend SSR modules/seo/) — /ph/:slug reste actif */}
      <Route path="/pharmacies"       element={<Navigate to="/marketplace?type=pharmacie" replace />} />
      <Route path="/pharmacies/:slug" element={<PublicChrome><PharmacyPage /></PublicChrome>} />

      {/* ── Pharmacie dashboard (pro) ── */}
      <Route path="/pharmacy-dashboard" element={
        <ProtectedRoute permissions={[PERMISSIONS.PHARMACY_SALE_CREATE, PERMISSIONS.PHARMACY_PRODUCT_MANAGE, PERMISSIONS.PHARMACY_STATS_VIEW, PERMISSIONS.PHARMACY_DELIVERY_MANAGE]}>
          <PageLayout branding={branding}><PharmacyDashboard /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/checkout"      element={<PublicChrome><CheckoutPage /></PublicChrome>} />
      <Route path="/track/:code"   element={<PublicChrome><OrderTrackingPage /></PublicChrome>} />

      {/* ── Table Reservation (luxury booking wizard) ── */}
      <Route path="/r/:slug/reserve" element={<PublicChrome><TableReservationPage /></PublicChrome>} />

      {/* ── QR Smart Ordering ── */}
      <Route path="/qr/:slug/:token" element={<QrTablePage />} />

      {/* ── Auth & profil client ── */}
      <Route path="/account"         element={<PublicChrome><CustomerAuthPage /></PublicChrome>} />
      <Route path="/account/orders"  element={<Navigate to="/dashboard" replace />} />

      {/* ── Dashboard Consommateur ── */}
      <Route path="/dashboard" element={
        <CustomerProtectedRoute><CustomerDashboardLayout><DashboardHomePage /></CustomerDashboardLayout></CustomerProtectedRoute>
      } />
      <Route path="/dashboard/activity" element={
        <CustomerProtectedRoute><CustomerDashboardLayout><ActivityPage /></CustomerDashboardLayout></CustomerProtectedRoute>
      } />
      <Route path="/dashboard/lists" element={
        <CustomerProtectedRoute><CustomerDashboardLayout><ShoppingListsPage /></CustomerDashboardLayout></CustomerProtectedRoute>
      } />
      <Route path="/dashboard/wallet" element={
        <CustomerProtectedRoute><CustomerDashboardLayout><WalletPage /></CustomerDashboardLayout></CustomerProtectedRoute>
      } />
      <Route path="/dashboard/insights" element={
        <CustomerProtectedRoute><CustomerDashboardLayout><InsightsPage /></CustomerDashboardLayout></CustomerProtectedRoute>
      } />
      <Route path="/dashboard/profile" element={
        <CustomerProtectedRoute><CustomerDashboardLayout><DashboardProfilePage /></CustomerDashboardLayout></CustomerProtectedRoute>
      } />
      <Route path="/dashboard/card" element={
        <CustomerProtectedRoute><CustomerDashboardLayout><IfilinoCardPage /></CustomerDashboardLayout></CustomerProtectedRoute>
      } />
      <Route path="/dashboard/notifications" element={
        <CustomerProtectedRoute><CustomerDashboardLayout><NotificationCenterPage /></CustomerDashboardLayout></CustomerProtectedRoute>
      } />
      <Route path="/dashboard/notifications/preferences" element={
        <CustomerProtectedRoute><CustomerDashboardLayout><CustomerNotificationPreferencesPage /></CustomerDashboardLayout></CustomerProtectedRoute>
      } />
      <Route path="/dashboard/assistant" element={
        <CustomerProtectedRoute><CustomerDashboardLayout><AssistantPage /></CustomerDashboardLayout></CustomerProtectedRoute>
      } />
      <Route path="/dashboard/family" element={
        <CustomerProtectedRoute><CustomerDashboardLayout><FamilyPage /></CustomerDashboardLayout></CustomerProtectedRoute>
      } />
      <Route path="/dashboard/gift-cards" element={
        <CustomerProtectedRoute><CustomerDashboardLayout><GiftCardsPage /></CustomerDashboardLayout></CustomerProtectedRoute>
      } />

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

      {/* ── Zones & tarification livraison (module delivery, Phase 5) ── */}
      <Route path="/delivery-zones" element={
        <ProtectedRoute permissions={PERMISSIONS.RESTAURANT_PROFILE_MANAGE}>
          <PageLayout branding={branding}><DeliveryZonesPricingPage /></PageLayout>
        </ProtectedRoute>
      } />

      {/* ── Vérification documents livreurs (module delivery, Phase 6) ── */}
      <Route path="/delivery-documents" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><DeliveryDocumentsReviewPage /></PageLayout>
        </ProtectedRoute>
      } />

      <Route path="/acquisition" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><AcquisitionDashboardPage /></PageLayout>
        </ProtectedRoute>
      } />

      <Route path="/admin/play" element={
        <ProtectedRoute permissions={PERMISSIONS.PLAY_MANAGE}>
          <PageLayout branding={branding}><PlayAdminPage /></PageLayout>
        </ProtectedRoute>
      } />

      <Route path="/admin/gaminghub" element={
        <ProtectedRoute permissions={PERMISSIONS.GAMING_MANAGE}>
          <PageLayout branding={branding}><GamingHubAdminPage /></PageLayout>
        </ProtectedRoute>
      } />



      <Route path="/admin/portals" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><PortalsAdminPage /></PageLayout>
        </ProtectedRoute>
      } />

      <Route path="/admin/media" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><MediaCenterPage /></PageLayout>
        </ProtectedRoute>
      } />

      <Route path="/admin/payments" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><PaymentsAdminPage /></PageLayout>
        </ProtectedRoute>
      } />

      {/* ── Push tokens (debug/admin — routage FCM par compte/rôle/device) ── */}
      <Route path="/admin/portals/:portal/articles/new" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><PortalArticleEditorPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/portals/:portal/articles/:id/edit" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><PortalArticleEditorPage /></PageLayout>
        </ProtectedRoute>
      } />

      <Route path="/admin/study" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><StudyAdminPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/study/lessons/new" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><StudyLessonEditorPage /></PageLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/study/lessons/:id/edit" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><StudyLessonEditorPage /></PageLayout>
        </ProtectedRoute>
      } />

      <Route path="/admin/comics" element={<ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}><Suspense fallback={<div className="app-loading">Loading Comics Control Room…</div>}><ComicsAdminDashboard /></Suspense></ProtectedRoute>} />
      <Route path="/admin/comics/series" element={<ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}><Suspense fallback={<div className="app-loading">Loading series…</div>}><ComicsAdminSeries /></Suspense></ProtectedRoute>} />
      <Route path="/admin/comics/series/:id" element={<ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}><Suspense fallback={<div className="app-loading">Loading editor…</div>}><ComicsSeriesEditor /></Suspense></ProtectedRoute>} />
      <Route path="/admin/comics/import" element={<ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}><Suspense fallback={<div className="app-loading">Loading importer…</div>}><ComicsImportWizard /></Suspense></ProtectedRoute>} />
      <Route path="/admin/comics/imports" element={<ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}><Suspense fallback={<div className="app-loading">Loading import history…</div>}><ComicsImportsPage /></Suspense></ProtectedRoute>} />
      <Route path="/admin/comics/:section" element={<ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}><Suspense fallback={<div className="app-loading">Loading workspace…</div>}><ComicsDashboardSection /></Suspense></ProtectedRoute>} />
      <Route path="/publisher/comics/*" element={<ProtectedRoute roles={['publisher','superadmin']}><Suspense fallback={<div className="app-loading">Loading Publisher Studio…</div>}><ComicsPublisherDashboard /></Suspense></ProtectedRoute>} />

      <Route path="/push-tokens" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <PageLayout branding={branding}><PushTokensPage /></PageLayout>
        </ProtectedRoute>
      } />

      <Route path="/dashboard/ai/*" element={
        <ProtectedRoute permissions={PERMISSIONS.PLATFORM_MANAGE}>
          <Suspense fallback={<div className="app-loading">Chargement du AI Command Center…</div>}>
            <AICommandCenter />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/marketplace" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <CustomerAuthProvider>
          <SubscriptionProvider>
          <KidsProfileProvider>
          <GamificationProvider>
          <I18nProvider>
            <CartProvider>
              <PlayProvider>
                <ConsentProvider>
                  <AppRoutes />
                  <CookieConsentBanner />
                </ConsentProvider>
              </PlayProvider>
            </CartProvider>
          </I18nProvider>
          </GamificationProvider>
          </KidsProfileProvider>
          </SubscriptionProvider>
        </CustomerAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
