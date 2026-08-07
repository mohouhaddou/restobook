import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, Clock3, FolderOpen, Heart, Home, Search, SlidersHorizontal,
  Sparkles, Star, TrendingUp, X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GLOBAL_TAXONOMY, localizedLabel } from './taxonomyConfig';
import { taxonomyCounts } from './taxonomyEngine';
import TaxonomyFilters from './TaxonomyFilters';
import './taxonomy.css';

const COPY = {
  en: { navigation: 'Explore', home: 'Home', close: 'Close navigation', filters: 'Filters' },
  fr: { navigation: 'Explorer', home: 'Accueil', close: 'Fermer la navigation', filters: 'Filtres' },
  ar: { navigation: 'استكشف', home: 'الرئيسية', close: 'إغلاق التنقل', filters: 'الفلاتر' },
};
const ICONS = { featured: Star, popular: TrendingUp, latest: Sparkles, favorites: Heart, 'continue-learning': Clock3, collections: FolderOpen, search: Search };

export default function PremiumTaxonomySidebar({ config, items, activeSlug, language, basePath, open, onClose, filters, onFiltersChange }) {
  const copy = COPY[language] || COPY.en;
  const counts = useMemo(() => taxonomyCounts(items, config), [items, config]);
  const activeGroup = config.groups.find(group => group.items.some(entry => entry.slug === activeSlug))?.id;
  const [expanded, setExpanded] = useState(() => new Set(activeGroup ? [activeGroup] : [config.groups[0]?.id].filter(Boolean)));
  useEffect(() => { if (activeGroup) setExpanded(current => new Set([...current, activeGroup])); }, [activeGroup]);
  const toggle = id => setExpanded(current => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const visibleGroups = config.groups.map(group => ({ ...group, items: group.items.filter(entry => (counts.get(entry.slug) || 0) > 0) })).filter(group => group.items.length);

  return <>
    {open && <button type="button" className="taxonomy-backdrop" onClick={onClose} aria-label={copy.close}/>}
    <aside className={`taxonomy-sidebar taxonomy-sidebar-premium${open ? ' is-open' : ''}`} aria-label={copy.navigation}>
      <div className="taxonomy-head"><strong>{copy.navigation}</strong><button type="button" onClick={onClose} aria-label={copy.close}><X size={20}/></button></div>
      <nav>
        <Link className={!activeSlug ? 'active' : ''} to={basePath} onClick={onClose}><Home size={17}/><span>{copy.home}</span><b>{items.length}</b></Link>
        <div className="taxonomy-global">
          {GLOBAL_TAXONOMY.map(entry => {
            const Icon = ICONS[entry.slug] || Star;
            return <Link className={activeSlug === entry.slug ? 'active' : ''} key={entry.slug} to={`${basePath}/${entry.slug}`} onClick={onClose}><Icon size={17}/><span>{localizedLabel(entry.label, language)}</span><b>{counts.get(entry.slug) || 0}</b></Link>;
          })}
        </div>
        {visibleGroups.map(group => <section className="taxonomy-group" key={group.id}>
          <button type="button" aria-expanded={expanded.has(group.id)} onClick={() => toggle(group.id)}><span>{localizedLabel(group.label, language)}</span><ChevronDown size={16}/></button>
          {expanded.has(group.id) && <div>{group.items.map(entry => <Link className={activeSlug === entry.slug ? 'active' : ''} key={entry.slug} to={`${basePath}/${entry.slug}`} onClick={onClose}><span>{localizedLabel(entry.label, language)}</span><b>{counts.get(entry.slug)}</b></Link>)}</div>}
        </section>)}
        <section className="taxonomy-filter-panel">
          <div className="taxonomy-filter-title"><SlidersHorizontal size={16}/><strong>{copy.filters}</strong></div>
          <TaxonomyFilters language={language} filters={filters} onChange={onFiltersChange}/>
        </section>
      </nav>
    </aside>
  </>;
}
