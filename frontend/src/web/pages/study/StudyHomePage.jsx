import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Clock3, GraduationCap, Menu, PlayCircle, Search, Sparkles } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { API, ASSET } from '../../../shared/services/api';
import { useCustomerAuth } from '../../../shared/context/CustomerAuthContext';
import { useKidsRouteLanguage } from '../kids/useKidsRouteLanguage';
import { kidsPath } from '../kids/i18n';
import { KidsLearnHeader } from './KidsLearnHeader';
import { PortalFooter } from '../../modules/portals/components/PortalFooter';
import TaxonomySidebar from '../../modules/kids-taxonomy/PremiumTaxonomySidebar';
import KidsLibraryCard from '../../modules/kids-taxonomy/KidsLibraryCard';
import ContentRail from '../../modules/kids-taxonomy/ContentRail';
import { findTaxonomyItem, taxonomyFor } from '../../modules/kids-taxonomy/taxonomyConfig';
import { filterByTaxonomy } from '../../modules/kids-taxonomy/taxonomyEngine';
import './study.css';
import '../../modules/portals/portals.css';

const COPY = {
  fr: { kicker: 'Apprendre en s’amusant', title: 'Chaque leçon devient une aventure.', intro: 'Explore les maths, les sciences et bien plus avec des cours illustrés, courts et faciles à suivre.', search: 'Que veux-tu apprendre aujourd’hui ?', today: 'La mission du jour', continue: 'Continue ton aventure', featured: 'Leçons à découvrir', recent: 'Nouveautés', popular: 'Les préférées des enfants', quick: 'Révision express', start: 'Commencer', minutes: 'min', results: 'Résultats pour', all: 'Toutes' },
  en: { kicker: 'Learn through play', title: 'Every lesson is an adventure.', intro: 'Explore maths, science and more with illustrated lessons that are easy to follow.', search: 'What would you like to learn today?', today: 'Today’s mission', continue: 'Continue your adventure', featured: 'Lessons to discover', recent: 'New lessons', popular: 'Kids’ favourites', quick: 'Quick revision', start: 'Start', minutes: 'min', results: 'Results for', all: 'All' },
  ar: { kicker: 'تعلّم واستمتع', title: 'كل درس مغامرة جديدة.', intro: 'استكشف الرياضيات والعلوم وغيرها من خلال دروس مصورة وسهلة المتابعة.', search: 'ماذا تريد أن تتعلم اليوم؟', today: 'مهمة اليوم', continue: 'واصل مغامرتك', featured: 'دروس للاستكشاف', recent: 'دروس جديدة', popular: 'المفضلة لدى الأطفال', quick: 'مراجعة سريعة', start: 'ابدأ', minutes: 'د', results: 'نتائج', all: 'الكل' },
};

function LessonCard({ lesson, language }) {
  return <KidsLibraryCard item={{ ...lesson, type: 'learn' }} language={language}/>;
}

function LessonRail({ title, items, language }) {
  if (!items?.length) return null;
  const id = `study-rail-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return <ContentRail id={id} title={title} items={items.map(item => ({ ...item, type: 'learn' }))} language={language}/>;
}

function pickOfTheDay(pool) { return pool?.length ? pool[Math.floor(Date.now() / 86400000) % pool.length] : null; }

export default function StudyHomePage() {
  const { taxonomy = "" } = useParams();
  const { language, t } = useKidsRouteLanguage();
  const { token } = useCustomerAuth();
  const copy = COPY[language] || COPY.en;
  const [overview, setOverview] = useState(null);
  const [pool, setPool] = useState([]);
  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState({ sort: "newest" });
  const taxonomyConfig = taxonomyFor("study");
  const criterion = findTaxonomyItem("study", taxonomy);

  useEffect(() => { document.title = `${t('kids.nav.learn')} — iFilino Kids`; }, [t]);
  useEffect(() => {
    setLoading(true); setError('');
    Promise.all([fetch(API(`/study/overview?lang=${language}`)).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }), fetch(API(`/study/lessons?lang=${language}&limit=50`)).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })])
      .then(([overviewData, listData]) => { setOverview(overviewData); setPool(listData.items || []); }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [language]);
  useEffect(() => {
    if (!token) { setHistory([]); return; }
    fetch(API('/study/history?lang=' + language), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(data => setHistory((data.history || []).filter(h => !h.progress?.completed))).catch(() => setHistory([]));
  }, [token, language]);

  const subjects = useMemo(() => [...new Set(pool.map(l => l.subject).filter(Boolean))], [pool]);
  const filteredPool = useMemo(() => { if (!query.trim() && !subject && !taxonomy && !filters.age && !filters.difficulty && !filters.premium && !filters.duration) return null; let result = filterByTaxonomy(pool, criterion, query).filter(l => !subject || l.subject === subject); if (filters.age) result = result.filter(l => String(l.age || l.ageRange || l.metadata?.age || "").includes(filters.age)); if (filters.difficulty) result = result.filter(l => l.difficulty === filters.difficulty); if (filters.premium) result = result.filter(l => l.premium); if (filters.duration) result = result.filter(l => filters.duration === 'short' ? l.estimatedDurationMinutes < 10 : filters.duration === 'medium' ? l.estimatedDurationMinutes >= 10 && l.estimatedDurationMinutes <= 40 : l.estimatedDurationMinutes > 40); return [...result].sort((a,b) => filters.sort === 'alphabetical' ? a.title.localeCompare(b.title, language) : filters.sort === 'popular' ? Number(b.viewCount || 0)-Number(a.viewCount || 0) : new Date(b.publishedAt || 0)-new Date(a.publishedAt || 0)); }, [pool, query, subject, taxonomy, criterion, filters, language]);
  const todaysLesson = useMemo(() => pickOfTheDay(overview?.featured?.length ? overview.featured : pool), [overview, pool]);
  const quickRevision = useMemo(() => pool.filter(l => l.estimatedDurationMinutes && l.estimatedDurationMinutes <= 10).slice(0, 8), [pool]);

  if (taxonomy && !criterion) return <Navigate to={kidsPath(language, "study")} replace/>;
  return <div className="portal portal-kids portal-listing study-home"><KidsLearnHeader language={language} t={t} section="learn"/>
    <section className="study-hero"><div className="portal-shell study-hero-grid"><div><span className="study-kicker"><Sparkles size={17}/>{copy.kicker}</span><h1>{copy.title}</h1><p>{copy.intro}</p><label className="study-search"><Search size={20}/><span className="sr-only">{copy.search}</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder={copy.search}/></label><div className="study-subjects"><button type="button" className={!subject ? 'active' : ''} onClick={() => setSubject('')}>{copy.all}</button>{subjects.map(value => <button type="button" key={value} className={subject === value ? 'active' : ''} onClick={() => setSubject(value)}>{value}</button>)}</div></div><div className="study-hero-orbit" aria-hidden="true"><div><GraduationCap/><span>1/2</span><BookOpen/></div></div></div></section>
    <button type="button" className="study-taxonomy-toggle" onClick={() => setSidebarOpen(true)}><Menu size={19}/><span>{copy.all}</span></button><main className="portal-shell study-content taxonomy-layout"><TaxonomySidebar config={taxonomyConfig} items={pool} activeSlug={taxonomy} language={language} basePath={kidsPath(language, "study")} open={sidebarOpen} onClose={() => setSidebarOpen(false)} filters={filters} onFiltersChange={setFilters}/><div className="taxonomy-main">{error && <div className="study-state" role="alert">{t('portals.error.description')}</div>}{loading && <div className="study-loading" aria-busy="true"><span/><span/><span/></div>}{!loading && filteredPool ? <LessonRail title={`${copy.results} “${query || subject}”`} items={filteredPool} language={language} copy={copy}/> : !loading && <>{todaysLesson && <section className="study-section"><div className="study-section-title"><div><span className="study-eyebrow"><PlayCircle size={15}/>{copy.today}</span><h2>{todaysLesson.title}</h2></div></div><LessonCard lesson={todaysLesson} language={language} featured copy={copy}/></section>}<LessonRail title={copy.continue} items={history} language={language} copy={copy}/><LessonRail title={copy.featured} items={overview?.featured} language={language} copy={copy}/><LessonRail title={copy.recent} items={overview?.recentlyAdded} language={language} copy={copy}/><LessonRail title={copy.popular} items={overview?.popular} language={language} copy={copy}/><LessonRail title={copy.quick} items={quickRevision} language={language} copy={copy}/>{Object.entries(overview?.subjects || {}).map(([name, items]) => <LessonRail key={name} title={name} items={items} language={language} copy={copy}/>)}{!pool.length && <div className="portal-empty" role="status"><strong>{t('portals.empty.title')}</strong><p>{t('portals.empty.description')}</p></div>}</>}</div></main><PortalFooter portal="kids" language={language}/></div>;
}
