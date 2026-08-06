import React, { useState } from 'react';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../i18n/config';

export function PageLayout({ children, branding, heroUrl }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <div className="app-shell">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        branding={branding}
      />
      <div className="app-main">
        <Topbar
          onMenuClick={() => setSidebarOpen(v => !v)}
          branding={branding}
        />
        <main className="app-content">
          {heroUrl && (
            <div className="rb-hero" style={{ backgroundImage: `url('${heroUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              <div className="rb-hero__overlay" />
              <div className="rb-hero__content">
                <h2 className="rb-hero__title">{t('dashboard.hero.title', { name: user?.nom ? `, ${user.nom.split(' ')[0]}` : '' })}</h2>
                <p className="rb-hero__sub">{t('dashboard.hero.subtitle')}</p>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
