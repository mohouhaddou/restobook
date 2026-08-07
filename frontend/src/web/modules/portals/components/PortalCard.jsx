import React from 'react';
import { ArrowRight, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n, translate } from '../../../../i18n/config';
import { localeForLanguage } from '../../../pages/kids/i18n';

export function PortalCard({ portal, item, featured = false, language }) {
  const { t: uiT, formatNumber: uiFormatNumber } = useI18n();
  const t = portal === 'kids' ? (key, params) => translate(language, key, params) : uiT;
  const formatNumber = portal === 'kids'
    ? (value, options) => new Intl.NumberFormat(localeForLanguage(language), options).format(Number(value || 0))
    : uiFormatNumber;
  // Une histoire Kids ouvre désormais sa page de présentation (voir BookLandingPage.jsx), jamais
  // le lecteur ni la fiche générique directement — tous les autres contenus (jeux, quiz, sports...)
  // gardent leur route de détail habituelle, inchangée.
  const isKidsStory = portal === 'kids' && item.type === 'stories';
  const href = portal === 'kids'
    ? (isKidsStory ? `/kids/${language}/book/${item.slug}` : `/kids/${language}/content/${item.slug}`)
    : `/${portal}/content/${item.slug}`;
  return (
    <article className={`portal-card${featured ? ' portal-card-featured' : ''}`}>
      <Link to={href} className="portal-card-media" aria-label={item.title}>
        {item.image_url
          ? <img src={item.image_url} alt="" loading={featured ? 'eager' : 'lazy'}/>
          : <span className="portal-card-placeholder" aria-hidden="true"/>}
        <span className="portal-card-type">{t(`${portal}.nav.${item.type}`)}</span>
      </Link>
      <div className="portal-card-body">
        <h3><Link to={href}>{item.title}</Link></h3>
        {item.excerpt && <p>{item.excerpt}</p>}
        <div className="portal-card-meta">
          <span><Eye size={15}/> {formatNumber(item.view_count)}</span>
          <Link to={href} aria-label={`${t('portals.read')} ${item.title}`}>
            {t('portals.read')} <ArrowRight size={15}/>
          </Link>
        </div>
      </div>
    </article>
  );
}
