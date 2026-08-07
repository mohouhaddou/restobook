import React from 'react';

const SECTION_LINKS = ['stories', 'games', 'quizzes', 'coloring', 'audiobooks', 'videos', 'crafts', 'learn'];
export default function KidsSeoView({ language = 'en', item = null }) {
  const home = `/kids/${language}`;
  const title = item?.title || (language === 'fr' ? 'Histoires, jeux et apprentissage pour enfants' : language === 'ar' ? 'قصص وألعاب وتعلم للأطفال' : 'Stories, games and learning for kids');
  const description = item?.summary || item?.excerpt || (language === 'fr' ? 'Découvrez des contenus éducatifs adaptés aux enfants sur iFilino Kids.' : language === 'ar' ? 'اكتشف محتوى تعليمياً مناسباً للأطفال على iFilino Kids.' : 'Discover child-friendly educational content on iFilino Kids.');
  return <div className="seo-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <header><a href={home}>iFilino Kids</a><nav aria-label="iFilino Kids">{SECTION_LINKS.map(section => <a key={section} href={`${home}/${section}`}>{section}</a>)}</nav></header>
    <main><article><h1>{title}</h1><p>{description}</p>{item?.image_url || item?.coverImageUrl ? <img src={item.image_url || item.coverImageUrl} alt={`${title} cover`} width="1200" height="675"/> : null}</article></main>
  </div>;
}
