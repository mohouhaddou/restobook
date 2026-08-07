import React from 'react';
import { NavLink } from 'react-router-dom';
import { PRIMARY_NAV } from './navConfig';
import { useI18n } from '../../../i18n/config';
import { DashboardIcon } from '../../../shared/components/ui/DashboardIcon';

export function CustomerBottomNav() {
  const { t } = useI18n();
  return (
    <nav className="mk-bottom-bar" style={{ display: 'none' }}>
      {PRIMARY_NAV.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/dashboard'}
          className={({ isActive }) => `mk-bottom-tab${isActive ? ' active' : ''}`}
        >
          <span className="mk-bottom-tab-icon"><DashboardIcon icon={item.icon} size={20} /></span>
          <span>{t(item.labelKey) || item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
