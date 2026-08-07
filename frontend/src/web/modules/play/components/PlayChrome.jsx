import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Medal, Moon, Sun, Trophy, UserRound } from 'lucide-react';
import { LanguageSelect } from '../../../../shared/components/i18n/LanguageSelect';
import { useCustomerAuth } from '../../../../contexts/CustomerAuthContext';
import { usePlayContext } from '../PlayContext';
import { useI18n } from '../../../../i18n/config';
import usePlayTheme from '../hooks/usePlayTheme';
import '../play.css';

const NAV_LINKS = [
  { key: 'common.marketplace', to: '/marketplace' },
  { key: 'common.discover', to: '/discover' },
  { key: 'common.gaming', to: '/gaming' },
];

function PlayUserMenu({ user, profile, onNavigate }) {
  const [open, setOpen] = useState(false);
  const { logoutCustomer } = useCustomerAuth();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = event => { if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false); };
    const onEscape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => { document.removeEventListener('mousedown', onOutside); document.removeEventListener('keydown', onEscape); };
  }, [open]);

  function go(path) { setOpen(false); onNavigate?.(); navigate(path); }
  function handleLogout() { setOpen(false); logoutCustomer(); navigate('/play'); }

  return (
    <div className="play-user-menu" ref={menuRef}>
      <button type="button" className="play-user-menu-trigger" onClick={() => setOpen(value => !value)} aria-haspopup="menu" aria-expanded={open} aria-label="Menu du profil">
        {profile?.avatarUrl ? <img src={profile.avatarUrl} alt=""/> : profile?.avatarIcon ? <span>{profile.avatarIcon}</span> : <UserRound size={18}/>}
      </button>
      {open && (
        <div className="play-user-menu-panel" role="menu">
          <div className="play-user-menu-header">
            <div className="play-user-menu-avatar">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt=""/> : profile?.avatarIcon ? <span>{profile.avatarIcon}</span> : <UserRound size={20}/>}</div>
            <div><strong>{profile?.displayName || user?.nom || 'Joueur iFilino'}</strong><span>Niveau {profile?.currentLevel || 1} · {profile?.levelName || 'Explorateur'}</span></div>
          </div>
          <button type="button" role="menuitem" onClick={() => go('/play/profile')}><UserRound size={16}/> Mon profil</button>
          <button type="button" role="menuitem" onClick={() => go('/play/badges')}><Medal size={16}/> Mes badges</button>
          <button type="button" role="menuitem" onClick={() => go('/play/leaderboard')}><Trophy size={16}/> Classement</button>
          <div className="play-user-menu-divider"/>
          <button type="button" role="menuitem" className="play-user-menu-logout" onClick={handleLogout}><LogOut size={16}/> Déconnexion</button>
        </div>
      )}
    </div>
  );
}

export default function PlayChrome({ children, footer = true, nav = true }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useCustomerAuth();
  const { profile } = usePlayContext();
  const { theme, toggle } = usePlayTheme();

  return (
    <div className={`play-chrome${nav ? '' : ' no-nav'}`}>
      {nav && (
        <header className="play-chrome-nav">
          <button type="button" className="play-chrome-brand" onClick={() => navigate('/play')} aria-label="iFilino Play">
            <img src="/brand/ifilino_play_mark.png" alt="" />
          </button>
          <nav className="play-chrome-links" aria-label="Navigation iFilino">
            {NAV_LINKS.map(link => (
              <Link key={link.to} to={link.to} className="play-chrome-link">{t(link.key)}</Link>
            ))}
          </nav>
          <div className="play-chrome-actions">
            <button type="button" className="play-chrome-icon-btn" onClick={toggle} aria-pressed={theme === 'light'} aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'} title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
              {theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}
            </button>
            <LanguageSelect compact />
            {user ? (
              <PlayUserMenu user={user} profile={profile}/>
            ) : (
              <button type="button" className="play-chrome-account" onClick={() => navigate('/play/login')}>{t('common.login')}</button>
            )}
          </div>
        </header>
      )}

      <main className="play-chrome-main">{children}</main>

      {footer && (
        <footer className="play-chrome-footer">
          <div className="play-chrome-footer-inner">
            <div className="play-chrome-footer-brand">
              <img src="/brand/ifilino_play_mark.png" alt="iFilino Play" />
              <p>Jeux gratuits, défis quotidiens et récompenses — la pause jeu d’iFilino.</p>
            </div>
            <nav aria-label="Liens iFilino Play">
              <Link to="/marketplace">{t('common.marketplace')}</Link>
              <Link to="/discover">{t('common.discover')}</Link>
              <Link to="/gaming">{t('common.gaming')}</Link>
              <Link to="/play/leaderboard">Classement</Link>
              <Link to="/play/rewards">Récompenses</Link>
            </nav>
          </div>
          <div className="play-chrome-footer-bottom">
            <span>© {new Date().getFullYear()} iFilino Play</span>
          </div>
        </footer>
      )}
    </div>
  );
}
