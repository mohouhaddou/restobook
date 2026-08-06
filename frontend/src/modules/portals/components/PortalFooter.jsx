import React from 'react';
import { ArrowUp, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n, translate } from '../../../i18n/config';
import { PORTAL_CONFIG } from '../config';
import { PortalBrand } from './PortalBrand';
import '../portal-footer.css';

const IFILINO_LINKS = [
  ['portals.footer.marketplace', '/marketplace'],
  ['portals.footer.discover', '/discover'],
  ['portals.footer.gaming', '/gaming'],
  ['portals.footer.play', '/play'],
];

export function PortalFooter({ portal, language }) {
  const config = PORTAL_CONFIG[portal];
  const portalRoot = portal === 'kids' ? `/kids/${language}` : config.root;
  const { t: uiT } = useI18n();
  const t = portal === 'kids' ? (key, params) => translate(language, key, params) : uiT;
  const midpoint = Math.ceil(config.nav.length / 2);
  const columns = [
    { title: t('portals.footer.explore'), links: config.nav.slice(0, midpoint) },
    { title: t('portals.footer.more'), links: config.nav.slice(midpoint) },
  ];

  return (
    <footer className="portal-footer">
      <div className="portal-shell portal-footer-grid">
        <div className="portal-footer-brand">
          <PortalBrand portal={portal}/>
          <p>{t(`${portal}.footer.description`)}</p>
          <Link className="portal-footer-account" to="/account">
            {t('portals.footer.account')} <ExternalLink size={15}/>
          </Link>
        </div>

        {columns.map(column => (
          <nav key={column.title} aria-label={column.title}>
            <h2>{column.title}</h2>
            {column.links.map(([key]) => (
              <Link key={key} to={`${portalRoot}/${key}`}>{t(`${portal}.nav.${key}`)}</Link>
            ))}
          </nav>
        ))}

        <nav aria-label={t('portals.footer.ifilino')}>
          <h2>{t('portals.footer.ifilino')}</h2>
          {IFILINO_LINKS.map(([key, to]) => <Link key={to} to={to}>{t(key)}</Link>)}
          <Link to={portal === 'kids' ? `/kids/${language}/parents` : '/sports/community'}>
            {t(portal === 'kids' ? 'kids.nav.parents' : 'sports.nav.community')}
          </Link>
        </nav>
      </div>

      <div className="portal-shell portal-footer-bottom">
        <span>© {new Date().getFullYear()} {config.name}</span>
        <span>{t(`${portal}.footer.note`)}</span>
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label={t('portals.footer.backToTop')}>
          <ArrowUp size={17}/><span>{t('portals.footer.backToTop')}</span>
        </button>
      </div>
    </footer>
  );
}
