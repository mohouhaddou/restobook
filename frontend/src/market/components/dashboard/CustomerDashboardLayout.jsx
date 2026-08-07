import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../../../contexts/CustomerAuthContext';
import { useMkTheme } from '../../../shared/hooks/useMkTheme';
import { NotificationBell } from '../../../shared/components/ui/NotificationBell';
import { CustomerSidebar } from './CustomerSidebar';
import { CustomerBottomNav } from './CustomerBottomNav';
import { PRIMARY_NAV, SECONDARY_NAV } from './navConfig';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

function currentTitle(pathname) {
  const all = [...PRIMARY_NAV, ...SECONDARY_NAV];
  const match = all.find(item => item.to === pathname || (item.to !== '/dashboard' && pathname.startsWith(item.to)));
  return match?.label || 'Dashboard';
}

export function CustomerDashboardLayout({ children }) {
  const { user, token, logoutCustomer } = useCustomerAuth();
  const [theme, toggleTheme] = useMkTheme();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logoutCustomer();
    navigate('/account', { replace: true });
  }

  return (
    <div className={`mk-wrap mk-${theme}`} style={{ minHeight: '100vh', background: 'var(--mk-bg)', color: 'var(--mk-text)', transition: 'background .3s' }}>
      <div className="ifd-shell">
        <CustomerSidebar theme={theme} user={user} onToggleTheme={toggleTheme} onLogout={handleLogout} />

        <div className="ifd-main">
          <div className="ifd-topbar-mobile">
            <span style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>{currentTitle(location.pathname)}</span>
            <button
              onClick={toggleTheme}
              style={{ width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--mk-pill)', color: 'var(--mk-text)', fontSize: 14, display: 'grid', placeItems: 'center' }}
            >
              <PremiumIcon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
            <NotificationBell token={token} theme={theme} onNavigate={url => navigate(url)} centerUrl="/dashboard/notifications" />
          </div>

          <main className="ifd-content" style={{ padding: 'clamp(14px,3vw,32px)', maxWidth: 1200, margin: '0 auto' }}>
            {children}
          </main>
        </div>
      </div>

      <CustomerBottomNav />
    </div>
  );
}
