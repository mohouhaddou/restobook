import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { NotificationBell } from '../ui/NotificationBell';
import { LanguageSelect } from '../i18n/LanguageSelect';
import { useI18n } from '../../../i18n/config';

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

export function Topbar({ onMenuClick }) {
  const { user, token, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const initials = (() => {
    const s = (user?.nom || user?.matricule || '').trim();
    return s.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'U';
  })();

  return (
    <header className="app-topbar">
      {/* Mobile hamburger (hidden on desktop) */}
      <button className="d-lg-none tb-icon-btn" onClick={onMenuClick} aria-label={t('common.menu')}>
        <MenuIcon />
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right actions */}
      <div className="d-flex align-items-center gap-2">

        {/* Notifications — composant unifié, partagé avec le dashboard client */}
        <LanguageSelect compact />
        {user && <NotificationBell token={token} theme="light" onNavigate={(url) => navigate(url)} centerUrl="/notifications" />}

        {/* User avatar + dropdown */}
        {user && (
          <div className="dropdown">
            <button
              className="d-flex align-items-center gap-2 border-0 bg-transparent"
              style={{ cursor: 'pointer', padding: '4px', borderRadius: 10 }}
              data-bs-toggle="dropdown"
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'var(--rb-orange)', color: '#fff',
                display: 'grid', placeItems: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {initials}
              </div>
              <div className="d-none d-md-block text-start" style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rb-text)' }}>
                  {user.nom || user.matricule}
                </div>
                <div style={{ fontSize: 10, color: 'var(--rb-orange)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {user.role}
                </div>
              </div>
            </button>
            <div className="dropdown-menu dropdown-menu-end" style={{ minWidth: 200 }}>
              <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--rb-border)', marginBottom: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{user.nom || user.matricule}</div>
                <div style={{ fontSize: 11, color: 'var(--rb-muted)' }}>{user.email || user.matricule}</div>
              </div>
              <Link className="dropdown-item" to="/profile">{t('common.profile')}</Link>
              <div style={{ borderTop: '1px solid var(--rb-border)', margin: '4px 0' }} />
              <button
                className="dropdown-item"
                style={{ color: '#DC2626', width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
                onClick={logout}
              >
                {t('common.logout')}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
