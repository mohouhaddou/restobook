import React from 'react';
import { ASSET } from '../../../../api';
import { RUBRIQUES, rubriqueLabel } from '../rubriques';
import { DISCOVER_COPY, articlePath, discoverPath, normalizeLanguage } from '../i18n';

const SIDEBAR_RUBRIQUE_KEYS = ['restaurants_food','courses_epiceries','beaute_bien_etre','sante_pharmacies','maison_deco','famille_enfants','villes','promotions'];

export default function MagazineSidebar({ activeRubrique = null, rubriqueCounts = {}, popular = [], recent = [], tags = [], promotions = [], onDownloadClick, onNewsletterSubmit, language = 'ar' }) {
  const lang = normalizeLanguage(language);
  const copy = DISCOVER_COPY[lang];
  const dateLocale = copy.locale;
  return (
    <aside className="ifm-sidebar">
      <div className="ifm-widget">
        <p className="ifm-widget-title">{copy.rubriques}</p>
        <nav className="ifm-sidebar-nav">
          {SIDEBAR_RUBRIQUE_KEYS.map(key => <a key={key} href={discoverPath(lang, key)} className={`ifm-sidebar-link${activeRubrique === key ? ' active' : ''}`}>
            <span className="ifm-ico">{RUBRIQUES[key].icon}</span><span>{rubriqueLabel(key, lang)}</span>{rubriqueCounts[key] > 0 && <span className="ifm-sidebar-count">{rubriqueCounts[key]}</span>}
          </a>)}
        </nav>
      </div>
      <div className="ifm-widget ifm-app-widget">
        <p className="ifm-widget-title">{copy.appTitle}</p>
        <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14 }}>{copy.appPitch}</p>
        <ul><li>{copy.fastDelivery}</li><li>+1000 commerces</li><li>{copy.securePayment}</li><li>{copy.exclusiveDeals}</li></ul>
        {onDownloadClick ? <button type="button" className="ifm-app-btn" onClick={onDownloadClick}>{copy.download}</button> : <a className="ifm-app-btn" href="/">{copy.download}</a>}
      </div>
      <div className="ifm-widget">
        <p className="ifm-widget-title">{copy.newsletter}</p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--mk-muted)' }}>{copy.newsletterPitch}</p>
        <form className="ifm-newsletter-form" onSubmit={onNewsletterSubmit}><input type="email" name="email" placeholder={copy.email} required /><button type="submit">➤</button></form>
      </div>
      {popular.length > 0 && <div className="ifm-widget"><p className="ifm-widget-title">{copy.popular}</p>{popular.map(a => <a key={a.slug} href={articlePath(a, lang)} className="ifm-mini-article">{a.cover_image_url && <img src={ASSET(a.cover_image_url)} alt="" />}<div><div className="ifm-mini-title">{a.title}</div><div className="ifm-mini-date">{a.published_at ? new Date(a.published_at).toLocaleDateString(dateLocale) : ''}</div></div></a>)}</div>}
      {recent.length > 0 && <div className="ifm-widget"><p className="ifm-widget-title">{copy.recent}</p>{recent.map(a => <a key={a.slug} href={articlePath(a, lang)} className="ifm-mini-article">{a.cover_image_url && <img src={ASSET(a.cover_image_url)} alt="" />}<div><div className="ifm-mini-title">{a.title}</div><div className="ifm-mini-date">{a.published_at ? new Date(a.published_at).toLocaleDateString(dateLocale) : ''}</div></div></a>)}</div>}
      {promotions.length > 0 && <div className="ifm-widget"><p className="ifm-widget-title">{rubriqueLabel('promotions', lang)}</p><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{promotions.map(p => <a key={p.code} href={`/${p.business.url_prefix}/${p.business.slug}`} className="ifm-promo-mini">{p.business.logo_url && <img src={ASSET(p.business.logo_url)} alt="" />}<span><strong>{p.code}</strong><small>{p.type === 'percent' ? `${p.value}%` : `${p.value} MAD`} {lang === 'ar' ? 'لدى' : lang === 'en' ? 'at' : 'chez'} {p.business.name}</small></span></a>)}</div></div>}
      {tags.length > 0 && <div className="ifm-widget"><p className="ifm-widget-title">{copy.tags}</p><div className="ifm-tag-cloud">{tags.map(t => <a key={t.tag} href={`${discoverPath(lang)}?tag=${encodeURIComponent(t.tag)}`} className="mk-pill">{t.tag}</a>)}</div></div>}
    </aside>
  );
}
