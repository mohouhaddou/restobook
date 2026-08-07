import React from 'react';

const COPY = {
  en: ['Refine results','Language','Difficulty','Premium','Duration','Sort by','All','Newest','Popular','Alphabetical', 'Age'],
  fr: ['Affiner les résultats','Langue','Difficulté','Premium','Durée','Trier par','Tous','Nouveautés','Populaires','Alphabétique', 'Âge'],
  ar: ['تصفية النتائج','اللغة','المستوى','مميز','المدة','الترتيب','الكل','الأحدث','الأكثر شعبية','أبجدي', 'العمر'],
};
export default function TaxonomyFilters({ language, filters, onChange }) {
  const c = COPY[language] || COPY.en;
  const set = (key, value) => onChange({ ...filters, [key]: value });
  return <div className="taxonomy-filters" aria-label={c[0]}>
    <strong>{c[0]}</strong>
    <label>{c[1]}<select value={filters.language || ''} onChange={e=>set('language',e.target.value)}><option value="">{c[6]}</option><option value="fr">Français</option><option value="en">English</option><option value="ar">العربية</option></select></label>
    <label>{c[10]}<select value={filters.age || ""} onChange={e=>set('age',e.target.value)}><option value="">{c[6]}</option>{['4-5','5-6','6-7','7-8','8-9','9-10','10-11','11-12'].map(age=><option key={age} value={age}>{age}</option>)}</select></label>
    <label>{c[2]}<select value={filters.difficulty || ''} onChange={e=>set('difficulty',e.target.value)}><option value="">{c[6]}</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
    <label className="taxonomy-check"><input type="checkbox" checked={Boolean(filters.premium)} onChange={e=>set('premium',e.target.checked)}/>{c[3]}</label>
    <label>{c[4]}<select value={filters.duration || ''} onChange={e=>set('duration',e.target.value)}><option value="">{c[6]}</option><option value="short">&lt; 10 min</option><option value="medium">10–40 min</option><option value="long">&gt; 40 min</option></select></label>
    <label>{c[5]}<select value={filters.sort || 'newest'} onChange={e=>set('sort',e.target.value)}><option value="newest">{c[7]}</option><option value="popular">{c[8]}</option><option value="alphabetical">{c[9]}</option></select></label>
  </div>;
}
