import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, ShoppingBag, UserRound } from 'lucide-react';
import { BrandLogo } from '../../../../components/brand/BrandLogo';
import { RUBRIQUES, rubriqueLabel } from '../rubriques';
import { DISCOVER_COPY, discoverPath, normalizeLanguage, rememberDiscoverLanguage } from '../i18n';
import { useCustomerAuth } from '../../../../shared/context/CustomerAuthContext';

function DiscoverUserMenu({ user }) {
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

  function go(path) { setOpen(false); navigate(path); }
  function handleLogout() { setOpen(false); logoutCustomer(); navigate('/discover'); }
  const initials = (user?.nom || '?').trim().slice(0, 1).toUpperCase();

  return (
    <div className="if-user-menu" ref={menuRef}>
      <button type="button" className="if-user-menu-trigger" onClick={() => setOpen(value => !value)} aria-haspopup="menu" aria-expanded={open} aria-label="Mon compte">
        {user?.avatar_url ? <img src={user.avatar_url} alt=""/> : <span>{initials}</span>}
      </button>
      {open && (
        <div className="if-user-menu-panel" role="menu">
          <div className="if-user-menu-header">
            <div className="if-user-menu-avatar">{user?.avatar_url ? <img src={user.avatar_url} alt=""/> : <span>{initials}</span>}</div>
            <div><strong>{user?.nom}</strong><span>{user?.email}</span></div>
          </div>
          <button type="button" role="menuitem" onClick={() => go('/dashboard')}><LayoutDashboard size={16}/> Mon compte</button>
          <button type="button" role="menuitem" onClick={() => go('/dashboard/activity')}><ShoppingBag size={16}/> Mes commandes</button>
          <button type="button" role="menuitem" onClick={() => go('/dashboard/profile')}><UserRound size={16}/> Mon profil</button>
          <div className="if-user-menu-divider"/>
          <button type="button" role="menuitem" className="if-user-menu-logout" onClick={handleLogout}><LogOut size={16}/> Déconnexion</button>
        </div>
      )}
    </div>
  );
}

const MAGAZINE_LINKS = [
  { key: 'restaurants_food' }, { key: 'courses_epiceries' }, { key: 'beaute_bien_etre' }, { key: 'sante_pharmacies' },
  { labelKey: 'recipes', href: '?category=recette', key: 'recettes' }, { key: 'promotions' },
];
const MAGAZINE_MORE_LINKS = [
  { key: 'maison_deco' }, { key: 'famille_enfants' }, { key: 'villes' }, { key: 'evenements' }, { key: 'shopping' }, { key: 'conseils_astuces' },
];

function localizedHref(link, language) {
  if (link.href?.startsWith('?')) return discoverPath(language) + link.href;
  return discoverPath(language, link.key);
}

export function MagazineNavbar({ activeRubrique = '', language = 'ar', languageUrls = null }) {
  const lang = normalizeLanguage(language);
  const copy = DISCOVER_COPY[lang];
  const { user } = useCustomerAuth();
  const changeLanguage = (next) => {
    rememberDiscoverLanguage(next);
    const href = languageUrls?.[next] || discoverPath(next, activeRubrique && activeRubrique !== 'recettes' ? activeRubrique : '');
    window.location.assign(href);
  };
  return (
    <nav className="ifm-nav" aria-label="iFilino Discover navigation">
      <div className="ifm-nav-inner">
        <a href={discoverPath(lang)} className="ifm-nav-brand" aria-label={copy.home + ' iFilino Discover'}>
          <BrandLogo variant="discover" theme="light" size="md" className="ifm-nav-logo" style={{ height: 96, maxWidth: 260 }} />
        </a>
        <div className="ifm-nav-links">
          {MAGAZINE_LINKS.map(link => {
            const label = link.labelKey ? copy[link.labelKey] : rubriqueLabel(link.key, lang);
            const href = localizedHref(link, lang);
            return <a key={link.key} href={href} className={`ifm-nav-link${activeRubrique === link.key ? ' active' : ''}`} aria-current={activeRubrique === link.key ? 'page' : undefined}>{label}</a>;
          })}
          <details className="ifm-nav-more">
            <summary className={`ifm-nav-link ifm-nav-more-trigger${MAGAZINE_MORE_LINKS.some(link => activeRubrique === link.key) ? ' active' : ''}`}>{copy.more}</summary>
            <div className="ifm-nav-more-menu">
              {MAGAZINE_MORE_LINKS.map(link => <a key={link.key} href={localizedHref(link, lang)} className={`ifm-nav-more-link${activeRubrique === link.key ? ' active' : ''}`} aria-current={activeRubrique === link.key ? 'page' : undefined}>{rubriqueLabel(link.key, lang)}</a>)}
            </div>
          </details>
        </div>
        <div className="ifm-nav-actions">
          <button type="button" className={`ifm-lang-btn${lang === 'ar' ? ' active' : ''}`} onClick={() => changeLanguage('ar')} aria-pressed={lang === 'ar'}>العربية</button>
          <button type="button" className={`ifm-lang-btn${lang === 'fr' ? ' active' : ''}`} onClick={() => changeLanguage('fr')} aria-pressed={lang === 'fr'}>FR</button>
          <button type="button" className={`ifm-lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => changeLanguage('en')} aria-pressed={lang === 'en'}>EN</button>
          <a className="ifm-nav-ghost" href="/landing">{copy.home}</a>
          <a className="ifm-nav-ghost" href="/play">🎮 Jouer</a>
          <a className="ifm-nav-primary" href="/marketplace">{copy.order}</a>
          {user ? <DiscoverUserMenu user={user}/> : <a className="ifm-nav-ghost" href="/account">Connexion</a>}
        </div>
      </div>
    </nav>
  );
}

export function MagazineFooter({ language = 'ar' }) {
  const lang = normalizeLanguage(language);
  const copy = DISCOVER_COPY[lang];
  return (
    <footer className="ifm-footer">
      <div className="ifm-footer-inner">
        <div>
          <a href={discoverPath(lang)} className="ifm-footer-brand">iFilino Discover</a>
          <p>{copy.tagline}</p>
        </div>
        <div>
          <h2>{copy.read}</h2>
          <a href={discoverPath(lang)}>{copy.allArticles}</a>
          <a href={discoverPath(lang, 'conseils_astuces')}>{rubriqueLabel('conseils_astuces', lang)}</a>
          <a href={discoverPath(lang, 'promotions')}>{rubriqueLabel('promotions', lang)}</a>
        </div>
        <div>
          <h2>{copy.order}</h2>
          <a href="/marketplace">Marketplace</a>
          <a href="/marketplace?type=restaurant">Restaurants</a>
          <a href="/marketplace?type=pharmacie">Pharmacies</a>
        </div>
        <div>
          <h2>iFilino</h2>
          <a href="/landing">{copy.home}</a>
          <a href="/pro-register">{copy.merchants}</a>
          <a href="/login">{copy.proArea}</a>
        </div>
      </div>
    </footer>
  );
}
