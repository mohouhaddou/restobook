// Navigation du Dashboard Consommateur — source unique pour la sidebar
// desktop et le bottom-nav mobile (5 items primaires imposés par le spec).
export const PRIMARY_NAV = [
  { to: '/dashboard',           icon: '🏠', label: 'Accueil', labelKey: 'customer.nav.home' },
  { to: '/dashboard/activity',  icon: '🛒', label: 'Activité', labelKey: 'customer.nav.activity' },
  { to: '/dashboard/wallet',    icon: '💳', label: 'Wallet', labelKey: 'customer.nav.wallet' },
  { to: '/dashboard/insights',  icon: '📊', label: 'Insights', labelKey: 'customer.nav.insights' },
  { to: '/dashboard/profile',   icon: '👤', label: 'Profil', labelKey: 'customer.nav.profile' },
];

export const SECONDARY_NAV = [
  { to: '/dashboard/lists',       icon: '📝', label: 'Listes de courses', labelKey: 'customer.nav.shoppingLists' },
  { to: '/dashboard/card',        icon: '🪪', label: 'Carte iFilino', labelKey: 'customer.nav.ifilinoCard' },
  { to: '/dashboard/notifications', icon: '🔔', label: 'Notifications', labelKey: 'customer.nav.notifications' },
  { to: '/dashboard/assistant',   icon: '🤖', label: 'Assistant IA', labelKey: 'customer.nav.assistant' },
  { to: '/play',                  icon: '🎮', label: 'iFilino Play', labelKey: 'customer.nav.play' },
  { to: '/gaming',                icon: '🕹️', label: 'Gaming Hub', labelKey: 'customer.nav.gaming' },
  { to: '/dashboard/family',      icon: '👨‍👩‍👧', label: 'Espace Famille', labelKey: 'customer.nav.family', soon: true },
  { to: '/dashboard/gift-cards',  icon: '🎁', label: 'Cartes cadeaux', labelKey: 'customer.nav.giftCards', soon: true },
];
