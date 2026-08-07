import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import KidsLibraryCard from './KidsLibraryCard';

export default function ContentRail({ id, title, items, language }) {
  if (!items?.length) return null;
  const scroll = direction => document.getElementById(id)?.scrollBy({ left: direction * 640, behavior: 'smooth' });
  const labels = language === 'fr' ? ['Précédent', 'Suivant'] : language === 'ar' ? ['السابق', 'التالي'] : ['Previous', 'Next'];
  return <section className="kids-content-rail" aria-labelledby={`${id}-title`}>
    <header><div><h2 id={`${id}-title`}>{title}</h2><span>{items.length}</span></div><div className="kids-rail-controls"><button type="button" onClick={() => scroll(-1)} aria-label={labels[0]}><ChevronLeft aria-hidden="true"/></button><button type="button" onClick={() => scroll(1)} aria-label={labels[1]}><ChevronRight aria-hidden="true"/></button></div></header>
    <div id={id} className="kids-rail-track">{items.map(item => <KidsLibraryCard key={`${item.type || 'item'}-${item.id}`} item={item} language={language}/>)}</div>
  </section>;
}
