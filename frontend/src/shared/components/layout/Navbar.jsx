import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { BrandLogo } from '../brand/BrandLogo';
import { BRAND } from '../../../config/branding';

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="5" width="18" height="2" rx="1"/>
    <rect x="3" y="11" width="18" height="2" rx="1"/>
    <rect x="3" y="17" width="18" height="2" rx="1"/>
  </svg>
);

export function Navbar({ branding }) {
  const { user, logout } = useAuth();
  const brandName = branding?.brand_name || BRAND.APP_NAME;
  const { count, notifs, open: openNotifs, markRead } = useNotifications();

  const initials = (() => {
    const s = (user?.nom || user?.matricule || '').trim();
    return s.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'U';
  })();

  return (
    <nav className="rb-navbar d-flex align-items-center justify-content-between gap-3">
      {/* Logo + marque */}
      <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none flex-shrink-0">
        {branding?.brand_logo_url
          ? <>
              <img src={branding.brand_logo_url} alt={brandName} height={30} style={{borderRadius:6, maxWidth:140, objectFit:'contain'}} />
              <span className="rb-logo-name d-none d-sm-inline">{brandName}</span>
            </>
          : <BrandLogo variant="full" theme="light" size="xs" style={{ height:96 }} />
        }
      </Link>

      {/* Actions droite */}
      <div className="d-flex align-items-center gap-2">
        {/* Notifications */}
        {user && (
          <div className="dropdown">
            <button
              className="btn btn-outline-secondary position-relative"
              style={{width:38, height:38, padding:0, display:'grid', placeItems:'center'}}
              onClick={openNotifs} data-bs-toggle="dropdown" title="Notifications"
            >
              <BellIcon />
              {count > 0 && (
                <span style={{
                  position:'absolute', top:2, right:2, width:16, height:16,
                  background:'var(--rb-orange)', color:'#fff', borderRadius:'50%',
                  fontSize:9, fontWeight:700, display:'grid', placeItems:'center',
                  lineHeight:1,
                }}>
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
            <div className="dropdown-menu dropdown-menu-end" style={{minWidth:320, padding:8}}>
              <div style={{padding:'4px 8px 8px', fontWeight:600, fontSize:12, color:'var(--rb-muted)'}}>
                NOTIFICATIONS
              </div>
              {notifs.length === 0
                ? <div style={{padding:'12px 8px', color:'var(--rb-muted)', fontSize:13, textAlign:'center'}}>
                    Aucune notification non lue
                  </div>
                : notifs.slice(0, 5).map(n => (
                  <div key={n.id} style={{padding:'10px 8px', borderRadius:8, marginBottom:4, background:'var(--rb-surface)'}}>
                    <div style={{fontWeight:600, fontSize:13}}>{n.title}</div>
                    <div style={{color:'var(--rb-muted)', fontSize:12, marginTop:2}}>{n.message}</div>
                    {n.data?.user_id && (
                      <div className="d-flex gap-2 mt-2">
                        <button className="btn btn-sm btn-primary" style={{fontSize:11, padding:'2px 10px'}}
                          onClick={() => markRead(n.id)}>Activer</button>
                        <button className="btn btn-sm btn-outline-secondary" style={{fontSize:11, padding:'2px 10px'}}
                          onClick={() => markRead(n.id)}>Ignorer</button>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* Toggler mobile */}
        <button className="btn btn-outline-secondary d-lg-none"
          style={{width:38, height:38, padding:0, display:'grid', placeItems:'center'}}
          data-bs-toggle="collapse" data-bs-target="#rbSidebar">
          <MenuIcon />
        </button>

        {/* Avatar + menu profil */}
        {user && (
          <div className="dropdown">
            <button className="d-flex align-items-center gap-2 border-0 bg-transparent p-0 cursor-pointer"
              data-bs-toggle="dropdown" style={{cursor:'pointer'}}>
              <div className="avatar" style={{width:36, height:36, fontSize:13}}>
                {initials}
              </div>
              <div className="d-none d-lg-block text-start" style={{lineHeight:1.3}}>
                <div style={{fontSize:13, fontWeight:600, color:'var(--rb-text)'}}>{user.nom || user.matricule}</div>
                <div style={{fontSize:10, color:'var(--rb-orange)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em'}}>
                  {user.role}
                </div>
              </div>
            </button>
            <div className="dropdown-menu dropdown-menu-end" style={{padding:8, minWidth:200}}>
              <div style={{padding:'6px 10px 10px', borderBottom:'1px solid var(--rb-border)', marginBottom:6}}>
                <div style={{fontWeight:600, fontSize:13}}>{user.nom || user.matricule}</div>
                <div style={{fontSize:11, color:'var(--rb-muted)'}}>{user.email || user.matricule}</div>
              </div>
              <Link className="dropdown-item" to="/profile" style={{borderRadius:6, fontSize:13}}>Mon profil</Link>
              <div style={{borderTop:'1px solid var(--rb-border)', margin:'6px 0'}} />
              <button className="dropdown-item" style={{borderRadius:6, fontSize:13, color:'#DC2626'}} onClick={logout}>
                Déconnexion
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
