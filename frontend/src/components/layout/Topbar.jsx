import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

export function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { count, notifs, open: openNotifs, markRead, markAllRead } = useNotifications();

  const initials = (() => {
    const s = (user?.nom || user?.matricule || '').trim();
    return s.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'U';
  })();

  return (
    <header className="app-topbar">
      {/* Mobile hamburger (hidden on desktop) */}
      <button className="d-lg-none tb-icon-btn" onClick={onMenuClick} aria-label="Menu">
        <MenuIcon />
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right actions */}
      <div className="d-flex align-items-center gap-2">

        {/* Notifications */}
        {user && (
          <div className="dropdown">
            <button
              className="tb-icon-btn position-relative"
              onClick={openNotifs}
              data-bs-toggle="dropdown"
              title="Notifications"
            >
              <BellIcon />
              {count > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 15, height: 15,
                  background: 'var(--rb-orange)', color: '#fff',
                  borderRadius: '50%', fontSize: 8, fontWeight: 700,
                  display: 'grid', placeItems: 'center',
                }}>
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
            <div className="dropdown-menu dropdown-menu-end" style={{ minWidth: 320 }}>
              <div style={{ padding: '4px 6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 10, color: 'var(--rb-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Notifications</span>
                {count > 0 && <button onClick={markAllRead} style={{ fontSize: 10, color: 'var(--rb-orange)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Tout lu</button>}
              </div>
              {notifs.length === 0
                ? <div style={{ padding: '16px 8px', color: 'var(--rb-muted)', fontSize: 13, textAlign: 'center' }}>
                    Aucune notification
                  </div>
                : notifs.slice(0, 6).map(n => {
                  const unread = n.status === 'unread';
                  return (
                    <div key={n.id}
                      className="dropdown-item"
                      style={{ cursor: 'pointer', whiteSpace: 'normal', background: unread ? 'rgba(255,138,0,.07)' : 'transparent', borderLeft: unread ? '3px solid var(--rb-orange)' : '3px solid transparent' }}
                      onClick={() => markRead(n.id)}
                    >
                      <div style={{ fontWeight: unread ? 700 : 600, fontSize: 13 }}>{n.title}</div>
                      {n.message && <div style={{ color: 'var(--rb-muted)', fontSize: 12, marginTop: 2 }}>{n.message}</div>}
                    </div>
                  );
                })
              }
            </div>
          </div>
        )}

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
              <Link className="dropdown-item" to="/profile">Mon profil</Link>
              <div style={{ borderTop: '1px solid var(--rb-border)', margin: '4px 0' }} />
              <button
                className="dropdown-item"
                style={{ color: '#DC2626', width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
                onClick={logout}
              >
                Déconnexion
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
