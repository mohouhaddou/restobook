import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, ShoppingBag, UserRound } from 'lucide-react';
import { BrandLogo } from '../brand/BrandLogo';
import { NotificationBell } from '../ui/NotificationBell';
import { useCart } from '../../../contexts/CartContext';
import { useCustomerAuth } from '../../../contexts/CustomerAuthContext';
import { useMkTheme } from '../../hooks/useMkTheme';
import { BRAND } from '../../../config/branding';
import { useI18n } from '../../../i18n/config';
import { LanguageSelect } from '../i18n/LanguageSelect';

function PublicUserMenu({ user, navigate, t }) {
  const [open, setOpen] = useState(false);
  const { logoutCustomer } = useCustomerAuth();
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = event => { if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false); };
    const onEscape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => { document.removeEventListener('mousedown', onOutside); document.removeEventListener('keydown', onEscape); };
  }, [open]);

  function go(path) { setOpen(false); navigate(path); }
  function handleLogout() { setOpen(false); logoutCustomer(); navigate('/'); }
  const initials = (user?.nom || '?').trim().slice(0, 1).toUpperCase();

  return (
    <div className="if-user-menu" ref={menuRef}>
      <button type="button" className="if-user-menu-trigger" onClick={() => setOpen(value => !value)} aria-haspopup="menu" aria-expanded={open} aria-label={t('common.account')}>
        {user?.avatar_url ? <img src={user.avatar_url} alt=""/> : <span>{initials}</span>}
      </button>
      {open && (
        <div className="if-user-menu-panel" role="menu">
          <div className="if-user-menu-header">
            <div className="if-user-menu-avatar">{user?.avatar_url ? <img src={user.avatar_url} alt=""/> : <span>{initials}</span>}</div>
            <div><strong>{user?.nom}</strong><span>{user?.email}</span></div>
          </div>
          <button type="button" role="menuitem" onClick={() => go('/dashboard')}><LayoutDashboard size={16}/> {t('common.account')}</button>
          <button type="button" role="menuitem" onClick={() => go('/dashboard/activity')}><ShoppingBag size={16}/> {t('common.my_orders')}</button>
          <button type="button" role="menuitem" onClick={() => go('/dashboard/profile')}><UserRound size={16}/> {t('common.profile')}</button>
          <div className="if-user-menu-divider"/>
          <button type="button" role="menuitem" className="if-user-menu-logout" onClick={handleLogout}><LogOut size={16}/> {t('common.logout')}</button>
        </div>
      )}
    </div>
  );
}

const NAV_LINKS = [
  { key: 'common.marketplace', to: '/marketplace', match: '/marketplace' },
  { key: 'common.discover', to: '/discover', match: '/discover' },
  { key: 'common.gaming', to: '/gaming', match: '/gaming' },
  { key: 'sports.nav.home', to: '/sports', match: '/sports' },
  { key: 'kids.nav.home', to: '/kids', match: '/kids' },
  { key: 'common.businesses', to: '/pro-register', match: '/pro-register' },
];

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

function resetPublicScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  document.querySelectorAll('.if-public-main, .mk-explorer-panel, .mk-scroll, [data-scroll-root]').forEach(node => {
    if (node && typeof node.scrollTo === 'function') {
      node.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } else if (node) {
      node.scrollTop = 0;
      node.scrollLeft = 0;
    }
  });
}

const FOOTER_COLUMNS = [
  {
    titleKey: 'marketplace.nav.discover',
    links: [
      { key: 'common.marketplace', to: '/marketplace' },
      { key: 'common.discover', to: '/discover' },
      { key: 'common.gaming', to: '/gaming' },
      { key: 'common.restaurants', to: '/marketplace?type=restaurant' },
      { key: 'common.pharmacies', to: '/marketplace?type=pharmacie' },
    ],
  },
  {
    titleKey: 'marketplace.nav.businesses',
    links: [
      { key: 'common.restaurants', to: '/restaurants' },
      { key: 'common.grocery', to: '/epiceries' },
      { key: 'common.pharmacies', to: '/pharmacies' },
      { key: 'common.create_business', to: '/pro-register' },
    ],
  },
  {
    titleKey: 'marketplace.nav.account',
    links: [
      { key: 'common.customer_login', to: '/account' },
      { key: 'common.my_orders', to: '/dashboard' },
      { key: 'common.pro_area', to: '/login' },
      { key: 'common.become_courier', to: '/devenir-livreur' },
    ],
  },
];

export function PublicChrome({ children, footer = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, toggleTheme] = useMkTheme();
  const { itemCount } = useCart();
  const { token: customerToken, user: customerUser } = useCustomerAuth();
  const { t } = useI18n();

  function goToCart() {
    navigate('/checkout');
  }

  useIsoLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    resetPublicScroll();
    const frame = window.requestAnimationFrame(resetPublicScroll);
    const timers = [80, 220, 420].map(delay => window.setTimeout(resetPublicScroll, delay));

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach(timer => window.clearTimeout(timer));
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = previousRestoration || 'auto';
      }
    };
  }, [location.pathname]);

  return (
    <div className={`mk-wrap mk-${theme} if-public-shell`}>
      <nav className="if-public-nav" aria-label="Navigation iFilino">
        <button className="if-public-brand" type="button" onClick={() => navigate('/landing')} aria-label={t('common.home')}>
          <BrandLogo variant="full" theme={theme} size="xs" style={{ height: 70 }} />
        </button>

        <div className="if-public-links" aria-label="Navigation principale">
          {NAV_LINKS.map(link => (
            <button
              key={link.to}
              type="button"
              className={`if-public-link${location.pathname.startsWith(link.match) ? ' active' : ''}`}
              onClick={() => navigate(link.to)}
            >
              {t(link.key)}
            </button>
          ))}
        </div>

        <div className="if-public-actions">
          <button type="button" className="if-public-icon-btn" onClick={toggleTheme} aria-label={t('common.theme')}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <LanguageSelect compact />
          {customerToken && <NotificationBell token={customerToken} theme={theme} onNavigate={url => navigate(url)} />}
          <button type="button" className="if-public-cart" onClick={goToCart} aria-label={t('common.cart')}>
            <span>{t('common.cart')}</span>
            {itemCount > 0 && <strong>{itemCount}</strong>}
          </button>
          {customerUser ? (
            <PublicUserMenu user={customerUser} navigate={navigate} t={t}/>
          ) : (
            <button type="button" className="if-public-account" onClick={() => navigate('/account')}>{t('common.login')}</button>
          )}
        </div>
      </nav>

      <main className="if-public-main">{children}</main>

      {footer && (
        <footer className="if-public-footer">
          <div className="if-public-footer-inner">
            <div className="if-public-footer-brand">
              <BrandLogo variant="footer" theme={theme === 'dark' ? 'dark' : 'light'} size="xs" style={{ height: 92 }} />
              <p>{t('common.public_footer_copy')}</p>
            </div>
            {FOOTER_COLUMNS.map(col => (
              <div key={col.titleKey} className="if-public-footer-col">
                <h2>{t(col.titleKey)}</h2>
                {col.links.map(link => (
                  <button key={t(link.key)} type="button" onClick={() => navigate(link.to)}>{t(link.key)}</button>
                ))}
              </div>
            ))}
          </div>
          <div className="if-public-footer-bottom">
            <span>© {new Date().getFullYear()} {BRAND.APP_NAME}</span>
            <span>{t('common.local_tagline')}</span>
          </div>
        </footer>
      )}
    </div>
  );
}

export default PublicChrome;
