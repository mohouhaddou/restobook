import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Eye, FileEdit, Plus, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../shared/hooks/useApi';
import { RankBarChart } from '../../shared/components/stats/AdminCharts';
import { PortalHeroManagerTab } from '../../web/components/portalHero/PortalHeroManagerTab';
import AdminContentTable, { AccessBadge, ArticleIdentity } from './AdminContentTable';

const TYPES = {
  sports: ['news', 'articles', 'competitions', 'clubs', 'players', 'matches', 'live', 'videos', 'standings', 'statistics', 'community'],
  kids: ['learn', 'games', 'stories', 'quizzes', 'drawing', 'music', 'videos', 'animals', 'science', 'space', 'nature', 'history', 'crafts'],
};

export default function PortalsAdminPage() {
  const api = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('portal');
  const [portal, setPortal] = useState(TYPES[requested] ? requested : 'sports');
  const [tab, setTab] = useState('contents'); // 'contents' | 'hero'
  const [items, setItems] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [message, setMessage] = useState('');

  async function load(activePortal = portal) {
    const [contentData, analyticsData] = await Promise.all([
      api.get(`/superadmin/portals/${activePortal}/contents?limit=100`),
      api.get(`/superadmin/portals/${activePortal}/analytics`),
    ]);
    setItems(contentData.items || []);
    setAnalytics(analyticsData);
  }

  useEffect(() => {
    load(portal).catch(error => setMessage(error.message));
  }, [portal]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(item) {
    if (!window.confirm(`Supprimer « ${item.title_fr} » ?`)) return;
    try {
      await api.del(`/superadmin/portals/${portal}/contents/${item.id}`);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  const chartData = useMemo(() => (analytics?.byType || []).map(row => ({ name: row.type, value: row.views })), [analytics]);
  const columns = useMemo(() => [
    { key:'title', label:'Article', value:item => item.title_fr, render:item => <ArticleIdentity image={item.image_url} title={item.title_fr} subtitle={item.slug}/> },
    { key:'type', label:'Type', value:item => item.content_type },
    { key:'access', label:'Accès', value:item => Number(Boolean(item.isPremium ?? item.is_premium ?? item.premium)), render:item => <AccessBadge premium={Boolean(item.isPremium ?? item.is_premium ?? item.premium)}/> },
    { key:'status', label:'Statut', value:item => item.status, render:item => item.status === 'published' ? 'Publié' : 'Brouillon' },
    { key:'views', label:'Lectures', value:item => Number(item.view_count || 0) },
    { key:'actions', label:'Actions', sortable:false, render:item => <div style={{ display:'flex', gap:6 }}><Link className="btn btn-secondary" to={`/admin/portals/${portal}/articles/${item.id}/edit`} aria-label={`Modifier ${item.title_fr}`}><FileEdit size={16}/></Link><button type="button" className="btn btn-danger" onClick={() => remove(item)} aria-label={`Supprimer ${item.title_fr}`}><Trash2 size={16}/></button></div> },
  ], [portal]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div style={{ display: 'grid', gap: 18 }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <div><h1 style={{ margin: 0 }}>Portails Sports & Kids</h1><p style={{ margin: '5px 0 0', color: '#6b7280' }}>Contenus, publication et performances.</p></div>
      <div className="if-card" style={{ padding: 6, display: 'flex', gap: 5 }}>
        {['sports', 'kids'].map(key => <button key={key} type="button" className={`btn ${portal === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setPortal(key); setSearchParams({ portal: key }); }}>iFilino {key === 'sports' ? 'Sports' : 'Kids'}</button>)}
      </div>
    </header>

    <div className="if-card" style={{ padding: 6, display: 'inline-flex', gap: 5, width: 'fit-content' }}>
      {[['contents', 'Contenus'], ['hero', 'Hero (bannière carrousel)']].map(([key, label]) => (
        <button key={key} type="button" className={`btn ${tab === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(key)}>{label}</button>
      ))}
    </div>

    {tab === 'hero' ? (
      <PortalHeroManagerTab portal={portal}/>
    ) : (
      <>
        <div><Link className="btn btn-primary" to={`/admin/portals/${portal}/articles/new`}><Plus size={17}/> Nouvel article {portal === 'sports' ? 'Sports' : 'Kids'}</Link></div>
        {message && <div className="alert alert-info" role="status">{message}</div>}

        {analytics && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
          {[
            ['Contenus', analytics.summary.contents, FileEdit],
            ['Publiés', analytics.summary.published, Plus],
            ['Brouillons', analytics.summary.drafts, BarChart3],
            ['Lectures', analytics.summary.views, Eye],
          ].map(([label, value, Icon]) => <div className="if-card" style={{ padding: 16 }} key={label}><Icon size={20}/><strong style={{ display: 'block', fontSize: 25, marginTop: 8 }}>{value}</strong><span style={{ color: '#6b7280', fontSize: 12 }}>{label}</span></div>)}
        </div>}

        <div className="if-card" style={{ padding: 18 }}><h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Lectures par type</h2><RankBarChart data={chartData} height={240}/></div>
        <AdminContentTable items={items} columns={columns} categoryKey={item => item.content_type} categoryLabel={`Types de contenus ${portal}`} emptyMessage="Aucun article dans cette catégorie."/>
      </>
    )}
  </div>;
}
