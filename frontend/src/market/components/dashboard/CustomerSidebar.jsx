import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../../../shared/components/brand/BrandLogo';
import { PRIMARY_NAV, SECONDARY_NAV } from './navConfig';
import { useI18n } from '../../../i18n/config';
import { DashboardIcon } from '../../../shared/components/ui/DashboardIcon';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

export function CustomerSidebar({ theme, user, onToggleTheme, onLogout }) {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <aside className="ifd-sidebar">
      <div style={{ padding: '4px 10px 18px' }}>
        <BrandLogo variant="full" theme={theme} size="sm" />
      </div>

      <nav style={{ flex: 1 }}>
        {PRIMARY_NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) => `ifd-sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="ifd-ico"><DashboardIcon icon={item.icon} size={18} /></span>
            {t(item.labelKey) || item.label}
          </NavLink>
        ))}

        <div className="ifd-sidebar-section">{t('customer.nav.more')}</div>
        {SECONDARY_NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `ifd-sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="ifd-ico">{item.icon}</span>
            {t(item.labelKey) || item.label}
            {item.soon && <span className="ifd-soon">{t('common.soon')}</span>}
          </NavLink>
        ))}

        <div className="ifd-sidebar-section">{t('customer.nav.shop')}</div>
        <a className="ifd-sidebar-link" href="/marketplace" onClick={e => { e.preventDefault(); navigate('/marketplace'); }}>
          <span className="ifd-ico"><DashboardIcon icon="🧭" size={18} /></span>
          {t('customer.nav.backToMarketplace')}
        </a>
      </nav>

      <div style={{ borderTop: '1px solid var(--mk-border)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: 'var(--mk-orange-light)',
          color: 'var(--mk-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 14, flexShrink: 0,
        }}>
          {(user?.nom || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mk-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.nom || t('glossary.customer')}
          </div>
          <button onClick={onLogout} style={{
            background: 'none', border: 'none', padding: 0, color: 'var(--mk-muted)',
            fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
          }}>{t('common.logout')}</button>
        </div>
        <button
          onClick={onToggleTheme}
          title={t('common.theme')}
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--mk-pill)', color: 'var(--mk-text)', fontSize: 14,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <PremiumIcon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
      </div>
    </aside>
  );
}
