import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Copy, Eye, FileEdit, Plus, Star, Trash2, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '../../shared/hooks/useApi';
import { RankBarChart } from '../../shared/components/stats/AdminCharts';
import AdminContentTable, { AccessBadge, ArticleIdentity } from './AdminContentTable';

export default function StudyAdminPage() {
  const api = useApi();
  const [items, setItems] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [subject, setSubject] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  async function load() {
    const params = new URLSearchParams({ limit: '100' });
    if (status) params.set('status', status);
    if (subject) params.set('subject', subject);
    if (search) params.set('q', search);
    const [lessons, analyticsData] = await Promise.all([
      api.get(`/superadmin/study/lessons?${params.toString()}`),
      api.get('/superadmin/study/analytics'),
    ]);
    setItems(lessons.items || []);
    setAnalytics(analyticsData);
  }

  useEffect(() => {
    load().catch(error => setMessage(error.message));
  }, [status, subject]); // eslint-disable-line react-hooks/exhaustive-deps

  function runSearch(event) {
    event.preventDefault();
    load().catch(error => setMessage(error.message));
  }

  function toggleSelected(id) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function remove(item) {
    if (!window.confirm(`Supprimer « ${item.slug} » ?`)) return;
    try {
      await api.del(`/superadmin/study/lessons/${item.id}`);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function duplicate(item) {
    try {
      const { item: copy } = await api.post(`/superadmin/study/lessons/${item.id}/duplicate`, {});
      setMessage(`Dupliqué sous « ${copy.slug} ».`);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function bulk(action) {
    if (!selected.size) return;
    if (action === 'delete' && !window.confirm(`Supprimer ${selected.size} leçon(s) ?`)) return;
    try {
      await api.post('/superadmin/study/bulk', { ids: [...selected], action });
      setSelected(new Set());
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  const chartData = useMemo(() => (analytics?.bySubject || []).map(row => ({ name: row.subject, value: row.views })), [analytics]);
  const subjects = useMemo(() => [...new Set(items.map(i => i.subject).filter(Boolean))].sort(), [items]);
  const columns = useMemo(() => [
    { key:'select', label:'Sélection', sortable:false, width:42, render:item => <input type="checkbox" aria-label={`Sélectionner ${item.slug}`} checked={selected.has(item.id)} onChange={() => toggleSelected(item.id)}/> },
    { key:'title', label:'Leçon', value:item => (item.translations || []).find(t => t.language === 'en')?.title || item.slug, render:item => { const title=(item.translations || []).find(t => t.language === 'en')?.title || item.slug; const meta=`${item.slug}${item.featured?' · ★ à la une':''}`; return <ArticleIdentity image={item.thumbnail_url || item.cover_image_url} title={title} subtitle={meta}/>; } },
    { key:'subject', label:'Matière', value:item => item.subject || '' },
    { key:'grade', label:'Niveau', value:item => item.grade || '' },
    { key:'difficulty', label:'Difficulté', value:item => item.difficulty || '' },
    { key:'access', label:'Accès', value:item => Number(Boolean(item.premium)), render:item => <AccessBadge premium={Boolean(item.premium)}/> },
    { key:'duration', label:'Durée', value:item => Number(item.estimated_duration_minutes || 0), render:item => item.estimated_duration_minutes ? `${item.estimated_duration_minutes} min` : '—' },
    { key:'status', label:'Statut', value:item => item.status, render:item => item.status === 'published' ? 'Publié' : 'Brouillon' },
    { key:'views', label:'Lectures', value:item => Number(item.view_count || 0) },
    { key:'actions', label:'Actions', sortable:false, render:item => { const title=(item.translations || []).find(t => t.language === 'en')?.title || item.slug; return <div style={{display:'flex',gap:6}}><Link className="btn btn-secondary" to={`/admin/study/lessons/${item.id}/edit`} aria-label={`Modifier ${title}`}><FileEdit size={16}/></Link><button type="button" className="btn btn-secondary" onClick={() => duplicate(item)} aria-label={`Dupliquer ${title}`}><Copy size={16}/></button><button type="button" className="btn btn-danger" onClick={() => remove(item)} aria-label={`Supprimer ${title}`}><Trash2 size={16}/></button></div>; } },
  ], [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div style={{ display: 'grid', gap: 18 }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <div><h1 style={{ margin: 0 }}>Study — Leçons iFilino Kids</h1><p style={{ margin: '5px 0 0', color: '#6b7280' }}>Import de packages, publication et performances.</p></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Link className="btn btn-secondary" to="/dashboard/ai/imports"><Upload size={17}/> Importer un package ZIP</Link>
        <Link className="btn btn-primary" to="/admin/study/lessons/new"><Plus size={17}/> Nouvelle leçon</Link>
      </div>
    </header>

    {message && <div className="alert alert-info" role="status">{message}</div>}

    {analytics && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
      {[
        ['Leçons', analytics.summary.lessons, FileEdit],
        ['Publiées', analytics.summary.published, Plus],
        ['Brouillons', analytics.summary.drafts, BarChart3],
        ['Premium', analytics.summary.premium, Star],
        ['Lectures', analytics.summary.views, Eye],
      ].map(([label, value, Icon]) => <div className="if-card" style={{ padding: 16 }} key={label}><Icon size={20}/><strong style={{ display: 'block', fontSize: 25, marginTop: 8 }}>{value}</strong><span style={{ color: '#6b7280', fontSize: 12 }}>{label}</span></div>)}
    </div>}

    <div className="if-card" style={{ padding: 18 }}><h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Lectures par matière</h2><RankBarChart data={chartData} height={240}/></div>

    <form onSubmit={runSearch} className="if-card" style={{ padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <input className="form-control" style={{ maxWidth: 220 }} placeholder="Rechercher (slug)" value={search} onChange={e => setSearch(e.target.value)}/>
      <select className="form-select" style={{ maxWidth: 160 }} value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">Tous statuts</option>
        <option value="published">Publié</option>
        <option value="draft">Brouillon</option>
      </select>
      <select className="form-select" style={{ maxWidth: 180 }} value={subject} onChange={e => setSubject(e.target.value)}>
        <option value="">Toutes matières</option>
        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <button type="submit" className="btn btn-secondary">Filtrer</button>
      <div style={{ flex: 1 }}/>
      {selected.size > 0 && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color: '#6b7280', fontSize: 13 }}>{selected.size} sélectionnée(s)</span>
        <button type="button" className="btn btn-secondary" onClick={() => bulk('publish')}>Publier</button>
        <button type="button" className="btn btn-secondary" onClick={() => bulk('unpublish')}>Dépublier</button>
        <button type="button" className="btn btn-secondary" onClick={() => bulk('feature')}>Mettre en avant</button>
        <button type="button" className="btn btn-secondary" onClick={() => bulk('unfeature')}>Retirer avant</button>
        <button type="button" className="btn btn-danger" onClick={() => bulk('delete')}>Supprimer</button>
      </div>}
    </form>

    <AdminContentTable items={items} columns={columns} categoryKey={item => item.subject || 'Sans matière'} categoryLabel="Matières Study" emptyMessage="Aucune leçon pour ces filtres. Utilisez « Importer un package ZIP » ou « Nouvelle leçon »."/>
  </div>;
}
