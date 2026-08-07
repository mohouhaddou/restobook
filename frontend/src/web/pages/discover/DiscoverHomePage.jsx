import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { API } from '../../../api';
import MagazineSidebar from './magazine/MagazineSidebar';
import MagazineHeader from './magazine/MagazineHeader';
import { MagazineFooter, MagazineNavbar } from './magazine/MagazineNav';
import { MagazineArticleGrid } from './magazine/MagazineArticleCard';
import { RUBRIQUES, rubriqueLabel } from './rubriques';
import { Toast } from '../../../shared/components/ui/Toast';
import { DISCOVER_COPY, SUPPORTED_LANGUAGES, discoverPath, initialDiscoverLanguage, normalizeLanguage, rememberDiscoverLanguage } from './i18n';

export default function DiscoverHomePage() {
  const routeParams = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const routeLang = routeParams.lang && SUPPORTED_LANGUAGES.includes(routeParams.lang) ? routeParams.lang : '';
  const legacyRubrique = routeParams.rubrique && !SUPPORTED_LANGUAGES.includes(routeParams.rubrique) ? routeParams.rubrique : '';
  const language = normalizeLanguage(routeLang || initialDiscoverLanguage());
  const rubrique = legacyRubrique || '';
  const copy = DISCOVER_COPY[language];
  const page = Number(params.get('page') || 1);
  const initialTag = params.get('tag') || '';
  const category = params.get('category') || '';
  const query = params.get('q') || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebar, setSidebar] = useState({ popular: [], recent: [], tags: [], rubriques: [], promotions: [] });
  const [search, setSearch] = useState(query);
  const [toast, setToast] = useState('');

  useEffect(() => {
    rememberDiscoverLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = copy.dir;
    if (!routeLang) navigate(discoverPath(language, rubrique) + (params.toString() ? `?${params.toString()}` : ''), { replace: true });
  }, [language, routeLang, rubrique]);

  useEffect(() => {
    const t = setTimeout(() => {
      setParams(prev => {
        const n = new URLSearchParams(prev);
        if (search.trim()) n.set('q', search.trim()); else n.delete('q');
        n.set('page', '1');
        return n;
      });
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('lang', language);
    if (rubrique) qs.set('rubrique', rubrique);
    if (initialTag) qs.set('tag', initialTag);
    if (category) qs.set('category', category);
    if (query) qs.set('q', query);
    qs.set('page', String(page));
    fetch(API(`/discover/articles?${qs.toString()}`))
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ articles: [], total: 0, pages: 0 }))
      .finally(() => setLoading(false));
  }, [language, rubrique, page, initialTag, category, query]);

  useEffect(() => {
    const lang = `lang=${language}`;
    Promise.all([
      fetch(API(`/discover/popular?limit=5&${lang}`)).then(r => r.json()).catch(() => ({ articles: [] })),
      fetch(API(`/discover/recent?limit=5&${lang}`)).then(r => r.json()).catch(() => ({ articles: [] })),
      fetch(API(`/discover/tags/popular?limit=15&${lang}`)).then(r => r.json()).catch(() => ({ tags: [] })),
      fetch(API(`/discover/rubriques?${lang}`)).then(r => r.json()).catch(() => ({ rubriques: [] })),
      fetch(API('/discover/promotions?limit=5')).then(r => r.json()).catch(() => ({ promotions: [] })),
    ]).then(([popular, recent, tags, rubriques, promotions]) => {
      setSidebar({ popular: popular.articles || [], recent: recent.articles || [], tags: tags.tags || [], rubriques: rubriques.rubriques || [], promotions: promotions.promotions || [] });
    });
  }, [language]);

  async function handleNewsletterSubmit(e) {
    e.preventDefault();
    const email = e.target.elements.email.value;
    try {
      await fetch(API('/discover/newsletter/subscribe'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      setToast(copy.newsletterOk);
      e.target.reset();
    } catch { setToast(copy.newsletterError); }
  }

  const rubriqueCounts = Object.fromEntries(sidebar.rubriques.map(r => [r.key, r.count]));
  const title = category === 'recette' ? copy.recipes : (rubrique ? rubriqueLabel(rubrique, language) || rubrique : copy.homeTitle);

  return (
    <div className="mk-wrap mk-light" lang={language} dir={copy.dir} style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      <MagazineNavbar activeRubrique={rubrique || ''} language={language} />
      <div className="ifm-layout">
        <MagazineSidebar activeRubrique={rubrique || null} rubriqueCounts={rubriqueCounts} popular={sidebar.popular} recent={sidebar.recent} tags={sidebar.tags} promotions={sidebar.promotions} language={language} onDownloadClick={() => setToast(copy.comingSoon)} onNewsletterSubmit={handleNewsletterSubmit} />
        <main className="ifm-main">
          <MagazineHeader searchValue={search} onSearchChange={e => setSearch(e.target.value)} placeholder={copy.search} />
          <h1 style={{ fontSize: 30, fontWeight: 800 }}>{title}</h1>
          {!rubrique && <p style={{ color: 'var(--mk-muted)', marginBottom: 24 }}>{copy.tagline}</p>}
          {loading ? <div className="mk-skeleton" style={{ height: 200 }} /> : !(data?.articles || []).length ? <p>{copy.noArticles}</p> : <>
            <MagazineArticleGrid articles={data.articles} language={language} />
            {data.pages > 1 && <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 28 }}>
              {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => <button key={p} className={`mk-pill ${p === page ? 'active' : ''}`} onClick={() => setParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n; })}>{p}</button>)}
            </div>}
          </>}
        </main>
      </div>
      <MagazineFooter language={language} />
      <Toast msg={toast} onClose={() => setToast('')} />
    </div>
  );
}
