import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../../../hooks/useApi';
import { ASSET } from '../../../../api';

const ARTICLES_PER_PAGE = 20;

const STATUS_META = {
  draft: { label: 'Brouillon', color: '#6B7280', bg: '#F3F4F6' },
  published: { label: 'Publié', color: '#16A34A', bg: '#F0FDF4' },
};

const AI_CATEGORIES = [
  'guide', 'recette', 'promotion', 'conseil', 'actualite',
  'nouveau_commerce', 'nouveau_produit', 'vie_locale', 'portrait',
];

const AI_RUBRIQUES = [
  ['restaurants_food', 'Food & Restaurants'], ['courses_epiceries', 'Courses'],
  ['boucheries', 'Boucheries'], ['boulangeries', 'Boulangeries'], ['patisseries', 'Pâtisseries'],
  ['cafes', 'Cafés'], ['sante_pharmacies', 'Santé'], ['beaute_bien_etre', 'Beauté & Bien-être'],
  ['sport_forme', 'Sport & Forme'], ['famille_enfants', 'Famille'], ['maison_deco', 'Maison'],
  ['sorties_loisirs', 'Sorties & Loisirs'], ['shopping', 'Shopping'], ['evenements', 'Événements'],
  ['villes', 'Guides locaux'], ['maroc', 'Voyage & Découvertes'], ['conseils_astuces', 'Conseils & Astuces'],
  ['promotions', 'Bons plans'],
];

function AiSpinner() {
  return <span className="if-spinner if-spinner-sm ai-button-spinner" aria-hidden="true" />;
}

function AiButton({ loading, children, loadingLabel, className = 'btn btn-outline-primary', disabled = false, ...props }) {
  return (
    <button {...props} className={`${className} ai-button${loading ? ' ai-button-loading' : ''}`} disabled={loading || disabled}>
      {loading && <AiSpinner />}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
}

function paginationWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('start-ellipsis');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push('end-ellipsis');
  pages.push(total);
  return pages;
}

function articleLivePath(article) {
  const translations = Array.isArray(article?.translations) ? article.translations : [];
  const preferred = ['ar', 'fr', 'en']
    .map(language => translations.find(tr => tr.language === language && tr.slug))
    .find(Boolean) || translations.find(tr => tr.slug);
  if (preferred?.slug) return `/discover/${preferred.language || 'ar'}/article/${preferred.slug}`;
  return article?.slug ? `/discover/ar/article/${article.slug}` : '';
}

function AiGenerateModal({ onClose, onGenerated }) {
  const { get, post } = useApi();
  const [cities, setCities] = useState([]);
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('guide');
  const [rubrique, setRubrique] = useState('restaurants_food');
  const [vertical, setVertical] = useState('');
  const [cityId, setCityId] = useState('');
  const [longForm, setLongForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState('');
  const [error, setError] = useState('');
  const [aiStatus, setAiStatus] = useState(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    get('/marketplace/cities').then(d => setCities(d.cities || [])).catch(() => {});
    get('/superadmin/discover/ai/status').then(setAiStatus).catch(() => setAiStatus(null));
  }, []);

  async function handleTestConnection() {
    setTestBusy(true); setTestMsg(''); setError('');
    try {
      const status = await post('/superadmin/discover/ai/test-connection', {});
      setAiStatus(status);
      setTestMsg('Connexion OpenAI OK · ' + (status.model || 'modèle configuré'));
    } catch (e) {
      setTestMsg('');
      setError(e.message || 'Test de connexion impossible.');
    }
    setTestBusy(false);
  }

  async function handleGenerate(mode = 'article') {
    if (!topic.trim()) { setError('Le sujet est requis.'); return; }
    setBusy(true); setBusyMode(mode); setError('');
    try {
      const endpoint = mode === 'article_images' ? '/superadmin/discover/ai/generate-draft-with-images' : '/superadmin/discover/ai/generate-draft';
      const { article } = await post(endpoint, {
        topic: topic.trim(),
        category,
        rubrique,
        vertical: vertical || undefined,
        city_id: cityId ? Number(cityId) : undefined,
        long_form: longForm,
        include_sections: true,
        section_count: 2,
      });
      onGenerated(article);
    } catch (e) { setError(e.message); }
    setBusy(false); setBusyMode('');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div className="card" style={{ width: 480, maxWidth: '90vw', padding: 20 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Générer un brouillon avec l'IA</h3>
        <p style={{ fontSize: 13, color: 'var(--mk-muted, #64748B)' }}>
          Le moteur s'appuie sur de vrais commerces/produits/promotions de la marketplace pour ce filtre.
          Le résultat reste un brouillon à relire et compléter avant publication.
        </p>

        <label className="form-label">Sujet</label>
        <input className="form-control" placeholder="Ex : Les meilleures pizzas à Rabat" value={topic} onChange={e => setTopic(e.target.value)} />

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Rubrique</label>
            <select className="form-select" value={rubrique} onChange={e => setRubrique(e.target.value)}>
              {AI_RUBRIQUES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label">Catégorie</label>
            <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
              {AI_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={longForm} onChange={e => setLongForm(e.target.checked)} />
          Article long format (1500-2500 mots + FAQ riche) — plus lent
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Vertical (optionnel)</label>
            <select className="form-select" value={vertical} onChange={e => setVertical(e.target.value)}>
              <option value="">Tous</option>
              <option value="restaurant">Restaurants</option>
              <option value="hanout">Épiceries</option>
              <option value="pharmacie">Pharmacies</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label">Ville (optionnel)</label>
            <select className="form-select" value={cityId} onChange={e => setCityId(e.target.value)}>
              <option value="">Toutes</option>
              {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {testMsg && <div className="alert alert-success" style={{ marginTop: 12 }}>{testMsg}</div>}

        {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}<br /><button type="button" className="btn btn-outline-primary btn-xs" style={{ marginTop: 8 }} onClick={() => handleGenerate('article')} disabled={busy}>Réessayer</button></div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18, alignItems: 'center' }}>
          <AiButton className="btn btn-outline-primary" onClick={handleTestConnection} disabled={busy || testBusy} loading={testBusy} loadingLabel="Test...">Tester OpenAI</AiButton>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-outline-primary" onClick={onClose} disabled={busy}>Annuler</button>
            <AiButton className="btn btn-outline-primary" onClick={() => handleGenerate('article')} disabled={busy} loading={busy && busyMode === 'article'} loadingLabel="Génération...">Générer l'article</AiButton>
            <AiButton className="btn btn-primary" onClick={() => handleGenerate('article_images')} disabled={busy} loading={busy && busyMode === 'article_images'} loadingLabel="Génération images...">Générer l'article + les images</AiButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  return <th aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 2 }}><button type="button" onClick={() => onSort(sortKey)} style={{ minHeight: 40, border: 0, background: 'transparent', color: 'inherit', padding: 0, font: 'inherit', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label} <span aria-hidden="true">{active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>;
}

export default function ArticlesListPage() {
  const { get, patch, del } = useApi();
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState({ key: 'createdAt', direction: 'desc' });
  const sortedArticles = useMemo(() => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...articles].sort((a, b) => {
      const values = { title: a.title || '', category: a.category || '', status: a.status || '', unique_readers_count: Number(a.unique_readers_count || 0), view_count: Number(a.view_count || 0), createdAt: new Date(a.createdAt || 0).getTime() };
      const other = { title: b.title || '', category: b.category || '', status: b.status || '', unique_readers_count: Number(b.unique_readers_count || 0), view_count: Number(b.view_count || 0), createdAt: new Date(b.createdAt || 0).getTime() };
      return String(values[sort.key]).localeCompare(String(other[sort.key]), 'fr', { numeric: true, sensitivity: 'base' }) * direction;
    });
  }, [articles, sort]);
  function toggleSort(key) { setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); }

  function load(pageToLoad = page) {
    setLoading(true);
    get(`/superadmin/discover/articles?page=${pageToLoad}&limit=${ARTICLES_PER_PAGE}`)
      .then(d => {
        setArticles(d.articles || []);
        setTotal(Number(d.total || 0));
        setPages(Math.max(1, Number(d.pages || 1)));
        setPage(Math.max(1, Number(d.page || pageToLoad)));
        setLoading(false);
      })
      .catch(e => { setMsg(e.message); setLoading(false); });
  }
  useEffect(() => { load(page); }, [page]);

  function handleGenerated(article) {
    setShowAiModal(false);
    navigate(`/discover-admin/articles/${article.id}/edit`);
  }

  async function togglePublish(article) {
    try {
      await patch(`/superadmin/discover/articles/${article.id}/publish`, {});
      load(page);
    } catch (e) { setMsg(e.message); }
  }

  async function remove(article) {
    if (!window.confirm(`Supprimer « ${article.title} » ?`)) return;
    try {
      await del(`/superadmin/discover/articles/${article.id}`);
      if (articles.length === 1 && page > 1) setPage(p => p - 1);
      else load(page);
    }
    catch (e) { setMsg(e.message); }
  }

  const pageItems = paginationWindow(page, pages);
  const firstItem = total ? ((page - 1) * ARTICLES_PER_PAGE) + 1 : 0;
  const lastItem = Math.min(total, page * ARTICLES_PER_PAGE);

  return (
    <div className="app-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">iFilino Discover — Articles</h1>
          <p className="page-subtitle">Guides, recettes, promotions et actualités.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline-primary" onClick={() => navigate('/discover-admin/stats')}>📊 Statistiques</button>
          <button className="btn btn-outline-primary" onClick={() => setShowAiModal(true)}>✨ Générer l'article</button>
          <button className="btn btn-primary" onClick={() => navigate('/discover-admin/articles/new')}>+ Nouvel article</button>
        </div>
      </div>

      {showAiModal && <AiGenerateModal onClose={() => setShowAiModal(false)} onGenerated={handleGenerated} />}

      {msg && <div className="alert alert-danger">{msg}</div>}

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : !articles.length ? (
        <div className="empty-state">
          <div className="empty-state__icon">📝</div>
          <div className="empty-state__title">Aucun article</div>
          <div className="empty-state__desc">Créez votre premier article iFilino Discover.</div>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="rb-table" style={{ width: '100%', minWidth: 1000 }}>
            <thead>
              <tr><SortHeader label="Article" sortKey="title" sort={sort} onSort={toggleSort} /><SortHeader label="Catégorie" sortKey="category" sort={sort} onSort={toggleSort} /><SortHeader label="Statut" sortKey="status" sort={sort} onSort={toggleSort} /><SortHeader label="Lecteurs uniques" sortKey="unique_readers_count" sort={sort} onSort={toggleSort} /><SortHeader label="Lectures brutes" sortKey="view_count" sort={sort} onSort={toggleSort} /><SortHeader label="Créé" sortKey="createdAt" sort={sort} onSort={toggleSort} /><th style={{ position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 2 }}>Actions</th></tr>
            </thead>
            <tbody>
              {sortedArticles.map(a => {
                const st = STATUS_META[a.status] || STATUS_META.draft;
                const livePath = articleLivePath(a);
                const canViewArticle = a.status === 'published' && !!livePath;
                return (
                  <tr key={a.id}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {a.cover_image_url && <img src={ASSET(a.cover_image_url)} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />}
                      {a.title}
                      {a.generated_by_ai && <span className="rb-badge" style={{ color: '#7C3AED', background: '#F5F3FF', fontSize: 11 }} title="Brouillon généré par l'IA">✨ IA</span>}
                    </td>
                    <td>{a.category}</td>
                    <td><span className="rb-badge" style={{ color: st.color, background: st.bg }}>{st.label}</span></td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {Number(a.unique_readers_count || 0).toLocaleString('fr-FR')}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {Number(a.view_count || 0).toLocaleString('fr-FR')}
                    </td>
                    <td>{new Date(a.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button className="btn btn-outline-primary btn-xs" onClick={() => navigate(`/discover-admin/articles/${a.id}/edit`)}>Modifier</button>
                      <button className="btn btn-outline-primary btn-xs" onClick={() => window.open(livePath, '_blank', 'noopener,noreferrer')} disabled={!canViewArticle} title={canViewArticle ? livePath : 'Disponible après publication'}>
                        Voir article
                      </button>
                      <button className="btn btn-outline-primary btn-xs" onClick={() => togglePublish(a)}>
                        {a.status === 'published' ? 'Dépublier' : 'Publier'}
                      </button>
                      <button className="btn btn-outline-primary btn-xs" style={{ color: '#DC2626', borderColor: '#DC2626' }} onClick={() => remove(a)}>Suppr.</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 16px', borderTop: '1px solid var(--rb-border, #E5E7EB)' }}>
            <div style={{ fontSize: 13, color: 'var(--rb-muted, #64748B)', fontWeight: 600 }}>
              {firstItem}-{lastItem} sur {total} article{total > 1 ? 's' : ''}
            </div>
            <nav aria-label="Pagination des articles Discover" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline-primary btn-xs"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{ minWidth: 44, minHeight: 36, opacity: page <= 1 ? 0.48 : 1 }}
              >
                Préc.
              </button>
              {pageItems.map(item => item.toString().includes('ellipsis') ? (
                <span key={item} aria-hidden="true" style={{ minWidth: 28, textAlign: 'center', color: 'var(--rb-muted, #64748B)', fontWeight: 800 }}>…</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`btn btn-xs ${item === page ? 'btn-primary' : 'btn-outline-primary'}`}
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => setPage(item)}
                  style={{ minWidth: 38, minHeight: 36, fontWeight: 800 }}
                >
                  {item}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-outline-primary btn-xs"
                disabled={page >= pages}
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                style={{ minWidth: 44, minHeight: 36, opacity: page >= pages ? 0.48 : 1 }}
              >
                Suiv.
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
