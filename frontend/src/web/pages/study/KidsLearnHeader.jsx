import React from 'react';
import { Link } from 'react-router-dom';
import { PORTAL_CONFIG } from '../../modules/portals/config';
import { PortalBrand } from '../../modules/portals/components/PortalBrand';
import { useCustomerAuth } from '../../../shared/context/CustomerAuthContext';

// Même en-tête que PortalPage.jsx (marque + nav + connexion), pour que /kids/:lang/learn... soit
// une section Kids comme les autres (Stories/Games/...), pas une page à part. Dupliqué à dessein
// plutôt qu'extrait de PortalPage.jsx : cette dernière est déjà en prod, zéro risque de régression
// en la laissant intacte.
export function KidsLearnHeader({ language, t, section = 'learn' }) {
  const { user } = useCustomerAuth();
  const config = PORTAL_CONFIG.kids;
  const portalRoot = `/kids/${language}`;
  return (
    <header className="portal-header">
      <div className="portal-shell portal-header-row">
        <PortalBrand portal="kids"/>
        <nav className="portal-nav" aria-label={t('kids.nav.label')}>
          <Link to={portalRoot}>{t('kids.nav.home')}</Link>
          {config.nav.slice(0, 7).map(([key, Icon]) => (
            <Link className={section === key ? 'active' : ''} key={key} to={`${portalRoot}/${key}`}>
              <Icon size={17}/><span>{t(`kids.nav.${key}`)}</span>
            </Link>
          ))}
        </nav>
        <Link className="portal-header-auth" to={user ? `/kids/${language}/profile` : `/kids/${language}/login`}>
          {user ? (user.nom || t('kids.auth.myAccount')) : t('kids.auth.tabs.login')}
        </Link>
      </div>
    </header>
  );
}
