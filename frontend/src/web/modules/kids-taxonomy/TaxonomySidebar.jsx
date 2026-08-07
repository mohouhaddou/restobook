import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Home, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GLOBAL_TAXONOMY, localizedLabel } from './taxonomyConfig';
import { taxonomyCounts } from './taxonomyEngine';
import './taxonomy.css';

const COPY = {
  en: { navigation: 'Explore', home: 'Home', close: 'Close navigation' },
  fr: { navigation: 'Explorer', home: 'Accueil', close: 'Fermer la navigation' },
  ar: { navigation: 'استكشف', home: 'الرئيسية', close: 'إغلاق التنقل' },
};

export default function TaxonomySidebar({ module, config, items, activeSlug, language, basePath, open, onClose }) {
  const copy = COPY[language] || COPY.en;
  const counts = useMemo(() => taxonomyCounts(items, config), [items, config]);
  const activeGroup = config.groups.find(group => group.items.some(entry => entry.slug === activeSlug))?.id;
  const [expanded, setExpanded] = useState(() => new Set(activeGroup ? [activeGroup] : []));
  useEffect(() => {
    if (activeGroup) setExpanded(current => new Set([...current, activeGroup]));
  }, [activeGroup]);
  const toggle = id => setExpanded(current => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const visibleGroups = config.groups.map(group => ({
    ...group,
    items: group.items.filter(entry => (counts.get(entry.slug) || 0) > 0),
  })).filter(group => group.items.length);

  return <>
    {open && <button type="button" className="taxonomy-backdrop" onClick={onClose} aria-label={copy.close}/>}
    <aside className={`taxonomy-sidebar${open ? ' is-open' : ''}`} aria-label={copy.navigation}>
      <div className="taxonomy-head"><strong>{copy.navigation}</strong><button type="button" onClick={onClose} aria-label={copy.close}><X size={20}/></button></div>
      <nav>
        <Link className={!activeSlug ? 'active' : ''} to={basePath} onClick={onClose}><Home size={18}/><span>{copy.home}</span><b>{items.length}</b></Link>
        <div className="taxonomy-global">
          {GLOBAL_TAXONOMY.filter(entry => entry.field === '$search' || (counts.get(entry.slug) || 0) > 0).map(entry =>
            <Link className={activeSlug === entry.slug ? 'active' : ''} key={entry.slug} to={`${basePath}/${entry.slug}`} onClick={onClose}>
              {entry.field === '$search' && <Search size={17}/>}<span>{localizedLabel(entry.label, language)}</span><b>{counts.get(entry.slug)}</b>
            </Link>)}
        </div>
        {visibleGroups.map(group => {
          const isExpanded = expanded.has(group.id);
          return <section className="taxonomy-group" key={group.id}>
            <button type="button" aria-expanded={isExpanded} onClick={() => toggle(group.id)}>
              <span>{localizedLabel(group.label, language)}</span><ChevronDown size={17}/>
            </button>
            {isExpanded && <div>{group.items.map(entry =>
              <Link className={activeSlug === entry.slug ? 'active' : ''} key={entry.slug} to={`${basePath}/${entry.slug}`} onClick={onClose}>
                <span>{localizedLabel(entry.label, language)}</span><b>{counts.get(entry.slug)}</b>
              </Link>)}</div>}
          </section>;
        })}
      </nav>
    </aside>
  </>;
}
